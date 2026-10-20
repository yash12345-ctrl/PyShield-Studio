const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow = null;
let backendProcess = null;

// Determine paths
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const appRootDir = path.resolve(__dirname, '../../');
const frontendDist = path.join(__dirname, '../dist/index.html');

// Pick best icon based on platform
const getIconPath = () => {
  if (process.platform === 'win32') {
    return path.join(__dirname, 'icons', 'icon.ico');
  }
  return path.join(__dirname, 'icons', 'icon.png');
};

// Check if backend is already running on port 5001
function checkBackendHealth() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:5001/api/health', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Start backend if not already active
async function ensureBackendRunning() {
  const isRunning = await checkBackendHealth();
  if (isRunning) {
    console.log('[Desktop] Python backend is already running on port 5001.');
    return;
  }

  console.log('[Desktop] Starting local Python backend...');

  // Search for Python virtualenv or system python
  let pythonBin = 'python3';
  const venvPythonLinux = path.join(appRootDir, '.venv', 'bin', 'python');
  const venvPythonWin = path.join(appRootDir, '.venv', 'Scripts', 'python.exe');
  const runScript = path.join(appRootDir, 'backend', 'run_backend.py');

  if (fs.existsSync(venvPythonLinux)) {
    pythonBin = venvPythonLinux;
  } else if (fs.existsSync(venvPythonWin)) {
    pythonBin = venvPythonWin;
  }

  if (fs.existsSync(runScript)) {
    try {
      backendProcess = spawn(pythonBin, [runScript], {
        cwd: appRootDir,
        detached: false,
        stdio: 'ignore'
      });

      backendProcess.on('error', (err) => {
        console.error('[Desktop] Failed to launch backend:', err.message);
      });

      console.log(`[Desktop] Spawned backend (PID: ${backendProcess.pid}) with ${pythonBin}`);
    } catch (e) {
      console.error('[Desktop] Error spawning backend process:', e);
    }
  } else {
    console.warn('[Desktop] backend/run_backend.py not found at', runScript);
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'PyShield Studio',
    icon: getIconPath(),
    backgroundColor: '#0b0f19',
    autoHideMenuBar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false // allow connecting to local websocket / http backend without strict browser origin blocks
    }
  });

  // Smooth appearance when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Load URL
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (fs.existsSync(frontendDist)) {
    mainWindow.loadFile(frontendDist);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupMenu();
}

function setupMenu() {
  const template = [
    {
      label: 'PyShield Studio',
      submenu: [
        { label: 'About PyShield Studio v1.0.0', role: 'about' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { role: 'toggleDevTools', accelerator: 'F12' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen', accelerator: 'F11' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'GitHub Repository',
          click: async () => {
            await shell.openExternal('https://github.com/yash12345-ctrl/PyShield-Studio');
          }
        },
        {
          label: 'Cloud Web Version',
          click: async () => {
            await shell.openExternal('https://py-shield-studio.vercel.app');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    await ensureBackendRunning();
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });
}

function cleanUpBackend() {
  if (backendProcess && !backendProcess.killed) {
    try {
      console.log('[Desktop] Terminating backend process...');
      backendProcess.kill('SIGTERM');
      backendProcess = null;
    } catch (e) {
      console.error('[Desktop] Error closing backend process:', e);
    }
  }
}

app.on('will-quit', cleanUpBackend);
app.on('window-all-closed', () => {
  cleanUpBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
