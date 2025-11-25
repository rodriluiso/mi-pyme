# MI-PYME

Sistema de gestión empresarial para PyMEs que cubre operaciones de compra, venta, inventario, finanzas y recursos humanos. Pensado para negocios que requieren control detallado de stock, gestión de clientes/proveedores con múltiples sucursales, y seguimiento de cobranzas.

## Arquitectura

La aplicación se divide en tres componentes principales:

- **Backend Django**: API REST que gestiona la lógica de negocio y acceso a datos
- **Frontend React**: Interfaz web desarrollada con Vite, TypeScript y TailwindCSS
- **Desktop Tauri** (opcional): Aplicación nativa para Windows que consume la misma API

El backend puede ejecutarse con PostgreSQL en producción o SQLite en desarrollo. La aplicación web se comunica con el backend mediante autenticación por tokens (cross-domain) o sesiones (same-domain).

## Requerimientos del sistema

### Para desarrollo local

- Python 3.11+
- Node.js 18+ y npm
- Git

### Para aplicación desktop (Tauri)

- Rust 1.77.2+
- Requisitos adicionales de Tauri según plataforma: [https://tauri.app/v1/guides/getting-started/prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)

### Para despliegue en producción

- PostgreSQL 14+
- Redis (opcional, para cache)
- Servidor con HTTPS configurado (ej: Nginx, Render, Railway)

## Instalación

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Crear archivo `.env` en `backend/`:

```env
DJANGO_SECRET_KEY=tu-secret-key-aqui
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=sqlite:///db.sqlite3
```

Ejecutar migraciones y crear superusuario:

```bash
python manage.py migrate
python manage.py createsuperuser
```

### Frontend

```bash
cd frontend
npm install
```

Crear archivo `.env.local` en `frontend/`:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

## Uso

### Modo desarrollo

Ejecutar backend y frontend en terminales separadas:

```bash
# Terminal 1: Backend
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python manage.py runserver

# Terminal 2: Frontend
cd frontend
npm run dev
```

La aplicación web estará disponible en `http://localhost:5173` y el admin de Django en `http://localhost:8000/admin`.

### Aplicación desktop con Tauri

Instalar Rust siguiendo la guía oficial: [https://www.rust-lang.org/tools/install](https://www.rust-lang.org/tools/install)

Ejecutar en modo desarrollo:

```bash
cd frontend
npm run tauri:dev
```

La primera compilación toma 5-10 minutos. Compilaciones posteriores son más rápidas.

## Estructura del proyecto

```
mi-pyme-dev/
├── backend/
│   ├── core/                    # Configuración Django
│   │   ├── settings/
│   │   │   ├── base.py         # Settings compartidos
│   │   │   ├── dev.py          # Development
│   │   │   ├── prod.py         # Production
│   │   │   └── desktop.py      # Desktop app
│   │   ├── urls.py
│   │   └── authentication.py   # Auth personalizada
│   ├── clientes/               # Gestión de clientes y sucursales
│   ├── proveedores/            # Gestión de proveedores
│   ├── productos/              # Productos terminados
│   ├── compras/                # Compras y materias primas
│   ├── ventas/                 # Ventas y remitos
│   ├── finanzas_reportes/      # Finanzas, pagos, movimientos
│   ├── recursos_humanos/       # RR.HH. y empleados
│   ├── contabilidad/           # Contabilidad básica
│   ├── inventario/             # Control de stock
│   ├── configuracion/          # Config de empresa y sistema
│   └── usuarios/               # Usuarios y permisos
├── frontend/
│   ├── src/
│   │   ├── components/         # Componentes React
│   │   ├── pages/              # Páginas por módulo
│   │   ├── hooks/              # Custom hooks
│   │   ├── lib/                # Utilidades y cliente API
│   │   ├── contexts/           # React contexts
│   │   └── types/              # TypeScript types
│   ├── src-tauri/              # Configuración Tauri
│   │   ├── src/
│   │   ├── Cargo.toml
│   │   └── tauri.conf.json
│   └── dist/                   # Build de producción
├── scripts/
│   ├── deploy.sh               # Deploy automatizado
│   └── backup_db.sh            # Backup de base de datos
└── infra/
    └── nginx/                  # Configuraciones Nginx
```

## Variables de entorno

### Backend

Variables requeridas en producción (`.env.production`):

```env
# Django
DJANGO_SECRET_KEY=            # Generar con: python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=         # ej: mipyme.com,www.mipyme.com
DJANGO_CORS_ALLOWED_ORIGINS=  # ej: https://frontend.mipyme.com

# Database
DATABASE_URL=                 # ej: postgres://user:pass@host:5432/dbname

# Redis (opcional)
REDIS_URL=                    # ej: redis://localhost:6379/1

# Email (opcional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=

# Encryption
FERNET_KEY=                   # Generar con: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
```

### Frontend

Variables para build de producción (`.env.production`):

```env
VITE_API_BASE_URL=https://api.mipyme.com/api
```

## Scripts disponibles

### Backend

```bash
# Ejecutar servidor de desarrollo
python manage.py runserver

# Crear migraciones
python manage.py makemigrations

# Aplicar migraciones
python manage.py migrate

# Crear superusuario
python manage.py createsuperuser

# Recolectar archivos estáticos
python manage.py collectstatic

# Shell interactivo
python manage.py shell

# Tests
python manage.py test
```

### Frontend

```bash
# Desarrollo
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview

# Linting
npm run lint

# Formateo de código
npm run format

# Tests
npm run test
npm run test:coverage

# Tauri (desktop)
npm run tauri:dev     # Desarrollo
npm run tauri:build   # Build instalador
```

## Construcción del build

### Web (producción)

```bash
# 1. Build frontend
cd frontend
npm install
npm run build

# 2. Build backend
cd ../backend
pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate
```

El directorio `frontend/dist/` contiene los archivos estáticos del frontend listos para servir con Nginx o cualquier servidor HTTP.

### Desktop (Windows)

```bash
cd frontend
npm run tauri:build
```

El instalador se genera en `frontend/src-tauri/target/release/bundle/`. La primera compilación puede tardar 10-15 minutos.

Tamaño aproximado del instalador: 15-20 MB.

## Troubleshooting

### Error 500 al crear materia prima sin SKU

Solucionado en versión actual. El campo SKU ahora acepta valores nulos.

### Dashboard muestra indicadores en cero

Verificar que el backend esté sirviendo respuestas paginadas correctamente. El frontend maneja automáticamente respuestas con formato `{results: [...]}` y arrays directos.

### Error 403 al acceder desde mobile

La aplicación usa autenticación por tokens para requests cross-domain. Asegurar que:
- `DJANGO_CORS_ALLOWED_ORIGINS` incluya el dominio del frontend
- El frontend guarde el token recibido en el login (`localStorage.setItem('auth_token', token)`)
- Las peticiones incluyan el header `Authorization: Token <token>`

### Tauri no compila en Windows

Verificar que Rust esté instalado y en PATH. Cerrar y reabrir la terminal después de instalar Rust.

```bash
rustc --version
cargo --version
```

Si los comandos no se reconocen, ejecutar `INSTALAR_RUST.bat` desde el directorio raíz.

### Migraciones pendientes

```bash
python manage.py showmigrations
python manage.py migrate
```

### Puerto ya en uso

Cambiar el puerto del backend:

```bash
python manage.py runserver 8001
```

Actualizar `VITE_API_BASE_URL` en el frontend si es necesario.

## Licencia

Uso privado.

## Contacto

Para soporte técnico o consultas sobre el sistema, consultar la documentación interna o contactar al equipo de desarrollo.
