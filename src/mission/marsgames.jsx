// Supply Run to Mars as canvas mini-games: drop crates into the hold, hang cargo pods
// on a ship that really tips, and drag loads into the lander. Same puzzles and the same
// recording rules as the card versions in Mission.jsx; only how she answers changed.
import { useEffect, useMemo, useRef, useState } from "react";
import { W, H, fmt, clamp, dist, ease, drawBackground, burst, popup, shake, text, roundRect, drawShip } from "./arcade.js";
import { cargoItem, balancePuzzle, balanceItem, landPuzzle, landItem } from "./engine.js";
import { roundTo } from "../engine/util.js";
import { Keypad, useHardwareKeys } from "../ui/components.jsx";
import { sfx } from "./sfx.js";
import { StationHead, Bolt, Record } from "./Mission.jsx";
import { useCanvasGame, useApi, useHelp, hud } from "./games.jsx";

// ── Mars scenery ──
function drawMars(ctx, t, y0 = 440) {
  const p = ctx.createRadialGradient(690, 70, 6, 690, 70, 46);
  p.addColorStop(0, "#f4a07a"); p.addColorStop(1, "#b5462f");
  ctx.fillStyle = p; ctx.beginPath(); ctx.arc(690, 70, 34, 0, 6.283); ctx.fill();
  const g = ctx.createLinearGradient(0, y0 - 20, 0, H);
  g.addColorStop(0, "#c8553d"); g.addColorStop(1, "#6e271c");
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y0 + Math.sin(x * 0.013) * 9 + Math.sin(x * 0.037 + 1) * 4);
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(60,15,10,0.35)";
  for (const [x, r] of [[90, 14], [330, 9], [560, 16], [740, 8]]) { ctx.beginPath(); ctx.ellipse(x, y0 + 22, r, r * 0.35, 0, 0, 6.283); ctx.fill(); }
}
function drawCrate(ctx, x, y, s, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#d1924f"; ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = "#7a4a1f"; ctx.lineWidth = Math.max(1, s / 9); ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  if (s > 10) { ctx.beginPath(); ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + s - 2, y + s - 2); ctx.moveTo(x + s - 2, y + 2); ctx.lineTo(x + 2, y + s - 2); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
const mtint = "#2a1430";

// ═══ Station 1: Crate Drop ═════════════════════════════════════════════════════
// The hold is an area model: rows × each place-value part. She types a section's
// partial product and the Cruiser drops exactly that many rows of crates into it.
const HOLD = { x: 130, y: 150, w: 600, h: 210 };
const TOTAL = { x: 130, y: 380, w: 600, h: 54 };
function cargoGame(item, api) {
  const { rows, parts } = item;
  const grow = parts.map((p) => String(p).length), sumG = grow.reduce((a, b) => a + b, 0);
  let x = HOLD.x;
  const secs = parts.map((p, i) => {
    const w = (HOLD.w * grow[i]) / sumG, cols = Math.max(2, grow[i] * 2);
    const cs = Math.min(24, (w - 16) / cols, (HOLD.h - 60) / rows);
    const s = { i, p, x, w, cols, cs, placed: 0, wrongs: [] };
    x += w; return s;
  });
  const slot = (s, k) => {
    const r = Math.floor(k / s.cols), c = k % s.cols;
    const gw = s.cols * s.cs, x0 = s.x + (s.w - gw) / 2;
    return { x: x0 + c * s.cs, y: HOLD.y + HOLD.h - 8 - (r + 1) * s.cs };
  };
  const g = {
    secs, view: { vals: [], locked: [], active: 0 }, ship: { x: 430, y: 84, tx: 430 }, falling: [], queue: [], doors: 0, done: false, flyOff: 0,
    secAt(p) { return secs.find((s) => p.x >= s.x && p.x < s.x + s.w && p.y >= HOLD.y && p.y < HOLD.y + HOLD.h); },
    hits(p) { const s = this.secAt(p); return (s && !this.view.locked[s.i]) || (p.y >= TOTAL.y && p.y < TOTAL.y + TOTAL.h && !this.view.locked[parts.length]); },
    pointer(p, kind) {
      if (kind !== "down") return;
      const s = this.secAt(p);
      if (s) api.current.select(s.i);
      else if (p.y >= TOTAL.y && p.y < TOTAL.y + TOTAL.h) api.current.select(parts.length);
    },
    // ok: crates stack into the section row by row. Wrong: a few crates hit it and spill out.
    drop(i, ok, tooMany) {
      const total = i === parts.length;
      this.ship.tx = total ? HOLD.x + HOLD.w / 2 : secs[i].x + secs[i].w / 2;
      this.queue.push({ i, ok, tooMany, total });
    },
    update(dt) {
      const s = this.ship, fx = this.fx;
      s.x = ease(s.x, s.tx, 5, dt);
      const q = this.queue[0];
      if (q && Math.abs(s.x - s.tx) < 8) {
        q.t = (q.t || 0) + dt;
        const every = this.calm ? 0.012 : 0.035;
        if (q.total) {
          if (!q.started) { q.started = true; this.done = q.ok; if (q.ok) { fx.flash = 0.7; fx.flashColor = "#ffc93c"; burst(fx, HOLD.x + HOLD.w / 2, HOLD.y, { n: 50, color: "#ffe08a", speed: 260, life: 1.2 }); popup(fx, HOLD.x + HOLD.w / 2, HOLD.y - 30, "CARGO LOADED!", "#ffe08a", 36); } else { shake(fx, 10); for (let k = 0; k < 6; k++) this.falling.push({ x: s.x + (Math.random() - 0.5) * 60, y: s.y + 20, vx: (Math.random() - 0.5) * 300, vy: -80, spill: true, life: 1.2 }); popup(fx, HOLD.x + HOLD.w / 2, TOTAL.y - 10, q.tooMany ? "Too many crates!" : "Not enough crates!", "#ff9fb3", 26); } }
          this.queue.shift();
        } else {
          const sec = secs[q.i];
          if (q.ok) {
            const n = rows * sec.cols;
            q.sent = q.sent || 0;
            while (q.sent < n && q.t >= q.sent * every) {
              const to = slot(sec, q.sent++);
              this.falling.push({ x: s.x - sec.cs / 2 + (Math.random() - 0.5) * 10, y: s.y + 16, tx: to.x, ty: to.y, sec, vy: 0, life: 9 });
            }
            if (q.sent >= n) { this.queue.shift(); burst(fx, sec.x + sec.w / 2, HOLD.y + 40, { n: 18, color: "#ffe08a", speed: 160 }); }
          } else {
            for (let k = 0; k < 5; k++) this.falling.push({ x: s.x + (Math.random() - 0.5) * 30, y: s.y + 20, vx: (Math.random() - 0.5) * 60, vy: 0, bounce: HOLD.y + HOLD.h * (q.tooMany ? 0.15 : 0.85), cs: sec.cs, life: 2 });
            shake(fx, 8);
            popup(fx, sec.x + sec.w / 2, HOLD.y + 30, q.tooMany ? "Too many crates!" : "Not enough crates!", "#ff9fb3", 22);
            this.queue.shift();
          }
        }
      }
      for (const c of this.falling) {
        c.life -= dt;
        if (c.sec) {
          // Fall, then glide into the crate's slot.
          c.vy += 1400 * dt; c.y += c.vy * dt; c.x = ease(c.x, c.tx, 10, dt);
          if (c.y >= c.ty) { c.y = c.ty; c.sec.placed++; c.life = 0; }
        } else {
          c.vy += 900 * dt; c.y += c.vy * dt; c.x += (c.vx || 0) * dt;
          if (c.bounce && c.y > c.bounce && c.vy > 0) { c.vy = -c.vy * 0.6 - 120; c.vx = (Math.random() < 0.5 ? -1 : 1) * (160 + Math.random() * 120); c.bounce = null; }
        }
      }
      this.falling = this.falling.filter((c) => c.life > 0 && c.y < H + 40);
      this.doors = this.done ? Math.min(1, this.doors + dt * 0.8) : 0;
      if (this.doors >= 1) { this.flyOff = Math.min(1, this.flyOff + dt * 0.5); }
      updateStarsLite(this, dt);
    },
    draw(ctx) {
      const t = this.t, v = this.view;
      drawBackground(ctx, this.stars, t, { tint: mtint });
      drawMars(ctx, t, 452);
      // Hold frame
      roundRect(ctx, HOLD.x - 70, HOLD.y - 34, HOLD.w + 84, HOLD.h + 42, 18); ctx.fillStyle = "rgba(143,155,208,0.25)"; ctx.fill();
      ctx.strokeStyle = "#9aa6d6"; ctx.lineWidth = 3; ctx.stroke();
      text(ctx, String(rows), HOLD.x - 34, HOLD.y + HOLD.h / 2 - 8, { size: 34, color: "#ffe08a" });
      text(ctx, "rows", HOLD.x - 34, HOLD.y + HOLD.h / 2 + 22, { size: 16, color: "#c9cde6" });
      for (const s of secs) {
        const on = v.active === s.i && !v.locked[s.i] && !this.done, lk = v.locked[s.i];
        ctx.fillStyle = lk ? "rgba(79,214,143,0.14)" : on ? "rgba(255,201,60,0.12)" : "rgba(13,19,58,0.75)";
        ctx.fillRect(s.x + 3, HOLD.y, s.w - 6, HOLD.h);
        ctx.strokeStyle = on ? `rgba(255,201,60,${0.7 + 0.3 * Math.sin(t * 5)})` : lk ? "#4fd68f" : "rgba(154,166,214,0.5)";
        ctx.lineWidth = on ? 4 : 2; ctx.strokeRect(s.x + 3, HOLD.y, s.w - 6, HOLD.h);
        text(ctx, fmt(s.p), s.x + s.w / 2, HOLD.y - 17, { size: 18, color: "#eef1ff" });
        for (let k = 0; k < s.placed; k++) { const p = slot(s, k); drawCrate(ctx, p.x, p.y, s.cs); }
        const val = v.vals[s.i];
        text(ctx, `${rows} × ${fmt(s.p)}`, s.x + s.w / 2, HOLD.y + 24, { size: s.w > 150 ? 20 : 16, color: "#c9cde6", stroke: true });
        if (val || on) hud(ctx, val ? fmt(val) + (lk ? " ✓" : "") : "  ?  ", s.x + s.w / 2, HOLD.y + 58, { size: s.w > 150 ? 22 : 18, color: lk ? "#b9f5d3" : "#ffe08a", border: on ? "#ffc93c" : null });
      }
      // Total strip
      const tOn = v.active === parts.length && !v.locked[parts.length] && !this.done, tLk = v.locked[parts.length];
      roundRect(ctx, TOTAL.x, TOTAL.y, TOTAL.w, TOTAL.h, 14); ctx.fillStyle = tLk ? "rgba(79,214,143,0.2)" : "rgba(13,19,58,0.85)"; ctx.fill();
      ctx.strokeStyle = tOn ? `rgba(255,201,60,${0.7 + 0.3 * Math.sin(t * 5)})` : tLk ? "#4fd68f" : "rgba(154,166,214,0.5)"; ctx.lineWidth = tOn ? 4 : 2; ctx.stroke();
      text(ctx, "Total crates: add the sections", TOTAL.x + 20, TOTAL.y + TOTAL.h / 2, { size: 19, align: "left", color: "#c9cde6" });
      const tv = v.vals[parts.length];
      hud(ctx, tv ? fmt(tv) + (tLk ? " ✓" : "") : "  ?  ", TOTAL.x + TOTAL.w - 90, TOTAL.y + TOTAL.h / 2, { size: 22, color: tLk ? "#b9f5d3" : "#ffe08a", border: tOn ? "#ffc93c" : null });
      // Cargo doors slide shut when everything is loaded
      if (this.doors > 0) {
        const dw = (HOLD.w / 2) * this.doors;
        ctx.fillStyle = "#8f9bd0"; ctx.fillRect(HOLD.x, HOLD.y - 4, dw, 10); ctx.fillRect(HOLD.x + HOLD.w - dw, HOLD.y - 4, dw, 10);
      }
      for (const c of this.falling) drawCrate(ctx, c.x, c.y, c.sec ? c.sec.cs : c.cs || 18, c.spill || c.bounce === null ? Math.min(1, c.life) : 1);
      const s = this.ship, moving = Math.abs(s.tx - s.x) > 6;
      const fy = s.y - this.flyOff * 200;
      if (fy > -60) drawShip(ctx, s.x + this.flyOff * 120, fy, { t, thrust: this.flyOff > 0 ? 1 : moving ? 0.7 : 0.3, tilt: clamp((s.tx - s.x) / 600, -0.2, 0.2) - this.flyOff * 0.2, lights: true, scale: 0.9 });
      hud(ctx, `📦 ${rows} rows × ${fmt(item.n)} crates`, 170, 28, { size: 20 });
    },
  };
  return g;
}
function updateStarsLite(g, dt) { for (const s of g.stars) { s.x -= 4 * s.z * dt; if (s.x < -2) s.x = W + 2; } }

export function CargoGame({ st, world, record, calm, onBack }) {
  const [item] = useState(() => cargoItem(st.skills.multiply.level, world));
  const { rows, n, parts } = item;
  const nBox = parts.length + 1, T = parts.length;
  const ans = item.answer.map(Number);
  const [vals, setVals] = useState(() => Array(nBox).fill(""));
  const [locked, setLocked] = useState(() => Array(nBox).fill(false));
  const [active, setActive] = useState(0);
  const misses = useRef(Array(nBox).fill(0));
  const [boltDid, setBoltDid] = useState(false);
  const [phase, setPhase] = useState("work"); // work | loaded
  const [first, setFirst] = useState(null);
  const firstRef = useRef(false);
  const [help, helpRef, useHelpKind] = useHelp();
  const [msg, setMsg] = useState(null);
  const t0 = useRef(Date.now());
  const placeName = (p) => ["ones", "tens", "hundreds", "thousands"][String(p).length - 1];
  const sectionsDone = locked.slice(0, T).every(Boolean);

  const api = useApi({
    select: (i) => {
      if (phase !== "work" || locked[i]) return;
      if (i === T && !sectionsDone) { setMsg({ kind: "info", text: "Fill every section first, then add them up for the total." }); return; }
      sfx.click(); setActive(i);
    },
  });
  const [cv, game] = useCanvasGame(() => cargoGame(item, api), calm);
  useEffect(() => { if (game.current) game.current.view = { vals, locked, active }; }, [vals, locked, active, game]);

  const onKey = (k) => {
    if (phase !== "work" || locked[active]) return;
    setVals((v) => v.map((x, i) => (i !== active ? x : k === "⌫" ? x.slice(0, -1) : /\d/.test(k) ? (x + k).slice(0, 7) : x)));
  };
  const nextOpen = (lk) => { for (let i = 0; i < T; i++) if (!lk[i]) return i; return T; };
  const drop = () => {
    if (phase !== "work") return;
    const i = active, v = vals[i];
    if (!v) { setMsg({ kind: "info", text: i === T ? "Type the total first." : `Type how many crates go in the ${fmt(parts[i])} section.` }); return; }
    const ok = Number(v) === ans[i];
    const given = vals.map((x) => x || "?").join(", ");
    // First try counts: every box right on its first drop.
    if (!firstRef.current && (!ok || (i === T && misses.current.every((m) => m === 0)))) {
      firstRef.current = true;
      const r = record("cargo", item, { correct: ok, help: helpRef.current, ms: Date.now() - t0.current, given });
      setFirst(r.support);
    }
    if (ok) {
      sfx.load(); game.current?.drop(i, true);
      const lk = locked.map((x, j) => x || j === i); setLocked(lk);
      if (i === T) { setTimeout(() => sfx.power(), 300); setPhase("loaded"); setMsg({ kind: "good", text: `Cargo loaded! ${rows} × ${fmt(n)} = ${fmt(ans[T])} crates.` }); return; }
      setActive(nextOpen(lk)); setMsg({ kind: "good", text: `${rows} × ${fmt(parts[i])} = ${fmt(ans[i])}. Section loaded!` });
      return;
    }
    sfx.bump(); game.current?.drop(i, false, Number(v) > ans[i]);
    misses.current[i]++;
    setVals((x) => x.map((y, j) => (j === i ? "" : y)));
    if (misses.current[i] >= 2) {
      // Bolt loads this one and shows why; she keeps going with the rest.
      setBoltDid(true);
      setTimeout(() => {
        game.current?.drop(i, true);
        setVals((x) => x.map((y, j) => (j === i ? String(ans[i]) : y)));
        const lk = locked.map((x, j) => x || j === i); setLocked(lk);
        if (i === T) { setPhase("loaded"); setMsg({ kind: "info", text: `Bolt finished loading: ${parts.map((p, j) => fmt(ans[j])).join(" + ")} = ${fmt(ans[T])} crates. Here's how it works.` }); return; }
        setActive(nextOpen(lk));
        setMsg({ kind: "info", text: `Bolt loaded that section: ${rows} × ${fmt(parts[i])} is ${rows} × ${String(parts[i])[0]} ${placeName(parts[i])} = ${fmt(ans[i])}.` });
      }, calm ? 500 : 1200);
      return;
    }
    setMsg({ kind: "bad", text: i === T
      ? `The total doesn't match the sections. Add ${parts.map((_, j) => fmt(vals[j] || ans[j])).join(" + ")} again.`
      : `${Number(v) > ans[i] ? "Too many" : "Not enough"} crates for that section, so they spilled out. Think: ${rows} × ${String(parts[i])[0]} ${placeName(parts[i])}. Try again!` });
  };
  useHardwareKeys(onKey, drop, phase === "work");

  return (
    <div className="ms-panel">
      <StationHead id="cargo" onBack={onBack} story={`The hold has ${rows} rows. Each row holds ${fmt(n)} crates. Tap a section, type how many crates go in it, and the Cruiser drops them in. Then add up the sections.`} />
      <canvas ref={cv} className="ms-canvas" role="img" aria-label={`Area model: ${rows} rows by ${parts.map(fmt).join(" + ")}. ${locked.filter(Boolean).length} of ${nBox} boxes loaded.`} />
      <div className="ms-sr">{[...parts, "total"].map((p, i) => <button key={i} disabled={locked[i] || phase !== "work"} onClick={() => api.current.select(i)}>{i === T ? "Choose the total box" : `Choose the ${rows} × ${fmt(p)} section`}</button>)}</div>
      {phase === "work" && (<>
        <div className="ms-gamebar">
          <span className="ms-eq">{active === T ? "Total" : `${rows} × ${fmt(parts[active])}`} = <b className="ms-q">{vals[active] ? fmt(vals[active]) : "?"}</b></span>
          <button className="ms-go" onClick={drop}>{active === T ? "Load it all ✓" : "Drop the crates 📦"}</button>
        </div>
        <Keypad onKey={onKey} />
      </>)}
      {msg && <div className={`ms-msg ${msg.kind}`} role="status">{msg.text}</div>}
      {phase === "work" && !first && <Bolt used={help} onUse={useHelpKind} hint={item.hint}
        part={{ text: `${rows} × ${fmt(n)} using partial products: ${parts.map((p) => `${rows} × ${fmt(p)}`).join(", ")}, then the total.`, answer: item.answer, steps: item.steps }}
        visual={<ul className="ms-pv">{parts.map((p, i) => <li key={i}>{rows} × {fmt(p)} is {rows} × {String(p)[0]} {placeName(p)}</li>)}</ul>} />}
      {phase === "loaded" && boltDid && <ol className="ms-steps">{item.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>}
      <Record r={first} />
      {phase === "loaded" && <div className="ms-actions"><button className="ms-go" onClick={() => onBack("cargo")}>Back to the ship ➜</button></div>}
    </div>
  );
}

// ═══ Station 2: Balance the ship ═══════════════════════════════════════════════
// Hang a cargo pod on the right hook. The ship tips toward the heavier side for real.
const PIV = { x: 400, y: 190 }, ARM = 190, CABLE = 70;
function balanceGame(pz, api) {
  const homes = [130, 300, 500, 670];
  const loads = pz.loads.map((l, i) => ({ i, label: `${l.c} × ${fmt(l.m)}`, w: l.c * l.m, x: homes[i], y: 410, hx: homes[i], hy: 410, state: "home" }));
  const g = {
    loads, ang: -0.2, vel: 0, right: null, drag: null, level: 0, done: false,
    hook() { const a = this.ang; return { x: PIV.x + Math.cos(a) * ARM, y: PIV.y + Math.sin(a) * ARM + CABLE }; },
    leftHook() { const a = this.ang; return { x: PIV.x - Math.cos(a) * ARM, y: PIV.y - Math.sin(a) * ARM + CABLE }; },
    loadAt(p) { return this.loads.find((l) => l.state === "home" && Math.abs(p.x - l.x) < 75 && Math.abs(p.y - l.y) < 32); },
    hits(p) { return api.current.canPlace() && !!this.loadAt(p); },
    send(i) { const l = this.loads[i]; if (!l || l.state !== "home" || this.right || !api.current.canPlace()) return; l.state = "fly"; sfx.click(); },
    pointer(p, kind) {
      if (kind === "down") { const l = this.loadAt(p); if (l && api.current.canPlace() && !this.right) { this.drag = { l, ox: l.x - p.x, oy: l.y - p.y, sx: p.x, sy: p.y }; l.state = "drag"; } return; }
      const d = this.drag; if (!d) return;
      if (kind === "drag") { d.l.x = p.x + d.ox; d.l.y = p.y + d.oy; return; }
      this.drag = null;
      const moved = Math.hypot(p.x - d.sx, p.y - d.sy) > 12;
      if (!moved || dist(d.l, this.hook()) < 120 || d.l.y < 300) d.l.state = "fly"; else d.l.state = "back";
    },
    stow() { const l = this.right; if (l) { l.state = "stowed"; } this.right = null; },
    update(dt) {
      const fx = this.fx, hk = this.hook();
      for (const l of this.loads) {
        if (l.state === "fly") {
          l.x = ease(l.x, hk.x, 7, dt); l.y = ease(l.y, hk.y + 22, 7, dt);
          if (Math.hypot(l.x - hk.x, l.y - hk.y - 22) < 6) {
            l.state = "on"; this.right = l;
            const res = api.current.place(l.i);
            if (res === "ok") { this.level = 1.2; burst(fx, PIV.x, PIV.y, { n: 40, color: "#b9f5d3", speed: 240 }); popup(fx, PIV.x, 60, "BALANCED!", "#b9f5d3", 36); }
            else { l.fallT = this.calm ? 0.5 : 1.4; }
          }
        } else if (l.state === "on") {
          l.x = hk.x; l.y = hk.y + 22;
          if (l.fallT !== undefined) { l.fallT -= dt; if (l.fallT <= 0) { l.state = "back"; l.used = true; this.right = null; delete l.fallT; shake(fx, 6); } }
        } else if (l.state === "back" || l.state === "stowed") {
          l.x = ease(l.x, l.hx, 6, dt); l.y = ease(l.y, l.hy, 6, dt);
          if (l.state === "back" && Math.hypot(l.x - l.hx, l.y - l.hy) < 2) l.state = l.used ? "used" : "home";
        }
      }
      // Spring physics: the heavier side goes down.
      const r = this.right, target = !r ? -0.2 : r.w === pz.target ? 0 : r.w < pz.target ? -0.2 : 0.2;
      this.vel += (target - this.ang) * 24 * dt; this.vel *= 1 - dt * (this.calm ? 6 : 2.6); this.ang += this.vel * dt;
      this.level = Math.max(0, this.level - dt * 0.5);
      for (const s of this.stars) { s.x -= 4 * s.z * dt; if (s.x < -2) s.x = W + 2; }
    },
    draw(ctx) {
      const t = this.t;
      drawBackground(ctx, this.stars, t, { tint: mtint });
      drawMars(ctx, t, 452);
      // Docking tower
      ctx.fillStyle = "#5a628f"; ctx.fillRect(PIV.x - 10, PIV.y + 20, 20, 452 - PIV.y - 20);
      ctx.beginPath(); ctx.moveTo(PIV.x - 30, PIV.y + 34); ctx.lineTo(PIV.x + 30, PIV.y + 34); ctx.lineTo(PIV.x, PIV.y + 6); ctx.closePath(); ctx.fillStyle = "#8f9bd0"; ctx.fill();
      // Level gauge
      const deg = Math.round((this.ang * 180) / Math.PI);
      hud(ctx, Math.abs(deg) <= 1 && this.right ? "⚖️ Level" : `⚖️ Tipping ${deg < 0 ? "left" : "right"}`, 120, 28, { size: 20, color: Math.abs(deg) <= 1 && this.right ? "#b9f5d3" : "#ffb38a" });
      // Ship as the beam, with cables and pods
      const lh = this.leftHook(), hk = this.hook();
      ctx.strokeStyle = "#c9cde6"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lh.x, lh.y - CABLE); ctx.lineTo(lh.x, lh.y); ctx.moveTo(hk.x, hk.y - CABLE); ctx.lineTo(hk.x, hk.y); ctx.stroke();
      ctx.save(); ctx.translate(PIV.x, PIV.y); ctx.rotate(this.ang);
      ctx.fillStyle = "#8f9bd0"; roundRect(ctx, -ARM - 10, -6, ARM * 2 + 20, 12, 6); ctx.fill();
      ctx.restore();
      drawShip(ctx, PIV.x, PIV.y - 12, { t: 0, tilt: this.ang, thrust: this.level > 0 ? 1 : 0.2, lights: !!this.right, scale: 1.1 });
      pod(ctx, lh.x, lh.y + 22, `${pz.a} × ${fmt(pz.m)}`, "#ffc93c");
      if (!this.right) { ctx.setLineDash([6, 6]); ctx.strokeStyle = `rgba(255,255,255,${0.4 + 0.3 * Math.sin(t * 4)})`; ctx.lineWidth = 2; roundRect(ctx, hk.x - 66, hk.y, 132, 44, 12); ctx.stroke(); ctx.setLineDash([]); text(ctx, "?", hk.x, hk.y + 22, { size: 24, color: "#c9cde6" }); }
      // Tray of loads
      roundRect(ctx, 40, 378, 720, 64, 16); ctx.fillStyle = "rgba(7,11,36,0.55)"; ctx.fill();
      for (const l of this.loads) {
        if (l.state === "stowed" && Math.hypot(l.x - l.hx, l.y - l.hy) < 4) { pod(ctx, l.x, l.y, l.label + " ✓", "#4fd68f", 0.75); continue; }
        pod(ctx, l.x, l.y, l.label, l.used || l.state === "used" ? "#5a628f" : "#52d6e8", l.state === "used" ? 0.55 : 1, l.state === "drag");
      }
      if (this.level > 0) { ctx.globalAlpha = Math.min(1, this.level); text(ctx, "✨", lh.x, lh.y - 30, { size: 26 }); text(ctx, "✨", hk.x, hk.y - 30, { size: 26 }); ctx.globalAlpha = 1; }
      if (!this.right && this.loads.every((l) => l.state === "home" || l.state === "used" || l.state === "stowed")) text(ctx, "Drag a load up to the right hook", 400, 468, { size: 16, color: "rgba(255,240,230,0.85)" });
    },
  };
  return g;
}
function pod(ctx, x, y, label, color, alpha = 1, lifted = false) {
  ctx.globalAlpha = alpha;
  ctx.font = "700 20px Fredoka, system-ui, sans-serif";
  const w = Math.max(118, ctx.measureText(label).width + 30), h = 44;
  if (lifted) { ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8; }
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 12); ctx.fillStyle = "#1e2766"; ctx.fill();
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
  text(ctx, label, x, y + 1, { size: 20, color: "#eef1ff" });
  ctx.globalAlpha = 1;
}

