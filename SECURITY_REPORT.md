# 🔒 Informe de Seguridad - Sistema Mi PyME

**Fecha del análisis:** 28 de Octubre de 2025
**Versión analizada:** 1.0
**Nivel de Riesgo:** 🟡 **MEDIO-ALTO** (desarrollo) → 🔴 **ALTO** (sin mejoras en producción)

---

## 📊 Resumen Ejecutivo

He realizado un análisis exhaustivo de seguridad de tu aplicación Mi PyME. El sistema tiene **bases sólidas** con muchas configuraciones correctas, pero también presenta **vulnerabilidades críticas** que deben resolverse antes de producción.

### **Puntuación de Seguridad: 6.5/10**

**Aspectos Positivos:**
- ✅ Autenticación y autorización bien implementadas
- ✅ CSRF y CORS configurados correctamente
- ✅ Sistema de auditoría con logs de acceso
- ✅ Configuraciones HTTPS para producción
- ✅ Validadores de contraseña activos

**Áreas Críticas a Mejorar:**
- 🚨 Archivo .env commitido con credenciales
- 🚨 SQLite en lugar de PostgreSQL
- ⚠️ Sin rate limiting contra fuerza bruta
- ⚠️ Contraseña de reset hardcoded

---

## 🚨 Vulnerabilidades CRÍTICAS (Resolver URGENTE)

### 1. Archivo .env Expuesto en el Repositorio
**Severidad:** 🔴 **CRÍTICA**

**El Problema:**
```bash
# backend/.env está en el repo con:
DJANGO_SECRET_KEY=f%x-e8@n))ms3ezln%fgrxwnq2km@ps%)&j0+qp)9bk$upqqzm
POSTGRES_PASSWORD=app
```

**Por qué es peligroso:**
- Cualquiera con acceso al repo puede ver las credenciales
- El SECRET_KEY compromete toda la seguridad (sesiones, cookies, tokens)
- Las credenciales quedan en el historial de Git PERMANENTEMENTE

**Solución INMEDIATA:**
```bash
# 1. Remover del repositorio
git rm --cached backend/.env
git commit -m "security: remove .env from repository"
git push

# 2. Regenerar SECRET_KEY
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'

# 3. Actualizar .env con la nueva key
# 4. NUNCA commitear archivos .env
```

### 2. SQLite en Producción
**Severidad:** 🔴 **CRÍTICA**

**El Problema:**
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',  # ❌ NO para producción
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}
```

**Por qué SQLite NO sirve para producción:**
- ❌ No soporta múltiples conexiones concurrentes
- ❌ Sin replicación ni backup automático
- ❌ Archivo único vulnerable a corrupción
- ❌ Rendimiento limitado bajo carga
- ❌ No es seguro para datos críticos de negocio

**Solución:**
```python
# settings.py - Usar PostgreSQL
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('POSTGRES_DB', 'mipyme_prod'),
        'USER': os.getenv('POSTGRES_USER', 'mipyme_user'),
        'PASSWORD': os.getenv('POSTGRES_PASSWORD'),
        'HOST': os.getenv('POSTGRES_HOST', 'localhost'),
        'PORT': os.getenv('POSTGRES_PORT', '5432'),
        'CONN_MAX_AGE': 600,
        'OPTIONS': {
            'sslmode': 'require',  # En producción
        }
    }
}
```

### 3. Contraseña de Reset Predecible
**Severidad:** 🔴 **ALTA**

**El Problema:**
```python
def resetear_password(self, request, pk=None):
    nueva_password = "temp123456"  # ❌ Hardcoded!
```

**Riesgos:**
- Cualquiera que lea el código sabe la contraseña temporal
- Atacante puede resetear y acceder con contraseña conocida

**Solución:**
```python
import secrets
import string

def resetear_password(self, request, pk=None):
    """Resetear contraseña con token seguro"""
    usuario = self.get_object()

    # Generar contraseña aleatoria de 16 caracteres
    alphabet = string.ascii_letters + string.digits + string.punctuation
    nueva_password = ''.join(secrets.choice(alphabet) for _ in range(16))

    usuario.set_password(nueva_password)
    usuario.debe_cambiar_password = True  # Flag para forzar cambio
    usuario.save()

    # TODO: Enviar por email, NO retornar en respuesta
    # send_secure_email(usuario.email, nueva_password)

    LogAcceso.objects.create(
        usuario=request.user,
        accion=f"Reseteó contraseña de: {usuario.username}",
        modulo="usuarios",
        ip_address=self.get_client_ip(request)
    )

    return Response({
        "mensaje": f"Contraseña reseteada. Se envió email a {usuario.email}"
        # NO incluir la contraseña aquí
    })
