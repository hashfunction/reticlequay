import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { geometryForShape } from "./assets";
import type { Preset, DisplayGeometry, Settings } from "./types";
const presetKeys = [
  "id",
  "name",
  "displayId",
  "shape",
  "color",
  "size",
  "opacity",
  "rotation",
  "offsetX",
  "offsetY",
  "visible",
];
export const emptySettings = (): Settings => ({
  version: 1,
  presets: [],
  activeByDisplay: {},
});
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a settings object.");
  return value as Record<string, unknown>;
}
export function exactKeys(
  value: Record<string, unknown>,
  keys: string[],
): void {
  if (
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    throw new Error("Unexpected or missing settings fields.");
}
function text(value: unknown, field: string, limit: number): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > limit ||
    /[\x00-\x1f]/.test(value)
  )
    throw new Error(`${field} must contain 1–${limit} printable characters.`);
  return value;
}
export function identifier(value: unknown): string {
  const id = text(value, "Identifier", 100);
  if (
    !/^[a-zA-Z0-9_-]+$/.test(id) ||
    ["__proto__", "constructor", "prototype"].includes(id)
  )
    throw new Error("Invalid identifier.");
  return id;
}
function number(
  value: unknown,
  field: string,
  min: number,
  max: number,
  integer = false,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new Error(
      `${field} must be ${integer ? "a whole number " : ""}between ${min} and ${max}.`,
    );
  return value;
}
export function validatePreset(value: unknown): Preset {
  const p = record(value);
  exactKeys(p, presetKeys);
  identifier(p.id);
  identifier(p.displayId);
  text(p.name, "Preset name", 60);
  geometryForShape(p.shape);
  if (typeof p.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(p.color))
    throw new Error("Color must be a six-digit hexadecimal color.");
  number(p.size, "Size", 8, 512, true);
  number(p.opacity, "Opacity", 0.05, 1);
  number(p.rotation, "Rotation", 0, 360);
  number(p.offsetX, "Horizontal offset", -32768, 32768, true);
  number(p.offsetY, "Vertical offset", -32768, 32768, true);
  if (typeof p.visible !== "boolean")
    throw new Error("Visibility must be true or false.");
  return { ...p } as unknown as Preset;
}
export function validateSettings(value: unknown): Settings {
  const data = record(value);
  exactKeys(data, ["version", "presets", "activeByDisplay"]);
  if (
    data.version !== 1 ||
    !Array.isArray(data.presets) ||
    data.presets.length > 200
  )
    throw new Error(
      "Unsupported settings version or too many presets (maximum 200).",
    );
  const presets = data.presets.map(validatePreset);
  const byId = new Map(presets.map((p) => [p.id, p]));
  if (byId.size !== presets.length)
    throw new Error("Preset identifiers must be unique.");
  const active = record(data.activeByDisplay);
  const activeByDisplay: Record<string, string> = {};
  for (const [display, id] of Object.entries(active)) {
    identifier(display);
    identifier(id);
    if (byId.get(id as string)?.displayId !== display)
      throw new Error("Active preset must belong to the selected display.");
    activeByDisplay[display] = id as string;
  }
  return { version: 1, presets, activeByDisplay };
}
export function boundsForPreset(
  p: Pick<Preset, "size" | "offsetX" | "offsetY">,
  display: DisplayGeometry,
): DisplayGeometry["bounds"] {
  const { x, y, width, height } = display.bounds;
  const size = Math.min(p.size, width, height);
  return {
    x: Math.round(
      Math.max(
        x,
        Math.min(x + width - size, x + (width - size) / 2 + p.offsetX),
      ),
    ),
    y: Math.round(
      Math.max(
        y,
        Math.min(y + height - size, y + (height - size) / 2 + p.offsetY),
      ),
    ),
    width: size,
    height: size,
  };
}
export function livePresets(
  settings: Settings,
  displays: DisplayGeometry[],
): { preset: Preset; display: DisplayGeometry }[] {
  return displays.flatMap((display) => {
    const preset = settings.presets.find(
      (p) =>
        p.id === settings.activeByDisplay[display.id] &&
        p.displayId === display.id,
    );
    return preset ? [{ preset, display }] : [];
  });
}
export class PresetStore {
  private readonly file: string;
  constructor(private readonly directory: string) {
    this.file = join(directory, "presets.json");
  }
  async load(): Promise<{ settings: Settings; recovered: boolean }> {
    let raw: string;
    try {
      raw = await readFile(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { settings: emptySettings(), recovered: false };
      throw error;
    }
    try {
      if (Buffer.byteLength(raw) > 1024 * 1024)
        throw new Error("Settings too large.");
      return { settings: validateSettings(JSON.parse(raw)), recovered: false };
    } catch {
      await rename(
        this.file,
        join(
          this.directory,
          `presets.corrupt-${Date.now()}-${randomUUID()}.json`,
        ),
      );
      return { settings: emptySettings(), recovered: true };
    }
  }
  async save(value: unknown): Promise<void> {
    const settings = validateSettings(value);
    await mkdir(this.directory, { recursive: true });
    const temporary = join(this.directory, `.presets-${randomUUID()}.tmp`);
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(JSON.stringify(settings, null, 2) + "\n");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, this.file);
    } finally {
      await unlink(temporary).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
}
