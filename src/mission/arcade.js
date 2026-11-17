// A tiny canvas game kit for the missions: one 800×480 play field, a parallax
// starfield, particles, floating text and the Comet Cruiser drawn in code.
// Everything is plain canvas 2D so it runs smoothly on an iPad.
export const W = 800, H = 480;
const FONT = (px, w = 700) => `${w} ${px}px Fredoka, ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
export const fmt = (n) => Number(n).toLocaleString("en-US");
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

// ── Background ──
export function makeStars(n = 90) {
  return Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.2 + Math.random() * 0.8, p: Math.random() * 6.28 }));
}
export function updateStars(stars, dt, vx = 8, vy = 0) {
  for (const s of stars) {
    s.x -= vx * s.z * dt; s.y -= vy * s.z * dt;
    if (s.x < -2) { s.x = W + 2; s.y = Math.random() * H; } else if (s.x > W + 2) s.x = -2;
    if (s.y < -2) s.y = H + 2; else if (s.y > H + 2) s.y = -2;
  }
}
export function drawBackground(ctx, stars, t, { streak = 0, tint = "#141a46" } = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#070b24"); g.addColorStop(1, tint);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const n = ctx.createRadialGradient(600, 120, 10, 600, 120, 320);
  n.addColorStop(0, "rgba(180,140,255,0.18)"); n.addColorStop(1, "rgba(180,140,255,0)");
  ctx.fillStyle = n; ctx.fillRect(0, 0, W, H);
  const n2 = ctx.createRadialGradient(140, 400, 10, 140, 400, 260);
  n2.addColorStop(0, "rgba(82,214,232,0.12)"); n2.addColorStop(1, "rgba(82,214,232,0)");
  ctx.fillStyle = n2; ctx.fillRect(0, 0, W, H);
  for (const s of stars) {
    const a = 0.35 + 0.65 * s.z * (0.75 + 0.25 * Math.sin(t * 2 + s.p));
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    if (streak > 0) ctx.fillRect(s.x, s.y, 1 + streak * s.z, 1.4 * s.z + 0.4);
    else ctx.fillRect(s.x, s.y, 1.4 * s.z + 0.5, 1.4 * s.z + 0.5);
  }
}

// ── Particles and floating text ──
export function burst(fx, x, y, { n = 18, color = "#ffc93c", speed = 160, life = 0.8, size = 3, spread = Math.PI * 2, dir = 0, gravity = 0 } = {}) {
  const k = fx.calm ? Math.ceil(n / 3) : n;
  for (let i = 0; i < k; i++) {
    const a = dir + (Math.random() - 0.5) * spread, v = speed * (0.35 + Math.random() * 0.65);
    fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: size * (0.6 + Math.random() * 0.8), gravity });
  }
}
// Particles that fly to a point (energy streaming into the reactor, shards into the shield).
export function stream(fx, x, y, tx, ty, { n = 16, color = "#ffc93c", life = 0.9 } = {}) {
  const k = fx.calm ? Math.ceil(n / 3) : n;
  for (let i = 0; i < k; i++) fx.parts.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30, tx, ty, homing: true, delay: i * 0.03, life, max: life, color, size: 3 + Math.random() * 3 });
}
export function popup(fx, x, y, text, color = "#ffffff", size = 26) { fx.texts.push({ x, y, text, color, size, life: 1.4, max: 1.4 }); }
export function shake(fx, amount = 10) { if (!fx.calm) fx.shake = Math.max(fx.shake, amount); }
export function makeFx(calm) { return { parts: [], texts: [], shake: 0, calm, flash: 0, flashColor: "#ffffff" }; }
export function updateFx(fx, dt) {
  for (const p of fx.parts) {
    if (p.delay > 0) { p.delay -= dt; continue; }
    p.life -= dt;
    if (p.homing) { const f = 1 - p.life / p.max; p.x += (p.tx - p.x) * Math.min(1, dt * (3 + f * 10)); p.y += (p.ty - p.y) * Math.min(1, dt * (3 + f * 10)); }
    else { p.vx *= 1 - dt * 1.5; p.vy = p.vy * (1 - dt * 1.5) + (p.gravity || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  }
  fx.parts = fx.parts.filter((p) => p.life > 0);
  for (const t of fx.texts) { t.life -= dt; t.y -= 34 * dt; }
  fx.texts = fx.texts.filter((t) => t.life > 0);
  fx.shake = Math.max(0, fx.shake - dt * 40);
  fx.flash = Math.max(0, fx.flash - dt * 2.5);
}
export function drawFx(ctx, fx) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of fx.parts) {
    if (p.delay > 0) continue;
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.fill();
  }
  ctx.restore();
  for (const t of fx.texts) {
    ctx.globalAlpha = Math.min(1, t.life / 0.5);
    text(ctx, t.text, t.x, t.y, { size: t.size, color: t.color, stroke: true });
  }
  ctx.globalAlpha = 1;
  if (fx.flash > 0) { ctx.globalAlpha = fx.flash * 0.5; ctx.fillStyle = fx.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}
export function text(ctx, s, x, y, { size = 20, color = "#eef1ff", weight = 700, align = "center", stroke = false, base = "middle" } = {}) {
  ctx.font = FONT(size, weight); ctx.textAlign = align; ctx.textBaseline = base;
  if (stroke) { ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = "rgba(5,8,30,0.85)"; ctx.lineJoin = "round"; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
export function pill(ctx, s, x, y, { size = 20, bg = "rgba(13,19,58,0.85)", color = "#eef1ff", border = null } = {}) {
  ctx.font = FONT(size); const w = ctx.measureText(s).width + size * 1.1, h = size * 1.6;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
  if (border) { ctx.lineWidth = 2; ctx.strokeStyle = border; ctx.stroke(); }
  text(ctx, s, x, y + 1, { size, color });
  return w;
}
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ── The Comet Cruiser ──
export function drawShip(ctx, x, y, { t = 0, tilt = 0, thrust = 0, scale = 1, lights = true, dir = 0 } = {}) {
  ctx.save(); ctx.translate(x, y + Math.sin(t * 2.2) * 3); ctx.rotate(tilt); ctx.scale(scale, scale);
  if (thrust > 0) {
    // Flame points backwards (left when flying right, down when hovering).
    ctx.save(); if (dir === 1) ctx.rotate(Math.PI / 2);
    const fl = 26 + thrust * 30 + Math.sin(t * 40) * 5;
    const g = ctx.createLinearGradient(0, 14, 0, 14 + fl); g.addColorStop(0, "rgba(255,230,120,0.95)"); g.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-18, 12); ctx.quadraticCurveTo(0, 14 + fl * 1.3, 18, 12); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "#ff8a5c";
  ctx.beginPath(); ctx.moveTo(-40, 4); ctx.lineTo(-54, 20); ctx.lineTo(-26, 12); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(40, 4); ctx.lineTo(54, 20); ctx.lineTo(26, 12); ctx.closePath(); ctx.fill();
  // dome
  const d = ctx.createRadialGradient(-6, -26, 2, 0, -14, 30); d.addColorStop(0, "rgba(200,250,255,0.9)"); d.addColorStop(1, "rgba(82,214,232,0.35)");
  ctx.fillStyle = d; ctx.beginPath(); ctx.ellipse(0, -8, 26, 26, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = "#9aa6d6"; ctx.lineWidth = 2; ctx.stroke();
  text(ctx, "🤖", 0, -16, { size: 16 });
  // hull
  const h = ctx.createLinearGradient(0, -14, 0, 18); h.addColorStop(0, "#e6ebff"); h.addColorStop(1, "#8f9bd0");
  ctx.fillStyle = h; ctx.beginPath(); ctx.ellipse(0, 4, 52, 16, 0, 0, 6.283); ctx.fill();
  ctx.strokeStyle = "#6b76b0"; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const on = lights && Math.sin(t * 5 - i) > -0.2;
    ctx.fillStyle = on ? "#ffc93c" : "#5a628f";
    ctx.beginPath(); ctx.arc(-28 + i * 14, 6, 3.6, 0, 6.283); ctx.fill();
  }
  ctx.restore();
}

// ── Things in space ──
// A glowing energy cell with its number.
export function drawOrb(ctx, x, y, r, label, { t = 0, color = "255,201,60", dim = false, ring = false } = {}) {
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.8);
  g.addColorStop(0, `rgba(${color},${dim ? 0.25 : 0.55})`); g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, 6.283); ctx.fill();
  const c = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
  c.addColorStop(0, dim ? "#7a7f9c" : "#fff7d6"); c.addColorStop(1, dim ? "#3b4270" : `rgb(${color})`);
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
  if (ring) { ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 6)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 7, 0, 6.283); ctx.stroke(); }
  text(ctx, label, x, y + 1, { size: Math.max(15, r * 0.62), color: dim ? "#c9cde6" : "#2a1d00" });
}
// An asteroid carrying a number. `seed` keeps its lumpy outline stable.
export function rockShape(seed, n = 11) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: n }, () => 0.78 + rnd() * 0.32);
}
export function drawRock(ctx, x, y, r, label, shape, rot, { glow = false, t = 0 } = {}) {
  ctx.save(); ctx.translate(x, y);
  if (glow) { ctx.strokeStyle = `rgba(255,255,255,${0.45 + 0.4 * Math.sin(t * 6)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r + 9, 0, 6.283); ctx.stroke(); }
  ctx.rotate(rot);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#9b8a7a"); g.addColorStop(1, "#4d4038");
  ctx.fillStyle = g; ctx.beginPath();
  shape.forEach((k, i) => { const a = (i / shape.length) * 6.283; const px = Math.cos(a) * r * k, py = Math.sin(a) * r * k; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath(); ctx.arc(r * 0.3, r * 0.2, r * 0.18, 0, 6.283); ctx.fill();
  ctx.beginPath(); ctx.arc(-r * 0.35, r * 0.35, r * 0.12, 0, 6.283); ctx.fill();
  ctx.restore();
  pill(ctx, label, x, y, { size: Math.max(16, r * 0.42), bg: "rgba(10,14,40,0.82)", color: "#ffffff" });
}
export function drawBeam(ctx, x1, y1, x2, y2, t, color = "82,214,232") {
  const a = Math.atan2(y2 - y1, x2 - x1), L = Math.hypot(x2 - x1, y2 - y1);
  ctx.save(); ctx.translate(x1, y1); ctx.rotate(a);
  const g = ctx.createLinearGradient(0, 0, L, 0); g.addColorStop(0, `rgba(${color},0.55)`); g.addColorStop(1, `rgba(${color},0.15)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(L, -28); ctx.lineTo(L, 28); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = `rgba(${color},0.6)`; ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) { const p = ((t * 1.6 + k / 3) % 1) * L; ctx.beginPath(); ctx.moveTo(p, -8 - (20 * p) / L); ctx.lineTo(p, 8 + (20 * p) / L); ctx.stroke(); }
  ctx.restore();
}
export function drawLaser(ctx, x1, y1, x2, y2, alpha, color = "#ff6b8a") {
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}
