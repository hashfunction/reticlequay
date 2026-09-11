import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  boundsForPreset,
  validatePreset,
  validateSettings,
  livePresets,
  PresetStore,
} from "../src/presets";
const validPreset = {
  id: "p1",
  name: "Precision",
  displayId: "left",
  shape: "cross",
  color: "#72dec9",
  size: 40,
  opacity: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  visible: true,
};
const left = {
  id: "left",
  bounds: { x: -1920, y: 0, width: 1920, height: 1080 },
  scaleFactor: 1.5,
};
const settings = {
  version: 1,
  presets: [validPreset],
  activeByDisplay: { left: "p1" },
};
test("centers a 40 DIP overlay on a display left of primary", () => {
  assert.deepEqual(boundsForPreset(validPreset, left), {
    x: -980,
    y: 520,
    width: 40,
    height: 40,
  });
});
test("uses display origin and DIP offsets without applying scale twice", () => {
  assert.deepEqual(
    boundsForPreset(
      { ...validPreset, offsetX: 20, offsetY: -10 },
      {
        ...left,
        bounds: { x: 0, y: -1200, width: 1600, height: 1200 },
        scaleFactor: 2,
      },
    ),
    { x: 800, y: -630, width: 40, height: 40 },
  );
});
test("clamps large offsets to selected display instead of leaking onto adjacent display", () => {
  assert.deepEqual(
    boundsForPreset({ ...validPreset, offsetX: 30000, offsetY: -30000 }, left),
    { x: -40, y: 0, width: 40, height: 40 },
  );
});
test("rejects non-finite and out-of-range settings", () => {
  for (const patch of [
    { opacity: NaN },
    { size: 100000 },
    { size: 0 },
    { offsetX: Infinity },
    { rotation: 361 },
    { visible: "yes" },
    { name: "" },
    { color: "red;url(x)" },
    { shape: "../../evil.png" },
    { shape: "<svg onload=alert(1)>" },
    { assetPath: "/tmp/x.png" },
  ])
    assert.throws(() => validatePreset({ ...validPreset, ...patch }));
  assert.deepEqual(validatePreset(validPreset), validPreset);
});
test("rejects duplicates, dangling selections and cross-display preset mappings", () => {
  assert.throws(() =>
    validateSettings({ ...settings, presets: [validPreset, validPreset] }),
  );
  assert.throws(() =>
    validateSettings({ ...settings, activeByDisplay: { left: "missing" } }),
  );
  assert.throws(() =>
    validateSettings({ ...settings, activeByDisplay: { right: "p1" } }),
  );
});
test("disconnected display stays saved and restores only when same display returns", () => {
  assert.deepEqual(livePresets(settings, []), []);
  assert.deepEqual(livePresets(settings, [{ ...left, id: "right" }]), []);
  assert.equal(livePresets(settings, [left])[0].preset.id, "p1");
  assert.equal(settings.presets.length, 1);
});
test("atomically round-trips settings using real files", async () => {
  const root = await mkdtemp(join(tmpdir(), "rq-presets-"));
  try {
    const store = new PresetStore(root);
    await store.save(settings);
    assert.deepEqual((await store.load()).settings, settings);
    assert.deepEqual(await readdir(root), ["presets.json"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("preserves corrupt bytes in recovery copy and starts safely empty", async () => {
  const root = await mkdtemp(join(tmpdir(), "rq-corrupt-"));
  try {
    await writeFile(join(root, "presets.json"), "{bad");
    const result = await new PresetStore(root).load();
    assert.equal(result.recovered, true);
    assert.equal(result.settings.presets.length, 0);
    const backup = (await readdir(root)).find((x) =>
      x.startsWith("presets.corrupt-"),
    );
    assert.ok(backup);
    assert.equal(await readFile(join(root, backup), "utf8"), "{bad");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("fresh install is empty and invalid saves leave previous settings intact", async () => {
  const root = await mkdtemp(join(tmpdir(), "rq-valid-"));
  try {
    const store = new PresetStore(root);
    assert.equal((await store.load()).settings.presets.length, 0);
    await store.save(settings);
    await assert.rejects(
      store.save({
        ...settings,
        presets: [{ ...validPreset, size: Infinity }],
      }),
    );
    assert.deepEqual((await store.load()).settings, settings);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
