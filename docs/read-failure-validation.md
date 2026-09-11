# Review fix: preserve unreadable presets

The prior startup catch displayed an error but left empty settings writable.
A read error such as EACCES could therefore be followed by an atomic save that
replaced the unreadable original file. Atomic writes alone did not protect it.

SettingsSession now owns successful-load state and persisted mutations. It starts
locked, locks before every load, and unlocks only after PresetStore.load succeeds.
On failure it preserves the last known state and reports an actionable read-access
and restart error. Every main-process IPC command checks this prerequisite;
settings mutations also enforce it inside SettingsSession.apply. The renderer
receives settingsWritable and disables editor controls and action buttons while
locked. No automatic retry promotes empty state to writable state. An explicit
successful load (or restart) is required. Corrupt data remains editable only after
PresetStore.load successfully preserves its bytes in a recovery copy.

## TDD evidence

The first test run used an extraction of the existing startup catch/save behavior:
`npx tsx --test tests/settings-session.test.ts` failed 3 of 4 cases. The corruption
recovery control case passed. See read-failure-red.log.

After adding the guard, the same command passed all 4 cases:

- Real POSIX chmod000 read failure; restore permissions; reject save, activate and
  delete; confirm original bytes and directory entries remain exactly unchanged;
  explicitly reload, then successfully edit the original preset.
- Inject EACCES on reload while using a real PresetStore for all writes; preserve
  prior settings and original bytes, rejecting all mutation kinds.
- Reject mutation before any successful load without creating any file.
- Successfully backed-up corrupt data permits new presets and preserves backup bytes.

The real chmod case is explicitly skipped on Windows because chmod does not
establish a Windows deny-read ACL. The injected EACCES test runs on all platforms.

Final commands: npm run build; npm test (20 passed); node --check
public/scripts/main.js; git diff --check. GUI Electron smoke was not rerun for this
patch because the Mac desktop was locked. Historical smoke logs predate this
patch and are not presented as validation of its UI changes. Windows ACL and
actual GUI read-error validation remain follow-up checks for the controller.
