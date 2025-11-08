const { app, BrowserWindow } = require('electron');
const path = require('path');

console.log('Electron loaded successfully!');
console.log('app:', typeof app);
console.log('BrowserWindow:', typeof BrowserWindow);

let mainWindow;

function createWindow() {
  console.log('Creating window...');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'MI-PYME Desktop - Test'
  });

  // Cargar desde Render
  mainWindow.loadURL('https://mipyme-frontend.onrender.com');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  console.log('App ready!');
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

console.log('Script end');
