const { _electron: electron } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const executablePath = process.env.RETICLEQUAY_EXECUTABLE;
function launchOptions(userData) {
  return {
    ...(executablePath ? { executablePath } : {}),
    args: [...(executablePath ? [] : [path.resolve(".")]), "--user-data-dir=" + userData],
    timeout: 30000,
  };
}
(async () => {
  const base = process.env.RETICLEQUAY_SMOKE_ROOT || os.tmpdir();
  await fs.mkdir(base, { recursive: true });
  const root = await fs.mkdtemp(path.join(base, "reticlequay-smoke-"));
  let app;
  try {
    // Electron's own user-data-dir switch isolates the real application without a test-only IPC surface.
    app = await electron.launch(launchOptions(root));
    if (executablePath) {
      const actual = await app.evaluate(({ app }) => ({ packaged: app.isPackaged, executable: process.execPath }));
      assert.equal(actual.packaged, true);
      assert.equal(path.resolve(actual.executable).toLowerCase(), path.resolve(executablePath).toLowerCase());
    }
    const page = await app.firstWindow();
    await page.waitForFunction(() => Boolean(window.reticlequay));
    assert.deepEqual(
      await page.evaluate(() => ({
        require: typeof require,
        process: typeof process,
      })),
      { require: "undefined", process: "undefined" },
    );
    const initial = await page.evaluate(() => window.reticlequay.getState());
    assert.equal(initial.ok, true);
    assert.ok(initial.state.displays.length > 0);
    const display = initial.state.displays[0];
    const preset = {
      id: "smoke",
      name: "Precision",
      displayId: display.id,
      shape: "cross-dot",
      color: "#72dec9",
      size: 40,
      opacity: 0.7,
      rotation: 15,
      offsetX: 0,
      offsetY: 0,
      visible: true,
    };
    await page
      .getByLabel("Preset name", { exact: true })
      .fill("Precision");
    await page
      .getByLabel("Built-in shape", { exact: true })
      .selectOption("cross-dot");
    await page.getByLabel("Opacity (%)", { exact: true }).fill("70");
    await page.getByLabel("Rotation (°)", { exact: true }).fill("15");
    await page
      .getByRole("button", { name: "Save new & apply", exact: true })
      .click();
    await page.waitForFunction(
      async () =>
        (await window.reticlequay.getState()).state.settings.presets[0]
          ?.name === "Precision",
    );
    await page.waitForFunction(
      () =>
        document.querySelector("#status").textContent ===
        "New preset saved and applied.",
    );
    await page.getByLabel("Size (DIP)", { exact: true }).fill("64");
    await page
      .getByRole("button", { name: "Update preset", exact: true })
      .click();
    await page.waitForFunction(
      async () =>
        (await window.reticlequay.getState()).state.settings.presets[0].size ===
        64,
    );
    await page.waitForFunction(
      () =>
        document.querySelector("#status").textContent ===
        "Preset updated and applied.",
    );
    assert.equal(
      JSON.parse(await fs.readFile(path.join(root, "presets.json"), "utf8"))
        .presets[0].size,
      64,
    );
    const rejected = await page.evaluate(
      (p) =>
        window.reticlequay.command({
          kind: "save",
          preset: { ...p, shape: "<svg onload=alert(1)>" },
        }),
      preset,
    );
    assert.equal(rejected.ok, false);
    const overlay = await app
      .waitForEvent("window", {
        predicate: (p) => p.url().includes("crosshair"),
        timeout: 2000,
      })
      .catch(() => app.windows().find((p) => p.url().includes("crosshair")));
    assert.ok(overlay);
    await overlay.waitForFunction(
      () =>
        window.overlay &&
        document.querySelector("canvas").dataset.drawn === "true",
    );
    assert.deepEqual(
      await overlay.evaluate(() => ({
        command: typeof window.reticlequay,
        require: typeof require,
        process: typeof process,
      })),
      { command: "undefined", require: "undefined", process: "undefined" },
    );
    const prefs = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((w) => ({
        url: w.webContents.getURL(),
        preferences: w.webContents.getLastWebPreferences(),
        focusable: w.isFocusable(),
        visible: w.isVisible(),
      })),
    );
    for (const win of prefs) {
      assert.equal(win.preferences.sandbox, true);
      assert.equal(win.preferences.contextIsolation, true);
      assert.equal(win.preferences.nodeIntegration, false);
    }
    assert.equal(
      prefs.find((w) => w.url.includes("crosshair")).focusable,
      false,
    );
    if (executablePath && process.platform === "win32") {
      // Resize the actual installed app window; screenshots contain its real rendering,
      // with no image scaling, overlays, or replacement UI.
      await app.evaluate(({ BrowserWindow }) => {
        const controls = BrowserWindow.getAllWindows().find((w) => !w.webContents.getURL().includes("crosshair"));
        controls.setContentSize(1366, 900);
      });
      await page.waitForFunction(() => window.innerWidth >= 1366 && window.innerHeight >= 900);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.resolve("docs/store-controls.png"), fullPage: true });
      await page.getByText("About & help", { exact: true }).click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.resolve("docs/store-help.png"), fullPage: true });
      await page.getByText("About & help", { exact: true }).click();
    }
    // The intentional denied navigation leaves Playwright auto-wait pending; perform UI clicks before this security probe.
    const before = page.url();
    await page.evaluate(() => {
      location.href = "https://example.com";
    });
    await page.waitForTimeout(250);
    assert.equal(page.url(), before);
    await page.evaluate(() => window.open("https://example.com"));
    await page.waitForTimeout(100);
    assert.equal(app.windows().length, 2);
    await page.evaluate(() => window.reticlequay.command({ kind: "toggle" }));
    assert.equal(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes("crosshair"))
          .isVisible(),
      ),
      false,
    );
    await page.evaluate(() => window.reticlequay.command({ kind: "toggle" }));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.resolve("docs/controls-smoke.png"), fullPage: true });
    await app.close();
    app = null;
    const persisted = JSON.parse(
      await fs.readFile(path.join(root, "presets.json"), "utf8"),
    );
    assert.equal(persisted.presets[0].size, 64);
    app = await electron.launch(launchOptions(root));
    const relaunched = await app.firstWindow();
    await relaunched.waitForFunction(
      async () =>
        window.reticlequay &&
        (await window.reticlequay.getState()).state.settings.presets[0]
          ?.size === 64,
    );
    console.log(
      "PASS: real Electron startup, sandbox bridge, controls save/update, generated overlay, invalid payload rejection, navigation/new-window denial, hide/show and persisted relaunch.",
    );
  } finally {
    if (app) await app.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
