const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;

function startServer() {
  // Start the web server as a child process
  serverProcess = fork(path.join(__dirname, 'server.js'), [], {
    silent: true
  });
  serverProcess.stdout?.on('data', (data) => console.log(data.toString()));
  serverProcess.stderr?.on('data', (data) => console.error(data.toString()));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    title: 'Shanthi Wellness - Clinic EMR',
    icon: path.join(__dirname, 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Wait a moment for server to start, then load
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3000');
  }, 1500);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});