```

---

## ⚠️ Vulnerabilidades de ALTA Prioridad

### 4. Sin Rate Limiting (Protección contra Fuerza Bruta)
**Severidad:** 🟠 **ALTA**

**El Problema:**
No hay límite de intentos de login. Un atacante puede probar miles de contraseñas.

**Solución - Opción 1: Django Axes (Recomendado)**
```bash
pip install django-axes
```

```python
# settings.py
INSTALLED_APPS += ['axes']

MIDDLEWARE += [
    'axes.middleware.AxesMiddleware',
]

AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesStandaloneBackend',  # Debe ir primero
    'django.contrib.auth.backends.ModelBackend',
]

# Configuración de Axes
AXES_FAILURE_LIMIT = 5  # Bloquear después de 5 intentos fallidos
AXES_COOLOFF_TIME = 1  # Bloquear por 1 hora
AXES_LOCKOUT_CALLABLE = 'axes.lockout.lockout_by_combination'
AXES_RESET_ON_SUCCESS = True
```

**Solución - Opción 2: Django Ratelimit (Más simple)**
```bash
pip install django-ratelimit
```

```python
# usuarios/views.py
from django_ratelimit.decorators import ratelimit

class AuthViewSet(viewsets.ViewSet):
    @ratelimit(key='ip', rate='5/h', method='POST')  # 5 intentos por hora por IP
    @action(detail=False, methods=['post'])
    def login(self, request):
        # Tu código de login...
        pass
```

### 5. Validación de Contraseñas Débil
**Severidad:** 🟠 **MEDIA-ALTA**

**El Problema:**
Los validadores de Django son básicos. Permiten contraseñas como "Password1".

**Solución - Validador Personalizado:**
```python
# usuarios/validators.py
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _
import re

class StrongPasswordValidator:
    """
    Validador de contraseñas fuertes para entorno empresarial
    """
    def validate(self, password, user=None):
        if len(password) < 12:
            raise ValidationError(
                _("La contraseña debe tener al menos 12 caracteres."),
                code='password_too_short',
            )

        if not re.search(r'[A-Z]', password):
            raise ValidationError(
                _("La contraseña debe contener al menos una letra mayúscula."),
                code='password_no_upper',
            )

        if not re.search(r'[a-z]', password):
            raise ValidationError(
                _("La contraseña debe contener al menos una letra minúscula."),
                code='password_no_lower',
            )

        if not re.search(r'\d', password):
            raise ValidationError(
                _("La contraseña debe contener al menos un número."),
                code='password_no_digit',
            )

        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            raise ValidationError(
                _("La contraseña debe contener al menos un carácter especial."),
                code='password_no_special',
            )

        # Verificar palabras comunes del negocio
        palabras_prohibidas = ['lacteos', 'roble', 'mipyme', 'admin', 'password']
        for palabra in palabras_prohibidas:
            if palabra.lower() in password.lower():
                raise ValidationError(
                    _("La contraseña no puede contener palabras comunes del negocio."),
                    code='password_too_common',
                )

    def get_help_text(self):
        return _(
            "Tu contraseña debe tener al menos 12 caracteres, "
            "incluyendo mayúsculas, minúsculas, números y caracteres especiales."
        )

# settings.py
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 12}
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
    {
        'NAME': 'usuarios.validators.StrongPasswordValidator',  # ← Agregar
    },
]
```

### 6. Certificados AFIP Sin Protección
**Severidad:** 🟠 **ALTA**

**El Problema:**
```python
certificado_afip = models.FileField(upload_to='certificados/')  # ❌ Sin encriptar
clave_privada_afip = models.FileField(upload_to='certificados/')  # ❌ Muy peligroso
```

Las claves privadas de AFIP están almacenadas sin encriptar. Si alguien accede al servidor, puede firmar facturas en tu nombre.

**Solución:**
```bash
pip install django-fernet-fields cryptography
```

```python
# configuracion/models.py
from fernet_fields import EncryptedFileField

class ConfiguracionEmpresa(models.Model):
    # Campos encriptados
    certificado_afip = EncryptedFileField(
        upload_to='certificados/',
        blank=True,
        null=True,
    )
    clave_privada_afip = EncryptedFileField(
        upload_to='certificados/',
        blank=True,
        null=True,
    )

# settings.py - Agregar key de encriptación
from cryptography.fernet import Fernet

# Generar una vez: Fernet.generate_key()
FERNET_KEYS = [os.getenv('FERNET_KEY')]  # Guardar en .env

# .env
FERNET_KEY=<generar con: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
```

---

## 📋 Vulnerabilidades de Prioridad MEDIA

### 7. Datos Sensibles Sin Encriptar en DB
**Problema:** CUIT, CBU, CAI están en texto plano en la base de datos.

```python
# Solución con django-fernet-fields
from fernet_fields import EncryptedCharField

class Cliente(models.Model):
    identificacion = EncryptedCharField(max_length=20)  # CUIT/DNI encriptado

