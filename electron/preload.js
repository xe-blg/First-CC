const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  updateTray: (text) => ipcRenderer.send('update-tray', text),
  flashWindow: () => ipcRenderer.send('flash-window'),
  onTrayCommand: (callback) => {
    ipcRenderer.on('tray-command', (_event, command) => callback(command));
  },
});
