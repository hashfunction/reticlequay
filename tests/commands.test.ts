import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCommand, trustedSender } from "../src/commands";
const p = {
  id: "one",
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
const base = { version: 1, presets: [p], activeByDisplay: { left: "one" } };
test("save activates only the matching monitor; delete removes its active mapping", () => {
  const next = applyCommand(base, {
    kind: "save",
    preset: { ...p, id: "two", displayId: "right" },
  });
  assert.deepEqual(next.activeByDisplay, { left: "one", right: "two" });
  const deleted = applyCommand(next, { kind: "delete", id: "one" });
  assert.deepEqual(deleted.activeByDisplay, { right: "two" });
  assert.equal(deleted.presets.length, 1);
  assert.equal(base.presets.length, 1);
});
test("named presets load independently per display and cannot migrate existing IDs", () => {
  const saved = applyCommand(base, {
    kind: "save",
    preset: { ...p, id: "other", name: "Other" },
  });
  assert.equal(
    applyCommand(saved, { kind: "activate", id: "one" }).activeByDisplay.left,
    "one",
  );
  assert.throws(() =>
    applyCommand(base, { kind: "save", preset: { ...p, displayId: "right" } }),
  );
  assert.throws(() => applyCommand(base, { kind: "activate", id: "absent" }));
});
test("malformed commands cannot add privileged operations or extra fields", () => {
  for (const command of [
    { kind: "shell", url: "file:///tmp/a" },
    { kind: "save", preset: { ...p, assetPath: "a.svg" } },
    { kind: "delete", id: "one", path: "/tmp/a" },
    null,
  ])
    assert.throws(() => applyCommand(base, command));
});
test("IPC permits the controls main frame and denies overlay, subframes and navigated frames", () => {
  const mainFrame = { url: "reticlequay://app/index.html" };
  const sender = { id: 10, mainFrame };
  assert.equal(trustedSender({ sender, senderFrame: mainFrame }, sender), true);
  assert.equal(
    trustedSender(
      { sender: { id: 11, mainFrame }, senderFrame: mainFrame },
      sender,
    ),
    false,
  );
  assert.equal(
    trustedSender({ sender, senderFrame: { url: mainFrame.url } }, sender),
    false,
  );
  assert.equal(trustedSender({ sender, senderFrame: null }, sender), false);
  mainFrame.url = "https://evil.example";
  assert.equal(
    trustedSender({ sender, senderFrame: mainFrame }, sender),
    false,
  );
});