class ConfiguracionEmpresa(models.Model):
    cai = EncryptedCharField(max_length=50)
    banco_cbu = EncryptedCharField(max_length=22)
```

### 8. Sin Content Security Policy (CSP)
**Problema:** No hay protección contra XSS mediante CSP headers.

```bash
pip install django-csp
```

```python
# settings.py
MIDDLEWARE += ['csp.middleware.CSPMiddleware']

CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = ("'self'", "'unsafe-inline'", "'unsafe-eval'")  # Ajustar según necesidad
CSP_STYLE_SRC = ("'self'", "'unsafe-inline'")
CSP_IMG_SRC = ("'self'", "data:", "https:")
CSP_FONT_SRC = ("'self'", "data:")
CSP_CONNECT_SRC = ("'self'", "http://localhost:8000")
```

### 9. Sin Validación de Archivos Subidos
**Problema:** FileFields sin validación de tipo/tamaño.

```python
from django.core.validators import FileExtensionValidator
from django.core.exceptions import ValidationError

class ConfiguracionEmpresa(models.Model):
    logo = models.ImageField(
        upload_to='empresa/',
        validators=[
            FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png', 'webp']),
        ],
        help_text="Máximo 5MB. Formatos: JPG, PNG, WEBP"
    )

    def clean(self):
        super().clean()

        # Validar tamaño
        if self.logo and self.logo.size > 5 * 1024 * 1024:  # 5MB
            raise ValidationError("El logo no puede exceder 5MB")

        # Validar dimensiones (opcional)
        if self.logo:
            from PIL import Image
            img = Image.open(self.logo)
            if img.width > 2000 or img.height > 2000:
                raise ValidationError("El logo no puede exceder 2000x2000 px")
```

### 10. Logs Sin Rotación
**Problema:** Los logs pueden crecer indefinidamente.

```python
# settings.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'django.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 10,
            'formatter': 'verbose',
        },
        'security': {
            'level': 'WARNING',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'security.log'),
            'maxBytes': 10 * 1024 * 1024,
            'backupCount': 10,
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file'],
            'level': 'INFO',
        },
        'django.security': {
            'handlers': ['security'],
            'level': 'WARNING',
        },
    },
}

# Crear directorio de logs
import os
os.makedirs(os.path.join(BASE_DIR, 'logs'), exist_ok=True)
```

---

## 🎯 Plan de Acción Inmediato (7 días)

### **Día 1-2: CRÍTICO** 🚨
- [ ] **Remover .env del repositorio**
  ```bash
  git rm --cached backend/.env
  git commit -m "security: remove .env"
  ```
- [ ] **Regenerar SECRET_KEY**
- [ ] **Cambiar todas las contraseñas de DB**
- [ ] **Crear .env.example como plantilla**
- [ ] **Implementar contraseñas aleatorias en reset**

### **Día 3-4: ALTO** ⚠️
- [ ] **Configurar PostgreSQL**
  - Instalar PostgreSQL
  - Migrar datos de SQLite
  - Actualizar settings.py
  - Configurar backups automáticos
- [ ] **Implementar rate limiting** (django-axes)
- [ ] **Mejorar validación de contraseñas**

### **Día 5-7: MEDIO** 📋
- [ ] **Configurar CSP headers**
- [ ] **Implementar rotación de logs**
- [ ] **Validar archivos subidos**
- [ ] **Encriptar datos sensibles** (opcional pero recomendado)
- [ ] **Documentar procedimientos de seguridad**

---

## 🛡️ Configuración Recomendada para Producción

### Archivo .env.example (Plantilla)
```bash
# ===================================
# CONFIGURACIÓN DE PRODUCCIÓN
# ===================================
# IMPORTANTE: NO commitear este archivo con valores reales

# Django Core
DJANGO_SECRET_KEY=<generar con: python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=tudominio.com,www.tudominio.com

# Database PostgreSQL
POSTGRES_DB=mipyme_prod
POSTGRES_USER=mipyme_user
POSTGRES_PASSWORD=<contraseña segura de 20+ caracteres>
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# CORS
ALLOWED_ORIGIN=https://tudominio.com

# Encriptación de archivos
FERNET_KEY=<generar con: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">

# Email (para recuperación de contraseñas)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=tu@email.com
EMAIL_HOST_PASSWORD=<app password de Gmail>

# Monitoreo (opcional)
SENTRY_DSN=https://...

# Security
SECURE_SSL_REDIRECT=True
```

### Script de Backup Automático
```bash
#!/bin/bash
# scripts/backup_db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="mipyme_prod"

# Crear backup
pg_dump -U mipyme_user $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Eliminar backups antiguos (mantener últimos 30 días)
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete

