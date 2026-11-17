// The Comet Cruiser stations as real-time canvas mini-games. The math and the
// recording are the same as the card versions in Mission.jsx: the game only decides
// how she makes her choice (fly, beam, blast, steer), never whether it counts.
// No timers and no fail state: a wrong move bounces, explodes or bumps, then she tries again.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { W, H, fmt, clamp, dist, ease, makeStars, updateStars, drawBackground, makeFx, burst, stream, popup, shake, updateFx, drawFx, text, pill, roundRect, drawShip, drawOrb, rockShape, drawRock, drawBeam, drawLaser } from "./arcade.js";
import { reactorPuzzle, reactorItem, waysToMake, wayText, shieldItem, gatePuzzle, gateItem, inGate } from "./engine.js";
import { isCorrect } from "../engine/check.js";
import { shuffle } from "../engine/util.js";
import { Keypad, useHardwareKeys, ColumnEntry } from "../ui/components.jsx";
import { sfx } from "./sfx.js";
import { StationHead, Bolt, Record, countUp } from "./Mission.jsx";

// ── The canvas loop shared by every game ──
// make() returns a game object with update(dt), draw(ctx) and pointer(p, kind).
// The hook adds g.t, g.fx (particles), g.stars and g.calm, scales the 800×480 field
// to the canvas, and maps touches into field coordinates.
export function useCanvasGame(make, calm) {
  const ref = useRef(null), game = useRef(null);
  useEffect(() => {
    const cv = ref.current, ctx = cv.getContext("2d");
    const g = make();
    g.t = 0; g.calm = calm; g.fx = makeFx(calm); g.stars = g.stars || makeStars();
    game.current = g;
    let raf = 0, last = performance.now(), dpr = 1, down = false;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth || W;
      cv.width = Math.round(w * dpr); cv.height = Math.round((w * dpr * H) / W);
    };
    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(cv);
    const loc = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
    const onDown = (e) => { e.preventDefault(); down = true; try { cv.setPointerCapture(e.pointerId); } catch {} g.pointer?.(loc(e), "down"); };
    const onMove = (e) => { const p = loc(e); if (down) g.pointer?.(p, "drag"); else cv.style.cursor = g.hits?.(p) ? "pointer" : "default"; };
    const onUp = (e) => { if (!down) return; down = false; g.pointer?.(loc(e), "up"); };
    cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp); cv.addEventListener("pointercancel", onUp);
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      g.t += dt;
      g.update(dt);
      updateFx(g.fx, dt);
      const s = cv.width / W, fx = g.fx;
      const sx = fx.shake ? (Math.random() - 0.5) * fx.shake : 0, sy = fx.shake ? (Math.random() - 0.5) * fx.shake : 0;
      ctx.setTransform(s, 0, 0, s, sx * s, sy * s);
      g.draw(ctx);
      drawFx(ctx, fx);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); ro?.disconnect();
      cv.removeEventListener("pointerdown", onDown); cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp); cv.removeEventListener("pointercancel", onUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const g = game.current; if (g) { g.calm = calm; g.fx.calm = calm; } }, [calm]);
  return [ref, game];
}
// Callbacks the game calls back into React; always the latest render's versions.
export function useApi(fns) { const r = useRef(fns); r.current = fns; return r; }
export const useHelp = () => {
  const [help, setHelp] = useState([]);
  const ref = useRef([]);
  const use = useCallback((k) => { ref.current = [...new Set([...ref.current, k])]; setHelp(ref.current); }, []);
  return [help, ref, use];
};
export const hud = (ctx, s, x, y, opts = {}) => pill(ctx, s, x, y, { size: 22, bg: "rgba(7,11,36,0.78)", border: "rgba(154,166,214,0.45)", ...opts });

