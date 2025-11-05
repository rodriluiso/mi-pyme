"""
Desktop settings for Electron app (Windows).
Uses PostgreSQL portable + local file storage.
"""

from .base import *

# DEBUG can be controlled via env var for desktop
DEBUG = os.getenv("DJANGO_DEBUG", "False").lower() == "true"

# Allowed hosts - Desktop runs on localhost
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '[::1]']

# Database - PostgreSQL portable (configured by Electron)
# Default to PostgreSQL on custom port to avoid conflicts
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('POSTGRES_DB', 'mipyme'),
        'USER': os.getenv('POSTGRES_USER', 'postgres'),
        'PASSWORD': os.getenv('POSTGRES_PASSWORD', ''),
        'HOST': os.getenv('POSTGRES_HOST', '127.0.0.1'),
        'PORT': os.getenv('POSTGRES_PORT', '5433'),  # Custom port to avoid conflicts
        'CONN_MAX_AGE': 0,  # Don't persist connections in desktop app
        'OPTIONS': {'connect_timeout': 10},
    }
}

# CORS - Desktop frontend runs in Electron
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'file://',  # Allow Electron file:// protocol
]

CSRF_TRUSTED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]

CORS_ALLOW_CREDENTIALS = True
CSRF_COOKIE_NAME = 'csrftoken'
CSRF_HEADER_NAME = 'HTTP_X_CSRFTOKEN'
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_USE_SESSIONS = False

# Security - Relaxed for desktop (no HTTPS on localhost)
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_HSTS_SECONDS = 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False

# Email - Console backend for desktop
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Static/Media - Local paths in user data directory
if os.getenv('DESKTOP_USER_DATA_PATH'):
    USER_DATA_PATH = Path(os.getenv('DESKTOP_USER_DATA_PATH'))
    MEDIA_ROOT = USER_DATA_PATH / 'media'
    STATIC_ROOT = USER_DATA_PATH / 'static'

    # Create directories if they don't exist
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    STATIC_ROOT.mkdir(parents=True, exist_ok=True)

# Logging - File logging for desktop
if os.getenv('DESKTOP_LOG_PATH'):
    LOG_FILE = Path(os.getenv('DESKTOP_LOG_PATH')) / 'django.log'
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    LOGGING = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'verbose': {
                'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
                'style': '{',
            },
        },
        'handlers': {
            'file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'filename': str(LOG_FILE),
                'maxBytes': 10 * 1024 * 1024,  # 10 MB
                'backupCount': 5,
                'formatter': 'verbose',
            },
            'console': {
                'class': 'logging.StreamHandler',
                'formatter': 'verbose',
            },
        },
        'root': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
        },
        'loggers': {
            'django': {
                'handlers': ['file', 'console'],
                'level': 'INFO',
                'propagate': False,
            },
        },
    }
else:
    # Fallback to console logging
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
            'console': {
                'class': 'logging.StreamHandler',
                'formatter': 'verbose',
            },
        },
        'root': {
            'handlers': ['console'],
            'level': 'INFO',
        },
    }

# Cache - Local memory cache for desktop
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'mipyme-desktop',
    }
}
