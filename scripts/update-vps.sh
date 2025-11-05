#!/bin/bash
# Script para actualizar la aplicación en VPS

set -e

APP_DIR="/home/pyme/app"
APP_USER="pyme"

echo "========================================="
echo "  Actualizando Sistema PYME"
echo "========================================="
echo ""

# Verificar que existe backup reciente
LATEST_BACKUP=$(find /backups/pyme -name "full_backup_*.tar.gz" -mtime -1 2>/dev/null | head -1)
if [ -z "$LATEST_BACKUP" ]; then
    echo "⚠️  ADVERTENCIA: No hay backup reciente (últimas 24h)"
    echo "¿Deseas crear un backup ahora? (s/n)"
    read -r response
    if [[ "$response" =~ ^([sS])$ ]]; then
        bash /home/pyme/app/scripts/backup-vps.sh
    fi
fi

echo "[1/6] Deteniendo servicio..."
sudo systemctl stop pyme

echo "[2/6] Actualizando código..."
cd $APP_DIR
if [ -d ".git" ]; then
    sudo -u $APP_USER git pull
else
    echo "No es un repositorio git. Copia los archivos manualmente."
fi

echo "[3/6] Actualizando dependencias del backend..."
cd $APP_DIR/backend
sudo -u $APP_USER bash <<EOF
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
EOF

echo "[4/6] Aplicando migraciones..."
sudo -u $APP_USER bash <<EOF
source venv/bin/activate
python manage.py migrate
python manage.py collectstatic --noinput
EOF

echo "[5/6] Actualizando frontend..."
cd $APP_DIR/frontend
sudo -u $APP_USER npm install
sudo -u $APP_USER npm run build

echo "[6/6] Reiniciando servicios..."
sudo systemctl start pyme
sudo systemctl reload nginx

# Verificar que el servicio está corriendo
sleep 3
if sudo systemctl is-active --quiet pyme; then
    echo ""
    echo "========================================="
    echo "  ✓ Actualización Completada"
    echo "========================================="
    echo ""
    echo "Estado del servicio:"
    sudo systemctl status pyme --no-pager -l
else
    echo ""
    echo "========================================="
    echo "  ✗ ERROR: El servicio no inició"
    echo "========================================="
    echo ""
    echo "Revisa los logs:"
    echo "sudo journalctl -u pyme -n 50"
    echo "sudo tail -50 /var/log/pyme/error.log"
    exit 1
fi
