import { BrowserWindow } from "electron";
import { join } from "node:path";
import { geometryForShape } from "./assets";
import { boundsForPreset, livePresets } from "./presets";
import { secureWindow } from "./security";
import type { DisplayGeometry, Preset, Settings } from "./types";
class CrosshairOverlay {
  readonly window: BrowserWindow;
  private preset: Preset;
  private hidden: boolean;
  private ready = false;
  constructor(preset: Preset, display: DisplayGeometry, hidden: boolean) {
    this.preset = preset;
    this.hidden = hidden;
    this.window = new BrowserWindow({
      ...boundsForPreset(preset, display),
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      focusable: false,
      skipTaskbar: true,
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: join(__dirname, "overlay-preload.js"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    secureWindow(this.window);
    this.window.setIgnoreMouseEvents(true, { forward: true });
    this.window.setAlwaysOnTop(true, "screen-saver");
    this.window.webContents.on("did-finish-load", () => {
      this.ready = true;
      this.render();
    });
    void this.window.loadURL("reticlequay://app/crosshair.html");
  }
  update(preset: Preset, display: DisplayGeometry, hidden: boolean): void {
    this.preset = preset;
    this.hidden = hidden;
    this.window.setBounds(boundsForPreset(preset, display));
    this.render();
  }
  private render(): void {
    if (!this.ready || this.window.isDestroyed()) return;
    this.window.webContents.send("rq:overlay", {
      preset: this.preset,
      geometry: geometryForShape(this.preset.shape),
    });
    if (this.preset.visible && !this.hidden) this.window.showInactive();
    else this.window.hide();
  }
  close(): void {
    if (!this.window.isDestroyed()) this.window.destroy();
  }
}
export class OverlayManager {
  private readonly overlays = new Map<string, CrosshairOverlay>();
  reconcile(
    settings: Settings,
    displays: DisplayGeometry[],
    hidden: boolean,
  ): void {
    const live = livePresets(settings, displays);
    const ids = new Set(live.map((item) => item.display.id));
    for (const [id, overlay] of this.overlays)
      if (!ids.has(id)) {
        overlay.close();
        this.overlays.delete(id);
      }
    for (const { preset, display } of live) {
      const old = this.overlays.get(display.id);
      if (old && !old.window.isDestroyed()) old.update(preset, display, hidden);
      else
        this.overlays.set(
          display.id,
          new CrosshairOverlay(preset, display, hidden),
        );
    }
  }
  close(): void {
    for (const overlay of this.overlays.values()) overlay.close();
    this.overlays.clear();
  }
}
