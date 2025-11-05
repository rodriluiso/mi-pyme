# Checklist de Producción - Sistema PYME

## 📋 Antes de ir a Producción

### Seguridad ✓

#### Django Settings
- [ ] `DEBUG = False` en producción
- [ ] `SECRET_KEY` usando variable de entorno (nunca hardcodeado)
- [ ] `ALLOWED_HOSTS` configurado correctamente
- [ ] `SECURE_SSL_REDIRECT = True` (si usas HTTPS)
- [ ] `SESSION_COOKIE_SECURE = True` (si usas HTTPS)
- [ ] `CSRF_COOKIE_SECURE = True` (si usas HTTPS)
- [ ] `SECURE_HSTS_SECONDS` configurado (si usas HTTPS)
- [ ] Quitar claves/passwords de archivos de configuración

#### Base de Datos
- [ ] Usar PostgreSQL (no SQLite en producción)
- [ ] Usuario de BD con contraseña fuerte
- [ ] Usuario de BD con privilegios mínimos necesarios
- [ ] Configurar límite de conexiones
- [ ] Habilitar logging de queries lentas

#### Archivos y Configuración
- [ ] `.env` no está en Git (verificar `.gitignore`)
- [ ] Archivos `__pycache__` ignorados
- [ ] `node_modules` ignorado
- [ ] Secrets rotativos documentados
- [ ] Documentación de configuración actualizada

#### Usuarios y Accesos
- [ ] Cambiar contraseña del superusuario Django
- [ ] Eliminar usuarios de prueba
- [ ] Deshabilitar registro público (si aplica)
- [ ] Configurar permisos por rol correctamente
- [ ] 2FA para admin (opcional pero recomendado)

---

### Performance ⚡

#### Backend
- [ ] Gunicorn configurado con workers apropiados
- [ ] Timeout configurado (120s recomendado)
- [ ] Keep-alive configurado
- [ ] Max requests por worker
- [ ] Database connection pooling
- [ ] Índices de BD optimizados

#### Frontend
- [ ] Build de producción generado (`npm run build`)
- [ ] Assets minificados
- [ ] Source maps deshabilitados (o separados)
- [ ] Lazy loading implementado
- [ ] Images optimizadas

#### Servidor Web
- [ ] Gzip/Brotli compression habilitado
- [ ] Cache headers configurados
- [ ] CDN para assets estáticos (opcional)
- [ ] Rate limiting configurado
- [ ] Client max body size apropiado

---

### Backup y Recuperación 💾

#### Sistema de Backup
- [ ] Script de backup automático configurado
- [ ] Backup diario de base de datos
- [ ] Backup semanal completo
- [ ] Backup de archivos media
- [ ] Backup de configuración (.env, nginx, etc.)
- [ ] Backups almacenados fuera del servidor

#### Retención
- [ ] Policy de retención definida (ej: 30 días)
- [ ] Limpieza automática de backups antiguos
- [ ] Backup offsite configurado (opcional)
- [ ] Backup encryption (para datos sensibles)

#### Recuperación
- [ ] Procedimiento de restore documentado
- [ ] Restore probado al menos 1 vez
- [ ] RTO (Recovery Time Objective) definido
- [ ] RPO (Recovery Point Objective) definido

---

### Monitoring y Logs 📊

#### Logs
- [ ] Django logging configurado
- [ ] Nginx access/error logs
- [ ] Gunicorn logs
- [ ] Log rotation configurado (logrotate)
- [ ] Logs centralizados (opcional)

#### Monitoring
- [ ] Uptime monitoring (UptimeRobot, Pingdom, etc.)
- [ ] Health check endpoint (`/health/`)
- [ ] Email/SMS alerts configurados
- [ ] Disk space monitoring
- [ ] CPU/RAM monitoring
- [ ] Database monitoring

#### Métricas
- [ ] Request/response time
- [ ] Error rate
- [ ] Database query time
- [ ] Usuarios activos
- [ ] Transacciones por minuto

---

### Infraestructura 🏗️

#### Servidor
- [ ] SO actualizado
- [ ] Firewall configurado (UFW, iptables)
- [ ] SSH con key-based auth
- [ ] SSH puerto cambiado (opcional)
- [ ] Fail2ban instalado (opcional)
- [ ] Automatic security updates

#### Red
- [ ] Dominio configurado
- [ ] DNS apuntando correctamente
- [ ] SSL/TLS certificate instalado
- [ ] Certificate auto-renewal configurado
- [ ] CDN configurado (opcional)

#### Servicios
- [ ] PostgreSQL corriendo como servicio
- [ ] Gunicorn corriendo como servicio
- [ ] Nginx corriendo como servicio
- [ ] Servicios configurados para auto-start
- [ ] Health checks en servicios

---

