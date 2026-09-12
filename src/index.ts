import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  protocol,
  screen,
  shell,
  Tray,
} from "electron";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { trustedSender, CONTROL_URL } from "./commands";
import { geometryForShape, shapes } from "./assets";
import { exactKeys, PresetStore, record } from "./presets";
import { SettingsSession } from "./settings-session";
import { OverlayManager } from "./crosshair";
import { secureProtocol, secureWindow } from "./security";
import type { AppState, DisplayGeometry, Reply } from "./types";
// Keep existing presets across the customer-facing rename. Electron's explicit
// --user-data-dir continues to select its own isolated location.
if (!app.commandLine.hasSwitch("user-data-dir"))
  app.setPath("userData", join(app.getPath("appData"), "ReticleQuay"));
app.setName("AimWisp");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "reticlequay",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
app.enableSandbox();
let controls: BrowserWindow | undefined;
let settingsSession: SettingsSession;
let hidden = false;
let notice = "";
let hotkeyAvailable = false;
const overlays = new OverlayManager();
let queue = Promise.resolve();
let quitting = false;
let tray: Tray | undefined;
function displays(): DisplayGeometry[] {
  return screen.getAllDisplays().map((d) => ({
    id: String(d.id),
    label: d.label || `Display ${d.id}`,
    bounds: d.bounds,
    scaleFactor: d.scaleFactor,
  }));
}
function state(): AppState {
  return {
    settings: settingsSession.settings,
    settingsWritable: settingsSession.writable,
    displays: displays(),
    hidden,
    notice,
    hotkeyAvailable,
    geometries: Object.fromEntries(shapes.map((s) => [s, geometryForShape(s)])),
  };
}
function refresh(): void {
  overlays.reconcile(settingsSession.settings, displays(), hidden);
  if (controls && !controls.isDestroyed())
    controls.webContents.send("rq:state", state());
  if (tray)
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Open AimWisp",
          click: () => {
            controls?.show();
          },
        },
        {
          label: hidden ? "Show overlays" : "Hide overlays",
          click: () => {
            hidden = !hidden;
            refresh();
          },
        },
        { type: "separator" },
        { label: "Quit AimWisp", click: () => app.quit() },
      ]),
    );
}
function fail(error: unknown): Reply {
  return {
    ok: false,
    error:
      error instanceof Error
        ? error.message
        : "Operation failed. Please retry.",
  };
}
function authorized(event: Electron.IpcMainInvokeEvent): boolean {
  return trustedSender(event, controls?.webContents);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    controls?.restore();
    controls?.show();
  });
  void app
    .whenReady()
    .then(async () => {
      // Electron handles --user-data-dir; ordinary launches use its application-owned userData directory.
      settingsSession = new SettingsSession(
        new PresetStore(app.getPath("userData")),
      );
      await settingsSession.load();
      notice = settingsSession.notice;
      secureProtocol(join(app.getAppPath(), "public"));
      controls = new BrowserWindow({
        width: 1040,
        height: 820,
        minWidth: 760,
        minHeight: 680,
        backgroundColor: "#101b27",
        title: "AimWisp",
        icon: join(app.getAppPath(), "public", "icon.png"),
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
          preload: join(__dirname, "preload.js"),
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      controls.setMenu(null);
      secureWindow(controls);
      controls.on("close", (event) => {
        if (!quitting && tray) {
          event.preventDefault();
          controls?.hide();
        }
      });
      controls.on("closed", () => {
        controls = undefined;
        app.quit();
      });
      ipcMain.handle("rq:state", (event) =>
        authorized(event)
          ? { ok: true, state: state() }
          : { ok: false, error: "Unauthorized sender." },
      );
      ipcMain.handle("rq:command", (event, value: unknown) => {
        if (!authorized(event))
          return { ok: false, error: "Unauthorized sender." };
        const operation = queue.then(async (): Promise<Reply> => {
          try {
            settingsSession.assertWritable();
            const command = record(value);
            if (command.kind === "toggle") {
              exactKeys(command, ["kind"]);
              hidden = !hidden;
            } else {
              try {
                await settingsSession.apply(command);
              } catch (error) {
                if (error instanceof Error && "code" in error)
                  throw new Error(
                    "Could not save presets. Check available disk space and settings-folder access, then retry.",
                  );
                throw error;
              }
            }
            refresh();
            return { ok: true, state: state() };
          } catch (error) {
            return fail(error);
          }
        });
        queue = operation.then(
          () => undefined,
          () => undefined,
        );
        return operation;
      });
      ipcMain.handle(
        "rq:help",
        async (event, target: unknown): Promise<Reply> => {
          if (!authorized(event))
            return { ok: false, error: "Unauthorized sender." };
          try {
            if (target === "license") {
              await dialog.showMessageBox(controls!, {
                type: "info",
                title: "AimWisp licenses",
                message: "AimWisp • Crosshair Y attribution",
                detail:
                  (await readFile(join(app.getAppPath(), "LICENSE"), "utf8")) +
                  "\n\n" +
                  (await readFile(
                    join(app.getAppPath(), "THIRD_PARTY_NOTICES.md"),
                    "utf8",
                  )),
              });
            } else if (target === "support" || target === "privacy")
              await shell.openExternal(
                `https://aimwisp.trieflow.com/${target}`,
              );
            else throw new Error("Unsupported help target.");
            return { ok: true, state: state() };
          } catch (error) {
            return fail(error);
          }
        },
      );
      hotkeyAvailable = globalShortcut.register(
        "CommandOrControl+Shift+H",
        () => {
          hidden = !hidden;
          refresh();
        },
      );
      if (!hotkeyAvailable)
        notice = (
          notice +
          " Global shortcut is in use. Use Hide overlays in this window or the tray."
        ).trim();
      screen.on("display-added", () => refresh());
      screen.on("display-removed", () => refresh());
      screen.on("display-metrics-changed", () => refresh());
      // Original in-memory cross geometry for the tray; no inherited branding assets.
      const pixels = Buffer.alloc(16 * 16 * 4);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++)
          if (
            (x >= 7 && x <= 8 && y >= 2 && y <= 13) ||
            (y >= 7 && y <= 8 && x >= 2 && x <= 13)
          ) {
            const i = (y * 16 + x) * 4;
            pixels[i] = 201;
            pixels[i + 1] = 222;
            pixels[i + 2] = 114;
            pixels[i + 3] = 255;
          }
      try {
        tray = new Tray(
          nativeImage.createFromBitmap(pixels, { width: 16, height: 16 }),
        );
        tray.setToolTip("AimWisp");
        tray.on("click", () => controls?.show());
      } catch {
        notice = (
          notice +
          " Tray unavailable; closing this window quits the application."
        ).trim();
      }
      await controls.loadURL(CONTROL_URL);
      controls.show();
      refresh();
    })
    .catch((error) => {
      console.error("AimWisp startup failed:", error);
      app.quit();
    });
}
app.on("before-quit", () => {
  quitting = true;
  overlays.close();
});
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  tray?.destroy();
});
app.on("activate", () => controls?.show());
