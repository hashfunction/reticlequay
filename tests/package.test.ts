import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
const { stageApplication } = createRequire(import.meta.url)(
  "../scripts/package-windows.cjs",
);
test("portable staging includes runnable app and licenses while excluding source, tests and unsafe legacy assets", async () => {
  const root = await mkdtemp(join(tmpdir(), "rq-stage-"));
  try {
    await stageApplication(resolve("."), root);
    const names = await readdir(root);
    assert.deepEqual(names.sort(), [
      "LICENSE",
      "THIRD_PARTY_NOTICES.md",
      "dist",
      "package.json",
      "public",
    ]);
    const manifest = JSON.parse(
      await readFile(join(root, "package.json"), "utf8"),
    );
    assert.equal(manifest.main, "dist/index.js");
    assert.equal(manifest.dependencies, undefined);
    const assets = await readdir(join(root, "public"));
    assert.equal(assets.includes("editor.html"), false);
    assert.equal(assets.includes("fonts"), false);
    assert.ok(
      (await readFile(join(root, "LICENSE"), "utf8")).includes("YSSF8"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