### Testing 🧪

#### Pre-Deploy Testing
- [ ] Tests unitarios pasando
- [ ] Tests de integración pasando
- [ ] Tests E2E críticos pasando
- [ ] Smoke tests definidos
- [ ] Load testing realizado (opcional)

#### Post-Deploy Verification
- [ ] Homepage carga correctamente
- [ ] Login funciona
- [ ] Crear/editar registros funciona
- [ ] Reportes generan correctamente
- [ ] API endpoints responden
- [ ] Admin panel accesible

---

### Documentación 📚

#### Técnica
- [ ] README actualizado
- [ ] Guía de deployment
- [ ] Arquitectura documentada
- [ ] Variables de entorno documentadas
- [ ] API endpoints documentados
- [ ] Procedimientos de backup/restore

#### Usuario
- [ ] Manual de usuario
- [ ] Guía de inicio rápido
- [ ] FAQs
- [ ] Videos tutoriales (opcional)
- [ ] Contacto de soporte definido

---

### Legal y Compliance 📜

- [ ] Términos y condiciones
- [ ] Política de privacidad
- [ ] GDPR compliance (si aplica)
- [ ] Ley de protección de datos local
- [ ] Auditoría de seguridad (recomendado)

---

## 🚀 Checklist de Deployment

### Pre-Deployment
```bash
# 1. Backup del sistema actual (si existe)
bash scripts/backup-vps.sh

# 2. Pull del código más reciente
git pull origin main

# 3. Verificar que todos los tests pasan
cd backend && python manage.py test
cd ../frontend && npm run test

# 4. Build del frontend
cd frontend && npm run build

# 5. Verificar migraciones
cd backend && python manage.py makemigrations --dry-run
```

### Deployment
```bash
# 6. Aplicar migraciones
python manage.py migrate

# 7. Colectar archivos estáticos
python manage.py collectstatic --noinput

# 8. Reiniciar servicios
sudo systemctl restart pyme
sudo systemctl reload nginx

# 9. Verificar servicios
sudo systemctl status pyme
sudo systemctl status nginx
```

### Post-Deployment
```bash
# 10. Verificar logs
sudo tail -f /var/log/pyme/error.log

# 11. Smoke tests
curl http://localhost/
curl http://localhost/api/health/

# 12. Monitorear por 15 minutos
watch -n 5 'sudo systemctl status pyme'
```

---

## 🔥 Rollback Plan

### Si algo sale mal:

```bash
# 1. Detener servicio
sudo systemctl stop pyme

# 2. Revertir código
git reset --hard HEAD~1  # O el commit anterior

# 3. Restaurar base de datos del backup
gunzip < /backups/pyme/db_YYYYMMDD.sql.gz | psql -U pyme_user pyme_db

# 4. Reiniciar
sudo systemctl start pyme
```

---

## 📞 Contactos de Emergencia

```yaml
Soporte Técnico:
  - Nombre: _____________
  - Teléfono: ___________
  - Email: ______________

Hosting/VPS:
  - Proveedor: __________
  - Soporte: ____________
  - Panel: ______________

Base de Datos:
  - Admin: ______________
  - Backup: _____________

DNS/Dominio:
  - Proveedor: __________
  - Panel: ______________
```

---

## 📊 Métricas de Éxito

Definir KPIs post-deployment:

- [ ] Uptime > 99.5% (4h downtime/mes max)
- [ ] Response time < 500ms (promedio)
- [ ] Error rate < 1%
- [ ] Backup success rate 100%
- [ ] Zero security incidents
- [ ] User satisfaction > 80%

---

## 🔄 Mantenimiento Regular

### Diario
- [ ] Verificar uptime
- [ ] Revisar logs de errores
- [ ] Verificar backups

### Semanal
- [ ] Revisar performance metrics
- [ ] Actualizar dependencias (dev environment primero)
- [ ] Limpiar logs antiguos
- [ ] Verificar disk space

### Mensual
- [ ] Security audit
- [ ] Update de SO y paquetes
- [ ] Review de errores recurrentes
- [ ] Test de restore de backup
- [ ] Revisar y optimizar queries lentas

### Trimestral
- [ ] Revisar y actualizar documentación
- [ ] Capacity planning
- [ ] Disaster recovery drill
- [ ] Security penetration test (recomendado)
- [ ] User feedback review

---

## ✅ Certificación Final

Antes de considerar el deployment completo:

```
Yo _________________ certifico que:

✓ He completado todos los items del checklist
✓ He probado el sistema en staging
✓ He realizado backup completo
✓ Tengo plan de rollback listo
✓ He documentado cambios importantes
✓ El equipo está informado del deployment

Fecha: _______________
Firma: _______________
```

---

**Última actualización**: Octubre 2025
**Versión**: 1.0