// ═══ Station 1: Cell Catcher ═══════════════════════════════════════════════════
// Fly the Cruiser, tractor-beam energy cells, and fill the reactor tube to exactly the target.
const TUBE = { x: 690, y: 78, w: 70, h: 340 };
function reactorGame(pz, api) {
  const slots = [[110, 130], [300, 110], [500, 140], [140, 340], [340, 360], [530, 330]];
  const cells = shuffle(pz.cells.map((v, i) => i)).map((i, k) => {
    const a = Math.random() * 6.283, sp = 12 + Math.random() * 12;
    return { i, v: pz.cells[i], x: slots[k][0] + (Math.random() - 0.5) * 40, y: slots[k][1] + (Math.random() - 0.5) * 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 38, mode: "free", k: 0 };
  });
  const g = {
    ship: { x: 330, y: 240, tx: 330, ty: 240 },
    cells, chase: null, loaded: [], shown: 0, over: null, gap: false, solved: false, glow: 0, started: false,
    tubeTop() { return TUBE.y + TUBE.h - (this.loadedSum() / pz.target) * TUBE.h; },
    loadedSum() { return this.loaded.reduce((s, c) => s + c.v, 0); },
    hitCell(p) { return this.cells.find((c) => c.mode === "free" && dist(c, p) < c.r + 14); },
    hits(p) { return !!this.hitCell(p); },
    // Tap a cell: the ship flies over and beams it in. Tap or drag in space: the ship flies there.
    request(i) {
      const c = this.cells.find((x) => x.i === i);
      if (!c || c.mode !== "free" || this.chase || !api.current.canLoad()) return;
      this.chase = c; c.mode = "chase"; this.started = true; sfx.click();
    },
    pointer(p, kind) {
      const c = kind === "down" && this.hitCell(p);
      if (c) { this.request(c.i); return; }
      if (!this.chase && kind !== "up") { this.ship.tx = clamp(p.x, 60, 620); this.ship.ty = clamp(p.y, 60, H - 40); }
    },
    eject(i, fromTop) {
      const c = this.cells.find((x) => x.i === i);
      if (!c) return;
      this.loaded = this.loaded.filter((x) => x !== c);
      c.mode = "eject"; c.k = 0; c.x = TUBE.x - 10; c.y = fromTop ? TUBE.y - 20 : this.tubeTop();
      c.vx = -180 - Math.random() * 80; c.vy = -60 + Math.random() * 120;
      burst(this.fx, TUBE.x, c.y, { n: 18, color: fromTop ? "#ff6b8a" : "#ffc93c", speed: 200, dir: Math.PI, spread: 2 });
    },
    ejectAll() { [...this.loaded].reverse().forEach((c) => this.eject(c.i)); this.solved = false; },
    update(dt) {
      const sp = this.calm ? 0.45 : 1, s = this.ship;
      updateStars(this.stars, dt, 6);
      // Chasing: hover just above (or below) the cell, then beam it up.
      if (this.chase) {
        const c = this.chase;
        s.tx = clamp(c.x, 60, 620); s.ty = c.y > 150 ? c.y - 92 : c.y + 92;
        if (c.mode === "chase" && Math.hypot(s.x - s.tx, s.y - s.ty) < 22) { c.mode = "beam"; c.k = 0; c.bx = c.x; c.by = c.y; }
        if (c.mode === "beam") {
          c.k = Math.min(1, c.k + dt * (this.calm ? 1.6 : 2.2));
          c.x = c.bx + (s.x - c.bx) * c.k * c.k; c.y = c.by + (s.y - c.by) * c.k * c.k;
          if (c.k >= 1) this.deliver(c);
        }
      }
      const prevX = s.x;
      s.x = ease(s.x, s.tx, this.chase ? 4 : 6, dt); s.y = ease(s.y, s.ty, this.chase ? 4 : 6, dt);
      s.vx = (s.x - prevX) / Math.max(dt, 0.001);
      for (const c of this.cells) {
        if (c.mode === "free" || c.mode === "chase") {
          c.x += c.vx * dt * sp; c.y += c.vy * dt * sp;
          if (c.x < c.r + 8) { c.x = c.r + 8; c.vx = Math.abs(c.vx); }
          if (c.x > 630 - c.r) { c.x = 630 - c.r; c.vx = -Math.abs(c.vx); }
          if (c.y < c.r + 54) { c.y = c.r + 54; c.vy = Math.abs(c.vy); }
          if (c.y > H - c.r - 8) { c.y = H - c.r - 8; c.vy = -Math.abs(c.vy); }
        } else if (c.mode === "eject") {
          c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= 1 - dt * 1.8; c.vy *= 1 - dt * 1.8;
          c.k += dt;
          if (c.k > 0.9) { c.mode = "free"; c.x = clamp(c.x, c.r + 8, 630 - c.r); c.y = clamp(c.y, c.r + 54, H - c.r - 8); c.vx = (Math.random() - 0.5) * 36; c.vy = (Math.random() - 0.5) * 36; }
        } else if (c.mode === "in") c.k = Math.min(1, c.k + dt * 2.5);
      }
      // Cells nudge apart so numbers never hide behind each other.
      const fr = this.cells.filter((c) => c.mode === "free" || c.mode === "chase");
      for (let a = 0; a < fr.length; a++) for (let b = a + 1; b < fr.length; b++) {
        const A = fr[a], B = fr[b], d = dist(A, B), m = A.r + B.r + 12;
        if (d < m && d > 0.1) { const push = ((m - d) / d) * 0.5; const dx = (B.x - A.x) * push, dy = (B.y - A.y) * push; A.x -= dx; A.y -= dy; B.x += dx; B.y += dy; }
      }
      this.shown = ease(this.shown, this.loadedSum(), 6, dt);
      if (this.over) { this.over.k += dt; if (this.over.k > 0.7) { this.eject(this.over.c.i, true); this.over = null; } }
      this.glow = this.solved ? Math.min(1, this.glow + dt * 2) : Math.max(0, this.glow - dt * 2);
    },
    // The cell reaches the ship: React decides what happens (same rules as the card version).
    deliver(c) {
      this.chase = null;
      const res = api.current.load(c.i);
      const fx = this.fx, s = this.ship;
      stream(fx, s.x, s.y, TUBE.x + TUBE.w / 2, this.tubeTop(), { n: 22 });
      if (res === "over") {
        c.mode = "over"; this.over = { c, k: 0 };
        shake(fx, 12); fx.flash = 0.6; fx.flashColor = "#ff6b8a";
        popup(fx, TUBE.x - 60, TUBE.y + 10, `${fmt(this.loadedSum() + c.v)}? Overload!`, "#ff9fb3", 24);
        return;
      }
      c.mode = "in"; c.k = 0; this.loaded.push(c);
      popup(fx, TUBE.x - 30, this.tubeTop() + 20, `+${fmt(c.v)}`, "#ffe08a", 24);
      if (res === "full") {
        this.solved = true; fx.flash = 0.8; fx.flashColor = "#ffc93c"; shake(fx, 6);
        burst(fx, TUBE.x + TUBE.w / 2, TUBE.y, { n: 50, speed: 280, color: "#ffe08a", life: 1.2 });
        burst(fx, s.x, s.y, { n: 30, speed: 200, color: "#52d6e8", life: 1 });
        popup(fx, 330, 210, "REACTOR ONLINE!", "#ffe08a", 40);
      }
    },
    draw(ctx) {
      const t = this.t, s = this.ship;
      drawBackground(ctx, this.stars, t);
      // Reactor tube
      const top = TUBE.y + TUBE.h - (this.shown / pz.target) * TUBE.h;
      if (this.glow > 0) { ctx.save(); ctx.shadowColor = "#ffc93c"; ctx.shadowBlur = 40 * this.glow; roundRect(ctx, TUBE.x, TUBE.y, TUBE.w, TUBE.h, 18); ctx.fillStyle = "rgba(255,201,60,0.15)"; ctx.fill(); ctx.restore(); }
      roundRect(ctx, TUBE.x, TUBE.y, TUBE.w, TUBE.h, 18); ctx.fillStyle = "rgba(20,26,70,0.9)"; ctx.fill();
      ctx.save(); roundRect(ctx, TUBE.x, TUBE.y, TUBE.w, TUBE.h, 18); ctx.clip();
      let y = TUBE.y + TUBE.h;
      this.loaded.forEach((c, k) => {
        const h = (c.v / pz.target) * TUBE.h * Math.min(1, this.shown / Math.max(1, this.loadedSum()));
        const gr = ctx.createLinearGradient(TUBE.x, 0, TUBE.x + TUBE.w, 0);
        gr.addColorStop(0, k % 2 ? "#e0a31f" : "#ffc93c"); gr.addColorStop(0.5, k % 2 ? "#ffd766" : "#fff0b0"); gr.addColorStop(1, k % 2 ? "#e0a31f" : "#ffc93c");
        ctx.fillStyle = gr; ctx.fillRect(TUBE.x, y - h, TUBE.w, h);
        ctx.fillStyle = "rgba(42,29,0,0.35)"; ctx.fillRect(TUBE.x, y - h, TUBE.w, 2);
        if (h > 24) text(ctx, fmt(c.v), TUBE.x + TUBE.w / 2, y - h / 2, { size: Math.min(20, h * 0.6), color: "#2a1d00" });
        y -= h;
      });
      // Bubbles rising in the energy
      for (let k = 0; k < 6; k++) { const by = TUBE.y + TUBE.h - ((t * 40 + k * 57) % Math.max(1, TUBE.y + TUBE.h - top)); if (by > top) { ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.arc(TUBE.x + 14 + ((k * 23) % 44), by, 2.5, 0, 6.283); ctx.fill(); } }
      if (this.over) { const oh = (this.over.c.v / pz.target) * TUBE.h; ctx.fillStyle = `rgba(255,107,138,${0.8 - this.over.k})`; ctx.fillRect(TUBE.x, top - oh, TUBE.w, oh); }
      if (this.gap && this.loadedSum() < pz.target && !this.over) {
        ctx.save(); ctx.beginPath(); ctx.rect(TUBE.x, TUBE.y, TUBE.w, top - TUBE.y); ctx.clip();
        ctx.strokeStyle = "rgba(82,214,232,0.55)"; ctx.lineWidth = 6;
        for (let k = -TUBE.h; k < TUBE.h; k += 16) { ctx.beginPath(); ctx.moveTo(TUBE.x, TUBE.y + k); ctx.lineTo(TUBE.x + TUBE.w, TUBE.y + k + TUBE.w); ctx.stroke(); }
        ctx.restore();
      }
      ctx.restore();
      roundRect(ctx, TUBE.x, TUBE.y, TUBE.w, TUBE.h, 18); ctx.lineWidth = 3; ctx.strokeStyle = this.solved ? "#ffe08a" : "#9aa6d6"; ctx.stroke();
      for (let k = 1; k < 10; k++) { const ty = TUBE.y + (TUBE.h * k) / 10; ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(TUBE.x + TUBE.w - (k === 5 ? 22 : 12), ty, k === 5 ? 22 : 12, 2); }
      text(ctx, `${fmt(pz.target)}`, TUBE.x + TUBE.w / 2, TUBE.y - 22, { size: 22, color: "#ffe08a", stroke: true });
      text(ctx, "0", TUBE.x + TUBE.w / 2, TUBE.y + TUBE.h + 18, { size: 16, color: "#9aa6d6" });
      // Running total, and the striped gap when Bolt shows it
      const sum = this.loadedSum();
      if (sum > 0 && !this.solved) hud(ctx, fmt(Math.round(this.shown)), TUBE.x - 52, clamp(top, TUBE.y + 20, TUBE.y + TUBE.h - 16), { size: 20, color: "#ffe08a" });
      if (this.gap && sum < pz.target && !this.over) hud(ctx, `needs ${fmt(pz.target - sum)}`, TUBE.x - 70, (TUBE.y + top) / 2, { size: 18, color: "#52d6e8" });
      hud(ctx, `⚡ Make exactly ${fmt(pz.target)}`, 170, 30, { size: 22 });
      if (!this.started) text(ctx, "Tap an energy cell to beam it in", 330, H - 22, { size: 18, color: "rgba(238,241,255,0.75)" });
      // Cells
      for (const c of this.cells) {
        if (c.mode === "in") continue;
        const sc = c.mode === "beam" ? 1 - c.k * 0.55 : 1;
        drawOrb(ctx, c.x, c.y, c.r * sc, sc > 0.6 ? fmt(c.v) : "", { t, ring: c.mode === "chase", color: c.mode === "over" ? "255,107,138" : "255,201,60" });
      }
      // Beam then ship (the beam comes out of the ship's belly)
      const c = this.chase;
      if (c && c.mode === "beam") drawBeam(ctx, s.x, s.y + 14, c.x, c.y, t);
      const moving = Math.hypot(s.tx - s.x, s.ty - s.y) > 6;
      drawShip(ctx, s.x, s.y, { t, tilt: clamp((s.vx || 0) / 900, -0.25, 0.25), thrust: moving ? 0.8 : 0.25, lights: this.solved || sum > 0 });
    },
  };
  return g;
}

