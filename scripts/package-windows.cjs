const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
async function stageApplication(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  for (const entry of ["dist", "public", "LICENSE", "THIRD_PARTY_NOTICES.md"])
    await fs.cp(path.join(source, entry), path.join(destination, entry), {
      recursive: true,
    });
  const pkg = JSON.parse(
    await fs.readFile(path.join(source, "package.json"), "utf8"),
  );
  const minimal = {
    name: pkg.name,
    productName: pkg.productName,
    version: pkg.version,
    description: pkg.description,
    author: pkg.author,
    license: pkg.license,
    main: pkg.main,
  };
  await fs.writeFile(
    path.join(destination, "package.json"),
    JSON.stringify(minimal, null, 2) + "\n",
  );
}
exports.stageApplication = stageApplication;
async function main() {
  if (process.platform !== "win32")
    throw new Error(
      "Run portable Windows packaging on Windows x64. Local builds and staging tests do not verify a Windows executable.",
    );
  const staging = await fs.mkdtemp(
    path.join(os.tmpdir(), "reticlequay-package-"),
  );
  try {
    await stageApplication(path.resolve("."), staging);
    const { packager } = await import("@electron/packager");
    const result = await packager({
      dir: staging,
      name: "AimWisp",
      icon: path.resolve("assets/reticlequay.ico"),
      platform: "win32",
      arch: "x64",
      electronVersion: "44.3.0",
      out: path.resolve("build"),
      overwrite: true,
      asar: true,
      prune: true,
      appCopyright: "Copyright 2026 Trieflow LLC",
      win32metadata: {
        CompanyName: "Trieflow LLC",
        FileDescription: "AimWisp display preset overlay",
      },
    });
    console.log("Portable Windows application directory:", result.join(", "));
    console.log(
      "Unsigned development build. Windows runtime, packaging identity, signing and Store certification are separate release gates.",
    );
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
