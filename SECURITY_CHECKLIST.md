# 🔐 MI-PYME Security Checklist - Pre-Deployment

## ✅ Variables de Entorno Críticas

### Obligatorias (BLOQUEANTES)

- [ ] **DJANGO_SECRET_KEY**: Generada con 50+ caracteres aleatorios
  ```bash
  python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
  ```

- [ ] **DATABASE_URL**: Configurada con credenciales seguras de PostgreSQL
  - Usuario NO es "postgres" o "admin"
  - Contraseña tiene 20+ caracteres con símbolos
  - Host NO es público (solo red interna)

- [ ] **DJANGO_ALLOWED_HOSTS**: Lista específica de dominios (NO usar *)
  - Ejemplo: `mipyme.example.com,www.mipyme.example.com`

- [ ] **CORS_ALLOWED_ORIGINS**: Lista específica de orígenes (NO usar *)
  - Ejemplo: `https://mipyme.example.com,https://www.mipyme.example.com`

- [ ] **FERNET_KEY**: Generada para cifrado de datos sensibles
  ```bash
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  ```

### Recomendadas

- [ ] **REDIS_URL**: Configurado con autenticación
  - Formato: `redis://:password@host:6379/0`

- [ ] **EMAIL_HOST_PASSWORD**: Contraseña de aplicación (no contraseña de cuenta)

- [ ] **SENTRY_DSN**: Para monitoreo de errores en producción

## 🔒 Configuración de Seguridad Django

### Settings de Producción

- [ ] **DEBUG = False** (CRÍTICO - verificar en prod.py)

- [ ] **SECURE_SSL_REDIRECT = True** (forzar HTTPS)

- [ ] **SESSION_COOKIE_SECURE = True**

- [ ] **CSRF_COOKIE_SECURE = True**

- [ ] **SECURE_HSTS_SECONDS = 31536000** (1 año)

- [ ] **SECURE_HSTS_INCLUDE_SUBDOMAINS = True**

- [ ] **SECURE_HSTS_PRELOAD = True**

- [ ] **X_FRAME_OPTIONS = 'DENY'**

- [ ] **SECURE_CONTENT_TYPE_NOSNIFF = True**

- [ ] **SECURE_BROWSER_XSS_FILTER = True**

### Rate Limiting (Django Axes)

- [ ] **AXES_FAILURE_LIMIT = 5** (intentos antes de bloqueo)

- [ ] **AXES_COOLOFF_TIME = 1** hora (tiempo de bloqueo)

- [ ] Django Axes está en INSTALLED_APPS

- [ ] AxesMiddleware está en MIDDLEWARE

## 🗄️ Base de Datos

### PostgreSQL

- [ ] Usuario de DB tiene contraseña fuerte (20+ caracteres)

- [ ] Usuario de DB NO tiene permisos de superuser

- [ ] PostgreSQL escucha solo en localhost o red privada

- [ ] Puerto PostgreSQL NO está expuesto públicamente

- [ ] Backups automáticos configurados (ver BACKUP_POLICY.md)

- [ ] Cifrado en tránsito (SSL/TLS) habilitado

### Migraciones

- [ ] Todas las migraciones aplicadas
  ```bash
  python manage.py showmigrations
  ```

- [ ] No hay migraciones pendientes
  ```bash
  python manage.py makemigrations --check --dry-run
  ```

## 🌐 Infraestructura

### Nginx

