const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;

function startServer() {
  serverProcess = fork(path.join(__dirname, 'server.js'), [], { silent: true });
  serverProcess.stdout?.on('data', (data) => console.log(data.toString()));
  serverProcess.stderr?.on('data', (data) => console.error(data.toString()));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    title: 'Shanthi Wellness - Insurance System',
    icon: path.join(__dirname, 'logo.png'),
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  setTimeout(() => { mainWindow.loadURL('http://localhost:3000'); }, 2000);
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => { startServer(); createWindow(); });
app.on('window-all-closed', () => { if (serverProcess) serverProcess.kill(); app.quit(); });
app.on('before-quit', () => { if (serverProcess) serverProcess.kill(); });
