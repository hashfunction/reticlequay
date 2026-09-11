import { contextBridge, ipcRenderer } from "electron";
import type { Preset } from "./types";
import type { Primitive } from "./assets";
// Receive-only: no invoke, send, filesystem, or settings mutation capability.
contextBridge.exposeInMainWorld("overlay", {
  onSettings: (
    callback: (payload: { preset: Preset; geometry: Primitive[] }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { preset: Preset; geometry: Primitive[] },
    ) => callback(payload);
    ipcRenderer.on("rq:overlay", listener);
    return () => ipcRenderer.removeListener("rq:overlay", listener);
  },
});
