"""
Production settings for server deployment.
"""

from .base import *
import dj_database_url

# DEBUG must be False in production
DEBUG = False

# Allowed hosts - REQUIRED from environment
allowed_hosts_env = os.getenv("DJANGO_ALLOWED_HOSTS", "")
ALLOWED_HOSTS = [host.strip() for host in allowed_hosts_env.split(",") if host.strip()]

if not ALLOWED_HOSTS:
    raise ValueError(
        "DJANGO_ALLOWED_HOSTS environment variable is required in production. "
        "Example: 'mipyme.example.com,www.mipyme.example.com'"
    )

# Database - PostgreSQL with connection pooling
DATABASES = {
    'default': dj_database_url.config(
        default=os.getenv('DATABASE_URL'),
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# Ensure DATABASE_URL is set
if not DATABASES['default']:
    raise ValueError("DATABASE_URL environment variable is required in production")

# CORS - Strict whitelist from environment
cors_origins_env = os.getenv("DJANGO_CORS_ALLOWED_ORIGINS", "")
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

if not CORS_ALLOWED_ORIGINS:
    raise ValueError(
        "DJANGO_CORS_ALLOWED_ORIGINS environment variable is required in production. "
        "Example: 'https://mipyme.example.com,https://www.mipyme.example.com'"
    )

CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS.copy()
CORS_ALLOW_CREDENTIALS = True
CSRF_COOKIE_NAME = 'csrftoken'
CSRF_HEADER_NAME = 'HTTP_X_CSRFTOKEN'
CSRF_COOKIE_SAMESITE = 'None'  # Required for cross-domain cookies
CSRF_COOKIE_SECURE = True  # Required when SameSite=None
CSRF_USE_SESSIONS = False

# Security settings - STRICT for production
SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "True").lower() == "true"
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = 'None'  # Required for cross-domain cookies
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Email - SMTP for production
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() == 'true'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'noreply@mipyme.com')

# Static files - for collectstatic
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Logging - Structured JSON for production
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            'format': '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "name": "%(name)s", "message": "%(message)s", "pathname": "%(pathname)s", "lineno": %(lineno)d}',
        },
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json',  # JSON format for production logs
        },
    },
    'root': {
        'handlers': ['console'],
        'level': os.getenv('LOG_LEVEL', 'INFO'),
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': os.getenv('LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'WARNING',  # Only warnings/errors for SQL
            'propagate': False,
        },
    },
}

# Cache - Redis for production (if configured)
if os.getenv('REDIS_URL'):
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': os.getenv('REDIS_URL'),
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            },
            'KEY_PREFIX': 'mipyme',
            'TIMEOUT': 300,
        }
    }
else:
    # Fallback to local memory cache
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'unique-snowflake',
        }
    }

# Session - Use cache if available
if os.getenv('REDIS_URL'):
    SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
    SESSION_CACHE_ALIAS = 'default'
