# Arquitectura del Sistema - Mi-PyME

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Arquitectura de Autenticación](#arquitectura-de-autenticación)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Sistema de Permisos](#sistema-de-permisos)
6. [Flujo de Autenticación](#flujo-de-autenticación)
7. [Módulos del Sistema](#módulos-del-sistema)
8. [API Endpoints](#api-endpoints)
9. [Seguridad](#seguridad)

---

## 🎯 Visión General

**Mi-PyME** es un sistema de gestión empresarial (ERP) diseñado para pequeñas y medianas empresas. Proporciona herramientas para gestionar ventas, compras, inventario, finanzas, recursos humanos y contabilidad.

### Características Principales:
- Sistema de autenticación por sesión (Session-based Authentication)
- 3 niveles jerárquicos de usuarios
- Módulos integrados de gestión empresarial
- API RESTful con Django REST Framework
- Interfaz moderna con React + TypeScript
- Auditoría completa de acciones

---

## 🛠️ Stack Tecnológico

### Backend
- **Framework**: Django 5.0
- **API**: Django REST Framework (DRF)
- **Base de Datos**: SQLite (desarrollo) / PostgreSQL (producción recomendado)
- **Autenticación**: Django Session Authentication
- **Validación**: Django Password Validators
- **CORS**: django-cors-headers

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **HTTP Client**: Axios
- **Routing**: React Router
- **UI**: Tailwind CSS + Custom Components
- **State Management**: React Context API

### Dependencias Principales

**Backend** (`backend/requirements.txt`):
```
Django==5.0.*
djangorestframework
djangorestframework-simplejwt  # Instalado pero NO usado actualmente
drf-spectacular
django-filter
django-cors-headers
psycopg2-binary
Pillow
python-dotenv
```

**Frontend** (`frontend/package.json`):
- React + TypeScript
- Axios para peticiones HTTP
- React Router para navegación

---

## 🔐 Arquitectura de Autenticación

### Tipo de Autenticación: **Session-Based Authentication**

El sistema **NO usa JWT**. En su lugar, utiliza el sistema de sesiones nativo de Django con cookies.

#### ¿Cómo funciona?

```
┌─────────────┐                    ┌─────────────┐                    ┌──────────────┐
│   Browser   │                    │   Backend   │                    │   Database   │
│  (Frontend) │                    │   (Django)  │                    │  (SQLite/PG) │
└──────┬──────┘                    └──────┬──────┘                    └──────┬───────┘
       │                                  │                                  │
       │  1. POST /api/usuarios/          │                                  │
       │     auth/login/                  │                                  │
       │  {username, password}            │                                  │
       ├─────────────────────────────────>│                                  │
       │                                  │  2. Verificar credenciales       │
       │                                  ├─────────────────────────────────>│
       │                                  │<─────────────────────────────────┤
       │                                  │  3. Usuario válido               │
       │                                  │                                  │
       │                                  │  4. django.contrib.auth.login()  │
       │                                  │     - Crea sesión en servidor    │
       │                                  │     - Guarda user_id en sesión   │
       │                                  │                                  │
       │  5. Set-Cookie: sessionid=...    │                                  │
       │<─────────────────────────────────┤                                  │
       │  Response: {usuario: {...}}      │                                  │
       │                                  │                                  │
       │  6. GET /api/proveedores/        │                                  │
       │  Cookie: sessionid=...           │                                  │
       ├─────────────────────────────────>│                                  │
       │                                  │  7. Verificar sessionid          │
       │                                  │     - Buscar sesión activa       │
       │                                  │     - Cargar usuario desde DB    │
       │                                  ├─────────────────────────────────>│
       │                                  │<─────────────────────────────────┤
       │  8. Response: [proveedores...]   │  Usuario autenticado             │
       │<─────────────────────────────────┤                                  │
       │                                  │                                  │
```

### Componentes de Autenticación

#### 1. Backend (`backend/usuarios/views.py`)

```python
@action(detail=False, methods=['post'], permission_classes=[])
def login(self, request):
    """Login de usuario con sesiones de Django"""
    serializer = LoginSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.validated_data['user']

        # Crear sesión (esto guarda sessionid en cookie)
        login(request, user)

        # Actualizar última actividad
        user.ultima_actividad = timezone.now()
        user.save()

        # Registrar en log de auditoría
        LogAcceso.objects.create(
            usuario=user,
            accion="Login exitoso",
            ip_address=get_client_ip(request),
            exitoso=True
        )

        return Response({
            'mensaje': 'Login exitoso',
            'usuario': PerfilUsuarioSerializer(user).data
        })
```

#### 2. Frontend (`frontend/src/contexts/AuthContext.tsx`)

```typescript
const login = async (credentials: LoginRequest): Promise<void> => {
  const response = await fetch('http://localhost:8000/api/usuarios/auth/login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // ← CLAVE: Envía y recibe cookies
    body: JSON.stringify(credentials),
  });

  const data: LoginResponse = await response.json();
  setUser(data.usuario);
};
```

#### 3. Axios Client (`frontend/src/lib/api/client.ts`)

```typescript
export const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api',
  timeout: 15000,
  withCredentials: true  // ← CLAVE: Envía cookies automáticamente
});
```

### Ventajas de Session-Based Authentication

✅ **Más seguro para aplicaciones web tradicionales**
- La cookie `sessionid` tiene flags `HttpOnly` (no accesible desde JavaScript)
- Protección CSRF integrada con Django
- Dificulta ataques XSS

✅ **Gestión de sesión en servidor**
- Control total sobre sesiones activas
- Fácil invalidar sesiones (logout global)
- Auditoría completa de sesiones

✅ **Integración nativa con Django**
- Menos código personalizado
- Aprovecha sistema maduro de Django
- Middleware de autenticación automático

### Desventajas vs JWT

❌ **No es stateless**
- Requiere almacenamiento en servidor
- Más difícil escalar horizontalmente

❌ **No ideal para APIs móviles**
- Las apps móviles prefieren tokens

❌ **Requiere cookies**
- Problemas con CORS si no se configura bien

---

## 📁 Estructura del Proyecto

```
mi-pyme-dev/
├── backend/                      # Servidor Django
│   ├── core/                     # Configuración principal
│   │   ├── settings.py          # Configuraciones de Django
│   │   ├── urls.py              # URLs principales
│   │   └── wsgi.py
│   ├── usuarios/                # App de autenticación
│   │   ├── models.py            # Usuario, LogAcceso, ConfiguracionSistema
│   │   ├── views.py             # Login, logout, perfil
│   │   ├── permissions.py       # Permisos personalizados
│   │   └── serializers.py
│   ├── clientes/                # Gestión de clientes
│   ├── proveedores/             # Gestión de proveedores
│   ├── productos/               # Catálogo de productos
│   ├── ventas/                  # Ventas y cobranzas
│   ├── compras/                 # Compras y materias primas
│   ├── recursos_humanos/        # Empleados y nómina
│   ├── finanzas_reportes/       # Finanzas, bancos, AFIP
│   ├── inventario/              # Stock y valorización
│   ├── contabilidad/            # Contabilidad y reportes
│   ├── db.sqlite3               # Base de datos (desarrollo)
│   ├── requirements.txt         # Dependencias Python
│   └── .env                     # Variables de entorno
│
├── frontend/                    # Cliente React
│   ├── src/
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx  # Context de autenticación
│   │   ├── lib/
│   │   │   └── api/
│   │   │       ├── client.ts    # Cliente Axios configurado
│   │   │       └── endpoints/   # APIs por módulo
│   │   ├── pages/               # Páginas de la aplicación
│   │   ├── components/          # Componentes reutilizables
│   │   └── types/               # Tipos TypeScript
│   ├── .env                     # Variables de entorno
│   └── package.json
│
├── SECURITY.md                  # Guía de seguridad
└── ARCHITECTURE.md              # Este archivo
```

---

## 👥 Sistema de Permisos

### Niveles de Usuario

El sistema define 3 niveles jerárquicos:

```python
class Usuario(AbstractUser):
    class NivelAcceso(models.TextChoices):
        ADMIN_TOTAL = 'ADMIN_TOTAL', 'Administrador Total'
        ADMIN_NIVEL_2 = 'ADMIN_NIVEL_2', 'Administrador Nivel 2'
        ADMIN_NIVEL_1 = 'ADMIN_NIVEL_1', 'Administrador Nivel 1'

    nivel_acceso = models.CharField(
        max_length=20,
        choices=NivelAcceso.choices,
        default=NivelAcceso.ADMIN_NIVEL_1
    )
```

### Permisos por Nivel

| Módulo | Admin Nivel 1 | Admin Nivel 2 | Admin Total |
|--------|--------------|---------------|-------------|
| Dashboard | ✅ | ✅ | ✅ |
| Ventas | ✅ | ✅ | ✅ |
| Clientes | ✅ | ✅ | ✅ |
| AFIP | ✅ | ✅ | ✅ |
| Compras | ❌ | ✅ | ✅ |
| Proveedores | ❌ | ✅ | ✅ |
| Productos | ❌ | ✅ | ✅ |
| Finanzas | ❌ | ✅ | ✅ |
| Reportes | ❌ | ✅ | ✅ |
| Bancos | ❌ | ✅ | ✅ |
| Recursos Humanos | ❌ | ❌ | ✅ |
| Usuarios | ❌ | ❌ | ✅ |
| Configuración | ❌ | ❌ | ✅ |

### Permisos Personalizados

**Archivo**: `backend/usuarios/permissions.py`

```python
# Solo Admin Total
class IsAdminTotal(BasePermission):
    def has_permission(self, request, view):
        return request.user.nivel_acceso == 'ADMIN_TOTAL'

# Admin Nivel 2 o superior
class IsAdminNivel2OrHigher(BasePermission):
    def has_permission(self, request, view):
        return request.user.get_nivel_numerico() >= 2

# Gestión de usuarios
class CanManageUsers(BasePermission):
    def has_permission(self, request, view):
        return request.user.puede_gestionar_usuarios()
```

---

## 🔄 Flujo de Autenticación Completo

### 1. Login

```typescript
// Frontend: src/contexts/AuthContext.tsx
const login = async (credentials: LoginRequest) => {
  const response = await fetch('/api/usuarios/auth/login/', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });

  const data = await response.json();
  setUser(data.usuario);  // Guardar usuario en estado
};
```

**Backend procesa**:
1. Validar credenciales
2. Crear sesión con `django.contrib.auth.login()`
3. Django envía cookie `sessionid` automáticamente
4. Registrar en log de auditoría
5. Retornar datos del usuario

### 2. Peticiones Autenticadas

```typescript
// Frontend: src/lib/api/client.ts
const apiClient = axios.create({
  withCredentials: true  // Axios envía cookie automáticamente
});

// Uso
const proveedores = await apiClient.get('/proveedores/');
```

**Backend procesa**:
1. Django lee cookie `sessionid` de la petición
2. Busca sesión en BD (tabla `django_session`)
3. Carga usuario asociado
4. Middleware `AuthenticationMiddleware` agrega `request.user`
5. ViewSet verifica `permission_classes = [IsAuthenticated]`
6. Si válido, ejecuta la vista

### 3. Verificación de Sesión al Cargar App

```typescript
// Frontend: src/contexts/AuthContext.tsx
useEffect(() => {
  const checkAuth = async () => {
    const response = await fetch('/api/usuarios/auth/perfil/', {
      credentials: 'include'
    });

    if (response.ok) {
      const userData = await response.json();
      setUser(userData);
    }
  };

  checkAuth();
}, []);
```

### 4. Logout

```typescript
// Frontend
const logout = async () => {
  await fetch('/api/usuarios/auth/logout/', {
    method: 'POST',
    credentials: 'include'
  });
  setUser(null);
};
```

**Backend**:
1. `django.contrib.auth.logout(request)`
2. Elimina sesión de BD
3. Invalida cookie `sessionid`

---

## 📦 Módulos del Sistema

### 1. Clientes (`clientes/`)
- Gestión de clientes y sucursales
- Historial de ventas y pagos
- Cálculo de saldo por cliente

### 2. Proveedores (`proveedores/`)
- Gestión de proveedores
- Historial de compras y pagos
- Cálculo de cuentas por pagar

### 3. Productos (`productos/`)
- Catálogo de productos
- Control de stock
- Alertas de stock mínimo

### 4. Ventas (`ventas/`)
- Registro de ventas
- Gestión de cobranzas
- Condiciones de pago
- Generación de remitos

### 5. Compras (`compras/`)
- Compras de materias primas
- Gestión de stock por proveedor
- Resúmenes por proveedor/categoría

### 6. Recursos Humanos (`recursos_humanos/`)
- Empleados
- Pagos de nómina
- Gestión de datos laborales

### 7. Finanzas y Reportes (`finanzas_reportes/`)
- Movimientos financieros
- Pagos a clientes/proveedores
- Cuentas bancarias
- Conciliación bancaria
- Facturación electrónica AFIP

### 8. Inventario (`inventario/`)
- Movimientos de stock
- Órdenes de producción
- Valorización de inventario
- Ajustes de inventario

### 9. Contabilidad (`contabilidad/`)
- Plan de cuentas
- Asientos contables
- Balance general
- Estado de resultados

---

## 🌐 API Endpoints

### Autenticación

```
POST   /api/usuarios/auth/login/              # Login
POST   /api/usuarios/auth/logout/             # Logout
GET    /api/usuarios/auth/perfil/             # Perfil del usuario actual
PUT    /api/usuarios/auth/actualizar_perfil/  # Actualizar perfil
POST   /api/usuarios/auth/cambiar_password/   # Cambiar contraseña
```

### CRUD Endpoints (Patrón general)

Cada módulo sigue el patrón REST estándar:

```
GET    /api/{modulo}/              # Listar todos
POST   /api/{modulo}/              # Crear nuevo
GET    /api/{modulo}/{id}/         # Obtener uno
PUT    /api/{modulo}/{id}/         # Actualizar completo
PATCH  /api/{modulo}/{id}/         # Actualizar parcial
DELETE /api/{modulo}/{id}/         # Eliminar
```

Ejemplo con Proveedores:
```
GET    /api/proveedores/
POST   /api/proveedores/
GET    /api/proveedores/5/
PUT    /api/proveedores/5/
DELETE /api/proveedores/5/
```

### Endpoints Personalizados

```
# Ventas
GET    /api/ventas/cobranzas/pendientes/
GET    /api/ventas/cobranzas/vencidas/
GET    /api/ventas/cobranzas/urgentes/
POST   /api/ventas/{id}/marcar-recordatorio/

# Compras
GET    /api/compras/resumen/proveedores/
GET    /api/compras/resumen/categorias/

# Inventario
GET    /api/inventario/movimientos/resumen/
POST   /api/inventario/movimientos/ajuste_manual/

# Contabilidad
GET    /api/contabilidad/reportes/balance_general/
GET    /api/contabilidad/reportes/estado_resultados/
```

---

## 🔒 Seguridad

### Medidas Implementadas

1. **Autenticación Obligatoria**
   - Todos los endpoints requieren `IsAuthenticated`
   - Sin endpoints públicos (excepto login)

2. **Variables de Entorno**
   - SECRET_KEY obligatoria
   - DEBUG=False por defecto
   - Uso de `python-dotenv`

3. **HTTPS en Producción**
   - `SECURE_SSL_REDIRECT = True`
   - `SESSION_COOKIE_SECURE = True`
   - `CSRF_COOKIE_SECURE = True`
   - HSTS habilitado

4. **Protecciones de Navegador**
   - XSS Filter activado
   - Clickjacking protection
   - MIME-type sniffing bloqueado

5. **Auditoría**
   - Logs de acceso con IP
   - Registro de todas las acciones importantes
   - Tracking de última actividad

6. **Validación**
   - Django ORM (previene SQL injection)
   - DRF Serializers (validación de inputs)
   - Password validators

### Configuración de Sesiones

```python
# backend/core/settings.py
SESSION_COOKIE_AGE = 1800  # 30 minutos
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_SAVE_EVERY_REQUEST = True
SESSION_COOKIE_SECURE = True  # Solo en producción (HTTPS)
SESSION_COOKIE_HTTPONLY = True  # Por defecto en Django
SESSION_COOKIE_SAMESITE = 'Lax'  # Protección CSRF
```

### CORS Configurado

```python
CORS_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://localhost:5174']
CORS_ALLOW_CREDENTIALS = True  # Permite envío de cookies
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS
```

---

## 🚀 Despliegue

### Desarrollo

```bash
# Backend
cd backend
python manage.py runserver

# Frontend
cd frontend
npm run dev
```

### Producción

Ver [SECURITY.md](SECURITY.md) para checklist completo de despliegue.

**Puntos clave**:
- Usar PostgreSQL en lugar de SQLite
- Configurar servidor web (Nginx/Apache)
- Habilitar HTTPS con certificado SSL
- Configurar variables de entorno de producción
- Configurar backups automatizados

---

## 📚 Referencias

- [Django Authentication System](https://docs.djangoproject.com/en/5.0/topics/auth/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [Django Session Authentication](https://www.django-rest-framework.org/api-guide/authentication/#sessionauthentication)
- [React Context API](https://react.dev/reference/react/createContext)

---

**Última actualización**: 2025-10-09
**Versión**: 1.0.0
