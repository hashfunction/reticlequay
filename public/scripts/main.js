"use strict";
const $ = (id) => document.getElementById(id);
let state;
let selection = "";
let presetId = "";
let busy = false;
const fields = [
  "name",
  "shape",
  "color",
  "size",
  "opacity",
  "rotation",
  "offsetX",
  "offsetY",
  "visible",
];
function message(text, error = false) {
  $("status").textContent = text;
  $("status").classList.toggle("error", error);
}
function draft(id = presetId || crypto.randomUUID()) {
  return {
    id,
    name: $("name").value,
    displayId: selection,
    shape: $("shape").value,
    color: $("color").value,
    size: Number($("size").value),
    opacity: Number($("opacity").value) / 100,
    rotation: Number($("rotation").value),
    offsetX: Number($("offsetX").value),
    offsetY: Number($("offsetY").value),
    visible: $("visible").checked,
  };
}
function preview() {
  if (!state) return;
  const p = draft();
  if (
    Number.isFinite(p.size) &&
    Number.isFinite(p.rotation) &&
    Number.isFinite(p.opacity)
  )
    window.drawReticle($("preview"), p, state.geometries[p.shape], true);
}
function options(select, entries, value) {
  select.replaceChildren(
    ...entries.map(([id, label]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = label;
      return option;
    }),
  );
  select.value = value;
}
function fill(p) {
  for (const field of fields) {
    if (field === "visible") $(field).checked = p.visible;
    else
      $(field).value =
        field === "opacity" ? Math.round(p.opacity * 100) : p[field];
  }
  preview();
}
function updateButtons() {
  const disabled = busy || !state?.settingsWritable;
  for (const id of [...fields, "display", "presets"]) $(id).disabled = disabled;
  for (const id of ["update", "load", "delete"])
    $(id).disabled = disabled || !presetId;
  $("save-new").disabled = disabled || !selection;
  $("toggle").disabled = disabled;
}
function render(next, reset = false) {
  state = next;
  const connected = state.displays;
  const ids = [
    ...new Set([
      ...connected.map((d) => d.id),
      ...state.settings.presets.map((p) => p.displayId),
    ]),
  ];
  if (!ids.includes(selection)) {
    selection = ids[0] || "";
    reset = true;
  }
  options(
    $("display"),
    ids.map((id) => [
      id,
      connected.find((d) => d.id === id)?.label ||
        `Display ${id} — disconnected`,
    ]),
    selection,
  );
  const presets = state.settings.presets.filter(
    (p) => p.displayId === selection,
  );
  if (reset) presetId = state.settings.activeByDisplay[selection] || "";
  if (!presets.some((p) => p.id === presetId)) presetId = "";
  options(
    $("presets"),
    [
      ["", "New preset"],
      ...presets.map((p) => [
        p.id,
        p.name +
          (state.settings.activeByDisplay[selection] === p.id
            ? " · active"
            : ""),
      ]),
    ],
    presetId,
  );
  const d = connected.find((d) => d.id === selection);
  $("connection").textContent = d ? "Connected" : "Disconnected";
  $("display-title").textContent =
    d?.label || `Display ${selection || "unavailable"}`;
  $("display-detail").textContent = d
    ? `${d.bounds.width} × ${d.bounds.height} DIP · ${Math.round(d.scaleFactor * 100)}% scale · Origin ${d.bounds.x}, ${d.bounds.y}`
    : "Presets remain saved. The overlay returns when this display reconnects.";
  $("toggle").textContent = state.hidden ? "Show overlays" : "Hide overlays";
  const active = state.settings.presets.find(
    (p) => p.id === state.settings.activeByDisplay[selection],
  );
  $("visibility").textContent = !d
    ? "Disconnected"
    : state.hidden
      ? "All hidden"
      : active?.visible
        ? "Overlay on"
        : "Overlay off";
  $("notice").hidden = !state.notice;
  $("notice").textContent = state.notice;
  if (reset) {
    const saved = presets.find((p) => p.id === presetId);
    fill(
      saved || {
        name: "My reticle",
        shape: "cross",
        color: "#72dec9",
        size: 40,
        opacity: 1,
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
        visible: true,
      },
    );
  }
  updateButtons();
  preview();
}
async function command(value, success, reset = true) {
  if (busy) return;
  if (!state?.settingsWritable) {
    message(
      state?.notice || "Presets are unavailable. Restart ReticleQuay.",
      true,
    );
    return;
  }
  busy = true;
  updateButtons();
  try {
    const result = await window.reticlequay.command(value);
    if (!result.ok) message(result.error, true);
    else {
      render(result.state, reset);
      message(success);
    }
  } catch {
    message(
      "Could not reach ReticleQuay. Restart the application and retry.",
      true,
    );
  } finally {
    busy = false;
    updateButtons();
  }
}
$("display").addEventListener("change", () => {
  selection = $("display").value;
  render(state, true);
  message("Edit the preview, then save or update to apply.");
});
$("presets").addEventListener("change", () => {
  presetId = $("presets").value;
  const p = state.settings.presets.find((p) => p.id === presetId);
  if (p) fill(p);
  updateButtons();
  message(
    p
      ? "Saved preset loaded into the editor. Choose Apply saved preset to activate it."
      : "Edit the preview, then save a new preset.",
  );
});
$("editor").addEventListener("input", preview);
$("editor").addEventListener("submit", (event) => {
  event.preventDefault();
  command(
    { kind: "save", preset: draft(crypto.randomUUID()) },
    "New preset saved and applied.",
  );
});
$("update").addEventListener("click", () => {
  if ($("editor").reportValidity())
    command({ kind: "save", preset: draft() }, "Preset updated and applied.");
});
$("load").addEventListener("click", () =>
  command({ kind: "activate", id: presetId }, "Saved preset applied."),
);
$("delete").addEventListener("click", () => {
  if (confirm("Delete this saved preset?"))
    command({ kind: "delete", id: presetId }, "Preset deleted.");
});
$("toggle").addEventListener("click", () =>
  command({ kind: "toggle" }, "Overlay visibility changed.", false),
);
for (const link of document.querySelectorAll("[data-help]"))
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      const r = await window.reticlequay.openHelp(link.dataset.help);
      if (!r.ok) message(r.error, true);
    } catch {
      message(
        "Could not open help. Visit reticlequay.trieflow.com/support.",
        true,
      );
    }
  });
window.reticlequay.onState((next) => render(next));
window.reticlequay
  .getState()
  .then((result) => {
    if (result.ok) render(result.state, true);
    else message(result.error, true);
  })
  .catch(() => message("Could not load settings. Restart ReticleQuay.", true));
