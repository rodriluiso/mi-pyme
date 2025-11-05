# MI-PYME Deployment Guide

## 🚀 Quick Start (Server Deployment)

### Prerequisites
- Ubuntu 22.04 LTS (or similar)
- Docker & Docker Compose
- Domain name (for SSL)
- PostgreSQL database (managed or self-hosted)

### 1. Initial Setup

```bash
# Clone repository
git clone <your-repo-url>
cd mi-pyme-dev

# Generate SECRET_KEY
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Copy and configure production env
cp .env.production.example .env.production
nano .env.production
# Fill in:
# - DJANGO_SECRET_KEY (from above)
# - DJANGO_ALLOWED_HOSTS (your domain)
# - DATABASE_URL (PostgreSQL connection string)
# - CORS_ALLOWED_ORIGINS (your domain with https://)
```

### 2. Build Frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### 3. First Deployment

```bash
# Build backend image
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 4. Create Superuser

```bash
docker-compose -f docker-compose.prod.yml exec backend \
    python manage.py createsuperuser
```

### 5. Verify Deployment

```bash
# Health check
curl http://localhost/api/health/

# Admin panel
# Visit: http://your-domain/admin/
```

### 6. SSL Setup (Optional but Recommended)

```bash
# Obtain certificate
docker run -it --rm \
    -v ./certbot/conf:/etc/letsencrypt \
    -v ./certbot/www:/var/www/certbot \
    certbot/certbot certonly --webroot \
    -w /var/www/certbot \
    -d your-domain.com \
    --email admin@your-domain.com \
    --agree-tos

# Update nginx config to enable SSL (uncomment SSL lines in infra/nginx/conf.d/default.conf)

# Restart nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

## 🖥️ Desktop Deployment (Coming Soon)

Desktop packaging with Electron will be added in Phase 2.

## 📊 Monitoring

### Health Checks
- Backend: `http://your-domain/api/health/`
- Readiness: `http://your-domain/api/ready/`

### Logs
```bash
# All services
docker-compose -f docker-compose.prod.yml logs

# Just backend
docker-compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 backend
```

## 🔄 Updates

```bash
# Pull latest code
git pull origin main

# Run deploy script
./scripts/deploy.sh
```

## 💾 Backups

```bash
# Manual backup
./scripts/backup_db.sh

# Automated (add to crontab)
0 2 * * * /path/to/mi-pyme-dev/scripts/backup_db.sh
```

## 🆘 Troubleshooting

See [RUNBOOK.md](RUNBOOK.md) for detailed troubleshooting.

### Common Issues

**Backend won't start:**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs backend

# Common fixes:
# 1. Verify DATABASE_URL is correct
# 2. Check SECRET_KEY is set
# 3. Ensure ALLOWED_HOSTS includes your domain
```

**Database connection errors:**
```bash
# Test database connection
docker-compose -f docker-compose.prod.yml exec backend \
    python manage.py check --database default
```

**Permission errors:**
```bash
# Fix ownership
sudo chown -R $USER:$USER .
```

## 📝 Next Steps

1. ✅ Configure automatic backups (cron job)
2. ✅ Set up monitoring (optional: add Sentry DSN to .env.production)
3. ✅ Configure email sending (SMTP settings)
4. ✅ Review security settings in infra/nginx/conf.d/default.conf
5. ⏳ Desktop packaging (Phase 2)

## 🔐 Security Checklist

- [ ] SECRET_KEY is unique and never committed
- [ ] DEBUG=False in production
- [ ] ALLOWED_HOSTS configured correctly
- [ ] SSL/HTTPS enabled
- [ ] Database uses strong password
- [ ] Backups running automatically
- [ ] Logs monitored regularly

## 📞 Support

For issues, see RUNBOOK.md or contact: [YOUR-EMAIL]
