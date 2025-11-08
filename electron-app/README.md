# MI-PYME Desktop - Versión Lite

Aplicación de escritorio liviana que se conecta al backend en Render.com para funcionar.

## Características

- **Liviana**: ~156 MB (solo frontend + Electron)
- **Siempre actualizada**: Se conecta al backend en Render (sin necesidad de actualizar la app)
- **Cache offline**: Guarda datos localmente para consulta cuando no hay internet (solo lectura)
- **Multiplataforma**: Windows, macOS y Linux

## Requisitos

- Node.js 18+ instalado
- Frontend compilado (`npm run build` en la carpeta `frontend`)
- Backend desplegado en Render.com

## Instalación de dependencias

```bash
npm install
```

## Desarrollo

Para ejecutar la app en modo desarrollo:

```bash
npm start
```

La app cargará el frontend desde Render.com y se conectará al backend también en Render.

## Compilar instalador

### Windows

1. Primero, compilar el frontend:
```bash
cd ../frontend
npm run build
cd ../electron-app
```

2. Copiar el build a la carpeta renderer (opcional, para fallback offline):
```bash
npm run copy-renderer
```

3. Compilar el instalador:
```bash
npm run build:win
```

El instalador se generará en `electron-app/dist/MI-PYME Desktop Setup 1.0.0.exe`

### macOS

```bash
npm run build:mac
```

### Linux

```bash
npm run build:linux
```

## Tamaño estimado

- **Instalador**: ~80 MB comprimido
- **Instalado**: ~156 MB
- **Descarga inicial**: ~80 MB

## Funcionamiento

### Modo Online (Normal)

- Se conecta a `https://mipyme-backend.onrender.com/api`
- Todas las operaciones CRUD funcionan normalmente
- Los datos se guardan automáticamente en cache SQLite local

### Modo Offline (Sin internet)

- Lee datos del cache SQLite
- Solo permite **consultar** datos previamente cargados
- No permite crear, editar o eliminar (requiere conexión)
- Muestra mensaje indicando que está offline

## Estructura de archivos

```
electron-app/
├── main.js           # Proceso principal de Electron
├── preload.js        # Script de preload para APIs seguras
├── package.json      # Configuración y dependencias
├── build-renderer.js # Script para copiar frontend build
├── renderer/         # Frontend compilado (opcional)
└── assets/           # Iconos de la aplicación
```

## Arquitectura

```
┌─────────────────────────────────────┐
│      MI-PYME Desktop (Electron)     │
├─────────────────────────────────────┤
│  Frontend React (desde Render)      │
│          ↓                           │
│  API Client (Axios)                 │
│          ↓                           │
│  Backend Django (Render.com)        │
│          ↓                           │
│  PostgreSQL (Render.com)            │
│                                     │
│  Cache SQLite (Local)  ← Offline   │
└─────────────────────────────────────┘
```

## Ventajas vs Versión Completa

| Característica | Lite | Pro (Completo) |
|----------------|------|----------------|
| Tamaño | ~156 MB | ~356 MB |
| Requiere internet | Sí | No |
| Actualizaciones backend | Automáticas | Requiere reinstalar |
| Cache offline | Solo lectura | Total |
| Precio sugerido | Gratis/$5/mes | $50 one-time |

## Notas de seguridad

- Las cookies de sesión se manejan automáticamente
- CSRF tokens se envían en cada petición POST/PUT/DELETE
- La comunicación con Render usa HTTPS
- El cache SQLite está en el directorio userData del usuario

## Personalización

Para cambiar el backend a otro servidor, editar `main.js`:

```javascript
const API_BASE_URL = 'https://tu-backend.com/api';
```

## Distribución

El instalador generado puede distribuirse a los usuarios finales sin dependencias adicionales.
