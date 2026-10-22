const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow = null;
let backendProcess = null;

// Determine environment & directories
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const appRootDir = isDev ? path.resolve(__dirname, '../../') : process.resourcesPath;
const frontendDist = path.join(__dirname, '../dist/index.html');

// Pick best icon based on platform
const getIconPath = () => {
  if (process.platform === 'win32') {
    return path.join(__dirname, 'icons', 'icon.ico');
  }
  return path.join(__dirname, 'icons', 'icon.png');
};

// Check if backend is already healthy on 127.0.0.1:5001
function checkBackendHealth() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:5001/api/health', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Repeatedly wait for backend to respond healthy
async function waitForBackendReady(maxAttempts = 30, intervalMs = 250) {
  for (let i = 0; i < maxAttempts; i++) {
    const alive = await checkBackendHealth();
    if (alive) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

// Find Python binary or standalone backend executable
function resolvePythonBackend() {
  const isWindows = process.platform === 'win32';

  // 1. Check for standalone frozen binary (e.g. from PyInstaller in resources/python-runtime)
  const frozenCandidates = isWindows
    ? [
        path.join(process.resourcesPath, 'python-runtime', 'pyshield-backend.exe'),
        path.join(process.resourcesPath, 'backend', 'pyshield-backend.exe'),
        path.join(appRootDir, 'backend', 'dist', 'pyshield-backend', 'pyshield-backend.exe')
      ]
    : [
        path.join(process.resourcesPath, 'python-runtime', 'pyshield-backend'),
        path.join(process.resourcesPath, 'backend', 'pyshield-backend'),
        path.join(appRootDir, 'backend', 'dist', 'pyshield-backend', 'pyshield-backend')
      ];

  for (const frozen of frozenCandidates) {
    if (fs.existsSync(frozen)) {
      return { type: 'frozen', executable: frozen, args: [] };
    }
  }

  // 2. Locate run_backend.py script
  const scriptCandidates = [
    path.join(process.resourcesPath, 'backend', 'run_backend.py'),
    path.join(appRootDir, 'backend', 'run_backend.py'),
    path.resolve(__dirname, '../../backend/run_backend.py')
  ];

  let runScript = null;
  for (const s of scriptCandidates) {
    if (fs.existsSync(s)) {
      runScript = s;
      break;
    }
  }

  // 3. Search for Python interpreter (bundled portable Python, venv, or system)
  const pythonCandidates = [];

  // A. Bundled portable Python inside resources (offline runtime)
  if (isWindows) {
    pythonCandidates.push(
      path.join(process.resourcesPath, 'python', 'python.exe'),
      path.join(process.resourcesPath, 'python-runtime', 'python.exe'),
      path.join(process.resourcesPath, '.venv', 'Scripts', 'python.exe')
    );
  } else {
    pythonCandidates.push(
      path.join(process.resourcesPath, 'python', 'bin', 'python3'),
      path.join(process.resourcesPath, 'python-runtime', 'bin', 'python3'),
      path.join(process.resourcesPath, '.venv', 'bin', 'python')
    );
  }

  // B. Workspace virtual environment (for dev and local execution)
  const localDevRoot = path.resolve(__dirname, '../../');
  if (isWindows) {
    pythonCandidates.push(
      path.join(appRootDir, '.venv', 'Scripts', 'python.exe'),
      path.join(localDevRoot, '.venv', 'Scripts', 'python.exe')
    );
  } else {
    pythonCandidates.push(
      path.join(appRootDir, '.venv', 'bin', 'python'),
      path.join(localDevRoot, '.venv', 'bin', 'python')
    );
  }

  // C. Windows system install paths
  if (isWindows) {
    const localAppData = process.env.LOCALAPPDATA || '';
    if (localAppData) {
      pythonCandidates.push(
        path.join(localAppData, 'Programs', 'Python', 'Python312', 'python.exe'),
        path.join(localAppData, 'Programs', 'Python', 'Python311', 'python.exe'),
        path.join(localAppData, 'Programs', 'Python', 'Python310', 'python.exe')
      );
    }
    pythonCandidates.push(
      'C:\\Python312\\python.exe',
      'C:\\Python311\\python.exe',
      'C:\\Python310\\python.exe',
      'python.exe',
      'py.exe'
    );
  } else {
    // Linux / macOS system paths
    pythonCandidates.push(
      '/usr/bin/python3',
      '/usr/local/bin/python3',
      'python3',
      'python'
    );
  }

  let chosenPython = null;
  for (const py of pythonCandidates) {
    if (py.includes(path.sep)) {
      if (fs.existsSync(py)) {
        chosenPython = py;
        break;
      }
    } else {
      chosenPython = py;
      break;
    }
  }

  if (!chosenPython) {
    chosenPython = isWindows ? 'python.exe' : 'python3';
  }

  return {
    type: 'script',
    executable: chosenPython,
    args: runScript ? [runScript] : []
  };
}

// Start backend if not already active
async function ensureBackendRunning() {
  const isRunning = await checkBackendHealth();
  if (isRunning) {
    console.log('[Desktop] Local Python backend is already active on port 5001.');
    return;
  }

  console.log('[Desktop] Initializing local offline Python backend...');

  // Setup writable user data directories (avoid writing to C:\Program Files\)
  const userDataDir = app.getPath('userData');
  const dbPath = path.join(userDataDir, 'pyshield.db');
  const connectionsDir = path.join(userDataDir, 'kernel_connections');
  const logPath = path.join(userDataDir, 'backend.log');

  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.mkdirSync(connectionsDir, { recursive: true });
  } catch (err) {
    console.warn('[Desktop] Warning creating userData subdirs:', err.message);
  }

  const backendConfig = resolvePythonBackend();
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  console.log(`[Desktop] Resolved backend target:`, backendConfig);
  console.log(`[Desktop] User database target: ${dbPath}`);
  console.log(`[Desktop] Connections target: ${connectionsDir}`);

  if (backendConfig.type === 'script' && backendConfig.args.length === 0) {
    console.warn('[Desktop] Warning: run_backend.py script could not be found.');
    return;
  }

  const backendEnv = {
    ...process.env,
    PYSHIELD_USER_DATA: userDataDir,
    PYSHIELD_DB_PATH: dbPath,
    PYSHIELD_CONNECTIONS_DIR: connectionsDir,
    PYSHIELD_RESOURCES_DIR: isDev ? path.resolve(__dirname, '../../') : process.resourcesPath,
    PYSHIELD_PYTHON_EXE: backendConfig.executable,
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8'
  };

  const workDir = isDev
    ? path.resolve(__dirname, '../../')
    : fs.existsSync(path.join(process.resourcesPath, 'backend'))
      ? path.join(process.resourcesPath, 'backend')
      : process.resourcesPath;

  try {
    backendProcess = spawn(backendConfig.executable, backendConfig.args, {
      cwd: workDir,
      env: backendEnv,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (backendProcess.stdout) {
      backendProcess.stdout.pipe(logStream);
      backendProcess.stdout.on('data', (d) => {
        if (isDev) process.stdout.write(`[Backend stdout] ${d}`);
      });
    }

    if (backendProcess.stderr) {
      backendProcess.stderr.pipe(logStream);
      backendProcess.stderr.on('data', (d) => {
        if (isDev) process.stderr.write(`[Backend stderr] ${d}`);
      });
    }

    backendProcess.on('error', (err) => {
      console.error('[Desktop] Failed to launch backend process:', err.message);
      fs.appendFileSync(logPath, `[Launch Error] ${err.message}\n`);
    });

    backendProcess.on('exit', (code, sig) => {
      console.log(`[Desktop] Backend exited with code: ${code}, signal: ${sig}`);
      fs.appendFileSync(logPath, `[Exit] Code: ${code}, Signal: ${sig}\n`);
    });

    console.log(`[Desktop] Spawned backend (PID: ${backendProcess.pid})`);

    // Wait for the backend to pass health check before opening UI
    const ready = await waitForBackendReady(30, 250);
    if (ready) {
      console.log('✓ [Desktop] Local backend successfully confirmed healthy on http://127.0.0.1:5001');
    } else {
      console.warn('⚠️ [Desktop] Backend startup timed out after 7.5s, UI will continue...');
    }
  } catch (e) {
    console.error('[Desktop] Exception spawning backend process:', e);
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

  // Globally disable right-click context menu across all pages (Proctored Examination Mode)
  mainWindow.webContents.on('context-menu', (e) => {
    e.preventDefault();
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
  const version = app.getVersion();
  const template = [
    {
      label: 'PyShield Studio',
      submenu: [
        { label: `About PyShield Studio v${version}`, role: 'about' },
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
      setTimeout(() => {
        if (backendProcess && !backendProcess.killed) {
          try {
            backendProcess.kill('SIGKILL');
          } catch (_) {}
        }
      }, 1000);
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

// --- In-App Auto-Update Downloader & Installer ---
let downloadedInstallerPath = null;

function downloadFileWithRedirects(fileUrl, destPath, onProgress, maxRedirects = 6) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects while downloading update.'));
    }

    const client = fileUrl.startsWith('https') ? https : http;
    const req = client.get(fileUrl, { headers: { 'User-Agent': 'PyShield-Studio-AutoUpdater' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return downloadFileWithRedirects(res.headers.location, destPath, onProgress, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Server returned HTTP ${res.statusCode}`));
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;
      let lastTime = Date.now();
      let lastBytes = 0;
      let speedMbSec = '0.0';

      const fileStream = fs.createWriteStream(destPath);

      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const now = Date.now();
        if (now - lastTime >= 250) {
          const deltaBytes = downloadedBytes - lastBytes;
          const deltaSec = (now - lastTime) / 1000;
          if (deltaSec > 0) {
            speedMbSec = ((deltaBytes / (1024 * 1024)) / deltaSec).toFixed(1);
          }
          lastTime = now;
          lastBytes = downloadedBytes;

          const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
          if (typeof onProgress === 'function') {
            onProgress({
              percent,
              downloadedMb: (downloadedBytes / (1024 * 1024)).toFixed(1),
              totalMb: totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : 'Unknown',
              speedMbSec
            });
          }
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => {
          if (typeof onProgress === 'function') {
            onProgress({
              percent: 100,
              downloadedMb: (downloadedBytes / (1024 * 1024)).toFixed(1),
              totalMb: (downloadedBytes / (1024 * 1024)).toFixed(1),
              speedMbSec: '0.0'
            });
          }
          resolve(destPath);
        });
      });

      fileStream.on('error', (err) => {
        try { fs.unlinkSync(destPath); } catch (_) {}
        reject(err);
      });
    });

    req.on('error', (err) => {
      try { fs.unlinkSync(destPath); } catch (_) {}
      reject(err);
    });
  });
}

// IPC Handlers for Auto-Update
ipcMain.handle('updater:start-download', async (event, { downloadUrl, version }) => {
  if (!downloadUrl) {
    throw new Error('Download URL is required.');
  }

  const isWindows = process.platform === 'win32';
  const ext = isWindows ? '.exe' : (downloadUrl.endsWith('.deb') ? '.deb' : '.AppImage');
  const tempDir = app.getPath('temp');
  const destPath = path.join(tempDir, `PyShield-Studio-Setup-${version || 'latest'}${ext}`);

  console.log(`[Updater] Starting download from ${downloadUrl} to ${destPath}`);

  try {
    const downloadedPath = await downloadFileWithRedirects(downloadUrl, destPath, (progressData) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:progress', progressData);
      }
    });

    downloadedInstallerPath = downloadedPath;
    console.log(`[Updater] Download successfully finished: ${downloadedPath}`);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:downloaded', { filePath: downloadedPath });
    }

    return { status: 'success', filePath: downloadedPath };
  } catch (err) {
    console.error('[Updater] Download error:', err);
    throw err;
  }
});

ipcMain.handle('updater:install', async () => {
  if (!downloadedInstallerPath || !fs.existsSync(downloadedInstallerPath)) {
    throw new Error('No downloaded update installer found.');
  }

  console.log(`[Updater] Launching update installer: ${downloadedInstallerPath}`);

  if (process.platform === 'win32') {
    // Launch NSIS setup in detached mode
    const child = spawn(downloadedInstallerPath, [], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
  } else {
    // Linux
    try {
      fs.chmodSync(downloadedInstallerPath, 0o755);
    } catch (_) {}

    if (downloadedInstallerPath.endsWith('.deb')) {
      spawn('xdg-open', [downloadedInstallerPath], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn(downloadedInstallerPath, [], { detached: true, stdio: 'ignore' }).unref();
    }
  }

  cleanUpBackend();
  setTimeout(() => {
    app.quit();
  }, 600);

  return { status: 'launching' };
});
