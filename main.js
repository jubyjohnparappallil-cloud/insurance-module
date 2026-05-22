const { app, BrowserWindow } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800
  });

  const startupFile = process.argv.includes('--insurance') ? 'insurance-only.html' : 'index.html';
  win.loadFile(startupFile);
}

app.whenReady().then(createWindow);