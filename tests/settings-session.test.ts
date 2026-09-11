import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chmod,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PresetStore } from "../src/presets";
import { SettingsSession } from "../src/settings-session";
import type { Preset, Settings } from "../src/types";
const preset: Preset = {
  id: "original",
  name: "Do not lose",
  displayId: "1",
  shape: "cross",
  color: "#72dec9",
  size: 40,
  opacity: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  visible: true,
};
const initial: Settings = {
  version: 1,
  presets: [preset],
  activeByDisplay: { "1": "original" },
};
const commands = [
  { kind: "save", preset: { ...preset, id: "replacement" } },
  { kind: "activate", id: "original" },
  { kind: "delete", id: "original" },
];

test(
  "unreadable startup locks every persisted mutation and preserves original bytes even after permissions return",
  {
    skip:
      process.platform === "win32"
        ? "POSIX chmod test; injected EACCES test runs on Windows"
        : false,
  },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "rq-read-guard-"));
    const file = join(root, "presets.json");
    const original = JSON.stringify(initial, null, 4) + "\n";
    try {
      await writeFile(file, original);
      await chmod(file, 0o000);
      const session = new SettingsSession(new PresetStore(root));
      await session.load();
      assert.equal(session.writable, false);
      assert.match(session.notice, /could not be read/i);
      assert.match(session.notice, /restart/i);
      await chmod(file, 0o600);
      for (const command of commands)
        await assert.rejects(session.apply(command), /read|restart/i);
      assert.equal(await readFile(file, "utf8"), original);
      assert.deepEqual(await readdir(root), ["presets.json"]);
      // Only an explicit successful reload unlocks editing and restores the originals.
      await session.load();
      assert.equal(session.writable, true);
      assert.deepEqual(session.settings, initial);
      await session.apply({ kind: "save", preset: { ...preset, size: 64 } });
      assert.equal(
        JSON.parse(await readFile(file, "utf8")).presets[0].size,
        64,
      );
    } finally {
      await chmod(file, 0o600).catch(() => {});
      await rm(root, { recursive: true, force: true });
    }
  },
);

test("injected read failure cannot promote empty settings or write through the real store", async () => {
  const root = await mkdtemp(join(tmpdir(), "rq-injected-read-"));
  const file = join(root, "presets.json");
  const original = JSON.stringify(initial) + "\n";
  try {
    await writeFile(file, original);
    const store = new PresetStore(root);
    let failing = false;
    // Inject only the I/O read failure; mutation still goes through the real filesystem store.
    const session = new SettingsSession({
      load: async () => {
        if (failing)
          throw Object.assign(new Error("Access denied"), { code: "EACCES" });
        return store.load();
      },
      save: (value) => store.save(value),
    });
    await session.load();
    failing = true;
    await session.load();
    assert.equal(session.writable, false);
    assert.deepEqual(session.settings, initial);
    for (const command of commands)
      await assert.rejects(session.apply(command), /read|restart/i);
    assert.equal(await readFile(file, "utf8"), original);
    assert.deepEqual(await readdir(root), ["presets.json"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("no mutation is accepted before loading has completed", async () => {
  const root = await mkdtemp(join(tmpdir(), "rq-not-loaded-"));
  try {
    const session = new SettingsSession(new PresetStore(root));
    await assert.rejects(session.apply(commands[0]), /read|restart/i);
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("successfully preserved corrupt settings remain editable", async () => {
  const root = await mkdtemp(join(tmpdir(), "rq-corrupt-edit-"));
  try {
    await writeFile(join(root, "presets.json"), "{corrupt");
    const session = new SettingsSession(new PresetStore(root));
    await session.load();
    assert.equal(session.writable, true);
    assert.match(session.notice, /recovery/i);
    await session.apply(commands[0]);
    const backup = (await readdir(root)).find((name) =>
      name.startsWith("presets.corrupt-"),
    );
    assert.ok(backup);
    assert.equal(await readFile(join(root, backup), "utf8"), "{corrupt");
    assert.equal(
      JSON.parse(await readFile(join(root, "presets.json"), "utf8")).presets[0]
        .id,
      "replacement",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
