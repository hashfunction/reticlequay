"use strict";
let current;
function render() {
  if (current)
    window.drawReticle(
      document.querySelector("canvas"),
      current.preset,
      current.geometry,
    );
}
window.overlay.onSettings((payload) => {
  current = payload;
  render();
});
window.addEventListener("resize", render);
