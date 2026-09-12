const fs = require("node:fs");
const cp = require("node:child_process");
const path = require("node:path");
require("./generate-icons.cjs");
fs.rmSync("dist", { recursive: true, force: true });
const result = cp.spawnSync(
  process.execPath,
  [
    path.join(
      path.dirname(require.resolve("typescript/package.json")),
      "bin",
      "tsc",
    ),
    "--project",
    "tsconfig.json",
  ],
  { stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status || 1);
console.log("Built AimWisp TypeScript main and sandboxed preload scripts.");
