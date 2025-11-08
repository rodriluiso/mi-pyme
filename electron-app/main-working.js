const { app, BrowserWindow } = require('electron');
const path = require('path');

// Configuración
const API_BASE_URL = 'https://mipyme-backend.onrender.com/api';
let mainWindow;

// Crear ventana principal
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'MI-PYME Desktop',
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Cargar desde Render
  mainWindow.loadURL('https://mipyme-frontend.onrender.com');

  // Abrir DevTools en desarrollo
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webPreferences.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  console.log('[MI-PYME Desktop] Ventana creada, cargando desde Render...');
}

// Eventos de la aplicación
app.whenReady().then(() => {
  console.log('[MI-PYME Desktop] App lista!');
  console.log('[MI-PYME Desktop] Backend:', API_BASE_URL);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

console.log('[MI-PYME Desktop] Iniciando aplicación...');
