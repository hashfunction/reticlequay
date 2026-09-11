# Validation evidence

Logs are captured command output with the source checkout prefix normalized to
`<source>` for publication. No credentials were captured.

Initial unit RED: `npm test` with explicit unimplemented feature stubs:
9 failures / 11 tests. Geometry/persistence implementation made all 11 pass.
Command RED: 3 failures / 15 tests; implementation made all 15 pass.
Package staging RED: 1 failure / 16 tests; staging implementation made all 16 pass.
Some invalid-input tests already passed against throwing stubs; successful-input
assertions and later green behavior are what established working validation.

The first real Electron attempt ran before the rebuilt entrypoint was available
and failed to launch (SIGTRAP); this is infrastructure evidence, not a valid
behavioral RED. A later attempt timed out on disabled Update because the test used
the bridge to create a preset without selecting it in the editor. The corrected
native-form test then exposed a save-completion timing failure (40 vs 64 persisted).
The UI now disables fields during saves and the test waits for visible completion
before subsequent edits. Recorded final smoke verifies real native form save and
update, actual disk bytes, overlay draw, isolation, blocked navigation/new windows,
hide/show and restart restoration. It does not simulate OS-level hotkeys or clicks
through to a game and is not Windows hardware evidence.

`npm audit --audit-level=high`: 0 vulnerabilities.
`node --check public/scripts/{main,draw,crosshair}.js`: success (each file separately).
`git diff --check`: success.
`node scripts/package-windows.cjs` on macOS: expected exit 1, instructing use of
Windows x64. Portable staging is tested locally; no Windows executable is claimed.
