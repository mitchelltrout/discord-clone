const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const DEFAULT_URL = 'https://chat.cghypermega.net';

function getConfigPath() {
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  if (portableDir) return path.join(portableDir, 'config.json');
  return path.join(app.getPath('userData'), 'config.json');
}

function getServerUrl() {
  try {
    const config = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
    if (config.serverUrl) return config.serverUrl;
  } catch {}
  return DEFAULT_URL;
}

function createWindow() {
  Menu.setApplicationMenu(null);

  const serverUrl = getServerUrl();

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    center: true,
    title: `Discord Clone — ${serverUrl}`,
    backgroundColor: '#313338',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  // Ctrl+Shift+I toggles DevTools
  win.webContents.on('before-input-event', (_, input) => {
    if (input.control && input.shift && input.key === 'I') {
      win.webContents.toggleDevTools();
    }
    if (input.control && input.key === 'r') {
      win.loadURL(serverUrl);
    }
  });

  // Show error page if URL fails to load
  win.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedURL) => {
    const params = new URLSearchParams({ url: validatedURL, code: errorCode, desc: errorDescription });
    win.loadFile(path.join(__dirname, 'error.html'), { query: Object.fromEntries(params) });
  });

  // Open target="_blank" links in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL(serverUrl);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
