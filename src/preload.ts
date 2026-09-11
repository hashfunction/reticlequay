import { contextBridge, ipcRenderer } from "electron";
import type { AppState, ReticleBridge } from "./types";
const bridge: ReticleBridge = {
  getState: () => ipcRenderer.invoke("rq:state"),
  command: (command) => ipcRenderer.invoke("rq:command", command),
  openHelp: (target) => ipcRenderer.invoke("rq:help", target),
  onState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AppState) =>
      callback(state);
    ipcRenderer.on("rq:state", listener);
    return () => ipcRenderer.removeListener("rq:state", listener);
  },
};
if (location.href === "reticlequay://app/index.html")
  contextBridge.exposeInMainWorld("reticlequay", bridge);
