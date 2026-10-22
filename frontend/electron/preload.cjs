const { contextBridge, ipcRenderer } = require('electron');
const packageJson = require('../package.json');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isDesktop: true,
  appVersion: packageJson.version || '1.0.6',
  startUpdateDownload: (downloadUrl, version) => ipcRenderer.invoke('updater:start-download', { downloadUrl, version }),
  onUpdateProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('updater:progress', handler);
    return () => ipcRenderer.removeListener('updater:progress', handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('updater:downloaded', handler);
    return () => ipcRenderer.removeListener('updater:downloaded', handler);
  },
  installUpdate: () => ipcRenderer.invoke('updater:install')
});

