const { contextBridge } = require('electron');
const packageJson = require('../package.json');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isDesktop: true,
  appVersion: packageJson.version || '1.0.5'
});