export function ReactorGame({ st, record, calm, onBack }) {
  const [pz] = useState(() => reactorPuzzle(st.skills.mental.level));
  const item = useMemo(() => reactorItem(pz), [pz]);
  const ways = useMemo(() => waysToMake(pz.cells, pz.target), [pz]);
  const [inside, setInside] = useState([]);
  const insideRef = useRef([]);
  const [msg, setMsg] = useState(null);
  const [first, setFirst] = useState(null);
  const firstRef = useRef(false);
  const [solved, setSolved] = useState(false);
  const [found, setFound] = useState([]);
  const [bonus, setBonus] = useState(false);
  const [help, helpRef, useHelpKind] = useHelp();
  const t0 = useRef(Date.now());
  const busy = solved && !bonus;
  const setIn = (v) => { insideRef.current = v; setInside(v); };

  const count = (correct, given) => {
    if (firstRef.current) return;
    firstRef.current = true;
    const r = record("reactor", item, { correct, help: helpRef.current, ms: Date.now() - t0.current, given, part: { answerType: "number", answer: String(pz.target) } });
    setFirst(r.support);
  };
  const api = useApi({
    canLoad: () => !busy,
    load: (i) => {
      const cur = insideRef.current, sum = cur.reduce((s, k) => s + pz.cells[k], 0);
      const v = pz.cells[i], ns = sum + v;
      if (ns > pz.target) {
        sfx.bump();
        setMsg({ kind: "bad", text: `Overload! ${fmt(sum)} + ${fmt(v)} = ${fmt(ns)}. That's ${fmt(ns - pz.target)} too much, so the cell shot back out.` });
        if (!bonus) count(false, String(ns));
        return "over";
      }
      const ni = [...cur, i];
      setIn(ni);
      if (ns < pz.target) { sfx.load(); setMsg(null); return "load"; }
      const mask = ni.reduce((m, k) => m | (1 << k), 0);
      if (bonus) {
        if (found.includes(mask)) { sfx.bump(); setMsg({ kind: "bad", text: "That's the same way as before. Vent the cells and try different ones!" }); return "load"; }
        sfx.win(); setFound([...found, mask]); setBonus(false); setSolved(true);
        setMsg({ kind: "good", text: `Another way! ${wayText(pz.cells, mask)} = ${fmt(pz.target)}. Bonus ⭐` });
        return "full";
      }
      sfx.power(); setSolved(true); setFound([mask]);
      setMsg({ kind: "good", text: `Reactor powered! ${wayText(pz.cells, mask)} = ${fmt(pz.target)}` });
      count(true, wayText(pz.cells, mask));
      return "full";
    },
  });
  const [cv, game] = useCanvasGame(() => reactorGame(pz, api), calm);
  useEffect(() => { if (game.current) game.current.gap = help.includes("visual"); }, [help, game]);

  const vent = () => {
    const last = inside[inside.length - 1];
    if (last === undefined || busy) return;
    sfx.click(); setIn(inside.slice(0, -1)); setMsg(null); game.current?.eject(last);
  };
  const anotherWay = () => {
    sfx.click(); setIn([]); setBonus(true); game.current?.ejectAll();
    setMsg({ kind: "info", text: `Bolt: "Can you power it a different way? Catch other cells to make ${fmt(pz.target)}."` });
  };
  const sum = inside.reduce((s, i) => s + pz.cells[i], 0);

  return (
    <div className="ms-panel">
      <StationHead id="reactor" onBack={onBack} story={`The reactor needs exactly ${fmt(pz.target)} energy units. Tap an energy cell and the Cruiser beams it in. Too much and the reactor overloads!`} />
      <canvas ref={cv} className="ms-canvas" role="img" aria-label={`Reactor ${fmt(sum)} of ${fmt(pz.target)}. Energy cells: ${pz.cells.map(fmt).join(", ")}.`} />
      <div className="ms-sr">{pz.cells.map((c, i) => <button key={i} disabled={busy || inside.includes(i)} onClick={() => game.current?.request(i)}>Beam in energy cell {fmt(c)}</button>)}</div>
      <div className="ms-gamebar">
        <span className="ms-eq">{inside.length > 1 ? `${inside.map((i) => fmt(pz.cells[i])).join(" + ")} = ${fmt(sum)}` : inside.length ? fmt(sum) : "Reactor empty"} <span className="ms-eq-goal">of {fmt(pz.target)}</span></span>
        {!busy && inside.length > 0 && <button className="ms-chip" onClick={vent}>↩ Vent last cell</button>}
      </div>
      {msg && <div className={`ms-msg ${msg.kind}`} role="status">{msg.text}</div>}
      {!first && <Bolt used={help} onUse={useHelpKind}
        part={{ text: `The reactor needs exactly ${fmt(pz.target)} energy units. Energy cells: ${pz.cells.map(fmt).join(", ")}. Pick cells that add up to exactly ${fmt(pz.target)}.`, answer: pz.cells.filter((_, i) => (ways[0] >> i) & 1).map(String), steps: ways.map((m) => `${wayText(pz.cells, m)} = ${fmt(pz.target)}`) }}
        hint={`Look for cells that make ${fmt(pz.target)} together. Catch one cell, then ask yourself: how much more do I need to reach ${fmt(pz.target)}? Is there a cell that size?`}
        visual={<p>The striped part of the reactor tube shows how much more it needs.</p>} />}
      <Record r={first} />
      {solved && !bonus && (
        <div className="ms-actions">
          {found.length < ways.length && <button className="ms-ghost" onClick={anotherWay}>⚡ Power it another way</button>}
          {found.length > 1 && <span className="ms-fine">You found {found.length} ways!</span>}
          <button className="ms-go" onClick={() => onBack("reactor")}>Back to the ship ➜</button>
        </div>
      )}
    </div>
  );
}

