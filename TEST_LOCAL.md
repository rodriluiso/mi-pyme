# Test Local Rápido

## 1. Generar SECRET_KEY (30 seg)
```bash
cd backend
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

## 2. Crear .env para desarrollo (1 min)
```bash
# Copiar
cp .env.example .env

# Editar y pegar el SECRET_KEY generado
nano .env
# O en Windows: notepad .env

# Debe quedar así:
DJANGO_SECRET_KEY=tu-secret-key-generado-arriba
DJANGO_SETTINGS_MODULE=core.settings.dev
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
```

## 3. Instalar dependencias y probar backend (3 min)
```bash
# Instalar deps
pip install -r requirements.txt

# Aplicar migraciones
python manage.py migrate

# Crear superuser
python manage.py createsuperuser

# Probar servidor
python manage.py runserver
```

## 4. Abrir navegador
```
http://localhost:8000/api/health/
http://localhost:8000/admin/
```

## ✅ Si funciona → Paso 2
## ❌ Si falla → Debug antes de continuar
