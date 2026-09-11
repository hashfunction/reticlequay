import type { Shape } from "./types";
export const shapes: readonly Shape[] = [
  "cross",
  "dot",
  "ring",
  "chevron",
  "cross-dot",
];
export type Primitive = {
  kind: "line" | "circle";
  values: number[];
  filled?: boolean;
};
/** Original geometry, normalized to a 100-unit square. No imported paths or markup. */
export function geometryForShape(value: unknown): Primitive[] {
  if (typeof value !== "string" || !shapes.includes(value as Shape))
    throw new Error(
      "Shape must be a built-in reticle. Custom images are not supported.",
    );
  const cross: Primitive[] = [
    { kind: "line", values: [50, 14, 50, 36] },
    { kind: "line", values: [50, 64, 50, 86] },
    { kind: "line", values: [14, 50, 36, 50] },
    { kind: "line", values: [64, 50, 86, 50] },
  ];
  const dot: Primitive = { kind: "circle", values: [50, 50, 5], filled: true };
  switch (value) {
    case "dot":
      return [dot];
    case "ring":
      return [{ kind: "circle", values: [50, 50, 30] }];
    case "chevron":
      return [
        { kind: "line", values: [25, 60, 50, 35] },
        { kind: "line", values: [50, 35, 75, 60] },
      ];
    case "cross-dot":
      return [...cross, dot];
    default:
      return cross;
  }
}
