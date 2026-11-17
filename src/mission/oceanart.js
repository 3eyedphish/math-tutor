// Deep Sea Rescue artwork, all drawn in code on canvas (no image files):
// the water, the reef, Captain's submarine and a cast of friendly sea creatures.
// Every creature is drawn in a 100 × 100 box centred on (x, y) and scaled by s.
import { W, H, roundRect, text } from "./arcade.js";

const TAU = Math.PI * 2;
const begin = (ctx, x, y, s, flip = false) => { ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -s : s, s); };
const eye = (ctx, x, y, r = 5, look = 0) => {
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = "#1b1630"; ctx.beginPath(); ctx.arc(x + look * r * 0.3, y + r * 0.1, r * 0.58, 0, TAU); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x + look * r * 0.3 - r * 0.2, y - r * 0.2, r * 0.2, 0, TAU); ctx.fill();
};
const smile = (ctx, x, y, w, color = "#3a1530") => { ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(x, y - w * 0.4, w, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); };
const blush = (ctx, x, y, r = 4) => { ctx.fillStyle = "rgba(255,120,160,0.45)"; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, TAU); ctx.fill(); };

// ── Water, light and reef ──
export function makePlankton(n = 60) {
  return Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 0.7, p: Math.random() * 6.28 }));
}
export function updatePlankton(ps, dt) {
  for (const p of ps) { p.y -= 6 * p.z * dt; p.x += Math.sin(p.p + p.y * 0.02) * 4 * dt; if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; } }
}
export function drawWater(ctx, ps, t, { deep = 0 } = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, deep ? "#0b4a7a" : "#1479b8"); g.addColorStop(0.55, deep ? "#062f5c" : "#0b4f8f"); g.addColorStop(1, "#04203f");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Light rays from the surface
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 5; i++) {
    const x = 80 + i * 170 + Math.sin(t * 0.3 + i) * 30;
    const r = ctx.createLinearGradient(0, 0, 0, H * 0.8);
    r.addColorStop(0, "rgba(160,230,255,0.13)"); r.addColorStop(1, "rgba(160,230,255,0)");
    ctx.fillStyle = r; ctx.beginPath(); ctx.moveTo(x - 30, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 110, H * 0.8); ctx.lineTo(x + 10, H * 0.8); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  for (const p of ps) { ctx.fillStyle = `rgba(200,240,255,${0.15 + 0.35 * p.z})`; ctx.beginPath(); ctx.arc(p.x, p.y, 0.8 + p.z * 1.4, 0, TAU); ctx.fill(); }
}
export function drawSeabed(ctx, t, y0 = 440, { kelp = true } = {}) {
  const g = ctx.createLinearGradient(0, y0 - 10, 0, H);
  g.addColorStop(0, "#e2c48d"); g.addColorStop(1, "#9c7c4a");
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y0 + Math.sin(x * 0.015) * 7 + Math.sin(x * 0.041 + 2) * 3);
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  if (kelp) for (const [x, h, c] of [[40, 120, "#2f9e5b"], [70, 80, "#3fbf6d"], [740, 140, "#2f9e5b"], [770, 90, "#45c779"], [520, 60, "#3fbf6d"]]) drawKelp(ctx, x, y0 + 4, h, t, c);
  for (const [x, c] of [[160, "#ff7f7f"], [600, "#ff9ad5"], [690, "#ffb35c"]]) drawCoral(ctx, x, y0 + 6, c);
  drawShell(ctx, 300, y0 + 12, 0.8); drawShell(ctx, 455, y0 + 16, 0.6);
}
export function drawKelp(ctx, x, y, h, t, color = "#2f9e5b") {
  ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x, y);
  for (let k = 1; k <= 8; k++) { const yy = y - (h * k) / 8; ctx.lineTo(x + Math.sin(t * 1.3 + k * 0.7 + x) * k * 1.8, yy); }
  ctx.stroke();
  ctx.fillStyle = color;
  for (let k = 2; k <= 7; k += 2) { const yy = y - (h * k) / 8, xx = x + Math.sin(t * 1.3 + k * 0.7 + x) * k * 1.8; ctx.beginPath(); ctx.ellipse(xx + (k % 4 ? 8 : -8), yy, 9, 4, k % 4 ? -0.5 : 0.5, 0, TAU); ctx.fill(); }
}
export function drawCoral(ctx, x, y, color) {
  ctx.strokeStyle = color; ctx.lineCap = "round";
  const branch = (bx, by, len, ang, w) => {
    if (len < 7) return;
    const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    branch(ex, ey, len * 0.68, ang - 0.45, w * 0.72); branch(ex, ey, len * 0.68, ang + 0.4, w * 0.72);
  };
  branch(x, y, 22, -Math.PI / 2, 7);
}
export function drawShell(ctx, x, y, s = 1) {
  begin(ctx, x, y, s);
  ctx.fillStyle = "#ffd9c2"; ctx.beginPath(); ctx.moveTo(-14, 4); ctx.quadraticCurveTo(0, -22, 14, 4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#d9967a"; ctx.lineWidth = 1.5;
  for (const a of [-8, -3, 3, 8]) { ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(a * 1.4, -8); ctx.stroke(); }
  ctx.restore();
}
export function drawPearl(ctx, x, y, r = 7, glow = false) {
  if (glow) { const g = ctx.createRadialGradient(x, y, 1, x, y, r * 3); g.addColorStop(0, "rgba(255,250,235,0.6)"); g.addColorStop(1, "rgba(255,250,235,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, TAU); ctx.fill(); }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.6, "#f3eadf"); g.addColorStop(1, "#cbbfd8");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
// A floating bubble with a label; `pop` 0..1 animates it bursting.
export function drawBubble(ctx, x, y, r, label, { t = 0, sel = false, pop = 0, wobble = 0, tint = "160,230,255" } = {}) {
  if (pop > 0) {
    ctx.strokeStyle = `rgba(${tint},${1 - pop})`; ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, d = r * (1 + pop * 0.8); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * d * 0.8, y + Math.sin(a) * d * 0.8); ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); ctx.stroke(); }
    return;
  }
  const wx = Math.sin(t * 2 + y * 0.03) * 1.5 * (1 + wobble * 3);
  ctx.save(); ctx.translate(x + wx, y);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, `rgba(${tint},0.10)`); g.addColorStop(0.85, `rgba(${tint},0.22)`); g.addColorStop(1, `rgba(${tint},0.55)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = sel ? "#ffe08a" : `rgba(${tint},0.9)`; ctx.lineWidth = sel ? 4 : 2; ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.beginPath(); ctx.ellipse(-r * 0.42, -r * 0.45, r * 0.18, r * 0.1, -0.7, 0, TAU); ctx.fill();
  if (label) text(ctx, label, 0, 2, { size: Math.min(26, r * 0.48), color: "#ffffff", stroke: true });
  ctx.restore();
}

// ── The submarine ──
export function drawSub(ctx, x, y, { t = 0, scale = 1, dir = 1, light = true, bob = true } = {}) {
  ctx.save(); ctx.translate(x, y + (bob ? Math.sin(t * 1.6) * 3 : 0)); ctx.scale(scale * dir, scale);
  if (light) {
    const g = ctx.createLinearGradient(60, 0, 230, 0);
    g.addColorStop(0, "rgba(255,245,180,0.35)"); g.addColorStop(1, "rgba(255,245,180,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(62, 2); ctx.lineTo(230, -40); ctx.lineTo(230, 50); ctx.closePath(); ctx.fill();
  }
  // Propeller
  const sp = Math.sin(t * 22);
  ctx.fillStyle = "#c98b1c"; ctx.beginPath(); ctx.ellipse(-70, 2, 5, 20 * Math.abs(sp) + 3, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#e0a52a"; ctx.fillRect(-68, -3, 12, 10);
  // Tail fins
  ctx.fillStyle = "#e0a52a";
  ctx.beginPath(); ctx.moveTo(-45, -8); ctx.lineTo(-62, -26); ctx.lineTo(-56, -6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-45, 12); ctx.lineTo(-62, 30); ctx.lineTo(-56, 10); ctx.closePath(); ctx.fill();
  // Periscope and tower
  ctx.fillStyle = "#e0a52a"; roundRect(ctx, -12, -42, 34, 22, 8); ctx.fill();
  ctx.fillStyle = "#9aa6b8"; ctx.fillRect(8, -62, 5, 22); ctx.fillRect(8, -62, 14, 5);
  // Hull
  const hg = ctx.createLinearGradient(0, -30, 0, 32);
  hg.addColorStop(0, "#ffd84d"); hg.addColorStop(1, "#e3a21a");
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(0, 2, 64, 30, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#b07a10"; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = "rgba(176,122,16,0.6)"; ctx.lineWidth = 1.5;
  for (const xx of [-36, -12]) { ctx.beginPath(); ctx.moveTo(xx, -26); ctx.lineTo(xx, 30); ctx.stroke(); }
  // Portholes: Pip rides in the back one, the captain in the front
  for (const [px, r] of [[22, 13], [-24, 9]]) {
    ctx.fillStyle = "#7a5410"; ctx.beginPath(); ctx.arc(px, -2, r + 3, 0, TAU); ctx.fill();
    ctx.fillStyle = "#9fe7ff"; ctx.beginPath(); ctx.arc(px, -2, r, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = "#ff9ec7"; ctx.beginPath(); ctx.arc(-24, 0, 5, 0, TAU); ctx.fill(); // Pip
  ctx.fillStyle = "#1b1630"; ctx.beginPath(); ctx.arc(-26, -1, 1, 0, TAU); ctx.arc(-22, -1, 1, 0, TAU); ctx.fill();
  ctx.fillStyle = "#ffd2a8"; ctx.beginPath(); ctx.arc(22, 0, 7, 0, TAU); ctx.fill(); // the captain
  ctx.fillStyle = "#6b3a1c"; ctx.beginPath(); ctx.arc(22, -4, 7, Math.PI, 0); ctx.fill();
  ctx.fillStyle = "#1b1630"; ctx.beginPath(); ctx.arc(20, 0, 1, 0, TAU); ctx.arc(25, 0, 1, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.beginPath(); ctx.arc(17, -7, 3, 0, TAU); ctx.fill();
  // Headlight
  ctx.fillStyle = "#fff7c2"; ctx.beginPath(); ctx.arc(60, 2, 5, 0, TAU); ctx.fill();
  ctx.restore();
}

// ── Creatures ──
export function drawOctopus(ctx, x, y, s = 1, { t = 0, color = "#b06ad9", happy = true, holdSign = false } = {}) {
  begin(ctx, x, y, s);
  const dark = "#8a46b8";
  ctx.strokeStyle = color; ctx.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    const bx = -22 + i * 8.8, sway = Math.sin(t * 2.2 + i) * 6;
    const up = holdSign && (i === 0 || i === 5);
    ctx.lineWidth = 9 - i % 2; ctx.beginPath(); ctx.moveTo(bx, 8);
    if (up) ctx.quadraticCurveTo(bx + (i ? 22 : -22), 0, bx + (i ? 30 : -30), -26);
    else ctx.bezierCurveTo(bx + sway, 26, bx - sway * 1.4 + (i - 2.5) * 6, 34, bx + (i - 2.5) * 9 + sway, 46);
    ctx.stroke();
  }
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, -12, 30, 30, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = dark; for (const [sx, sy, r] of [[-12, -30, 4], [10, -34, 3], [18, -20, 3.5]]) { ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill(); }
  eye(ctx, -10, -10, 6.5); eye(ctx, 10, -10, 6.5);
  blush(ctx, -18, 1); blush(ctx, 18, 1);
  if (happy) smile(ctx, 0, 6, 6); else { ctx.strokeStyle = "#3a1530"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 8, 3, 0, TAU); ctx.stroke(); }
  ctx.restore();
}
export function drawSeahorse(ctx, x, y, s = 1, { t = 0, color = "#ffb347", flip = false } = {}) {
  begin(ctx, x, y + Math.sin(t * 2 + x) * 3, s, flip);
  const dark = "#e58a1f";
  // Curled tail
  ctx.strokeStyle = color; ctx.lineWidth = 9; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, 18); ctx.quadraticCurveTo(-4, 38, 6, 44); ctx.arc(2, 40, 5, 0.3 * Math.PI, 1.9 * Math.PI, true); ctx.stroke();
  // Dorsal fin
  ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.quadraticCurveTo(-26 + Math.sin(t * 8) * 2, 2, -10, 12); ctx.closePath(); ctx.fill();
  // Body
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 4, 13, 20, 0.15, 0, TAU); ctx.fill();
  ctx.fillStyle = "#ffd89a"; ctx.beginPath(); ctx.ellipse(4, 6, 6, 14, 0.15, 0, TAU); ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = 1.5; for (let k = -6; k <= 16; k += 5) { ctx.beginPath(); ctx.moveTo(-1, k); ctx.lineTo(9, k + 1); ctx.stroke(); }
  // Head and snout
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(-1, -20, 12, 11, 0, 0, TAU); ctx.fill();
  roundRect(ctx, 6, -24, 20, 8, 4); ctx.fill();
  ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-8, -29); ctx.lineTo(-5, -38); ctx.lineTo(-1, -30); ctx.lineTo(3, -37); ctx.lineTo(5, -29); ctx.closePath(); ctx.fill();
  eye(ctx, 0, -22, 4.5, 1); blush(ctx, 2, -13, 3);
  ctx.restore();
}
export function drawNarwhal(ctx, x, y, s = 1, { t = 0, color = "#9fc3e8", flip = false, baby = false } = {}) {
  begin(ctx, x, y + Math.sin(t * 1.4 + x) * 3, s, flip);
  const dark = "#6f97c4";
  // Tail fluke
  const f = Math.sin(t * 3) * 6;
  ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-40, 4); ctx.quadraticCurveTo(-56, -10 + f, -62, -16 + f); ctx.quadraticCurveTo(-54, 4, -62, 22 + f); ctx.quadraticCurveTo(-52, 16 + f, -40, 8); ctx.closePath(); ctx.fill();
  // Body
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(-2, 4, 44, 22, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#dbe9f7"; ctx.beginPath(); ctx.ellipse(4, 14, 30, 9, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = dark; for (const [sx, sy] of [[-20, -6], [-8, -12], [-28, 4], [6, -8]]) { ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, TAU); ctx.fill(); }
  // Flipper
  ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(6, 16, 10, 5, 0.6 + Math.sin(t * 3) * 0.2, 0, TAU); ctx.fill();
  // Tusk (a spiral)
  if (!baby) {
    ctx.save(); ctx.translate(38, -4); ctx.rotate(-0.28);
    ctx.fillStyle = "#fff4d6"; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(48, 0); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#d8c49a"; ctx.lineWidth = 1.2; for (let k = 6; k < 44; k += 7) { ctx.beginPath(); ctx.moveTo(k, -3.4 + k * 0.07); ctx.lineTo(k + 4, 3.4 - k * 0.07); ctx.stroke(); }
    ctx.restore();
  } else { ctx.fillStyle = "#fff4d6"; ctx.beginPath(); ctx.moveTo(38, -6); ctx.lineTo(50, -10); ctx.lineTo(39, -1); ctx.closePath(); ctx.fill(); }
  eye(ctx, 24, -2, 4.5, 1); blush(ctx, 28, 7, 4); smile(ctx, 32, 6, 4);
  ctx.restore();
}
export function drawAxolotl(ctx, x, y, s = 1, { t = 0, color = "#ff9ec7", flip = false, wave = false } = {}) {
  begin(ctx, x, y + Math.sin(t * 2.4 + x) * 2, s, flip);
  const gill = "#ff4f93";
  // Tail fin
  ctx.fillStyle = "#ffc4dc"; ctx.beginPath(); ctx.moveTo(-14, -2); ctx.quadraticCurveTo(-46, -14 + Math.sin(t * 3) * 4, -52, 4); ctx.quadraticCurveTo(-40, 14, -14, 10); ctx.closePath(); ctx.fill();
  // Body and legs
  ctx.fillStyle = color;
  for (const [lx, ly, a] of [[-12, 14, 0.5], [6, 14, -0.4]]) { ctx.save(); ctx.translate(lx, ly); ctx.rotate(a + (wave && lx > 0 ? Math.sin(t * 8) * 0.6 - 1.4 : 0)); roundRect(ctx, -3, 0, 6, 12, 3); ctx.fill(); ctx.restore(); }
  ctx.beginPath(); ctx.ellipse(-8, 4, 24, 12, 0, 0, TAU); ctx.fill();
  // Gills: three feathery fronds each side
  ctx.strokeStyle = gill; ctx.lineWidth = 3.5; ctx.lineCap = "round";
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
    const a = side * (0.9 + k * 0.45) - Math.PI / 2 + Math.sin(t * 3 + k) * 0.08;
    const bx = 18 + side * 0, by = -10;
    const ex = bx + Math.cos(a) * 20, ey = by + Math.sin(a) * 16;
    ctx.beginPath(); ctx.moveTo(bx + side * 12, by + 4); ctx.lineTo(ex + side * 10, ey + 2); ctx.stroke();
    ctx.fillStyle = gill; for (let d = 0.4; d <= 1; d += 0.3) { ctx.beginPath(); ctx.arc(bx + side * 12 + (ex + side * 10 - bx - side * 12) * d, by + 4 + (ey + 2 - by - 4) * d, 2.6, 0, TAU); ctx.fill(); }
  }
  // Head
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(18, -4, 22, 17, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#1b1630"; ctx.beginPath(); ctx.arc(8, -8, 3.4, 0, TAU); ctx.arc(28, -8, 3.4, 0, TAU); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(7, -9, 1.1, 0, TAU); ctx.arc(27, -9, 1.1, 0, TAU); ctx.fill();
  blush(ctx, 4, 0, 4); blush(ctx, 32, 0, 4); smile(ctx, 18, 2, 7, "#9b2a5a");
  ctx.restore();
}
export function drawJelly(ctx, x, y, s = 1, { t = 0, color = "255,150,220" } = {}) {
  begin(ctx, x, y + Math.sin(t * 1.8 + x) * 4, s);
  const pulse = 1 + Math.sin(t * 3 + x) * 0.06;
  ctx.strokeStyle = `rgba(${color},0.7)`; ctx.lineWidth = 3; ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) { const bx = -16 + i * 8; ctx.beginPath(); ctx.moveTo(bx, 0); for (let k = 1; k <= 4; k++) ctx.lineTo(bx + Math.sin(t * 3 + i + k) * 4, k * 10); ctx.stroke(); }
  ctx.fillStyle = `rgba(${color},0.75)`; ctx.beginPath(); ctx.ellipse(0, 0, 24 * pulse, 22 / pulse, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.ellipse(-8, -12, 6, 4, -0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = "#1b1630"; ctx.beginPath(); ctx.arc(-7, -6, 2.4, 0, TAU); ctx.arc(7, -6, 2.4, 0, TAU); ctx.fill();
  smile(ctx, 0, -1, 4);
  ctx.restore();
}
export function drawCrab(ctx, x, y, s = 1, { t = 0, color = "#ff6f5e" } = {}) {
  begin(ctx, x, y, s);
  const snap = Math.abs(Math.sin(t * 3 + x)) * 0.4;
  ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = "round";
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(side * 14, 6 + k * 4); ctx.lineTo(side * (28 + k * 2), 14 + k * 6); ctx.stroke(); }
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * 16, -2); ctx.lineTo(side * 28, -16); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(side * 30, -20, 8, side > 0 ? -1.6 + snap : Math.PI - 1.6 - snap + 3.2, side > 0 ? 3.4 - snap : Math.PI + 1.6 + snap - 3.2 + 6.28); ctx.lineTo(side * 30, -20); ctx.fill();
  }
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 4, 20, 14, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-7, -18); ctx.moveTo(6, -8); ctx.lineTo(7, -18); ctx.stroke();
  eye(ctx, -7, -20, 4.2); eye(ctx, 7, -20, 4.2); smile(ctx, 0, 6, 5);
  ctx.restore();
}
export function drawTurtle(ctx, x, y, s = 1, { t = 0, flip = false } = {}) {
  begin(ctx, x, y + Math.sin(t * 1.2 + x) * 3, s, flip);
  const skin = "#7fd18a", sw = Math.sin(t * 2.5) * 0.35;
  ctx.fillStyle = skin;
  for (const [fx, fy, a] of [[14, -14, -0.6 + sw], [14, 16, 0.6 - sw], [-20, -10, -2.4 - sw * 0.5], [-20, 12, 2.4 + sw * 0.5]]) { ctx.save(); ctx.translate(fx, fy); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(10, 0, 13, 5, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  ctx.beginPath(); ctx.ellipse(34, 0, 12, 10, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#2f8f5b"; ctx.beginPath(); ctx.ellipse(0, 0, 28, 22, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#4cb37a"; for (const [px, py] of [[0, 0], [-14, -8], [-14, 8], [13, -8], [13, 8]]) { ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU); ctx.fill(); }
  ctx.fillStyle = "#1b1630"; ctx.beginPath(); ctx.arc(38, -3, 2.4, 0, TAU); ctx.fill();
  smile(ctx, 39, 4, 3);
  ctx.restore();
}
export function drawStar(ctx, x, y, s = 1, { t = 0, color = "#ffb35c" } = {}) {
  begin(ctx, x, y, s); ctx.rotate(Math.sin(t + x) * 0.1);
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 28, a = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ffe0b0"; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * 16, Math.sin(a) * 16, 2, 0, TAU); ctx.fill(); }
  ctx.fillStyle = "#1b1630"; ctx.beginPath(); ctx.arc(-4, -2, 2, 0, TAU); ctx.arc(4, -2, 2, 0, TAU); ctx.fill();
  smile(ctx, 0, 3, 3);
  ctx.restore();
}
export function drawFish(ctx, x, y, s = 1, { t = 0, color = "#5ee0c8", flip = false } = {}) {
  begin(ctx, x, y, s, flip);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-28, -10 + Math.sin(t * 8) * 3); ctx.lineTo(-28, 10 + Math.sin(t * 8) * 3); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, 18, 11, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fillRect(-4, -10, 4, 20);
  ctx.fillStyle = "#1b1630"; ctx.beginPath(); ctx.arc(9, -3, 2.2, 0, TAU); ctx.fill();
  ctx.restore();
}
export const DRAW = { octopus: drawOctopus, seahorse: drawSeahorse, narwhal: drawNarwhal, axolotl: drawAxolotl, jelly: drawJelly, crab: drawCrab, turtle: drawTurtle, star: drawStar, fish: drawFish };
export function drawCreature(ctx, kind, x, y, s, opts) { (DRAW[kind] || drawFish)(ctx, x, y, s, opts); }

// An ink cloud (0..1 coverage) over a rectangle.
export function drawInk(ctx, cx, cy, w, h, k, t) {
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.2);
  // A solid layer first so nothing shows through once the ink has spread
  ctx.fillStyle = "rgba(25,10,45,0.96)"; roundRect(ctx, cx - w * 0.44, cy - h * 0.42, w * 0.88, h * 0.84, 26); ctx.fill();
  for (let i = 0; i < 16; i++) {
    const a = i * 2.4, r = (0.35 + (i % 4) * 0.12) * Math.min(w, h) * k;
    const px = cx + Math.cos(a) * w * 0.32 * (i % 3 ? 1 : 0.5) + Math.sin(t + i) * 3, py = cy + Math.sin(a) * h * 0.28 * (i % 2 ? 1 : 0.6);
    const g = ctx.createRadialGradient(px, py, 1, px, py, r);
    g.addColorStop(0, "rgba(25,10,45,0.95)"); g.addColorStop(1, "rgba(25,10,45,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
