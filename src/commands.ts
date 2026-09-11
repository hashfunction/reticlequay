import {
  exactKeys,
  identifier,
  record,
  validatePreset,
  validateSettings,
} from "./presets";
import type { Settings } from "./types";
export const CONTROL_URL = "reticlequay://app/index.html";
interface Frame {
  url: string;
}
interface Sender {
  id: number;
  mainFrame: Frame;
}
export function trustedSender(
  event: { sender: Sender; senderFrame: Frame | null },
  controls: Sender | undefined,
): boolean {
  return Boolean(
    controls &&
      event.sender === controls &&
      event.senderFrame === controls.mainFrame &&
      event.senderFrame?.url === CONTROL_URL,
  );
}
export function applyCommand(current: Settings, value: unknown): Settings {
  const next = validateSettings(current);
  const command = record(value);
  if (command.kind === "save") {
    exactKeys(command, ["kind", "preset"]);
    const preset = validatePreset(command.preset);
    const old = next.presets.find((p) => p.id === preset.id);
    if (old && old.displayId !== preset.displayId)
      throw new Error("Save a new preset to use a different display.");
    next.presets = next.presets.filter((p) => p.id !== preset.id);
    next.presets.push(preset);
    next.activeByDisplay[preset.displayId] = preset.id;
  } else if (command.kind === "activate" || command.kind === "delete") {
    exactKeys(command, ["kind", "id"]);
    const id = identifier(command.id);
    const preset = next.presets.find((p) => p.id === id);
    if (!preset)
      throw new Error("Preset no longer exists. Select another preset.");
    if (command.kind === "activate")
      next.activeByDisplay[preset.displayId] = id;
    else {
      next.presets = next.presets.filter((p) => p.id !== id);
      if (next.activeByDisplay[preset.displayId] === id)
        delete next.activeByDisplay[preset.displayId];
    }
  } else throw new Error("Unsupported command.");
  return validateSettings(next);
}
