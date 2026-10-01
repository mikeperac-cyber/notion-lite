const { contextBridge, ipcRenderer } = require("electron");

let internalSecret = "";
try {
  internalSecret = ipcRenderer.sendSync("get-internal-secret-sync") || "";
} catch (err) {
  console.error("Failed to fetch internal secret via IPC:", err);
}

const subscribe = (channel, callback) => {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  platform: process.platform,
  onCommand: (callback) => subscribe("desktop:command", callback),
  onUpdateStatus: (callback) => subscribe("desktop:update-status", callback),
  ready: () => ipcRenderer.send("desktop:renderer-ready"),
  getSettings: () => ipcRenderer.invoke("desktop:get-settings"),
  setSettings: (changes) => ipcRenderer.invoke("desktop:set-settings", changes),
  saveFile: (request) => ipcRenderer.invoke("desktop:save-file", request),
  createBackup: () => ipcRenderer.invoke("desktop:create-backup"),
  restoreBackup: () => ipcRenderer.invoke("desktop:restore-backup"),
  importMarkdown: () => ipcRenderer.invoke("desktop:import-markdown"),
  pickAttachment: () => ipcRenderer.invoke("desktop:pick-attachment"),
  getAiSettings: () => ipcRenderer.invoke("desktop:get-ai-settings"),
  setAiSettings: (value) => ipcRenderer.invoke("desktop:set-ai-settings", value),
  checkForUpdates: () => ipcRenderer.invoke("desktop:check-updates"),
  getAppInfo: () => ipcRenderer.invoke("desktop:get-app-info"),
});

contextBridge.exposeInMainWorld("env", {
  internalSecret
});
