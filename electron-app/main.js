const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

// Configuración
const API_BASE_URL = 'https://mipyme-backend.onrender.com/api';
let mainWindow;
let db;

// Inicializar base de datos SQLite para cache offline
function initDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'cache.db');

  db = new Database(dbPath);

  // Crear tablas para cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS cache (
      endpoint TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  console.log('Cache database initialized at:', dbPath);
}

// Crear ventana principal
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'MI-PYME Desktop',
    backgroundColor: '#ffffff'
  });

  // Cargar el frontend desde Render (modo online) o desde local si está disponible
  const frontendPath = path.join(__dirname, 'renderer', 'index.html');
  const fs = require('fs');

  if (fs.existsSync(frontendPath)) {
    // Modo desarrollo: cargar desde archivo local
    mainWindow.loadFile(frontendPath);
  } else {
    // Modo producción: cargar desde Render
    mainWindow.loadURL('https://mipyme-frontend.onrender.com');
  }

  // Abrir DevTools en desarrollo
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Registrar IPC Handlers para comunicación con renderer
function setupIpcHandlers() {
  // Obtener configuración de API
  ipcMain.handle('get-api-config', () => {
    return {
      baseURL: API_BASE_URL,
      timeout: 30000
    };
  });

  // Guardar datos en cache
  ipcMain.handle('cache-save', (event, endpoint, data) => {
    try {
      const stmt = db.prepare('INSERT OR REPLACE INTO cache (endpoint, data, timestamp) VALUES (?, ?, ?)');
      stmt.run(endpoint, JSON.stringify(data), Date.now());
      return { success: true };
    } catch (error) {
      console.error('Error saving to cache:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtener datos del cache
  ipcMain.handle('cache-get', (event, endpoint) => {
    try {
      const stmt = db.prepare('SELECT data, timestamp FROM cache WHERE endpoint = ?');
      const row = stmt.get(endpoint);

      if (row) {
        return {
          success: true,
          data: JSON.parse(row.data),
          timestamp: row.timestamp
        };
      }

      return { success: false, error: 'Not found in cache' };
    } catch (error) {
      console.error('Error reading from cache:', error);
      return { success: false, error: error.message };
    }
  });

  // Limpiar cache antiguo (más de 7 días)
  ipcMain.handle('cache-clean', () => {
    try {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const stmt = db.prepare('DELETE FROM cache WHERE timestamp < ?');
      const result = stmt.run(sevenDaysAgo);
      return { success: true, deleted: result.changes };
    } catch (error) {
      console.error('Error cleaning cache:', error);
      return { success: false, error: error.message };
    }
  });

  // Verificar conexión a internet
  ipcMain.handle('check-online', async () => {
    try {
      const https = require('https');

      return new Promise((resolve) => {
        const req = https.get(API_BASE_URL + '/health/', (res) => {
          resolve({ online: res.statusCode === 200 });
        });

        req.on('error', () => {
          resolve({ online: false });
        });

        req.setTimeout(5000, () => {
          req.destroy();
          resolve({ online: false });
        });
      });
    } catch (error) {
      return { online: false };
    }
  });
}

// Eventos de la aplicación
app.whenReady().then(() => {
  initDatabase();
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) db.close();
    app.quit();
  }
});

app.on('before-quit', () => {
  if (db) db.close();
});
