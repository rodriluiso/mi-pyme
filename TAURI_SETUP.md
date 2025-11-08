# Guía de Configuración de MI-PYME Desktop con Tauri

## ¿Qué es Tauri?

Tauri es una alternativa moderna y ligera a Electron para crear aplicaciones de escritorio. En lugar de empaquetar Chromium completo, usa el navegador nativo del sistema operativo (WebView).

**Ventajas sobre Electron:**
- 📦 **10x más ligero**: ~15 MB vs ~156 MB
- ⚡ **Más rápido**: Arranque casi instantáneo
- 🔒 **Más seguro**: Rust backend con permisos explícitos
- 💻 **Menos recursos**: Usa el navegador del sistema, no Chromium

## Estructura del Proyecto

```
frontend/
├── src/                    # Código React (sin cambios)
├── src-tauri/             # Código Tauri
│   ├── src/
│   │   └── main.rs        # Punto de entrada Rust
│   ├── Cargo.toml         # Configuración Rust
│   ├── tauri.conf.json    # Configuración Tauri
│   └── build.rs           # Script de build
└── package.json           # Con scripts Tauri agregados
```

## Paso 1: Instalar Rust

Rust es necesario para compilar aplicaciones Tauri.

### Opción A: Script Automático (Recomendado)
```bash
# Ejecutar desde la raíz del proyecto
./INSTALAR_RUST.bat
```

### Opción B: Instalación Manual
1. Ir a https://rustup.rs/
2. Descargar e instalar rustup-init.exe
3. Aceptar las opciones por defecto
4. Cerrar y abrir nueva terminal

### Verificar Instalación
```bash
rustc --version
cargo --version
```

Deberías ver algo como:
```
rustc 1.XX.X
cargo 1.XX.X
```

## Paso 2: Probar en Modo Desarrollo

```bash
cd frontend
npm run tauri:dev
```

Esto:
1. Inicia el servidor Vite (React)
2. Compila el código Rust
3. Abre la aplicación de escritorio

**Nota**: La primera vez puede tardar 5-10 minutos porque descarga y compila todas las dependencias de Rust. Las siguientes veces será mucho más rápido.

## Paso 3: Compilar Instalador Windows

Una vez que todo funcione en desarrollo:

```bash
cd frontend
npm run tauri:build
```

Esto generará:
- **Instalador NSIS**: `frontend/src-tauri/target/release/bundle/nsis/MI-PYME Desktop_1.0.0_x64-setup.exe`
- **Instalador MSI**: `frontend/src-tauri/target/release/bundle/msi/MI-PYME Desktop_1.0.0_x64_en-US.msi`

El instalador incluye:
- Aplicación completa (~15 MB)
- Icono en escritorio
- Menú de inicio
- Desinstalador

## Configuración del Backend

La aplicación Tauri está configurada para conectarse a:

```
https://mipyme-backend.onrender.com/api
```

Esto se detecta automáticamente en [frontend/src/lib/api/client.ts:25-29](frontend/src/lib/api/client.ts#L25-L29) cuando la app se ejecuta en Tauri.

## Solución de Problemas

### Error: "rustc not found"
- Rust no está instalado o no está en el PATH
- Solución: Ejecutar `INSTALAR_RUST.bat` y abrir nueva terminal

### Error: "failed to compile"
- Primera compilación puede tomar mucho tiempo
- Solución: Esperar pacientemente (5-10 minutos)

### Error: "WebView2 not found" (Windows)
- Falta WebView2 (navegador Edge)
- Solución: Windows 10/11 modernos ya lo tienen. Si no, se descarga automáticamente al instalar la app

### La app no conecta al backend
- Verificar que https://mipyme-backend.onrender.com esté funcionando
- Verificar conexión a internet
- El backend en Render puede estar "dormido" (free tier). La primera petición lo despertará (tarda ~30 segundos)

## Scripts Disponibles

```bash
# Desarrollo (con hot reload)
npm run tauri:dev

# Compilar instalador
npm run tauri:build

# CLI de Tauri (para comandos avanzados)
npm run tauri
```

## Ventajas del Enfoque Actual

1. **Backend en la nube**: No necesitas empaquetar Django + PostgreSQL
2. **Actualizaciones fáciles**: Cambios en el backend afectan a todas las apps inmediatamente
3. **Tamaño pequeño**: Solo empaquetas el frontend React
4. **Multi-plataforma**: El mismo código funciona en Windows, macOS y Linux

## Próximos Pasos (Opcionales)

- [ ] Agregar ícono personalizado en `src-tauri/icons/`
- [ ] Configurar auto-updater
- [ ] Agregar cache offline con Rust
- [ ] Firmar el instalador con certificado (para evitar warning de Windows)

## Comparación Técnica

| Característica | Tauri | Electron |
|----------------|-------|----------|
| Tamaño final | ~15 MB | ~156 MB |
| Memoria RAM | ~30-50 MB | ~100-200 MB |
| Startup | <1 seg | 2-3 seg |
| Backend | Rust | Node.js |
| WebView | Nativo (Edge) | Chromium |
| Hot reload | ✅ | ✅ |
| Cross-platform | ✅ | ✅ |

## Recursos

- Documentación Tauri: https://tauri.app/
- Rust Book: https://doc.rust-lang.org/book/
- MI-PYME Backend: https://mipyme-backend.onrender.com
- MI-PYME Frontend Web: https://mipyme-frontend.onrender.com