export function BalanceGame({ st, record, calm, onBack }) {
  const [pz] = useState(() => balancePuzzle(st.skills.mental.level));
  const item = useMemo(() => balanceItem(pz), [pz]);
  const [found, setFound] = useState([]);
  const [tried, setTried] = useState([]);
  const [bonus, setBonus] = useState(false);
  const [first, setFirst] = useState(null);
  const firstRef = useRef(false);
  const [help, helpRef, useHelpKind] = useHelp();
  const [msg, setMsg] = useState(null);
  const t0 = useRef(Date.now());
  const balanced = found.length > 0;
  const nOk = pz.loads.filter((l) => l.ok).length;

  const api = useApi({
    canPlace: () => !balanced || bonus,
    place: (i) => {
      const l = pz.loads[i], w = l.c * l.m;
      if (!firstRef.current) { firstRef.current = true; const r = record("balance", item, { correct: l.ok, help: helpRef.current, ms: Date.now() - t0.current, given: `${l.c} × ${fmt(l.m)}`, part: { answerType: "number", answer: String(pz.target) } }); setFirst(r.support); }
      if (l.ok) {
        setTimeout(() => sfx.power(), 250);
        setFound((f) => [...f, i]); setBonus(false);
        setMsg({ kind: "good", text: bonus ? `Another match! ${l.c} × ${fmt(l.m)} = ${fmt(w)} too. Bonus ⭐` : `Balanced! ${l.c} × ${fmt(l.m)} = ${fmt(w)}, and ${pz.a} × ${fmt(pz.m)} = ${fmt(pz.target)}.` });
        return "ok";
      }
      setTimeout(() => sfx.bump(), 250);
      setTried((t) => [...t, i]);
      setMsg({ kind: "bad", text: `${w < pz.target ? "Too light" : "Too heavy"}! ${l.c} × ${fmt(l.m)} = ${fmt(w)}, but the left side is ${pz.a} × ${fmt(pz.m)}. Try another load.` });
      return "bad";
    },
  });
  const [cv, game] = useCanvasGame(() => balanceGame(pz, api), calm);
  const zeros = String(pz.m).length - 1;
  const unit = ["", "tens", "hundreds", "thousands"][zeros];

  return (
    <div className="ms-panel">
      <StationHead id="balance" onBack={onBack} story={`The left cargo pod has ${pz.a} crates of ${fmt(pz.m)} kg. Hang a load on the right hook that weighs exactly the same, or the ship tips over.`} />
      <canvas ref={cv} className="ms-canvas" role="img" aria-label={`Left pod ${pz.a} × ${fmt(pz.m)}. Loads: ${pz.loads.map((l) => `${l.c} × ${fmt(l.m)}`).join(", ")}.`} />
      <div className="ms-sr">{pz.loads.map((l, i) => <button key={i} disabled={tried.includes(i) || found.includes(i) || (balanced && !bonus)} onClick={() => game.current?.send(i)}>Hang the load {l.c} × {fmt(l.m)}</button>)}</div>
      {msg && <div className={`ms-msg ${msg.kind}`} role="status">{msg.text}</div>}
      {!first && <Bolt used={help} onUse={useHelpKind}
        hint={`Work out the left side first: ${pz.a} × ${fmt(pz.m)} is ${pz.a} × ${String(pz.m)[0]} ${unit}. Then check each load the same way.`}
        part={{ text: `The left side is ${pz.a} × ${fmt(pz.m)}. Which loads weigh the same? Loads: ${pz.loads.map((l) => `${l.c} × ${fmt(l.m)}`).join(", ")}.`, answer: pz.loads.filter((l) => l.ok).map((l) => `${l.c} × ${l.m}`), steps: pz.loads.map((l) => `${l.c} × ${fmt(l.m)} = ${fmt(l.c * l.m)}`) }}
        visual={<p>{pz.a} × {fmt(pz.m)} = {pz.a} × {String(pz.m)[0]} {unit} = {pz.a * Number(String(pz.m)[0])} {unit}. Count the zeros: each load needs the same number of {unit} in total.</p>} />}
      <Record r={first} />
      {balanced && !bonus && (
        <div className="ms-actions">
          {found.length < nOk && <button className="ms-ghost" onClick={() => { sfx.click(); setBonus(true); game.current?.stow(); setMsg({ kind: "info", text: `Bolt: "One more load also balances. Can you find it?"` }); }}>⚖️ Find the other match</button>}
          <button className="ms-go" onClick={() => onBack("balance")}>Back to the ship ➜</button>
        </div>
      )}
    </div>
  );
}

