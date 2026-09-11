"use strict";
window.drawReticle = (canvas, preset, geometry, preview = false) => {
  const ratio = window.devicePixelRatio || 1;
  const width = preview ? 300 : window.innerWidth;
  const height = preview ? 230 : window.innerHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2);
  ctx.rotate((preset.rotation * Math.PI) / 180);
  // Geometry fits inside a circle, so rotating never clips at the window edge.
  const size = preview ? Math.min(preset.size, 180) : Math.min(width, height);
  ctx.scale(size / 100, size / 100);
  ctx.translate(-50, -50);
  ctx.globalAlpha = preset.opacity;
  ctx.strokeStyle = preset.color;
  ctx.fillStyle = preset.color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  for (const primitive of geometry) {
    ctx.beginPath();
    const v = primitive.values;
    if (primitive.kind === "line") {
      ctx.moveTo(v[0], v[1]);
      ctx.lineTo(v[2], v[3]);
      ctx.stroke();
    } else {
      ctx.arc(v[0], v[1], v[2], 0, Math.PI * 2);
      if (primitive.filled) ctx.fill();
      else ctx.stroke();
    }
  }
  canvas.dataset.drawn = "true";
};
