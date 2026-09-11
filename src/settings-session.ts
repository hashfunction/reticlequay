import { applyCommand } from "./commands";
import { emptySettings } from "./presets";
import type { Settings } from "./types";

interface Store {
  load(): Promise<{ settings: Settings; recovered: boolean }>;
  save(value: unknown): Promise<void>;
}
const READ_FAILURE =
  "Presets could not be read. Editing is disabled to protect your saved presets. " +
  "Check read access to ReticleQuay’s presets.json and settings folder, then restart ReticleQuay.";

/** Owns the loading prerequisite for every persisted settings mutation. */
export class SettingsSession {
  private currentSettings: Settings = emptySettings();
  private loaded = false;
  notice = "";

  constructor(private readonly store: Store) {}

  get settings(): Settings {
    return this.currentSettings;
  }
  get writable(): boolean {
    return this.loaded;
  }

  async load(): Promise<void> {
    // A retry must not accept writes while the read is unresolved or failed.
    this.loaded = false;
    try {
      const result = await this.store.load();
      this.currentSettings = result.settings;
      this.notice = result.recovered
        ? "Corrupt settings were preserved in a recovery file. Create a new preset to continue."
        : "";
      this.loaded = true;
    } catch {
      // Preserve any last known state and the original file. A read error is
      // different from a missing file or a successfully preserved corrupt file.
      this.notice = READ_FAILURE;
    }
  }

  assertWritable(): void {
    if (!this.loaded) throw new Error(READ_FAILURE);
  }

  async apply(value: unknown): Promise<void> {
    this.assertWritable();
    const next = applyCommand(this.currentSettings, value);
    await this.store.save(next);
    this.currentSettings = next;
  }
}
