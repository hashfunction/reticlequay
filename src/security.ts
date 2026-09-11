import { BrowserWindow, protocol, session } from "electron";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
export const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; font-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
const files: Record<string, [string, string]> = {
  "/index.html": ["index.html", "text/html"],
  "/crosshair.html": ["crosshair.html", "text/html"],
  "/style.css": ["style.css", "text/css"],
  "/crosshair.css": ["crosshair.css", "text/css"],
  "/scripts/main.js": ["scripts/main.js", "text/javascript"],
  "/scripts/crosshair.js": ["scripts/crosshair.js", "text/javascript"],
  "/scripts/draw.js": ["scripts/draw.js", "text/javascript"],
};
export function secureProtocol(root: string): void {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  protocol.handle("reticlequay", async (request) => {
    const url = new URL(request.url);
    const entry = files[url.pathname];
    if (request.method !== "GET" || url.host !== "app" || url.search || !entry)
      return new Response("Not found", { status: 404 });
    try {
      return new Response(await readFile(join(root, entry[0])), {
        headers: {
          "Content-Type": entry[1],
          "Content-Security-Policy": CSP,
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return new Response("Resource unavailable", { status: 404 });
    }
  });
}
export function secureWindow(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("will-frame-navigate", (event) =>
    event.preventDefault(),
  );
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
}