// ═══ Station 2: Meteor Patch ═══════════════════════════════════════════════════
// The shield has a gap. Meteors carry patch sizes; blast the one that fills the gap exactly.
const SH = { x: 200, y: 262, r: 150 };
function shieldGame(item, choices, api) {
  const { whole, part } = item;
  const frac = part / whole, gapA = (1 - frac) * Math.PI * 2;
  const lanes = shuffle([110, 210, 310, 410]);
  const rocks = choices.map((v, k) => ({ v, x: 470 + ((k * 97) % 300), y: lanes[k], by: lanes[k], r: 30 + String(v).length * 4.5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.8, shape: rockShape(k * 7 + 3), alive: true, ph: Math.random() * 6 }));
  const g = {
    rocks, laser: null, patch: 0, state: "aim", lock: null, fixed: false,
    hitRock(p) { return this.rocks.find((r) => r.alive && dist(r, p) < r.r + 12); },
    hits(p) { return this.state === "aim" && !!this.hitRock(p); },
    pointer(p, kind) { if (kind === "down") { const r = this.hitRock(p); if (r) this.fire(r); } },
    fireValue(v) { const r = this.rocks.find((x) => x.alive && x.v === v); if (r) this.fire(r); return !!r; },
    fire(r, bolt = false) {
      if (this.state !== "aim" || !r.alive) return;
      this.state = "busy";
      this.laser = { r, k: 0, color: bolt ? "#52d6e8" : "#ff6b8a", bolt };
      sfx.click();
    },
    resolve(r, bolt) {
      const fx = this.fx;
      r.alive = false;
      const res = bolt ? "right" : api.current.fire(r.v);
      if (res === "right") {
        burst(fx, r.x, r.y, { n: 30, color: "#52d6e8", speed: 220 });
        const gx = SH.x + Math.cos(0) * SH.r, gy = SH.y;
        stream(fx, r.x, r.y, gx, gy, { n: 30, color: "#a9f2fb", life: 1.1 });
        this.state = "patching";
        popup(fx, SH.x + 20, 70, `${fmt(part)} + ${fmt(r.v)} = ${fmt(whole)}`, "#a9f2fb", 30);
        for (const o of this.rocks) if (o.alive) { o.flee = true; }
        return;
      }
      burst(fx, r.x, r.y, { n: 34, color: "#ff9a5c", speed: 260, life: 1 });
      burst(fx, r.x, r.y, { n: 14, color: "#ffe08a", speed: 140 });
      shake(fx, 10);
      const tot = part + r.v;
      popup(fx, r.x, r.y - 20, `${fmt(part)} + ${fmt(r.v)} = ${fmt(tot)}`, "#ffb38a", 22);
      popup(fx, r.x, r.y + 16, tot > whole ? "too big!" : "too small!", "#ffb38a", 20);
      if (res === "reveal") {
        this.state = "bolt";
        setTimeout(() => { const ok = this.rocks.find((x) => x.alive && x.v === whole - part); if (ok) { this.state = "aim"; this.fire(ok, true); } }, this.calm ? 500 : 1100);
      } else this.state = "aim";
    },
    update(dt) {
      const sp = this.calm ? 0.45 : 1;
      updateStars(this.stars, dt, 10);
      for (const r of this.rocks) {
        if (!r.alive) continue;
        r.rot += r.vr * dt * sp;
        if (r.flee) { r.x += 260 * dt; if (r.x > W + 80) r.alive = false; continue; }
        r.x -= 14 * dt * sp; r.y = r.by + Math.sin(this.t * 0.8 + r.ph) * 14;
        if (r.x < 420) r.x = 780;
      }
      if (this.laser) { this.laser.k += dt; if (this.laser.k > 0.22) { const { r, bolt } = this.laser; this.laser = null; this.resolve(r, bolt); } }
      if (this.state === "patching") {
        this.patch = Math.min(1, this.patch + dt * (this.calm ? 1.4 : 0.9));
        if (this.patch >= 1) { this.state = "done"; this.fixed = true; const fx = this.fx; fx.flash = 0.8; fx.flashColor = "#52d6e8"; burst(fx, SH.x, SH.y, { n: 60, color: "#a9f2fb", speed: 320, life: 1.2 }); popup(fx, SH.x, SH.y + SH.r + 30, "SHIELD SEALED!", "#a9f2fb", 32); }
      }
    },
    draw(ctx) {
      const t = this.t;
      drawBackground(ctx, this.stars, t, { tint: "#16123f" });
      // Shield: the part she has is solid; the gap faces the meteors.
      const start = gapA / 2, end = Math.PI * 2 - gapA / 2;
      ctx.save();
      const bub = ctx.createRadialGradient(SH.x, SH.y, SH.r * 0.4, SH.x, SH.y, SH.r);
      bub.addColorStop(0, "rgba(82,214,232,0)"); bub.addColorStop(1, `rgba(82,214,232,${this.fixed ? 0.28 : 0.12})`);
      ctx.fillStyle = bub; ctx.beginPath(); ctx.arc(SH.x, SH.y, SH.r, 0, 6.283); ctx.fill();
      ctx.lineCap = "round";
      ctx.shadowColor = "#52d6e8"; ctx.shadowBlur = this.calm ? 0 : 16;
      ctx.strokeStyle = "#52d6e8"; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.arc(SH.x, SH.y, SH.r, start, end); ctx.stroke();
      if (this.patch > 0) {
        ctx.strokeStyle = "#a9f2fb";
        const half = (gapA / 2) * this.patch;
        ctx.beginPath(); ctx.arc(SH.x, SH.y, SH.r, -half, half); ctx.stroke();
      }
      ctx.restore();
      if (this.patch < 1) {
        ctx.save(); ctx.setLineDash([8, 10]); ctx.lineDashOffset = -t * 30; ctx.strokeStyle = `rgba(255,107,138,${0.6 + 0.3 * Math.sin(t * 5)})`; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(SH.x, SH.y, SH.r, -gapA / 2, gapA / 2); ctx.stroke(); ctx.restore();
      }
      text(ctx, `has ${fmt(part)}`, SH.x, SH.y + 62, { size: 20, color: "#a9f2fb", stroke: true });
      drawShip(ctx, SH.x, SH.y, { t, thrust: 0.2, lights: this.fixed });
      const gx = SH.x + SH.r + 30;
      if (this.patch < 1) hud(ctx, "?", gx, SH.y, { size: 26, color: "#ff9fb3", border: "rgba(255,107,138,0.7)" });
      hud(ctx, `🛡️ Shield needs ${fmt(whole)}`, 180, 30, { size: 22 });
      // Meteors and lasers
      for (const r of this.rocks) if (r.alive) drawRock(ctx, r.x, r.y, r.r, fmt(r.v), r.shape, r.rot, { glow: this.lock === r.v, t });
      if (this.laser) { const r = this.laser.r; drawLaser(ctx, SH.x + 46, SH.y - 4, r.x, r.y, 1 - this.laser.k / 0.22, this.laser.color); }
      if (this.state === "aim" && !this.fx.texts.length && this.patch === 0) text(ctx, "Tap the meteor that patches the gap exactly", 590, H - 22, { size: 17, color: "rgba(238,241,255,0.75)" });
      if (this.state === "bolt") text(ctx, "Bolt is lining up the right shot…", 590, H - 22, { size: 17, color: "#52d6e8" });
    },
  };
  return g;
}