// ═══ Station 3: Lander Drop ═══════════════════════════════════════════════════
// Drag each load into the lander (fits) or onto the orbit dock (too heavy). When
// every load is sorted, the lander flies down to Mars Base.
const LANDER = { x: 150, y: 300, w: 190, h: 120 }, DOCK = { x: 610, y: 300, w: 200, h: 120 }, DROP = 74;
function landGame(pz, api) {
  const loads = pz.loads.map((l, i) => ({ i, label: `${l.c} × ${fmt(l.w)} kg`, x: 400, y: 58 + i * 52, hx: 400, hy: 58 + i * 52, state: "home" }));
  const g = {
    loads, drag: null, sel: null, sag: 0, alarm: 0, inLander: [], onDock: [], descend: 0, landed: false,
    loadAt(p) { return this.loads.find((l) => l.state === "home" && Math.abs(p.x - l.x) < 100 && Math.abs(p.y - l.y) < 26); },
    zone(p) {
      if (p.x > LANDER.x - LANDER.w / 2 - 30 && p.x < LANDER.x + LANDER.w / 2 + 30 && p.y > LANDER.y - 70) return "fits";
      if (p.x > DOCK.x - DOCK.w / 2 - 30 && p.x < DOCK.x + DOCK.w / 2 + 30 && p.y > DOCK.y - 70) return "heavy";
      return null;
    },
    hits(p) { return !!this.loadAt(p) || (this.sel && !!this.zone(p)); },
    send(i, says) { const l = this.loads[i]; if (l.state !== "home") return; this.sel = null; this.decide(l, says); },
    decide(l, says) {
      const res = api.current.decide(l.i, says);
      const fx = this.fx;
      if (res === "right") {
        if (says === "fits") { l.state = "lander"; l.slot = this.inLander.length; this.inLander.push(l); this.sag = 0.4; }
        else { l.state = "dock"; l.slot = this.onDock.length; this.onDock.push(l); }
        burst(fx, says === "fits" ? LANDER.x : DOCK.x, LANDER.y, { n: 16, color: "#b9f5d3", speed: 150 });
        if (this.inLander.length + this.onDock.length === this.loads.length) setTimeout(() => { this.descendStart = true; }, this.calm ? 300 : 900);
      } else {
        l.state = "reject"; l.rt = 0.9; l.tx = says === "fits" ? LANDER.x : DOCK.x; l.ty = LANDER.y + 20;
        if (says === "fits") { this.sag = 1.4; this.alarm = 1.4; } else this.alarm = 0.8;
        shake(fx, 8);
      }
    },
    pointer(p, kind) {
      if (kind === "down") {
        const l = this.loadAt(p);
        if (l) { this.drag = { l, ox: l.x - p.x, oy: l.y - p.y, sx: p.x, sy: p.y }; l.state = "drag"; return; }
        if (this.sel) { const z = this.zone(p); if (z) { const s = this.sel; this.sel = null; s.state = "home"; this.decide(s, z); } }
        return;
      }
      const d = this.drag; if (!d) return;
      if (kind === "drag") { d.l.x = p.x + d.ox; d.l.y = p.y + d.oy; return; }
      this.drag = null;
      if (Math.hypot(p.x - d.sx, p.y - d.sy) < 12) { d.l.state = "home"; this.sel = d.l; sfx.click(); return; } // a tap selects it
      const z = this.zone(d.l);
      if (z) { d.l.state = "home"; this.decide(d.l, z); } else d.l.state = "back";
    },
    update(dt) {
      for (const l of this.loads) {
        if (l.state === "lander") { l.x = ease(l.x, LANDER.x, 8, dt); l.y = ease(l.y, LANDER.y + 26 + this.descend * DROP - l.slot * 30, 8, dt); }
        else if (l.state === "dock") { l.x = ease(l.x, DOCK.x, 8, dt); l.y = ease(l.y, DOCK.y + 26 - l.slot * 30, 8, dt); }
        else if (l.state === "back") { l.x = ease(l.x, l.hx, 8, dt); l.y = ease(l.y, l.hy, 8, dt); if (Math.hypot(l.x - l.hx, l.y - l.hy) < 2) l.state = "home"; }
        else if (l.state === "reject") { l.rt -= dt; l.x = ease(l.x, l.tx, 10, dt); l.y = ease(l.y, l.ty, 10, dt); if (l.rt <= 0) l.state = "back"; }
      }
      this.sag = Math.max(0, this.sag - dt * 1.2); this.alarm = Math.max(0, this.alarm - dt);
      if (this.descendStart && !this.landed) {
        this.descend = Math.min(1, this.descend + dt * (this.calm ? 0.8 : 0.45));
        if (this.descend >= 1) { this.landed = true; const fx = this.fx; burst(fx, LANDER.x, 448, { n: 40, color: "#e8946f", speed: 200, dir: -Math.PI / 2, spread: 2.6 }); popup(fx, 400, 160, "DELIVERED TO MARS BASE!", "#ffe08a", 32); fx.flash = 0.5; fx.flashColor = "#ffc93c"; sfx.win(); }
      }
      for (const s of this.stars) { s.x -= 4 * s.z * dt; if (s.x < -2) s.x = W + 2; }
    },
    draw(ctx) {
      const t = this.t, d = this.descend;
      drawBackground(ctx, this.stars, t, { tint: mtint });
      drawMars(ctx, t, 452);
      // Mars Base
      ctx.fillStyle = "#c9cde6"; ctx.beginPath(); ctx.ellipse(360, 452, 46, 30, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#8f9bd0"; ctx.fillRect(310, 446, 100, 8);
      text(ctx, "Mars Base", 360, 470, { size: 14, color: "#ffe9de" });
      // The Cruiser holds the lander on a cable until everything is sorted
      drawShip(ctx, LANDER.x, 40, { t, thrust: 0.3, lights: true, scale: 0.8 });
      const ly = LANDER.y + d * DROP + this.sag * 8;
      if (d === 0) { ctx.strokeStyle = "#c9cde6"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(LANDER.x, 56); ctx.lineTo(LANDER.x, ly - LANDER.h / 2); ctx.stroke(); }
      // Lander body
      ctx.save(); ctx.translate(LANDER.x, ly);
      if (d > 0 && !this.landed) { const fl = 30 + Math.sin(t * 40) * 6; const gr = ctx.createLinearGradient(0, LANDER.h / 2, 0, LANDER.h / 2 + fl); gr.addColorStop(0, "rgba(255,230,120,0.95)"); gr.addColorStop(1, "rgba(255,120,40,0)"); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-26, LANDER.h / 2); ctx.quadraticCurveTo(0, LANDER.h / 2 + fl * 1.4, 26, LANDER.h / 2); ctx.fill(); }
      ctx.strokeStyle = "#9aa6d6"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-LANDER.w / 2 + 10, LANDER.h / 2 - 10); ctx.lineTo(-LANDER.w / 2 - 14, LANDER.h / 2 + 18); ctx.moveTo(LANDER.w / 2 - 10, LANDER.h / 2 - 10); ctx.lineTo(LANDER.w / 2 + 14, LANDER.h / 2 + 18); ctx.stroke();
      roundRect(ctx, -LANDER.w / 2, -LANDER.h / 2, LANDER.w, LANDER.h, 22);
      ctx.fillStyle = this.alarm > 0 && Math.sin(t * 20) > 0 ? "#5a2236" : "#2a3478"; ctx.fill();
      ctx.strokeStyle = this.alarm > 0 ? "#ff6b8a" : "#9aa6d6"; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
      if (d === 0) hud(ctx, `Lander: less than ${fmt(pz.limit)} kg`, LANDER.x, LANDER.y - LANDER.h / 2 - 22, { size: 17, color: "#b9f5d3" });
      // Orbit dock
      roundRect(ctx, DOCK.x - DOCK.w / 2, DOCK.y - DOCK.h / 2, DOCK.w, DOCK.h, 18); ctx.fillStyle = "rgba(143,155,208,0.22)"; ctx.fill();
      ctx.setLineDash([8, 8]); ctx.strokeStyle = "#9aa6d6"; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
      hud(ctx, "Too heavy: stays in orbit", DOCK.x, DOCK.y - DOCK.h / 2 - 22, { size: 17, color: "#ffb38a" });
      if (this.sel) { const pulse = 0.5 + 0.4 * Math.sin(t * 6); ctx.strokeStyle = `rgba(255,201,60,${pulse})`; ctx.lineWidth = 4; for (const z of [LANDER, DOCK]) { roundRect(ctx, z.x - z.w / 2 - 8, z.y - z.h / 2 - 8, z.w + 16, z.h + 16, 24); ctx.stroke(); } }
      for (const l of this.loads) cratePill(ctx, l.x, l.y, l.label, l.state === "drag", this.sel === l, l.state === "lander" || l.state === "dock" ? 0.85 : 1);
      if (this.loads.some((l) => l.state === "home") && !this.drag) text(ctx, this.sel ? "Now tap the lander or the dock" : "Drag each load to the lander or the dock", 430, 405, { size: 16, color: "rgba(238,241,255,0.8)" });
    },
  };
  return g;
}
function cratePill(ctx, x, y, label, lifted, sel, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.font = "700 19px Fredoka, system-ui, sans-serif";
  const w = Math.max(170, ctx.measureText(label).width + 58), h = 42;
  if (lifted) { ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8; }
  roundRect(ctx, -w / 2, -h / 2, w, h, 12); ctx.fillStyle = "#d1924f"; ctx.fill();
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.lineWidth = sel ? 4 : 2.5; ctx.strokeStyle = sel ? "#ffc93c" : "#7a4a1f"; ctx.stroke();
  text(ctx, "📦", -w / 2 + 20, 1, { size: 18 });
  text(ctx, label, 12, 1, { size: 19, color: "#2a1600" });
  ctx.restore();
}

