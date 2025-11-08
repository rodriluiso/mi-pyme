# Iconos de la Aplicación

Para que el instalador funcione correctamente, necesitas agregar los siguientes iconos en esta carpeta:

## Windows
- **icon.ico** - Icono para Windows (formato .ico)
  - Tamaños recomendados: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256
  - Herramienta: https://www.icoconverter.com/

## macOS
- **icon.icns** - Icono para macOS (formato .icns)
  - Tamaño base: 512x512 o 1024x1024 PNG
  - Herramienta: https://cloudconvert.com/png-to-icns

## Linux
- **icon.png** - Icono para Linux (formato .png)
  - Tamaño recomendado: 512x512 px

## Crear iconos desde un PNG

Si tienes un logo en formato PNG, puedes convertirlo:

### Opción 1: Online (Fácil)
1. Ve a https://www.icoconverter.com/
2. Sube tu PNG (idealmente 512x512 o mayor)
3. Descarga los archivos .ico, .icns y .png
4. Copia los archivos a esta carpeta

### Opción 2: Electron Icon Builder
```bash
npm install -g electron-icon-builder
electron-icon-builder --input=./logo.png --output=./assets
```

## Mientras tanto (Temporalmente)

Electron-builder puede funcionar sin iconos, pero mostrará un icono por defecto.

Si quieres probar la compilación sin iconos, **comenta o elimina** estas líneas del `package.json`:

```json
"win": {
  // "icon": "assets/icon.ico"  ← Comentar esta línea
},
"mac": {
  // "icon": "assets/icon.icns"  ← Comentar esta línea
},
"linux": {
  // "icon": "assets/icon.png"  ← Comentar esta línea
}
```