export function ShieldGame({ st, world, record, calm, onBack }) {
  const [item] = useState(() => shieldItem(st.skills.subtract.level, world));
  const { whole, part } = item;
  const answer = whole - part;
  const choices = useMemo(() => {
    const set = [answer];
    for (const w of [...(item.wrong || []).map(Number), answer + 100, answer - 10, answer + 10]) if (w > 0 && !set.includes(w) && set.length < 4) set.push(w);
    return shuffle(set);
  }, [item, answer]);
  const [phase, setPhase] = useState("work"); // work | fixed | revealed
  const triesRef = useRef(0);
  const [tries, setTries] = useState(0);
  const [first, setFirst] = useState(null);
  const firstRef = useRef(false);
  const [help, helpRef, useHelpKind] = useHelp();
  const [msg, setMsg] = useState(null);
  const [pad, setPad] = useState(false);
  const [resp, setResp] = useState("");
  const colRef = useRef(null);
  const t0 = useRef(Date.now());

  const api = useApi({
    fire: (v) => {
      const ok = isCorrect(item, String(v));
      if (!firstRef.current) { firstRef.current = true; const r = record("shield", item, { correct: ok, help: helpRef.current, ms: Date.now() - t0.current, given: String(v) }); setFirst(r.support); }
      if (ok) { sfx.power(); setPhase("fixed"); setMsg({ kind: "good", text: `Patched! ${fmt(part)} + ${fmt(answer)} = ${fmt(whole)}. The shield is whole again.` }); return "right"; }
      sfx.bump();
      const n = ++triesRef.current; setTries(n);
      const tot = part + v;
      if (n >= 2) { setPhase("revealed"); setMsg({ kind: "info", text: `${fmt(part)} + ${fmt(v)} = ${fmt(tot)}, ${tot > whole ? "too big" : "too small"}. Bolt is blasting the right meteor: ${fmt(answer)}. Here's how.` }); return "reveal"; }
      setMsg({ kind: "bad", text: `${fmt(part)} + ${fmt(v)} = ${fmt(tot)}. That's ${tot > whole ? "more" : "less"} than ${fmt(whole)}, so it can't patch the gap. Bolt drew a count-up below. Try another meteor!` });
      return "wrong";
    },
  });
  const [cv, game] = useCanvasGame(() => shieldGame(item, choices, api), calm);
  useEffect(() => { if (game.current) game.current.lock = resp ? Number(resp) : null; }, [resp, game]);
  const onKey = useCallback((k) => colRef.current?.key(k), []);
  const fireTyped = () => {
    if (!resp) return;
    if (!game.current?.fireValue(Number(resp))) setMsg({ kind: "info", text: `No meteor carries ${fmt(Number(resp))}. Check your columns and try again.` });
  };
  useHardwareKeys(onKey, fireTyped, pad && phase === "work");
  const marks = countUp(part, whole);
  const showCount = help.includes("visual") || (phase === "work" && tries > 0) || phase === "revealed";

  return (
    <div className="ms-panel">
      <StationHead id="shield" onBack={onBack} story={`The shield needs ${fmt(whole)} units of force field. Right now it has ${fmt(part)}. Blast the meteor that carries exactly the right patch!`} />
      <canvas ref={cv} className="ms-canvas" role="img" aria-label={`Shield has ${fmt(part)} of ${fmt(whole)}. Meteors carry ${choices.map(fmt).join(", ")}.`} />
      <div className="ms-sr">{choices.map((c) => <button key={c} disabled={phase !== "work"} onClick={() => game.current?.fireValue(c)}>Blast the meteor carrying {fmt(c)}</button>)}</div>
      <div className="ms-gamebar">
        <span className="ms-eq">{fmt(part)} + <b className="ms-q">{phase !== "work" ? fmt(answer) : "?"}</b> = {fmt(whole)}</span>
        {phase === "work" && <button className={`ms-chip ${pad ? "on" : ""}`} onClick={() => { sfx.click(); setPad(!pad); }}>🧮 Work it out</button>}
      </div>
      {pad && phase === "work" && (
        <div className="ms-pad">
          <p className="ms-fine center">Subtract {fmt(whole)} − {fmt(part)}. The meteor with your number lights up. Press Fire to blast it.</p>
          <ColumnEntry ref={colRef} column={item.column} onChange={setResp} />
          <div className="ms-actions center"><button className="ms-go" onClick={fireTyped} disabled={!resp}>Fire 🔫</button></div>
          <Keypad onKey={onKey} />
        </div>
      )}
      {msg && <div className={`ms-msg ${msg.kind}`} role="status">{msg.text}</div>}
      {showCount && (
        <div className="ms-visual">
          <p className="ms-fine">Bolt counts up from {fmt(part)} to {fmt(whole)} in friendly jumps:</p>
          <div className="ms-jumps">{marks.map((m, i) => <span key={i} className="ms-jump">{i > 0 && <em>+{fmt(m - marks[i - 1])}</em>}<b>{fmt(m)}</b></span>)}</div>
          {phase === "work" && <p className="ms-fine">Add up the jumps. Which meteor matches?</p>}
        </div>
      )}
      {phase === "work" && !first && <Bolt used={help} onUse={useHelpKind} hint={item.hint} visual={null}
        part={{ text: `The shield needs ${fmt(whole)} units. It has ${fmt(part)}. ${fmt(part)} + ? = ${fmt(whole)}. Meteors carry ${choices.map(fmt).join(", ")}. She can subtract ${fmt(whole)} − ${fmt(part)} in columns.`, answer: item.answer, steps: item.steps }} />}
      {phase === "revealed" && <ol className="ms-steps">{item.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
      <Record r={first} />
      {phase !== "work" && <div className="ms-actions"><button className="ms-go" onClick={() => onBack("shield")}>Back to the ship ➜</button></div>}
    </div>
  );
}

// ═══ Station 3: Gate Run ═══════════════════════════════════════════════════════
// Steer into a fuel lane, press GO, collect the cell and fly at the star gate.
const LANES = [130, 255, 380], CELL_X = 320, GATE = { x: 660, y: 255, ry: 118 };
function gateGame(pz, api) {
  const cells = pz.cells.map((v, k) => ({ v, lane: k, x: CELL_X, y: LANES[k], used: false, taken: false }));
  const g = {
    ship: { x: 110, y: LANES[1], ty: LANES[1], vx: 0 },
    cells, lane: 1, phase: "choose", charge: pz.charge, shownCharge: pz.charge, gate: 0, red: 0, streak: 0, line: false, cell: null,
    laneOf(y) { let b = 0; LANES.forEach((l, k) => { if (Math.abs(l - y) < Math.abs(LANES[b] - y)) b = k; }); return b; },
    hitCell(p) { return this.cells.find((c) => !c.used && Math.abs(p.x - c.x) < 90 && Math.abs(p.y - c.y) < 50); },
    hits(p) { return this.phase === "choose" && !!this.hitCell(p); },
    setLane(k) { if (this.phase !== "choose") return; this.ship.ty = LANES[k]; },
    pointer(p, kind) {
      if (this.phase !== "choose") return;
      const c = kind === "down" && this.hitCell(p);
      if (c) { this.ship.ty = c.y; sfx.click(); return; }
      if (kind === "up") this.ship.ty = LANES[this.laneOf(this.ship.ty)];
      else this.ship.ty = clamp(p.y, LANES[0], LANES[2]);
    },
    go() {
      const c = this.cells[this.lane];
      if (this.phase !== "choose" || c.used) return false;
      this.cell = c; this.ship.ty = c.y; this.phase = "toCell"; sfx.whoosh?.(); return true;
    },
    update(dt) {
      const s = this.ship, fx = this.fx;
      const speed = this.calm ? 230 : 300;
      this.streak = ease(this.streak, this.phase === "toCell" || this.phase === "toGate" || this.phase === "through" ? 1 : 0, 3, dt);
      updateStars(this.stars, dt, 10 + this.streak * 420);
      s.y = ease(s.y, s.ty, this.phase === "choose" ? 9 : 4, dt);
      if (this.phase === "choose") {
        const l = this.laneOf(s.y);
        if (l !== this.lane) { this.lane = l; api.current.lane(l); }
      } else if (this.phase === "toCell") {
        s.x += speed * dt;
        if (s.x >= CELL_X - 40) {
          const c = this.cell; c.taken = true; sfx.load();
          burst(fx, c.x, c.y, { n: 26, color: "#7ef0b0", speed: 200 });
          this.charge = pz.charge + c.v;
          popup(fx, c.x, c.y - 40, `+${fmt(c.v)}`, "#b5ffd6", 26);
          this.phase = "toGate"; s.ty = GATE.y;
        }
      } else if (this.phase === "toGate") {
        s.x += speed * dt;
        if (s.x >= GATE.x - 70) {
          const ok = api.current.arrive(this.cell.v);
          if (ok) { this.phase = "through"; fx.flash = 0.9; fx.flashColor = "#b48cff"; burst(fx, GATE.x, GATE.y, { n: 60, color: "#d9c4ff", speed: 300, life: 1.2 }); popup(fx, 400, 200, "THROUGH THE GATE!", "#e6d8ff", 38); }
          else {
            this.phase = "bump"; this.red = 1; s.vx = -360; shake(fx, 14);
            burst(fx, GATE.x - 40, s.y, { n: 30, color: "#ff6b8a", speed: 220, dir: Math.PI, spread: 2.4 });
            const tot = this.charge;
            popup(fx, GATE.x - 120, GATE.y - 150, tot === pz.lo || tot === pz.hi ? `${fmt(tot)}: on the edge!` : tot < pz.lo ? `${fmt(tot)}: too little` : `${fmt(tot)}: too much`, "#ff9fb3", 26);
          }
        }
      } else if (this.phase === "through") {
        s.x += speed * 1.6 * dt; this.gate = Math.min(1, this.gate + dt * 2);
        if (s.x > W + 120) this.phase = "gone";
      } else if (this.phase === "bump") {
        s.x += s.vx * dt; s.vx *= 1 - dt * 2.2;
        if (Math.abs(s.vx) < 40) { this.phase = "return"; const c = this.cell; c.used = true; c.taken = false; this.charge = pz.charge; s.ty = c.y; }
      } else if (this.phase === "return") {
        s.x = ease(s.x, 110, 3, dt);
        if (Math.abs(s.x - 110) < 4) { s.x = 110; this.phase = "choose"; const free = this.cells.findIndex((c) => !c.used); if (this.cells[this.lane].used && free >= 0) s.ty = LANES[free]; api.current.ready(); }
      }
      this.shownCharge = ease(this.shownCharge, this.charge, 4, dt);
      this.red = Math.max(0, this.red - dt * 0.8);
    },
    draw(ctx) {
      const t = this.t, s = this.ship;
      drawBackground(ctx, this.stars, t, { streak: this.streak * 26, tint: "#1a1446" });
      // Lane guides from the ship to each fuel cell
      if (this.phase === "choose") for (const c of this.cells) {
        ctx.strokeStyle = c.lane === this.lane && !c.used ? "rgba(126,240,176,0.5)" : "rgba(154,166,214,0.15)";
        ctx.setLineDash([6, 10]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(170, c.y); ctx.lineTo(c.x - 60, c.y); ctx.stroke(); ctx.setLineDash([]);
      }
      // The star gate: a swirling ring with its rule written on it
      ctx.save(); ctx.translate(GATE.x, GATE.y);
      const open = this.gate, red = this.red;
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = red > 0 ? `rgba(255,107,138,${0.4 + red * 0.5})` : `rgba(${k === 1 ? "82,214,232" : "180,140,255"},${0.55 + 0.25 * Math.sin(t * 3 + k)})`;
        ctx.lineWidth = 10 - k * 3; ctx.beginPath(); ctx.ellipse(0, 0, 40 + k * 6 + open * 20, GATE.ry - k * 8, 0, 0, 6.283); ctx.stroke();
      }
      const inner = ctx.createRadialGradient(0, 0, 4, 0, 0, GATE.ry);
      inner.addColorStop(0, `rgba(230,216,255,${0.35 + open * 0.5})`); inner.addColorStop(1, "rgba(180,140,255,0)");
      ctx.fillStyle = inner; ctx.beginPath(); ctx.ellipse(0, 0, 36 + open * 20, GATE.ry - 16, 0, 0, 6.283); ctx.fill();
      ctx.rotate(t * 0.6); ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2;
      for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.arc(0, 0, 22, 0, 1.6); ctx.stroke(); }
      ctx.restore();
      hud(ctx, `more than ${fmt(pz.lo)}`, GATE.x, GATE.y - GATE.ry - 22, { size: 19, color: "#e6d8ff" });
      hud(ctx, `less than ${fmt(pz.hi)}`, GATE.x, GATE.y + GATE.ry + 22, { size: 19, color: "#e6d8ff" });
      // Fuel cells
      for (const c of this.cells) {
        if (c.taken) continue;
        const label = `+${fmt(c.v)}`, sel = this.phase === "choose" && c.lane === this.lane && !c.used;
        ctx.font = "700 22px Fredoka, system-ui, sans-serif";
        const w = Math.max(96, ctx.measureText(label).width + 50), h = 52;
        if (sel) { ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(t * 6)})`; ctx.lineWidth = 3; roundRect(ctx, c.x - w / 2 - 7, c.y - h / 2 - 7, w + 14, h + 14, 22); ctx.stroke(); }
        const gr = ctx.createLinearGradient(0, c.y - h / 2, 0, c.y + h / 2);
        gr.addColorStop(0, c.used ? "#5a628f" : "#b5ffd6"); gr.addColorStop(1, c.used ? "#3b4270" : "#3fcf86");
        roundRect(ctx, c.x - w / 2, c.y - h / 2, w, h, 16); ctx.fillStyle = gr; ctx.fill();
        ctx.fillStyle = c.used ? "#3b4270" : "#2a8f5c"; ctx.fillRect(c.x + w / 2, c.y - 10, 7, 20);
        text(ctx, label, c.x, c.y + 1, { size: 22, color: c.used ? "#aeb4d6" : "#063d22" });
        if (c.used) { ctx.strokeStyle = "rgba(255,107,138,0.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c.x - w / 2 + 8, c.y + h / 2 - 8); ctx.lineTo(c.x + w / 2 - 8, c.y - h / 2 + 8); ctx.stroke(); }
      }
      // Number line strip (Bolt's "Show me")
      if (this.line) {
        const a = Math.min(pz.charge, pz.lo) - (pz.hi - pz.lo), b = pz.hi + (pz.hi - pz.lo), X = (n) => 230 + ((n - a) / (b - a)) * 340, Y = 30;
        roundRect(ctx, 214, 10, 372, 50, 14); ctx.fillStyle = "rgba(7,11,36,0.8)"; ctx.fill();
        ctx.strokeStyle = "#9aa6d6"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(228, Y); ctx.lineTo(572, Y); ctx.stroke();
        ctx.fillStyle = "rgba(180,140,255,0.45)"; ctx.fillRect(X(pz.lo), Y - 8, X(pz.hi) - X(pz.lo), 16);
        text(ctx, fmt(pz.lo), X(pz.lo), Y + 18, { size: 12, color: "#e6d8ff" }); text(ctx, fmt(pz.hi), X(pz.hi), Y + 18, { size: 12, color: "#e6d8ff" });
        const mx = clamp(X(this.shownCharge), 228, 572);
        ctx.fillStyle = "#ffc93c"; ctx.beginPath(); ctx.arc(mx, Y, 6, 0, 6.283); ctx.fill();
      }
      hud(ctx, `⚡ Charge ${fmt(Math.round(this.shownCharge))}`, 120, 30, { size: 22, color: "#ffe08a" });
      if (this.phase === "choose") text(ctx, "Drag the ship to a lane, then press GO", 330, H - 18, { size: 17, color: "rgba(238,241,255,0.75)" });
      if (this.phase !== "gone") drawShip(ctx, s.x, s.y, { t, thrust: this.phase === "choose" || this.phase === "return" ? 0.25 : 1, dir: this.phase === "choose" || this.phase === "return" ? 0 : 1, tilt: clamp((s.ty - s.y) / 300, -0.25, 0.25), lights: true, scale: 0.85 });
    },
  };
  return g;
}

export function GateGame({ st, record, calm, onBack }) {
  const [pz] = useState(() => gatePuzzle(st.skills.estimate.level));
  const item = useMemo(() => gateItem(pz), [pz]);
  const [tried, setTried] = useState([]);
  const [lane, setLane] = useState(1);
  const [phase, setPhase] = useState("choose"); // choose | flying | through
  const [first, setFirst] = useState(null);
  const firstRef = useRef(false);
  const [help, helpRef, useHelpKind] = useHelp();
  const [msg, setMsg] = useState(null);
  const t0 = useRef(Date.now());

  const api = useApi({
    lane: (l) => { setLane(l); sfx.click(); },
    ready: () => setPhase("choose"),
    arrive: (c) => {
      const ok = inGate(pz, c), total = pz.charge + c;
      if (!firstRef.current) { firstRef.current = true; const r = record("gate", item, { correct: ok, help: helpRef.current, ms: Date.now() - t0.current, given: `+${fmt(c)}`, part: { answerType: "number", answer: String(pz.good) } }); setFirst(r.support); }
      if (ok) { sfx.whoosh(); setPhase("through"); setMsg({ kind: "good", text: `${fmt(pz.charge)} + ${fmt(c)} = ${fmt(total)}. That's more than ${fmt(pz.lo)} and less than ${fmt(pz.hi)}. Through the gate!` }); return true; }
      sfx.bump(); setTried((t) => [...t, c]);
      const why = total === pz.lo ? `exactly ${fmt(pz.lo)}, right on the edge. The gate needs MORE than ${fmt(pz.lo)}.`
        : total === pz.hi ? `exactly ${fmt(pz.hi)}, right on the edge. The gate needs LESS than ${fmt(pz.hi)}.`
        : total < pz.lo ? `less than ${fmt(pz.lo)}, so the gate stayed shut.` : `more than ${fmt(pz.hi)}, so the gate pushed the ship back.`;
      setMsg({ kind: "bad", text: `Bump! ${fmt(pz.charge)} + ${fmt(c)} = ${fmt(total)}. That's ${why} Pick another lane.` });
      return false;
    },
  });
  const [cv, game] = useCanvasGame(() => gateGame(pz, api), calm);
  useEffect(() => { if (game.current) game.current.line = help.includes("visual"); }, [help, game]);
  const go = () => { if (game.current?.go()) { setPhase("flying"); setMsg(null); } };
  useEffect(() => {
    if (phase !== "choose") return;
    const h = (e) => {
      if (/^(INPUT|TEXTAREA)$/.test(e.target?.tagName || "")) return;
      if (e.key === "ArrowUp") { e.preventDefault(); game.current?.setLane(Math.max(0, lane - 1)); }
      else if (e.key === "ArrowDown") { e.preventDefault(); game.current?.setLane(Math.min(2, lane + 1)); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  const c = pz.cells[lane], used = tried.includes(c);

  return (
    <div className="ms-panel">
      <StationHead id="gate" onBack={onBack} story={`The ship has ${fmt(pz.charge)} charge. The star gate opens only for a charge MORE than ${fmt(pz.lo)} and LESS than ${fmt(pz.hi)}. Steer into the lane with the right fuel cell, then hit GO!`} />
      <canvas ref={cv} className="ms-canvas" role="img" aria-label={`Charge ${fmt(pz.charge)}. Gate opens for more than ${fmt(pz.lo)} and less than ${fmt(pz.hi)}. Fuel cells: ${pz.cells.map((x) => "+" + fmt(x)).join(", ")}.`} />
      <div className="ms-sr">{pz.cells.map((x, k) => <button key={k} disabled={phase !== "choose" || tried.includes(x)} onClick={() => { game.current?.setLane(k); setTimeout(() => game.current?.go() && setPhase("flying"), 400); }}>Fly with fuel cell +{fmt(x)}</button>)}</div>
      {phase !== "through" && (
        <div className="ms-gamebar">
          <div className="ms-lanes" role="group" aria-label="Lanes">
            {[0, 1, 2].map((k) => <button key={k} className={`ms-chip ${lane === k ? "on" : ""}`} disabled={phase !== "choose"} onClick={() => game.current?.setLane(k)} aria-label={`Lane ${k + 1}`}>{k === 0 ? "▲" : k === 1 ? "●" : "▼"}</button>)}
          </div>
          <button className="ms-go" onClick={go} disabled={phase !== "choose" || used}>{used ? "That cell is used up" : `GO with +${fmt(c)} 🚀`}</button>
        </div>
      )}
      {msg && <div className={`ms-msg ${msg.kind}`} role="status">{msg.text}</div>}
      {!first && <Bolt used={help} onUse={useHelpKind}
        part={{ text: `The ship has ${fmt(pz.charge)} charge. A gate opens only if the charge is more than ${fmt(pz.lo)} and less than ${fmt(pz.hi)}. Fuel cells: ${pz.cells.map((x) => "+" + fmt(x)).join(", ")}. Which one cell gets the ship through?`, answer: [String(pz.good), String(pz.charge + pz.good)], steps: pz.cells.map((x) => `${fmt(pz.charge)} + ${fmt(x)} = ${fmt(pz.charge + x)}`) }}
        hint={`Round each fuel cell to the nearest ${fmt(pz.round)} and add it to ${fmt(pz.charge)}. Which one lands between ${fmt(pz.lo)} and ${fmt(pz.hi)}? Landing exactly on ${fmt(pz.lo)} or ${fmt(pz.hi)} bumps the edge.`}
        visual={<p>Bolt put a number line at the top of the screen: the purple part is the gate, and the yellow dot is your charge.</p>} />}
      <Record r={first} />
      {phase === "through" && <div className="ms-actions"><button className="ms-go" onClick={() => onBack("gate")}>Back to the ship ➜</button></div>}
    </div>
  );
}