export function LandGame({ st, record, calm, onBack }) {
  const [pz] = useState(() => landPuzzle(st.skills.estimate.level));
  const item = useMemo(() => landItem(pz), [pz]);
  const [verdict, setVerdict] = useState(() => pz.loads.map(() => null));
  const verdictRef = useRef(pz.loads.map(() => null));
  const firstPick = useRef(pz.loads.map(() => null));
  const [first, setFirst] = useState(null);
  const firstRef = useRef(false);
  const [help, helpRef, useHelpKind] = useHelp();
  const [msg, setMsg] = useState(null);
  const t0 = useRef(Date.now());
  const done = verdict.every(Boolean);
  const placeWord = pz.place === 100 ? "hundred" : "ten";

  const api = useApi({
    decide: (i, says) => {
      const l = pz.loads[i], right = (says === "fits") === l.fits;
      if (!firstPick.current[i]) firstPick.current[i] = says;
      const nfp = firstPick.current;
      if (!firstRef.current) {
        const anyWrong = nfp.some((x, j) => x && (x === "fits") !== pz.loads[j].fits);
        if (anyWrong || nfp.every(Boolean)) {
          firstRef.current = true;
          const r = record("land", item, { correct: !anyWrong, help: helpRef.current, ms: Date.now() - t0.current, given: nfp.map((x, j) => `${pz.loads[j].c} × ${fmt(pz.loads[j].w)}: ${x || "?"}`).join("; "), part: { answerType: "number", answer: String(pz.limit) } });
          setFirst(r.support);
        }
      }
      const est = l.c * roundTo(l.w, pz.place);
      if (right) {
        sfx[l.fits ? "load" : "click"]();
        const nv = verdictRef.current.map((x, j) => (j === i ? (l.fits ? "fits" : "heavy") : x));
        verdictRef.current = nv; setVerdict(nv);
        if (nv.every(Boolean)) { setTimeout(() => sfx.whoosh(), 400); setMsg({ kind: "good", text: "Every load sorted! The lander is taking the light ones down to Mars Base." }); }
        else setMsg({ kind: "good", text: `${l.fits ? "Loaded" : "Left in orbit"}: ${l.c} × ${fmt(l.w)} is about ${l.c} × ${fmt(roundTo(l.w, pz.place))} = ${fmt(est)}.` });
        return "right";
      }
      sfx.bump();
      setMsg({ kind: "bad", text: says === "fits"
        ? `Alarm! Bolt checks: ${l.c} × ${fmt(l.w)} is about ${l.c} × ${fmt(roundTo(l.w, pz.place))} = ${fmt(est)}. That's more than ${fmt(pz.limit)}, so it's too heavy for the lander.`
        : `Bolt checks: ${l.c} × ${fmt(l.w)} is about ${l.c} × ${fmt(roundTo(l.w, pz.place))} = ${fmt(est)}. That's less than ${fmt(pz.limit)}, so it fits in the lander. Try it there!` });
      return "wrong";
    },
  });
  const [cv, game] = useCanvasGame(() => landGame(pz, api), calm);

  return (
    <div className="ms-panel">
      <StationHead id="land" onBack={onBack} story={`The lander can carry less than ${fmt(pz.limit)} kg on each trip. Estimate each load, then drag it into the lander or onto the orbit dock if it's too heavy.`} />
      <canvas ref={cv} className="ms-canvas" role="img" aria-label={`Lander limit ${fmt(pz.limit)} kg. Loads: ${pz.loads.map((l) => `${l.c} × ${fmt(l.w)} kg`).join(", ")}.`} />
      <div className="ms-sr">{pz.loads.map((l, i) => (
        <span key={i}><button disabled={!!verdict[i]} onClick={() => game.current?.send(i, "fits")}>{l.c} × {fmt(l.w)} kg fits</button><button disabled={!!verdict[i]} onClick={() => game.current?.send(i, "heavy")}>{l.c} × {fmt(l.w)} kg is too heavy</button></span>
      ))}</div>
      {msg && <div className={`ms-msg ${msg.kind}`} role="status">{msg.text}</div>}
      {!first && <Bolt used={help} onUse={useHelpKind}
        hint={`Round each crate's weight to the nearest ${placeWord}, then multiply by the number of crates. Compare that with ${fmt(pz.limit)}.`}
        part={{ text: `The lander carries less than ${fmt(pz.limit)} kg. Loads: ${pz.loads.map((l) => `${l.c} crates of ${fmt(l.w)} kg`).join(", ")}. Which loads fit?`, answer: pz.loads.map((l) => String(l.total)), steps: pz.loads.map((l) => `${l.c} × ${fmt(l.w)} ≈ ${l.c} × ${fmt(roundTo(l.w, pz.place))} = ${fmt(l.c * roundTo(l.w, pz.place))} → ${l.fits ? "fits" : "too heavy"}`) }}
        visual={<ul className="ms-pv">{pz.loads.map((l, i) => <li key={i}>{l.c} × {fmt(l.w)} is about {l.c} × {fmt(roundTo(l.w, pz.place))}</li>)}</ul>} />}
      <Record r={first} />
      {done && <div className="ms-actions"><button className="ms-go" onClick={() => onBack("land")}>Back to the ship ➜</button></div>}
    </div>
  );
}
