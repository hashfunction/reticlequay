// Original ReticleQuay artwork, Copyright 2026 Trieflow LLC, MIT.
// Reproducible RGBA PNG and Windows ICO; no imported assets or image libraries.
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const name = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(bytes.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([size, name, bytes, crc]);
}
function icon(size) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = ((x + 0.5) * 256) / size,
        py = ((y + 0.5) * 256) / size;
      const cornerX = Math.max(48 - px, 0, px - 208),
        cornerY = Math.max(48 - py, 0, py - 208);
      const inside = Math.hypot(cornerX, cornerY) <= 48;
      const vertical =
        Math.abs(px - 128) <= 7 &&
        ((py >= 58 && py <= 105) || (py >= 151 && py <= 198));
      const horizontal =
        Math.abs(py - 128) <= 7 &&
        ((px >= 58 && px <= 105) || (px >= 151 && px <= 198));
      const dot = Math.hypot(px - 128, py - 128) <= 10;
      const edge =
        Math.hypot(px - 128, py - 128) >= 89 &&
        Math.hypot(px - 128, py - 128) <= 91;
      const color =
        vertical || horizontal || dot
          ? [114, 222, 201]
          : edge
            ? [48, 70, 84]
            : [16, 27, 39];
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      rows.set([...color, inside ? 255 : 0], offset);
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const sizes = [16, 32, 48, 256],
  images = sizes.map(icon),
  header = Buffer.alloc(6);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = 6 + images.length * 16;
const entries = images.map((bytes, i) => {
  const entry = Buffer.alloc(16);
  entry[0] = sizes[i] === 256 ? 0 : sizes[i];
  entry[1] = entry[0];
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(bytes.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += bytes.length;
  return entry;
});
const root = path.resolve(__dirname, "..");
fs.mkdirSync(path.join(root, "assets"), { recursive: true });
fs.writeFileSync(
  path.join(root, "assets", "reticlequay.ico"),
  Buffer.concat([header, ...entries, ...images]),
);
fs.writeFileSync(path.join(root, "public", "icon.png"), images[3]);