# Log
echo "[$DATE] Backup creado: db_$DATE.sql.gz" >> $BACKUP_DIR/backup.log
```

```bash
# Agendar en crontab (todos los días a las 3am)
0 3 * * * /app/scripts/backup_db.sh
```

---

## 📚 Recursos Adicionales

### Herramientas de Seguridad
```bash
# Instalar herramientas de análisis
pip install bandit safety

# Escanear código en busca de vulnerabilidades
bandit -r backend/ -f json -o security_report.json

# Verificar dependencias con vulnerabilidades conocidas
safety check --json

# Actualizar dependencias
pip list --outdated
```

### Testing de Seguridad
```python
# tests/security/test_auth.py
from django.test import TestCase
from django.urls import reverse

class SecurityTestCase(TestCase):
    def test_rate_limiting_login(self):
        """Verificar que rate limiting funciona"""
        url = reverse('auth-login')

        # Intentar login 10 veces
        for _ in range(10):
            response = self.client.post(url, {
                'username': 'atacante',
                'password': 'wrongpass'
            })

        # El décimo intento debe ser bloqueado
        self.assertEqual(response.status_code, 429)  # Too Many Requests

    def test_password_reset_randomness(self):
        """Verificar que contraseñas de reset son aleatorias"""
        passwords = set()

        for _ in range(100):
            response = self.client.post('/api/usuarios/1/resetear_password/')
            # Aquí deberías mockear el envío de email para capturar la password
            password = response.data['password_temporal']
            passwords.add(password)

        # Todas deben ser diferentes
        self.assertEqual(len(passwords), 100)
```

### Monitoreo con Sentry
```bash
pip install sentry-sdk
```

```python
# settings.py
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[DjangoIntegration()],
    traces_sample_rate=0.1,
    send_default_pii=False,  # No enviar datos personales
    environment="production",
)
```

---

## ✅ Checklist de Seguridad Pre-Producción

### Backend
- [ ] Migrado a PostgreSQL
- [ ] Archivo .env removido del repo
- [ ] SECRET_KEY regenerada
- [ ] Rate limiting implementado
- [ ] Backups automáticos configurados
- [ ] HTTPS habilitado con certificado SSL válido
- [ ] Logs con rotación configurada
- [ ] Contraseñas de reset aleatorias
- [ ] Datos sensibles encriptados en DB
- [ ] CSP headers configurados
- [ ] Validación de archivos subidos
- [ ] 2FA implementado para admins (opcional)

### Frontend
- [ ] Variables de entorno en .env (no en código)
- [ ] HTTPS only (no HTTP)
- [ ] Logout automático por inactividad
- [ ] Validación de inputs en cliente
- [ ] Sanitización de output

### Infraestructura
- [ ] Firewall configurado (solo puertos 80, 443, 22)
- [ ] SSH con keys (no passwords)
- [ ] Fail2ban instalado
- [ ] Backups off-site configurados
- [ ] Actualizaciones automáticas de seguridad
- [ ] Monitoreo de recursos (CPU, RAM, disco)

### Documentación
- [ ] Política de contraseñas documentada
- [ ] Procedimientos de backup documentados
- [ ] Plan de recuperación ante desastres
- [ ] Contactos de emergencia
- [ ] Procedimientos de respuesta a incidentes

---

## 🎓 Conclusión y Recomendaciones

### Estado Actual
Tu aplicación tiene **buenas bases de seguridad** pero **NO está lista para producción**. Las configuraciones HTTPS, CSRF, CORS y el sistema de auditoría son excelentes. Sin embargo, las vulnerabilidades críticas (especialmente el .env expuesto y SQLite) deben resolverse URGENTEMENTE.

### Puntuación por Categoría
- 🟢 **Autenticación/Autorización:** 8/10
- 🟢 **Configuración HTTPS:** 9/10
- 🔴 **Gestión de Secretos:** 2/10 (por .env expuesto)
- 🟡 **Base de Datos:** 4/10 (SQLite no es producción)
- 🟡 **Rate Limiting:** 0/10 (no implementado)
- 🟢 **Auditoría:** 8/10
- 🟡 **Validación de Entrada:** 7/10
- 🟡 **Encriptación de Datos:** 5/10

### Recomendación Final
**🔴 NO DESPLEGAR EN PRODUCCIÓN** hasta completar al menos el plan de acción de Día 1-4.

Una vez implementadas las mejoras críticas y de alta prioridad, la aplicación puede alcanzar un nivel de seguridad **8/10**, adecuado para un entorno de producción de PyME.

### Próxima Auditoría
**30 días después del despliegue inicial** para verificar:
- Logs de seguridad
- Intentos de acceso fallidos
- Performance de rate limiting
- Backups funcionando correctamente
- Actualizaciones de dependencias

---

**¿Necesitas ayuda implementando alguna de estas mejoras?** Puedo asistirte con código específico para cualquier punto del informe.
