import { test } from "node:test";
import assert from "node:assert/strict";
import { geometryForShape } from "../src/assets";
test("built-in reticles contain bounded simple geometry", () => {
  for (const shape of ["cross", "dot", "ring", "chevron", "cross-dot"]) {
    const geometry = geometryForShape(shape);
    assert.ok(geometry.length > 0);
    for (const part of geometry) {
      assert.ok(["line", "circle"].includes(part.kind));
      assert.ok(
        part.values.every((n) => Number.isFinite(n) && n >= 0 && n <= 100),
      );
    }
  }
});
test("imported file paths, markup and unsupported shapes are rejected", () => {
  for (const input of [
    "file:///tmp/a.png",
    "../../a.svg",
    "<svg onload=alert(1)>",
    "data:image/png;base64,a",
    "custom",
    null,
    {},
  ])
    assert.throws(() => geometryForShape(input));
});
