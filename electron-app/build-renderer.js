/**
 * Script para copiar el build del frontend a la carpeta renderer de Electron
 */
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'frontend', 'dist');
const targetDir = path.join(__dirname, 'renderer');

// Función para copiar directorio recursivamente
function copyDirectory(source, target) {
  // Crear directorio destino si no existe
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  // Leer contenido del directorio fuente
  const files = fs.readdirSync(source);

  files.forEach(file => {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);

    if (fs.statSync(sourcePath).isDirectory()) {
      // Recursivamente copiar subdirectorios
      copyDirectory(sourcePath, targetPath);
    } else {
      // Copiar archivo
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

console.log('Copying frontend build to electron-app/renderer...');

if (!fs.existsSync(sourceDir)) {
  console.error('Error: Frontend dist folder not found!');
  console.error('Please run "npm run build" in the frontend directory first.');
  process.exit(1);
}

try {
  copyDirectory(sourceDir, targetDir);
  console.log('Frontend build copied successfully!');
} catch (error) {
  console.error('Error copying files:', error);
  process.exit(1);
}
