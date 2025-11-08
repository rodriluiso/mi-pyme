# Guía: MI-PYME Desktop Lite

## Resumen

Acabas de crear **MI-PYME Desktop Lite**, una aplicación de escritorio que aprovecha tu deployment en Render.com para funcionar.

### Características principales

- **Liviana**: ~156 MB instalado (vs ~356 MB de versión completa)
- **Conectada a la nube**: Usa el backend de Render que ya está funcionando
- **Cache offline**: Los datos se guardan localmente para consulta sin internet
- **Actualizaciones automáticas**: Al actualizar el backend en Render, la app se actualiza automáticamente

## Arquitectura

```
┌────────────────────────────────────────┐
│   MI-PYME Desktop (Electron)           │
│   ┌──────────────────────────────┐     │
│   │  Frontend React              │     │
│   │  (cargado desde Render o     │     │
│   │   empaquetado localmente)    │     │
│   └──────────────────────────────┘     │
│              ↓                          │
│   ┌──────────────────────────────┐     │
│   │  API Client                  │     │
│   │  • Auto-detecta Electron     │     │
│   │  • Guarda cache en SQLite    │     │
│   └──────────────────────────────┘     │
│              ↓                          │
└────────────────────────────────────────┘
           ↓ HTTPS
┌────────────────────────────────────────┐
│  Backend Django (Render.com)           │
│  https://mipyme-backend.onrender.com   │
│              ↓                          │
│  PostgreSQL (Render.com)               │
└────────────────────────────────────────┘

Cache SQLite Local (solo lectura offline)
```

## Modo de funcionamiento

### Online (Normal)
1. Usuario abre MI-PYME Desktop
2. App se conecta a Render backend
3. Todas las operaciones (GET, POST, PUT, DELETE) funcionan
4. Los datos de GET se guardan automáticamente en cache local

### Offline (Sin internet)
1. Usuario abre MI-PYME Desktop
2. App detecta que no hay conexión
3. Solo permite **consultar** datos previamente cargados
4. Muestra mensaje: "Modo offline - Solo lectura"

## Cómo compilar el instalador

### Paso 1: Preparar el frontend

El frontend ya está compilado en `frontend/dist/` (lo hiciste para Render).

Si necesitas recompilarlo:
```bash
cd frontend
npm run build
```

### Paso 2: Instalar dependencias de Electron

```bash
cd electron-app
npm install
```

### Paso 3: Compilar instalador

**Opción A: Usar script automático (Recomendado)**
```bash
cd electron-app
BUILD_DESKTOP.bat
```

**Opción B: Manual**
```bash
cd electron-app
npm run copy-renderer  # Copia frontend a electron-app/renderer
npm run build:win      # Compila instalador Windows
```

### Paso 4: Resultado

El instalador estará en:
```
electron-app/dist/MI-PYME Desktop Setup 1.0.0.exe
```

Tamaño aproximado: 80 MB (comprimido)

## Cómo probar en desarrollo

Sin compilar instalador, puedes probar la app:

```bash
cd electron-app
npm install
npm start
```

Esto abrirá la app de escritorio conectándose a Render.

## Distribución

Una vez compilado, puedes distribuir el instalador `.exe` de varias formas:

### 1. Descarga directa
- Sube el `.exe` a Google Drive, Dropbox, OneDrive
- Comparte el link con tus clientes
- Ellos descargan e instalan

### 2. Sitio web
- Crea un sitio simple con botón "Descargar MI-PYME Desktop"
- Hostea en Render Static Site (gratis)
- Link directo al `.exe`

### 3. GitHub Releases
- Sube el `.exe` a GitHub Releases
- Permite versionar y trackear descargas
- Gratis

## Modelo de negocio sugerido

### Opción 1: Desktop Gratis + Backend Premium
- **Desktop**: Gratis para descargar
- **Backend**: Después de 14 días de prueba, $10/mes
- **Ventaja**: Muchos usuarios prueban, algunos pagan

### Opción 2: Desktop Pago + Backend Incluido
- **Desktop**: $30 one-time
- **Incluye**: 1 año de acceso al backend en nube
- **Renovación**: $10/año después del primer año

### Opción 3: Freemium
- **Básico** (Gratis): Desktop + Backend con límites (10 clientes, 50 productos)
- **Pro** ($15/mes): Sin límites, reportes avanzados, multi-usuario

## Próximos pasos

### Mejoras recomendadas

1. **Agregar iconos**
   - Crea un logo 512x512 PNG
   - Conviértelo a .ico usando https://www.icoconverter.com/
   - Guárdalo en `electron-app/assets/icon.ico`
   - Descomenta línea de icono en `package.json`

2. **Auto-actualización**
   - Implementar electron-updater
   - La app se actualiza automáticamente sin reinstalar

3. **Modo híbrido real**
   - Permitir trabajar offline con escritura
   - Sincronizar cambios cuando vuelve internet

4. **Indicador de estado**
   - Icono en barra de tareas que muestra online/offline
   - Notificación cuando se pierde/recupera conexión

5. **Configuración**
   - Panel de ajustes dentro de la app
   - Permitir cambiar servidor backend (para empresas grandes)

## Ventajas de esta arquitectura

✅ **Menor mantenimiento**: Actualizas backend en Render, todos se actualizan
✅ **Multi-plataforma**: El mismo código funciona en Windows, Mac, Linux
✅ **Backup automático**: Datos siempre en PostgreSQL de Render
✅ **Escalable**: Si crece, fácil migrar a servidor dedicado
✅ **Flexible**: Puedes ofrecer web Y desktop con el mismo backend

## Comparación con versión web

| Característica | Web (Render) | Desktop Lite |
|----------------|--------------|--------------|
| Requiere navegador | Sí | No |
| Instalación | No | Sí (80 MB) |
| Offline cache | No | Sí (lectura) |
| Ícono en escritorio | No | Sí |
| Auto-inicio con Windows | No | Sí (opcional) |
| UX nativa | Limitada | Completa |
| Notificaciones sistema | Limitadas | Completas |

## Preguntas frecuentes

**P: ¿Necesito mantener dos códigos separados?**
R: No, el frontend es el mismo. Solo compilas diferente.

**P: ¿Puedo tener usuarios en web Y desktop simultáneamente?**
R: Sí, ambos usan el mismo backend de Render.

**P: ¿Qué pasa si Render tiene downtime?**
R: Desktop muestra datos cacheados (solo lectura). Web no funciona.

**P: ¿Cómo actualizo la app desktop?**
R: Por ahora, lanzas nueva versión y usuarios reinstalan. Con electron-updater sería automático.

**P: ¿Puedo cambiar la URL del backend?**
R: Sí, editando `API_BASE_URL` en `electron-app/main.js`

## Conclusión

Ahora tienes:
1. ✅ **Backend en producción** (Render.com)
2. ✅ **Frontend web** (https://mipyme-frontend.onrender.com)
3. ✅ **Desktop app** (MI-PYME Desktop Lite)

Todo aprovechando el mismo deployment en Render!

---

**¿Listo para distribuir?** Ejecuta `BUILD_DESKTOP.bat` y comparte el instalador.
