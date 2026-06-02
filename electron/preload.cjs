const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("instagramApp", {
  selectZip: () => ipcRenderer.invoke("dialog:select-zip"),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  analyze: (payload) => ipcRenderer.invoke("analysis:run", payload),
  saveOutput: (filename) => ipcRenderer.invoke("output:save", { filename }),
  saveAllOutputs: () => ipcRenderer.invoke("output:save-all"),
});
