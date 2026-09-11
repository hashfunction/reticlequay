export type Shape = "cross" | "dot" | "ring" | "chevron" | "cross-dot";
export interface Preset {
  id: string;
  name: string;
  displayId: string;
  shape: Shape;
  color: string;
  size: number;
  opacity: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  visible: boolean;
}
export interface DisplayGeometry {
  id: string;
  label?: string;
  bounds: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
}
export interface Settings {
  version: 1;
  presets: Preset[];
  activeByDisplay: Record<string, string>;
}
export interface AppState {
  settings: Settings;
  settingsWritable: boolean;
  displays: DisplayGeometry[];
  hidden: boolean;
  notice: string;
  hotkeyAvailable: boolean;
  geometries: Record<string, import("./assets").Primitive[]>;
}
export type Command =
  | { kind: "save"; preset: Preset }
  | { kind: "activate"; id: string }
  | { kind: "delete"; id: string }
  | { kind: "toggle" };
export type Reply =
  | { ok: true; state: AppState }
  | { ok: false; error: string };
export interface ReticleBridge {
  getState(): Promise<Reply>;
  command(command: Command): Promise<Reply>;
  openHelp(target: "support" | "privacy" | "license"): Promise<Reply>;
  onState(callback: (state: AppState) => void): () => void;
}
