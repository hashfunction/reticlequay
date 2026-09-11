# ReticleQuay

A local crosshair overlay with independent named presets for each connected display.
A maintained MIT-licensed fork of [Crosshair Y](https://github.com/YSSF8/crosshair-y)
by YSSF8, starting at commit `51edd7201021b92382a0e32960d27c21c5c2341b`.

- Five original built-in shapes: cross, dot, ring, chevron, cross + dot.
- Set size, color, opacity, rotation, visibility and display-relative DIP offsets.
- Save, load, update and delete named presets. One active preset per display.
- Disconnected displays retain their presets; their overlays stop until they return.
- Click-through overlays, tray controls, and Ctrl+Shift+H global hide/show.
- Isolated sandboxed renderers and application-owned atomic JSON persistence.

Designed for Windows windowed and borderless games. Exclusive fullscreen and Game
Bar integration are not supported. No game memory access, injection, telemetry,
network update service, custom image imports, or SVG editor. Current macOS tests
verify the application framework; Windows runtime and Store release gates remain
separate and must be completed before release.

## Development

Use Node.js 24 or later with npm. Run `npm ci`, `npm run build`, `npm test`, and
`npm run test:smoke`. Start with `npm start`. A graphical desktop session is
required for Electron smoke tests. The smoke test uses a temporary user-data
folder and closes its application after completion.

On Windows x64 run `powershell -ExecutionPolicy Bypass -File scripts/package-windows.ps1`
from a developer PowerShell session. Or run `npm run package:win` after installing
dependencies. This produces an unsigned portable folder under `build/`, not an
MSIX or a Store-certified package. [Build and validation notes](docs/reticlequay-build.md).

## Help and licensing

[Product](https://reticlequay.trieflow.com) ·
[Support](https://reticlequay.trieflow.com/support) ·
[Privacy](https://reticlequay.trieflow.com/privacy)

These canonical release endpoints are managed separately from this source task;
their availability is a release gate, not established by an app build.

Presets are in `presets.json` within Electron's ReticleQuay user-data directory
(normally `%APPDATA%/ReticleQuay` on Windows). Corrupt settings are renamed to a
`presets.corrupt-*.json` recovery file. Save failures leave the last valid file
and active state intact. A startup read error disables all settings commands;
restore read access to presets.json and restart before editing. Successfully
backed-up corrupt settings may be replaced with new presets. The temporary global
hide/show toggle resets on launch;
each preset's visibility is saved permanently.

The original MIT copyright and full grant remain in [LICENSE](LICENSE).
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) documents runtime/tool versions,
changes and asset provenance. Retain Electron's runtime license files when packaging.

## Windows package pipeline

The Windows workflow installs pinned dependencies, builds before running staging tests, runs the real Electron workflow on Windows, and creates an unsigned x64 MSIX with `scripts/package-msix.ps1`. It clears the committed macOS sample capture before collecting Windows evidence. Microsoft-assigned package identity fields are required and may differ from the app brand. Package construction does not establish installation, hardware validation, Store certification or publication.
