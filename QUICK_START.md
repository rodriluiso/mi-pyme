# MI-PYME Quick Start

## 🚀 Deploy en 5 Minutos

### 1. Clonar y Configurar (2 min)

```bash
git clone <tu-repo-url>
cd mi-pyme-dev

# Generar SECRET_KEY
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Configurar
cp .env.production.example .env.production
nano .env.production
# Pega el SECRET_KEY y configura DATABASE_URL, ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS
```

### 2. Build Frontend (1 min)

```bash
cd frontend
npm install
npm run build
cd ..
```

### 3. Deploy (2 min)

```bash
# Verificar pre-requisitos
./scripts/pre_deploy_check.sh

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Esperar y verificar
sleep 10
curl http://localhost/api/health/
```

### 4. Crear Admin

```bash
docker-compose -f docker-compose.prod.yml exec backend \
    python manage.py createsuperuser
```

## ✅ Listo!

Accede a: `http://tu-servidor/admin/`

---

## 🔧 Comandos Útiles

```bash
# Ver logs
docker-compose -f docker-compose.prod.yml logs -f

# Reiniciar
docker-compose -f docker-compose.prod.yml restart backend

# Parar todo
docker-compose -f docker-compose.prod.yml down

# Backup
./scripts/backup_db.sh

# Deploy actualización
./scripts/deploy.sh
```

## 🆘 Si Algo Falla

```bash
# Ver logs de errores
docker-compose -f docker-compose.prod.yml logs --tail=50 backend

# Verificar salud
curl http://localhost/api/health/

# Limpiar y reintentar
docker-compose -f docker-compose.prod.yml down
docker system prune -af
docker-compose -f docker-compose.prod.yml up -d --build
```

## 📚 Más Info

- **Despliegue completo:** [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Operaciones:** [RUNBOOK.md](RUNBOOK.md)
- **Estado actual:** [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)