- [ ] SSL/TLS configurado (Let's Encrypt)

- [ ] Redirección HTTP → HTTPS

- [ ] Headers de seguridad configurados:
  ```nginx
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  ```

- [ ] Rate limiting configurado (limit_req_zone)

- [ ] Tamaño máximo de upload configurado (client_max_body_size)

### Docker

- [ ] Containers corren como usuario no-root

- [ ] Imágenes desde fuentes oficiales

- [ ] No hay secretos hardcoded en Dockerfile

- [ ] .dockerignore excluye archivos sensibles

- [ ] Healthchecks configurados en todos los servicios

### Firewall

- [ ] Solo puertos 80 y 443 abiertos públicamente

- [ ] Puerto 22 (SSH) restringido a IPs específicas

- [ ] Puerto PostgreSQL (5432) NO accesible desde internet

- [ ] Puerto Redis (6379) NO accesible desde internet

## 📝 Archivos Sensibles

### .gitignore

- [ ] `.env` está en .gitignore

- [ ] `*.env` está en .gitignore

- [ ] `db.sqlite3` está en .gitignore

- [ ] `media/` está en .gitignore

- [ ] No hay archivos `.env*` en el repositorio
  ```bash
  git ls-files | grep -E "\.(env|secret|key|pem)"
  ```

### Permisos de Archivos

- [ ] `.env` tiene permisos 600 (solo owner puede leer)
  ```bash
  chmod 600 backend/.env
  ```

- [ ] Scripts tienen permisos apropiados
  ```bash
  chmod +x scripts/*.sh
  ```

- [ ] Directorio de backups tiene permisos 700
  ```bash
  chmod 700 backups/
  ```

## 🔑 Autenticación y Autorización

### Passwords

- [ ] Validadores de contraseña activos (AUTH_PASSWORD_VALIDATORS)

- [ ] Mínimo 8 caracteres

- [ ] No permite contraseñas comunes

- [ ] No permite contraseñas solo numéricas

### Sesiones

- [ ] SESSION_COOKIE_AGE configurado (30 minutos recomendado)

- [ ] SESSION_EXPIRE_AT_BROWSER_CLOSE = True

- [ ] SESSION_COOKIE_HTTPONLY = True (default Django)

- [ ] SESSION_COOKIE_SAMESITE = 'Strict' o 'Lax'

### Usuarios

- [ ] Usuario admin por defecto deshabilitado o con contraseña fuerte

- [ ] No hay usuarios de prueba en producción

- [ ] Permisos configurados correctamente (no todos son superusers)

## 🚀 Deployment

### Pre-Deploy

- [ ] Backup manual creado
  ```bash
  ./scripts/backup_db.sh
  ```

- [ ] Variables de entorno verificadas
  ```bash
  ./scripts/pre_deploy_check.sh
  ```

- [ ] Tests ejecutados y pasando
  ```bash
  python manage.py test
  ```

- [ ] Código revisado (no hay credenciales hardcoded)

### Post-Deploy

- [ ] Health check responde correctamente
  ```bash
  curl https://tu-dominio.com/api/health/
  ```

- [ ] Logs no muestran errores
  ```bash
  docker-compose logs -f backend
  ```

- [ ] SSL/TLS funcionando (A+ en SSL Labs)

- [ ] Funcionalidad crítica testeada manualmente

## 📊 Monitoreo

### Logs

- [ ] Logs estructurados (JSON en producción)

- [ ] Rotación de logs configurada (max 10MB, 3 archivos)

- [ ] No se loguean datos sensibles (contraseñas, tokens)

### Alertas

- [ ] Alertas de error configuradas (Sentry, email, etc.)

- [ ] Alertas de disponibilidad (uptime monitoring)

- [ ] Alertas de uso de recursos (CPU, RAM, disco)

- [ ] Alertas de backups fallidos

## 🧪 Testing de Seguridad

### Escaneos Básicos

- [ ] Escaneo de puertos (nmap)
  ```bash
  nmap -sV tu-dominio.com
  ```

- [ ] Verificación de headers HTTP
  ```bash
  curl -I https://tu-dominio.com
  ```

- [ ] Test de OWASP Top 10 básico

### Vulnerabilidades Conocidas

- [ ] Dependencias actualizadas
  ```bash
  pip list --outdated
  ```

- [ ] No hay CVEs críticos en dependencias
  ```bash
  pip-audit
  ```

- [ ] Django actualizado a última versión de seguridad

## 📋 Compliance y Documentación

- [ ] Política de backup documentada (BACKUP_POLICY.md)

- [ ] Runbook de incidentes (RUNBOOK.md)

- [ ] Contactos de emergencia actualizados

- [ ] Plan de recuperación de desastres probado

- [ ] Política de retención de datos definida

## ⚠️ Blockers Críticos

**NO DEPLOYAR si alguno de estos NO está marcado:**

1. [ ] DEBUG = False
2. [ ] DJANGO_SECRET_KEY configurada y única
3. [ ] DATABASE_URL apunta a PostgreSQL (no SQLite)
4. [ ] ALLOWED_HOSTS NO incluye '*'
5. [ ] SSL/TLS certificado instalado
6. [ ] Backup automático funcionando
7. [ ] Health check endpoint responde

---

**Verificado por**: ________________
**Fecha**: ________________
**Versión de deploy**: ________________
