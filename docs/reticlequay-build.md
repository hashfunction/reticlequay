# AimWisp build and verification

Baseline: Crosshair Y 4.2, commit `51edd7201021b92382a0e32960d27c21c5c2341b`.
Source branch: `codex/reticlequay`. Product version: `1.0.1`.

## Reproducible commands

- `npm ci` installs exact package-lock dependencies.
- `npm run build` removes previous compiled output and compiles TypeScript.
- `npm test` exercises geometry, validation, real filesystem persistence,
  command/state rules, sender checks and portable staging. Run build first on a
  fresh clone because staging intentionally verifies the real compiled application.
- `npm run test:smoke` builds and runs the real app through Playwright Electron;
  requires a graphical desktop. It uses an isolated temporary user-data directory,
  checks actual renderer bridges and controls, and removes its test settings.
- `npm start` builds and launches the interactive app.
- On Windows x64, `npm run package:win` builds an unsigned portable app folder.
- `powershell -ExecutionPolicy Bypass -File scripts/package-windows.ps1` installs,
  builds, tests, packages, ZIPs, and prints the ZIP SHA-256. The caller must review
  its local execution policy. No signing keys or Store identities are embedded.

Node 24+ recommended. Local implementation validation used Node 25.2.1, npm 11.6.4,
macOS arm64, Electron 44.3.0. `npm view electron@44.3.0 version` and
`npm view electron dist-tags --json` verified 44.3.0 as npm `latest` on 2026-09-11 UTC.
The controller independently checked the official Electron releases chart.
Primary security guidance: https://www.electronjs.org/docs/latest/tutorial/security

## Application and trust boundaries

The main process owns display information, the JSON file, active mappings and
window creation. Every IPC request verifies the exact controls WebContents and its
main sender frame and exact local URL. Renderer frames use `sandbox: true`,
`contextIsolation: true`, and `nodeIntegration: false`. The controls preload exposes
only getState, typed command, fixed help targets and state subscription. Overlay
preload exposes only a settings listener, with no write/invoke surface.

A private `reticlequay://app` protocol serves a fixed allowlist of packaged files.
CSP blocks remote content, connections, frames, inline scripts and object embeds.
Navigation, popups, webviews and permission requests are denied. Support/privacy
open only their fixed canonical HTTPS URLs in the system browser; the license
button displays bundled notices. There is no arbitrary shell/URL/file IPC.

Presets are validated against an exact schema: finite values, bounded integer
DIP size/offsets, hexadecimal color, known shape, bounded name, boolean visibility.
There are at most 200 presets. Unknown fields, custom images, markup, paths,
prototype keys, duplicate IDs, dangling selections and cross-display mappings
are rejected. No custom imports or crafted-image decoder surface exists.

Writes use a unique temporary sibling, file fsync, close and rename. The main
command queue serializes mutations and publishes new active state only after the
save succeeds. Corrupt JSON is preserved in a uniquely named recovery file.
A settings session blocks every command before a successful load. Read errors
(including EACCES or a failed corruption-backup rename) preserve the original file
and leave editing disabled. Restoring permissions alone does not unlock writes;
a successful explicit load or application restart is required. The UI reports the
read failure and disables settings actions. Successfully preserved corrupt settings
remain editable because their original bytes already have a recovery copy.

Monitor origins and sizes come from Electron DIP bounds; scale factors are used
for display information, never multiplied into placement again. Offsets clamp
inside the assigned display. Absent display IDs keep saved presets but no overlay.

## Asset and package scope

The package staging allowlist includes only compiled `dist`, current `public`,
a minimal package manifest, LICENSE and THIRD_PARTY_NOTICES.md. Source, tests,
design context, git history, raw SVG editor, updater, old assets and dev dependencies
are not staged. Electron's runtime license files remain alongside the executable.
Original in-code reticle/tray geometry and system font references need no separate
asset files. The application icon is generated from original geometry and supplied to the
Windows packager. Store imagery is a subsequent controller-owned release task.

## Windows acceptance still required

This task did not build or install an MSIX or execute a Windows binary. Run the
Windows scripts and retain command output, portable ZIP hash and exact executable
hash. Then validate physical mixed-DPI monitors (including negative origins),
hot-plug/replug, metrics/scaling changes, per-display visibility and presets,
OS-level Ctrl+Shift+H and conflicts, pointer click-through onto a windowed or
borderless game, tray quit/reopen, settings permission/disk failures, and Windows
install/uninstall behavior. Pure monitor tests are simulated geometry, not hardware
validation. Application IDs from Electron may change when hardware/driver topology
changes; saved presets intentionally never migrate to an unrelated ID automatically.

MSIX identity, signing, capabilities, Partner Center submission, Windows screenshots,
Store certification and canonical website DNS/HTTPS verification belong to the
release task. Do not describe the portable folder as a tested Store package.
