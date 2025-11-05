#!/bin/bash
# Script de deployment para VPS Linux (Ubuntu/Debian)

set -e  # Salir si hay error

echo "========================================"
echo "  Deployment Sistema PYME - VPS Linux"
echo "========================================"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
APP_USER="pyme"
APP_DIR="/home/$APP_USER/app"
PYTHON_VERSION="3.11"

echo -e "${GREEN}[1/10] Actualizando sistema...${NC}"
sudo apt update
sudo apt upgrade -y

echo -e "${GREEN}[2/10] Instalando dependencias del sistema...${NC}"
sudo apt install -y \
    python3.11 python3.11-venv python3-pip \
    postgresql postgresql-contrib \
    nginx \
    git \
    nodejs npm \
    certbot python3-certbot-nginx

echo -e "${GREEN}[3/10] Configurando PostgreSQL...${NC}"
if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw pyme_db; then
    echo "Creando base de datos..."
    sudo -u postgres psql <<EOF
CREATE DATABASE pyme_db;
CREATE USER pyme_user WITH PASSWORD 'change_this_password';
GRANT ALL PRIVILEGES ON DATABASE pyme_db TO pyme_user;
ALTER USER pyme_user CREATEDB;
EOF
    echo -e "${YELLOW}¡IMPORTANTE! Cambia la contraseña de PostgreSQL en el archivo .env${NC}"
else
    echo "Base de datos ya existe, omitiendo..."
fi

echo -e "${GREEN}[4/10] Creando usuario de aplicación...${NC}"
if ! id "$APP_USER" &>/dev/null; then
    sudo adduser --disabled-password --gecos "" $APP_USER
fi

echo -e "${GREEN}[5/10] Clonando o actualizando código...${NC}"
if [ ! -d "$APP_DIR" ]; then
    echo "¿URL del repositorio Git? (deja vacío para copiar archivos locales)"
    read GIT_REPO
    if [ -z "$GIT_REPO" ]; then
        sudo mkdir -p $APP_DIR
        sudo cp -r . $APP_DIR/
    else
        sudo -u $APP_USER git clone $GIT_REPO $APP_DIR
    fi
else
    cd $APP_DIR
    sudo -u $APP_USER git pull || echo "No es un repositorio git, omitiendo..."
fi

sudo chown -R $APP_USER:$APP_USER $APP_DIR

echo -e "${GREEN}[6/10] Configurando Backend...${NC}"
cd $APP_DIR/backend

# Crear entorno virtual
if [ ! -d "venv" ]; then
    sudo -u $APP_USER python3.11 -m venv venv
fi

# Instalar dependencias
sudo -u $APP_USER bash <<EOF
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn psycopg2-binary
EOF

# Configurar .env
if [ ! -f ".env" ]; then
    sudo -u $APP_USER cp .env.example .env

    # Generar SECRET_KEY
    SECRET_KEY=$(python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')

    sudo -u $APP_USER bash <<EOF
cat > .env <<EOL
DJANGO_SECRET_KEY=$SECRET_KEY
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
POSTGRES_DB=pyme_db
POSTGRES_USER=pyme_user
POSTGRES_PASSWORD=change_this_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
ALLOWED_ORIGIN=http://localhost
EOL
EOF

    echo -e "${YELLOW}Configurar .env con tu dominio y contraseñas!${NC}"
fi

# Actualizar settings.py para usar PostgreSQL
sudo -u $APP_USER bash <<'EOF'
source venv/bin/activate
python manage.py migrate
python manage.py collectstatic --noinput

# Crear superusuario si no existe
echo "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.filter(username='admin').exists() or User.objects.create_superuser('admin', 'admin@example.com', 'admin123')" | python manage.py shell
EOF

echo -e "${GREEN}[7/10] Configurando Frontend...${NC}"
cd $APP_DIR/frontend
sudo -u $APP_USER npm install
sudo -u $APP_USER npm run build

echo -e "${GREEN}[8/10] Configurando servicio Gunicorn...${NC}"
sudo mkdir -p /var/log/pyme
sudo chown $APP_USER:www-data /var/log/pyme

sudo tee /etc/systemd/system/pyme.service > /dev/null <<EOF
[Unit]
Description=PYME Django Application
After=network.target

[Service]
Type=notify
User=$APP_USER
Group=www-data
WorkingDirectory=$APP_DIR/backend
Environment="PATH=$APP_DIR/backend/venv/bin"
ExecStart=$APP_DIR/backend/venv/bin/gunicorn \\
    --workers 4 \\
    --bind unix:/run/pyme.sock \\
    --timeout 120 \\
    --access-logfile /var/log/pyme/access.log \\
    --error-logfile /var/log/pyme/error.log \\
    core.wsgi:application

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable pyme
sudo systemctl restart pyme

echo -e "${GREEN}[9/10] Configurando Nginx...${NC}"
sudo tee /etc/nginx/sites-available/pyme > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;  # Cambiar por tu dominio

    client_max_body_size 20M;

    # Frontend
    location / {
        root /home/pyme/app/frontend/dist;
        try_files $uri $uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://unix:/run/pyme.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Admin Django
    location /admin {
        proxy_pass http://unix:/run/pyme.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Archivos estáticos Django
    location /static/ {
        alias /home/pyme/app/backend/staticfiles/;
    }

    location /media/ {
        alias /home/pyme/app/backend/media/;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/pyme /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

echo -e "${GREEN}[10/10] Configurando Firewall...${NC}"
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw --force enable

echo ""
echo "========================================"
echo -e "${GREEN}  ✓ Deployment Completado${NC}"
echo "========================================"
echo ""
echo "INFORMACIÓN IMPORTANTE:"
echo "----------------------"
echo "1. Usuario admin creado: admin / admin123"
echo "   ${YELLOW}¡CÁMBIALO INMEDIATAMENTE!${NC}"
echo ""
echo "2. Edita la configuración:"
echo "   sudo nano $APP_DIR/backend/.env"
echo "   - Cambia DJANGO_ALLOWED_HOSTS a tu dominio"
echo "   - Cambia POSTGRES_PASSWORD"
echo ""
echo "3. Para SSL/HTTPS:"
echo "   sudo certbot --nginx -d tudominio.com"
echo ""
echo "4. Comandos útiles:"
echo "   sudo systemctl status pyme    # Ver estado"
echo "   sudo systemctl restart pyme   # Reiniciar"
echo "   sudo tail -f /var/log/pyme/error.log  # Ver logs"
echo ""
echo "5. Accede a:"
echo "   Web: http://$(curl -s ifconfig.me)"
echo "   Admin: http://$(curl -s ifconfig.me)/admin"
echo ""
echo "========================================"
