// Deep Sea Rescue: three canvas mini-games that pair Unit 4 multiplying with one focus
// skill each (remembering, stop-and-think, planning ahead). Same recording rules as the
// other missions: the first answer counts, help is kept separate, misses come back later.
// No timers on answers. Bubble Patrol has slow-floating bubbles, but it scores being
// right, never being fast, and it pauses whenever she takes a breathing break.
import { useEffect, useMemo, useRef, useState } from "react";
import { W, H, fmt, ease, burst, popup, shake, text, roundRect } from "./arcade.js";
import { makePlankton, updatePlankton, drawWater, drawSeabed, drawSub, drawBubble, drawPearl, drawInk, drawCreature, drawOctopus, drawSeahorse, drawNarwhal, drawAxolotl, drawJelly, drawKelp, drawFish, drawTurtle } from "./oceanart.js";
import { ensureFocus, messagePuzzle, messageText, judgeMessage, updateSpan, messageItem, CREATURES, bubbleRound, scoreBubbles, recordBubbleFocus, bubbleItem,
  routePuzzle, routeItem, recordPlan, ROUTE_NAMES, RATINGS, addRating, BUBBLES_PER_ROUND } from "./focus.js";
import { roundTo } from "../engine/util.js";
import { Keypad, useHardwareKeys, speak } from "../ui/components.jsx";
import { sfx } from "./sfx.js";
import { StationHead, Bolt, Record } from "./Mission.jsx";
import { useCanvasGame, useApi, useHelp, hud } from "./games.jsx";

// Breathing breaks pause the moving game underneath.
export const oceanPause = { on: false };
const level2 = (st) => st.skills.mult2?.level || 1;
const tensTrick = "Multiply the front digits, then put back all the zeros. 30 × 40: 3 × 4 = 12, two zeros → 1,200.";

// ── Small pieces of UI shared by the ocean stations ──
export function CreatureIcon({ kind, size = 34 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current, ctx = cv.getContext("2d"), d = 2;
    cv.width = size * d; cv.height = size * d;
    ctx.scale((size * d) / 100, (size * d) / 100);
    drawCreature(ctx, kind, kind === "narwhal" ? 42 : 50, 52, kind === "narwhal" ? 0.78 : 1, { t: 0 });
  }, [kind, size]);
  return <canvas ref={ref} className="ms-creature" style={{ width: size, height: size }} aria-hidden="true" />;
}

// The mission's home picture: the sub in the reef. Friends appear as stations are done.
export function OceanScene({ done = {}, calm, finale = false }) {
  const [cv] = useCanvasGame(() => {
    const g = {
      plankton: makePlankton(50), stars: [],
      update(dt) { updatePlankton(this.plankton, dt); },
      draw(ctx) {
        const t = this.t;
        drawWater(ctx, this.plankton, t);
        drawSeabed(ctx, t, 430);
        drawFish(ctx, 120 + ((t * 30) % 900) - 100, 90, 0.8, { t, color: "#ffd166" });
        drawFish(ctx, 700 - ((t * 22) % 900) + 100, 140, 0.7, { t, color: "#5ee0c8", flip: true });
        if (done.octo || finale) drawOctopus(ctx, 130, 360, 1.1, { t });
        if (done.bubbles || finale) { drawSeahorse(ctx, 640, 250, 0.9, { t, flip: true }); drawSeahorse(ctx, 690, 290, 0.7, { t, flip: true, color: "#ff9ad5" }); }
        if (done.route || finale) { drawNarwhal(ctx, 590, 120, 0.95, { t, flip: true }); drawNarwhal(ctx, 680, 175, 0.55, { t: t + 1, flip: true, baby: true }); }
        if (!done.route && !finale) { drawKelp(ctx, 700, 434, 150, t, "#1f7a45"); drawKelp(ctx, 722, 434, 130, t + 1, "#2f9e5b"); text(ctx, "?", 712, 330, { size: 30, color: "#ffe08a" }); }
        drawSub(ctx, 380 + (finale ? Math.sin(t * 0.8) * 40 : 0), 230, { t, scale: 1.25 });
        drawAxolotl(ctx, 250, 400, 0.7, { t, wave: true });
      },
    };
    return g;
  }, calm);
  return <canvas ref={cv} className="ms-canvas ms-scene" role="img" aria-label={`The submarine in the Coral Kingdom. ${Object.keys(done).filter((k) => done[k]).length} of 3 jobs done.`} />;
}

// Captain's log: she rates her own focus, then sees it next to how she actually did.
export function FocusCheck({ st, station, score, good, onDone, home = "Sub" }) {
  const [pick, setPick] = useState(null);
  const choose = (r) => {
    sfx.click(); setPick(r);
    addRating(ensureFocus(st), station, r.id, score);
  };
  const reply = !pick ? null
    : pick.id === "sharp" && good ? "You felt sharp, and it showed. Great focus, Captain!"
    : pick.id === "sharp" ? "You felt sharp. Next time, try one slow breath before each answer and see if the score matches the feeling."
    : pick.id === "wobbly" && good ? "It felt wobbly, but you still did really well. Your brain worked harder than it felt!"
    : pick.id === "wobbly" ? "Thanks for noticing! Noticing a wobbly feeling is a real skill. A breathing break can help next time."
    : good ? "Pretty good feeling, and a really good result!" : "Pretty good! Every round you play makes this skill stronger.";
  return (
    <div className="ms-focuscheck">
      <p className="ms-fine">Captain's log · {score}</p>
      <p className="ms-story"><b>How was your focus in that round?</b></p>
      <div className="row ms-ratings">
        {RATINGS.map((r) => <button key={r.id} className={`ms-preset ${pick?.id === r.id ? "on" : ""}`} disabled={!!pick} onClick={() => choose(r)}><b>{r.emoji}</b><span>{r.label}</span></button>)}
      </div>
      {pick && <div className="ms-msg info" role="status">{reply}</div>}
      {pick && <div className="ms-actions"><button className="ms-go" onClick={onDone}>Back to the {home.toLowerCase()} ➜</button></div>}
    </div>
  );
}

// A calm-down break: a bubble grows (breathe in) and shrinks (breathe out).
export function Breathe({ st, onClose }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    oceanPause.on = true;
    if (st) ensureFocus(st).breaths++;
    const id = setInterval(() => setN((x) => x + 1), 4000);
    return () => { clearInterval(id); oceanPause.on = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const inhale = n % 2 === 0, cycles = Math.floor(n / 2);
  return (
    <div className="ms-breathe" role="dialog" aria-label="Breathing break">
      <div className={`ms-breathe-bubble ${inhale ? "in" : "out"}`}><span>{inhale ? "Breathe in…" : "…and out"}</span></div>
      <p className="ms-story">{cycles < 3 ? "Follow the bubble. Big slow breaths, like a sleepy whale." : "Nice and calm. Ready when you are, Captain."}</p>
      <button className="ms-go" onClick={onClose}>I'm ready 🌊</button>
    </div>
  );
}

// ═══ Station 1: Octopus Messages (working memory) ═════════════════════════════
// Inky shows the pearl orders one at a time. Then the ink cloud hides them and a
// creature swims up asking for its pearls. She remembers its numbers and multiplies.
const ROUNDS = 3;
const SIGN = { x: 300, y: 50, w: 460, h: 290 };
function octoGame() {
  const g = {
    plankton: makePlankton(40), stars: [], view: { phase: "show", idx: 0, pz: null, peek: false, mood: null }, ink: 0, pearls: [], swim: 0,
    deliver(n) { this.pearls = Array.from({ length: Math.min(14, 3 + Math.round(n / 300)) }, (_, i) => ({ x: 130, y: 300, d: -i * 0.07 })); },
    update(dt) {
      if (oceanPause.on) return;
      updatePlankton(this.plankton, dt);
      const v = this.view, inked = (v.phase === "ask" || v.phase === "fix") && !v.peek;
      this.ink = ease(this.ink, inked ? 1 : 0, this.calm ? 6 : 2.4, dt);
      this.swim = ease(this.swim, v.phase === "show" ? 0 : 1, 3, dt);
      for (const p of this.pearls) { p.d += dt * 1.4; }
      this.pearls = this.pearls.filter((p) => p.d < 1);
    },
    draw(ctx) {
      const t = this.t, v = this.view, pz = v.pz;
      drawWater(ctx, this.plankton, t, { deep: 1 });
      drawSeabed(ctx, t, 446, { kelp: false });
      // Inky's cave
      ctx.fillStyle = "#3b2c52"; ctx.beginPath(); ctx.ellipse(130, 446, 125, 150, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#1c1430"; ctx.beginPath(); ctx.ellipse(130, 446, 92, 112, 0, Math.PI, 0); ctx.fill();
      drawOctopus(ctx, 130, 360, 1.25, { t, holdSign: v.phase === "show", happy: v.mood !== "oops" });
      if (!pz) return;
      // The sign Inky holds up
      roundRect(ctx, SIGN.x, SIGN.y, SIGN.w, SIGN.h, 22); ctx.fillStyle = "#f3e3c3"; ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = "#9b6a3a"; ctx.stroke();
      const cx = SIGN.x + SIGN.w / 2;
      if (v.phase === "show") {
        const m = pz.msgs[v.idx];
        text(ctx, `Message ${v.idx + 1} of ${pz.msgs.length}`, cx, SIGN.y + 30, { size: 18, color: "#7a5230" });
        drawCreature(ctx, m.who, SIGN.x + 105, SIGN.y + 150, m.who === "narwhal" ? 1.2 : 1.45, { t });
        text(ctx, `${m.a} ${CREATURES[m.who].many}`, cx + 70, SIGN.y + 110, { size: 32, color: "#3a2410" });
        text(ctx, `${m.b} pearls each`, cx + 70, SIGN.y + 160, { size: 28, color: "#3a2410" });
        drawPearl(ctx, cx - 20, SIGN.y + 210, 9); drawPearl(ctx, cx + 70, SIGN.y + 210, 9); drawPearl(ctx, cx + 160, SIGN.y + 210, 9);
        for (let i = 0; i < pz.msgs.length; i++) { ctx.fillStyle = i <= v.idx ? "#9b6a3a" : "rgba(155,106,58,0.3)"; ctx.beginPath(); ctx.arc(cx - (pz.msgs.length - 1) * 12 + i * 24, SIGN.y + SIGN.h - 24, 7, 0, 6.283); ctx.fill(); }
      } else {
        // Every order, small (visible only when the ink clears: on a peek, or after the round)
        text(ctx, "Inky's orders", cx, SIGN.y + 30, { size: 18, color: "#7a5230" });
        const rowH = Math.min(52, (SIGN.h - 60) / pz.msgs.length);
        pz.msgs.forEach((m, i) => {
          const y = SIGN.y + 66 + i * rowH;
          if (i === pz.ask && (v.phase === "done")) { roundRect(ctx, SIGN.x + 20, y - rowH / 2 + 3, SIGN.w - 40, rowH - 6, 10); ctx.fillStyle = "rgba(79,214,143,0.3)"; ctx.fill(); }
          if (v.wrong === i) { roundRect(ctx, SIGN.x + 20, y - rowH / 2 + 3, SIGN.w - 40, rowH - 6, 10); ctx.fillStyle = "rgba(255,122,122,0.3)"; ctx.fill(); }
          drawCreature(ctx, m.who, SIGN.x + 60, y, m.who === "narwhal" ? 0.36 : 0.44, { t });
          text(ctx, messageText(m), SIGN.x + 100, y, { size: Math.min(24, rowH * 0.5), color: "#3a2410", align: "left" });
        });
        drawInk(ctx, cx, SIGN.y + SIGN.h / 2, SIGN.w * 1.1, SIGN.h * 1.15, this.ink, t);
        if (this.ink > 0.6) text(ctx, "🐙 ink!", cx, SIGN.y + SIGN.h / 2, { size: 28, color: "rgba(255,255,255,0.55)" });
        // The asking creature swims in below the sign
        const m = pz.msgs[pz.ask], sx = 820 - this.swim * 300;
        drawCreature(ctx, m.who, sx, 400, m.who === "narwhal" ? 0.8 : 0.95, { t, flip: m.who === "narwhal" || m.who === "seahorse" || m.who === "axolotl" });
        if (this.swim > 0.9 && v.phase !== "done") hud(ctx, `Pearls for the ${CREATURES[m.who].many}?`, sx - 10, 330, { size: 19, color: "#ffe08a" });
        if (v.phase === "done") text(ctx, "♥", sx + 30, 345, { size: 30, color: "#ff8fb8" });
      }
      for (const p of this.pearls) { if (p.d < 0) continue; const k = p.d, x = 130 + (520 - 130) * k, y = 300 - Math.sin(k * Math.PI) * 120 + k * 90; drawPearl(ctx, x, y, 7, true); }
    },
  };
  return g;
}
export function OctoGame({ st, record, calm, onBack, home }) {
  const focus = ensureFocus(st);
  const [round, setRound] = useState(0);
  const [pz, setPz] = useState(() => messagePuzzle(level2(st), focus.span));
  const item = useMemo(() => messageItem(pz), [pz]);
  const [phase, setPhase] = useState("show"); // show | ask | fix | done | log
  const [idx, setIdx] = useState(0);
  const [val, setVal] = useState("");
  const [peek, setPeek] = useState(false);
  const [msg, setMsg] = useState(null);
  const [first, setFirst] = useState(null);
  const firstDone = useRef(false);
  const [help, setHelp] = useState([]);
  const helpRef = useRef([]);
  const useHelpKind = (k) => { helpRef.current = [...new Set([...helpRef.current, k])]; setHelp(helpRef.current); };
  const tally = useRef({ own: 0, total: 0 });
  const [wrong, setWrong] = useState(null);
  const t0 = useRef(Date.now());
  const [cv, game] = useCanvasGame(() => octoGame(), calm);
  useEffect(() => { if (game.current) game.current.view = { phase, idx, pz, peek, wrong, mood: msg?.kind === "bad" ? "oops" : null }; }, [phase, idx, pz, peek, wrong, msg, game]);
  const asked = pz.msgs[pz.ask], who = CREATURES[asked.who];

  const nextMsg = () => {
    sfx.click();
    if (idx + 1 < pz.msgs.length) { setIdx(idx + 1); return; }
    sfx.whoosh(); setPhase("ask"); setMsg(null); t0.current = Date.now();
  };
  const onKey = (k) => { if (phase === "ask" || phase === "fix") setVal((x) => (k === "⌫" ? x.slice(0, -1) : /\d/.test(k) ? (x + k).slice(0, 6) : x)); };
  const submit = () => {
    if ((phase !== "ask" && phase !== "fix") || !val) return;
    const j = judgeMessage(pz, val);
    if (!firstDone.current) {
      firstDone.current = true;
      const peeked = helpRef.current.includes("peek");
      const change = updateSpan(focus, j.kind, peeked);
      const r = record("octo", item, { correct: j.kind === "right", help: helpRef.current, ms: Date.now() - t0.current, given: val, part: { answerType: "number", text: `${asked.a} × ${asked.b}`, answer: String(asked.ans) } });
      setFirst(r.support);
      tally.current.total++; if (r.support.key === "independent") tally.current.own++;
      if (change > 0) setTimeout(() => setMsg({ kind: "good", text: `Memory power up! Next time Inky will send ${focus.span} messages.` }), 1600);
    }
    setPeek(false);
    if (j.kind === "right") {
      sfx.power(); game.current?.deliver(asked.ans); setWrong(null);
      const fx = game.current?.fx; if (fx) { burst(fx, 520, 400, { n: 24, color: "#fff4d6", speed: 160 }); popup(fx, 520, 300, `${fmt(asked.ans)} pearls!`, "#ffe08a", 30); }
      setMsg({ kind: "good", text: `Yes! ${asked.a} ${who.many} × ${asked.b} pearls = ${fmt(asked.ans)} pearls. The ${who.many} are so happy!` });
      setPhase("done"); setVal("");
      return;
    }
    sfx.bump(); setVal("");
    if (j.kind === "mixup") {
      const o = pz.msgs[j.other];
      setWrong(j.other); setPeek(true);
      setMsg({ kind: "bad", text: j.partial ? `Close! Some of those numbers belong to the ${CREATURES[o.who].many}. Look at the orders again, find the ${who.many}, then try again.` : `Oops, that's the ${CREATURES[o.who].many}' order! Look at the orders again, find the ${who.many}, then try again.` });
    } else if (j.kind === "slip") {
      setMsg({ kind: "bad", text: `So close! Count the zeros again. ${tensTrick}` });
    } else {
      setMsg({ kind: "bad", text: `Not quite. Do you remember the ${who.many}' numbers? Tap 👀 Peek if you need to, then multiply.` });
    }
    setPhase("fix");
  };
  useHardwareKeys(onKey, submit, phase === "ask" || phase === "fix");
  const doPeek = () => { sfx.click(); setPeek(true); useHelpKind("peek"); };
  const nextRound = () => {
    if (round + 1 >= ROUNDS) { setPhase("log"); return; }
    sfx.click();
    setRound(round + 1); setPz(messagePuzzle(level2(st), focus.span)); setIdx(0); setPhase("show"); setMsg(null); setFirst(null); setWrong(null); firstDone.current = false;
    helpRef.current = []; setHelp([]);
  };
  const story = phase === "show"
    ? "Inky is showing you pearl orders. Read each one and remember it. When Inky squirts ink, the orders disappear!"
    : `The ${who.many} want their pearls. How many pearls do they get?`;
  return (
    <div className="ms-panel">
      <StationHead id="octo" onBack={onBack} story={story} />
      <p className="ms-fine">Round {round + 1} of {ROUNDS} · Remembering {pz.msgs.length} messages</p>
      <canvas ref={cv} className="ms-canvas" role="img" aria-label={phase === "show" ? `Message ${idx + 1}: ${messageText(pz.msgs[idx])}.` : `The orders are hidden. The ${who.many} ask how many pearls they get.`} />
      {phase === "show" && (
        <div className="ms-gamebar">
          <span className="ms-eq">{messageText(pz.msgs[idx])}</span>
          <button className="ms-go" onClick={nextMsg}>{idx + 1 < pz.msgs.length ? "Got it, next message ➜" : "Got it! Ink time 🐙"}</button>
        </div>
      )}
      {(phase === "ask" || phase === "fix") && (<>
        <div className="ms-gamebar">
          <span className="ms-eq">Pearls for the {who.many} = <b className="ms-q">{val ? fmt(val) : "?"}</b></span>
          {!peek ? <button className="ms-ghost" onClick={doPeek}>👀 Peek</button> : <button className="ms-ghost" onClick={() => setPeek(false)}>🙈 Hide</button>}
          <button className="ms-go" onClick={submit}>Send pearls 🫧</button>
        </div>
        <Keypad onKey={onKey} />
      </>)}
      {msg && <div className={`ms-msg ${msg.kind}`} role="status">{msg.text}</div>}
      {(phase === "ask" || phase === "fix") && !first && <Bolt used={help} onUse={useHelpKind}
        hint={`First remember: how many ${who.many}, and how many pearls each? Then: ${tensTrick}`}
        part={{ text: `Remember the order for the ${who.many}, then multiply. (The child can't see the numbers now; don't tell them the numbers.)`, answer: [String(asked.ans), String(asked.a), String(asked.b)], steps: [] }} />}
      {phase === "show" && round === 0 && idx === 0 && <p className="ms-fine">💡 Pip's memory trick: say each order out loud twice, like a little song. “Thirty seahorses, forty pearls!”</p>}
      <Record r={first} />
      {phase === "done" && <div className="ms-actions"><button className="ms-go" onClick={nextRound}>{round + 1 < ROUNDS ? "Next message batch ➜" : "Finish 🐙"}</button></div>}
      {phase === "log" && <FocusCheck st={st} station="octo" home={home} score={`${tally.current.own} of ${ROUNDS} remembered on your own · now holding ${focus.span} messages`} good={tally.current.own >= 2} onDone={() => onBack("octo")} />}
    </div>
  );
}

// ═══ Station 2: Bubble Patrol (impulse control) ═══════════════════════════════
// Bubbles float up from the vent. Pop the ones worth MORE than the rule, let the others go.
function bubbleGame(round, api) {
  const g = {
    plankton: makePlankton(40), stars: [], bubbles: [], next: 0, spawned: 0, rate: 3.0, view: { playing: false }, resolved: 0,
    hits(p) { return !!this.at(p); },
    at(p) { return this.bubbles.find((b) => !b.done && Math.hypot(p.x - b.x, p.y - b.y) < b.r + 8); },
    pop(i) { const b = this.bubbles.find((x) => x.i === i && !x.done); if (b) this.decide(b, "pop"); },
    decide(b, what) {
      b.done = what; b.popT = 0.0001;
      this.resolved++;
      const res = api.current.result(b.i, what);
      const fx = this.fx;
      if (what === "pop" && res === "right") { burst(fx, b.x, b.y, { n: 20, color: "#bff3ff", speed: 180 }); b.pearl = true; }
      if (what === "pop" && res === "wrong") { burst(fx, b.x, b.y, { n: 12, color: "#ff9a9a", speed: 120 }); shake(fx, 5); popup(fx, b.x, b.y - 40, `${fmt(b.v)}`, "#ffb0b0", 24); }
      if (what === "pass" && res === "wrong") popup(fx, b.x, 70, `${fmt(b.v)} got away`, "#ffe08a", 20);
      if (what === "pass" && res === "right") popup(fx, b.x, 70, "✓ let it go", "#b9f5d3", 18);
    },
    pointer(p, kind) {
      if (kind !== "down" || !this.view.playing) return;
      const b = this.at(p); if (b) this.decide(b, "pop");
    },
    update(dt) {
      if (oceanPause.on) return;
      updatePlankton(this.plankton, dt);
      if (!this.view.playing) return;
      const speed = this.calm ? 26 : 34;
      this.next -= dt;
      const live = this.bubbles.filter((b) => !b.done).length;
      if (this.spawned < round.bubbles.length && (this.next <= 0 || live === 0) && live < 3) {
        const d = round.bubbles[this.spawned];
        const lanes = [200, 330, 460, 590];
        const used = this.bubbles.filter((b) => !b.done && b.y > H - 170).map((b) => b.lane);
        const free = [0, 1, 2, 3].filter((k) => !used.includes(k));
        const li = free.length ? free[(this.spawned * 3) % free.length] : 0;
        this.bubbles.push({ i: this.spawned, x: lanes[li] + (Math.random() - 0.5) * 40, y: H + 50, r: 52, v: d.v, label: `${d.a} × ${d.b}`, lane: li, done: null });
        this.spawned++; this.next = this.calm ? 3.6 : this.rate;
        api.current.live?.();
      }
      for (const b of this.bubbles) {
        if (b.done) { b.popT += dt * 2.2; continue; }
        b.y -= speed * dt;
        if (b.y < 40) this.decide(b, "pass");
      }
      this.bubbles = this.bubbles.filter((b) => !b.done || b.popT < 1);
      if (this.resolved >= round.bubbles.length && !this.finished) { this.finished = true; setTimeout(() => api.current.finish(), 900); }
    },
    draw(ctx) {
      const t = this.t;
      drawWater(ctx, this.plankton, t);
      drawSeabed(ctx, t, 452);
      // The vent the bubbles come from
      ctx.fillStyle = "#5b4a3a"; ctx.beginPath(); ctx.moveTo(300, 470); ctx.lineTo(340, 430); ctx.lineTo(460, 430); ctx.lineTo(500, 470); ctx.closePath(); ctx.fill();
      // The finish line: bubbles that reach the top have floated away
      ctx.setLineDash([10, 10]); ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(100, 40); ctx.lineTo(W - 20, 40); ctx.stroke(); ctx.setLineDash([]);
      drawSeahorse(ctx, 62, 210, 1.15, { t });
      drawSeahorse(ctx, 740, 300, 0.8, { t: t + 2, flip: true, color: "#ff9ad5" });
      hud(ctx, `POP if MORE than ${fmt(round.T)}`, 400, 18, { size: 18, color: "#ffe08a" });
      for (const b of this.bubbles) {
        if (b.pearl && b.done) { drawPearl(ctx, b.x, b.y - b.popT * 40, 8 * (1 - b.popT * 0.5), true); }
        drawBubble(ctx, b.x, b.y, b.r, b.label, { t, pop: b.done ? Math.min(1, b.popT) : 0, tint: b.done === "pop" && !b.pearl ? "255,160,160" : "160,230,255" });
      }
      if (!this.view.playing && !this.finished) text(ctx, "Ready when you are!", 400, 260, { size: 26, color: "rgba(255,255,255,0.8)" });
    },
  };
  return g;
}
export function BubbleGame({ st, record, calm, onBack, home }) {
  const focus = ensureFocus(st);
  const [round] = useState(() => bubbleRound(level2(st)));
  const item = useMemo(() => bubbleItem(round), [round]);
  const [phase, setPhase] = useState("goal"); // goal | play | done | log
  const [goal, setGoal] = useState(null);
  const results = useRef([]);
  const [msg, setMsg] = useState(null);
  const [first, setFirst] = useState(null);
  const [score, setScore] = useState(null);
  const [help, helpRef, useHelpKind] = useHelp();
  const [, force] = useState(0);
  const t0 = useRef(Date.now());
  const api = useApi({
    result: (i, what) => {
      const b = round.bubbles[i]; results.current[i] = what;
      const right = (what === "pop") === b.go;
      if (what === "pop" && right) { sfx.load(); setMsg({ kind: "good", text: `Pop! ${b.a} × ${b.b} = ${fmt(b.v)}. That's more than ${fmt(round.T)}.` }); }
      else if (what === "pop") { sfx.bump(); setMsg({ kind: "bad", text: `Whoa, stop and think! ${b.a} × ${b.b} = ${fmt(b.v)}, and that's ${b.v === round.T ? "equal to" : "less than"} ${fmt(round.T)}, not more. That one should float by.` }); }
      else if (!right) setMsg({ kind: "info", text: `That one floated away: ${b.a} × ${b.b} = ${fmt(b.v)}, which is more than ${fmt(round.T)}. No worries, there are more bubbles!` });
      force((x) => x + 1);
      return right ? "right" : "wrong";
    },
    live: () => force((x) => x + 1),
    finish: () => {
      const s = recordBubbleFocus(focus, round, results.current, goal);
      const ok = s.popsWrong + s.missed <= 1;
      const r = record("bubbles", item, { correct: ok, help: helpRef.current, ms: Date.now() - t0.current, given: round.bubbles.map((b, i) => `${b.a}×${b.b}:${results.current[i]}`).join(" "), part: { answerType: "number", text: `Is ${round.bubbles[0].a} × ${round.bubbles[0].b} more than ${fmt(round.T)}?`, answer: String(round.bubbles[0].v) } });
      setFirst(r.support); setScore(s); setPhase("done"); sfx.win();
      setMsg(null);
    },
  });
  const [cv, game] = useCanvasGame(() => bubbleGame(round, api), calm);
  useEffect(() => { if (game.current) game.current.view = { playing: phase === "play" }; }, [phase, game]);
  const start = (gl) => { sfx.click(); setGoal(gl); setPhase("play"); t0.current = Date.now(); };
  const live = game.current?.bubbles.filter((b) => !b.done) || [];
  const goalMet = score && goal && score.right >= goal;
  return (
    <div className="ms-panel">
      <StationHead id="bubbles" onBack={onBack} story={`Shelly the seahorse needs pearls for the seahorse nursery. Pop only the bubbles worth MORE than ${fmt(round.T)}. Let the others float away. Being right matters, not being fast!`} />
      <canvas ref={cv} className="ms-canvas" role="img" aria-label={`Bubbles floating up. Pop the ones worth more than ${fmt(round.T)}.`} />
      <div className="ms-sr">{live.map((b) => <button key={b.i} onClick={() => game.current?.pop(b.i)}>Pop {b.label}</button>)}</div>
      {phase === "goal" && (
        <div className="ms-focuscheck">
          <p className="ms-story"><b>Pick your goal, Captain.</b> There are {BUBBLES_PER_ROUND} bubbles. How many will you get right? (Popping a good one or letting a wrong one go both count.)</p>
          <div className="row ms-ratings">{[6, 8, 10].map((n) => <button key={n} className="ms-preset" onClick={() => start(n)}><b>{n}</b><span>{n === 10 ? "All of them!" : n === 8 ? "Most of them" : "A good start"}</span></button>)}</div>
          <p className="ms-fine">💡 Pip's trick: <b>Look, think, then tap.</b> If a bubble is close to {fmt(round.T)}, take an extra second.</p>
        </div>
      )}
      {phase === "play" && <p className="ms-fine">Goal: {goal} right · Bubble {Math.min(round.bubbles.length, (game.current?.spawned || 0))} of {round.bubbles.length}</p>}
      {msg && phase === "play" && <div className={`ms-msg ${msg.kind}`} role="status">{msg.text}</div>}
      {phase === "play" && <Bolt used={help} onUse={useHelpKind} hint={round.est ? `Round both numbers to the nearest ten and multiply. 28 × 41 is about 30 × 40 = 1,200.` : tensTrick}
        part={{ text: `Bubble patrol: pop bubbles worth more than ${fmt(round.T)}.`, answer: [], steps: [] }} />}
      {phase === "done" && score && (<>
        <div className="ms-tally">
          <div><b>{score.right}/{score.total}</b><span>right</span></div>
          <div><b>{round.bubbles.filter((b, i) => !b.go && results.current[i] === "pass").length}/{round.bubbles.filter((b) => !b.go).length}</b><span>tricky ones you let go</span></div>
          <div><b>{goal}</b><span>your goal</span></div>
        </div>
        <div className={`ms-msg ${goalMet ? "good" : "info"}`}>{goalMet ? `Goal reached! You set ${goal} and got ${score.right}. Shelly's nursery is full of pearls!` : `You got ${score.right}. Your goal was ${goal}. ${score.popsWrong ? "Most slips were pops that came too fast. Next time, look, think, then tap." : "A few got away. Keep your eyes on the bubbles near the bottom."}`}</div>
        <Record r={first} />
        {phase === "done" && <div className="ms-actions"><button className="ms-go" onClick={() => setPhase("log")}>Captain's log ➜</button></div>}
      </>)}
      {phase === "log" && <FocusCheck st={st} station="bubbles" home={home} score={`${score.right} of ${score.total} right, goal ${goal}`} good={score.right >= 8} onDone={() => onBack("bubbles")} />}
    </div>
  );
}

// ═══ Station 3: Narwhal Navigator (planning) ═════════════════════════════════
// Three routes to the baby narwhal. Plan first: once the sub dives, the route is set.
const START = { x: 92, y: 245 }, CALF = { x: 712, y: 245 };
const WAY = [{ x: 400, y: 95 }, { x: 400, y: 245 }, { x: 400, y: 395 }];
const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
function routeGame(pz, api) {
  const legsOf = (r) => [[START, WAY[r]], [WAY[r], CALF]];
  const g = {
    plankton: makePlankton(40), stars: [], view: { sel: null, seen: [], dive: null }, sub: { ...START }, k: 0, air: 1, free: 0,
    routeAt(p) {
      for (let r = 0; r < 3; r++) for (const [a, b] of legsOf(r)) {
        const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy, u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L));
        if (Math.hypot(p.x - (a.x + dx * u), p.y - (a.y + dy * u)) < 34) return r;
      }
      return null;
    },
    hits(p) { return !this.view.dive && this.routeAt(p) !== null; },
    pointer(p, kind) { if (kind === "down" && !this.view.dive) { const r = this.routeAt(p); if (r !== null) api.current.select(r); } },
    update(dt) {
      if (oceanPause.on) return;
      updatePlankton(this.plankton, dt);
      const d = this.view.dive;
      if (!d) { this.sub.x = ease(this.sub.x, START.x, 4, dt); this.sub.y = ease(this.sub.y, START.y, 4, dt); this.k = 0; this.air = 1; return; }
      const r = d.route, route = pz.routes[r], fits = route.fits;
      const stopAt = fits ? 2 : 1 + Math.min(0.85, (pz.limit - route.legs[0].v) / route.legs[1].v); // runs low partway through leg 2
      if (!d.back) {
        this.k = Math.min(stopAt, this.k + dt * (this.calm ? 0.9 : 0.45));
        const [a, b] = legsOf(r)[this.k < 1 ? 0 : 1];
        const pos = lerp(a, b, this.k < 1 ? this.k : this.k - 1);
        this.sub.x = pos.x; this.sub.y = pos.y;
        const used = this.k < 1 ? route.legs[0].v * this.k : route.legs[0].v + route.legs[1].v * (this.k - 1);
        this.air = Math.max(0, 1 - used / pz.limit);
        if (this.k >= stopAt && !d.ended) { d.ended = true; api.current.arrive(fits); if (fits) { this.free = 0.0001; burst(this.fx, CALF.x, CALF.y, { n: 40, color: "#bff3ff", speed: 200 }); } else { shake(this.fx, 8); } }
      } else { this.sub.x = ease(this.sub.x, START.x, 2.2, dt); this.sub.y = ease(this.sub.y, START.y, 2.2, dt); this.air = ease(this.air, 1, 1.5, dt); }
      if (this.free > 0) this.free = Math.min(1, this.free + dt * 0.5);
    },
    draw(ctx) {
      const t = this.t, v = this.view;
      drawWater(ctx, this.plankton, t, { deep: 1 });
      drawSeabed(ctx, t, 455, { kelp: false });
      // Landmarks on each route
      drawKelp(ctx, 360, 160, 80, t, "#2f9e5b"); drawKelp(ctx, 440, 160, 70, t + 1, "#3fbf6d");
      ctx.fillStyle = "#3b2c52"; ctx.beginPath(); ctx.ellipse(400, 236, 60, 26, 0, Math.PI, 0); ctx.fill();
      drawOctopus(ctx, 446, 214, 0.38, { t });
      drawJelly(ctx, 350, 360, 0.6, { t }); drawJelly(ctx, 455, 350, 0.5, { t: t + 2, color: "150,200,255" });
      // Routes and their legs
      for (let r = 0; r < 3; r++) {
        const sel = v.sel === r, seen = v.seen.includes(r), dimmed = v.dive && v.dive.route !== r;
        ctx.globalAlpha = dimmed ? 0.25 : 1;
        ctx.setLineDash(sel ? [] : [12, 10]); ctx.lineWidth = sel ? 7 : 4;
        ctx.strokeStyle = sel ? "#ffe08a" : seen ? "rgba(185,245,211,0.85)" : "rgba(255,255,255,0.55)";
        ctx.beginPath(); ctx.moveTo(START.x, START.y); ctx.lineTo(WAY[r].x, WAY[r].y); ctx.lineTo(CALF.x, CALF.y); ctx.stroke(); ctx.setLineDash([]);
        legsOf(r).forEach(([a, b], k) => {
          const m = lerp(a, b, 0.5), l = pz.routes[r].legs[k];
          hud(ctx, `${l.a} × ${l.b}`, m.x, m.y + (r === 1 ? 26 : r === 0 ? -14 : 14), { size: 17, color: sel ? "#ffe08a" : "#eef1ff" });
        });
        hud(ctx, `${seen ? "✓ " : ""}${ROUTE_NAMES[r]}`, WAY[r].x, WAY[r].y + (r === 0 ? -50 : r === 2 ? 52 : 50), { size: 15, color: seen ? "#b9f5d3" : "#c8d0f0" });
        ctx.globalAlpha = 1;
      }
      // The baby narwhal, stuck in kelp until the sub arrives
      const f = this.free;
      drawNarwhal(ctx, CALF.x + 20 - f * 40, CALF.y - f * 110, 0.6, { t, flip: true, baby: true });
      if (f < 1) { ctx.globalAlpha = 1 - f; drawKelp(ctx, CALF.x + 10, CALF.y + 40, 70, t, "#1f7a45"); drawKelp(ctx, CALF.x + 34, CALF.y + 40, 60, t + 2, "#2f9e5b"); ctx.globalAlpha = 1; }
      if (f > 0) drawNarwhal(ctx, CALF.x - 90 + f * 30, CALF.y - 150 + (1 - f) * -80, 0.9, { t, flip: true });
      drawSub(ctx, this.sub.x, this.sub.y, { t, scale: 0.6, dir: v.dive?.back ? -1 : 1 });
      // Oxygen tank gauge
      const gx = 20, gy = 30, gh = 150;
      roundRect(ctx, gx, gy, 26, gh, 10); ctx.fillStyle = "rgba(7,11,36,0.7)"; ctx.fill(); ctx.strokeStyle = "#9aa6d6"; ctx.lineWidth = 2; ctx.stroke();
      const fill = gh * this.air; roundRect(ctx, gx + 3, gy + gh - fill + 3, 20, Math.max(0, fill - 6), 7); ctx.fillStyle = this.air < 0.1 ? "#ff7a7a" : "#52d6e8"; ctx.fill();
      text(ctx, "O₂", gx + 13, gy + gh + 16, { size: 15, color: "#c8f4fa" });
    },
  };
  return g;
}
export function RouteGame({ st, record, calm, onBack, home }) {
  const focus = ensureFocus(st);
  const [pz] = useState(() => routePuzzle(level2(st)));
  const item = useMemo(() => routeItem(pz), [pz]);
  const [sel, setSel] = useState(null);
  const [seen, setSeen] = useState([]);
  const [dive, setDive] = useState(null);
  const [nudge, setNudge] = useState(false);
  const [phase, setPhase] = useState("plan"); // plan | dive | done | log
  const [msg, setMsg] = useState(null);
  const [first, setFirst] = useState(null);
  const firstDone = useRef(false);
  const checkedFirst = useRef(null);
  const [help, helpRef, useHelpKind] = useHelp();
  const t0 = useRef(Date.now());
  const routeLine = (r) => pz.routes[r].legs.map((l) => `${l.a} × ${l.b}`).join(" + ");
  const estLine = (r) => pz.routes[r].legs.map((l) => (pz.est ? `${l.a} × ${l.b} ≈ ${roundTo(l.a, 10)} × ${roundTo(l.b, 10)} = ${fmt(l.e)}` : `${l.a} × ${l.b} = ${fmt(l.v)}`)).join(", ");
  const api = useApi({
    select: (r) => {
      if (phase !== "plan") return;
      sfx.click(); setSel(r); setNudge(false);
      setSeen((s) => (s.includes(r) ? s : [...s, r]));
    },
    arrive: (fits) => {
      if (fits) { sfx.win(); setPhase("done"); setMsg({ kind: "good", text: `You made it with air to spare! ${ROUTE_NAMES[dive?.route ?? sel]}: ${estLine(sel)}. That's ${pz.est ? "about " : ""}${fmt(pz.est ? pz.routes[sel].estTotal : pz.routes[sel].total)}, less than ${fmt(pz.limit)}. The baby narwhal is free!` }); return; }
      sfx.bump();
      setMsg({ kind: "bad", text: `Air is running low! Pip turns the sub around. ${ROUTE_NAMES[sel]}: ${estLine(sel)}. That's ${pz.est ? "about " : ""}${fmt(pz.est ? pz.routes[sel].estTotal : pz.routes[sel].total)}, more than the tank holds. Plan another route.` });
      setTimeout(() => { setDive((d) => d && { ...d, back: true }); setTimeout(() => { setDive(null); setPhase("plan"); setSel(null); }, calm ? 600 : 1800); }, calm ? 300 : 900);
    },
  });
  const [cv, game] = useCanvasGame(() => routeGame(pz, api), calm);
  useEffect(() => { if (game.current) game.current.view = { sel, seen, dive }; }, [sel, seen, dive, game]);
  const go = (force = false) => {
    if (sel === null) return;
    if (!force && seen.length < 3 && !firstDone.current) { setNudge(true); sfx.click(); return; }
    if (!firstDone.current) {
      firstDone.current = true;
      if (checkedFirst.current === null) checkedFirst.current = seen.length === 3 && !nudge;
      const right = pz.routes[sel].fits;
      recordPlan(focus, checkedFirst.current, right);
      const r = record("route", item, { correct: right, help: helpRef.current, ms: Date.now() - t0.current, given: ROUTE_NAMES[sel], part: { answerType: "number", text: `${routeLine(pz.good)}`, answer: String(pz.routes[pz.good].total) } });
      setFirst(r.support);
    }
    setNudge(false); sfx.whoosh(); setMsg(null); setPhase("dive"); setDive({ route: sel });
  };
  const checkOthers = () => { checkedFirst.current = false; setNudge(false); sfx.click(); };
  return (
    <div className="ms-panel">
      <StationHead id="route" onBack={onBack} story={`A baby narwhal is stuck in the kelp! The air tank holds LESS than ${fmt(pz.limit)} units. Each leg of a route uses (minutes × air per minute). Plan a route that has enough air, then dive.`} />
      <canvas ref={cv} className="ms-canvas" role="img" aria-label={`Three routes. ${pz.routes.map((r, i) => `${ROUTE_NAMES[i]}: ${routeLine(i)}`).join(". ")}. The tank holds less than ${fmt(pz.limit)}.`} />
      {phase === "plan" && (<>
        <div className="ms-routes">
          {pz.routes.map((r, i) => (
            <button key={i} className={`ms-preset ${sel === i ? "on" : ""}`} onClick={() => api.current.select(i)}>
              <b>{seen.includes(i) ? "✓ " : ""}{ROUTE_NAMES[i]}</b><span>{routeLine(i)}</span>
            </button>
          ))}
        </div>
        <div className="ms-gamebar">
          <span className="ms-eq">{sel === null ? "Tap a route to look at it" : `Plan: ${ROUTE_NAMES[sel]}`} · Checked {seen.length} of 3</span>
          <button className="ms-go" disabled={sel === null} onClick={() => go(false)}>Dive! 🌊</button>
        </div>
        {nudge && (
          <div className="ms-msg info" role="status">
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}><CreatureIcon kind="axolotl" size={40} /><span>Pip: “Wait, Captain! Good divers check <b>every</b> route before they dive. You checked {seen.length} of 3.”</span></div>
            <div className="ms-actions"><button className="ms-ghost" onClick={() => go(true)}>Dive anyway</button><button className="ms-go" onClick={checkOthers}>Check the others 🧭</button></div>
          </div>
        )}
      </>)}
      {msg && <div className={`ms-msg ${msg.kind}`} role="status">{msg.text}</div>}
      {phase === "plan" && !first && <Bolt used={help} onUse={useHelpKind}
        hint={pz.est ? `For each route, round every number to the nearest ten, multiply each leg, then add the two legs. Is it less than ${fmt(pz.limit)}?` : `For each route, multiply each leg, then add the two legs. ${tensTrick}`}
        part={{ text: `Tank holds less than ${fmt(pz.limit)}. Routes: ${pz.routes.map((r, i) => `${ROUTE_NAMES[i]} ${routeLine(i)}`).join("; ")}. Which route fits?`, answer: pz.routes.map((r) => String(r.total)), steps: [] }}
        visual={<ul className="ms-pv">{pz.routes.map((r, i) => <li key={i}>{ROUTE_NAMES[i]}: {r.legs.map((l) => (pz.est ? `${l.a} × ${l.b} is about ${roundTo(l.a, 10)} × ${roundTo(l.b, 10)}` : `${l.a} × ${l.b} is ${l.a / 10} × ${l.b / 10} with two zeros`)).join(", then ")}</li>)}</ul>} />}
      <Record r={first} />
      {phase === "done" && <div className="ms-actions"><button className="ms-go" onClick={() => setPhase("log")}>Captain's log ➜</button></div>}
      {phase === "log" && <FocusCheck st={st} station="route" home={home} score={first?.key === "independent" ? "Right route on the first dive" : "Found the route"} good={first?.key !== "missed"} onDone={() => onBack("route")} />}
    </div>
  );
}

// ── Grown-ups: what the focus practice shows so far ──
export function FocusPanel({ st }) {
  const f = st?.focus;
  if (!f) return <p className="ms-fine"><i>No focus practice yet. Play Deep Sea Rescue to see it here.</i></p>;
  const m = f.memory, b = f.bubbles, p = f.plans;
  const pct = (a, n) => (n ? `${Math.round((100 * a) / n)}%` : "–");
  return (
    <div className="ms-focuspanel">
      <h3 className="ms-h2">🐙 Focus skills</h3>
      <ul className="ms-pv">
        <li><b>Remembering:</b> holding {f.span} messages now (best {f.spanBest}). {m.n} asked, {pct(m.right, m.n)} right first try; {m.mixups} memory mix-ups, {m.slips} math slips, {m.peeks} peeks.</li>
        <li><b>Stop and think:</b> {b.rounds} rounds. Popped {pct(b.hits, b.go)} of the bubbles she should, let go {pct(b.holds, b.nogo)} of the ones she shouldn't pop ({b.popsWrong} too-quick pops).{b.goals.length ? ` Goals: ${b.goals.slice(-4).map((g) => `${g.got}/${g.goal}`).join(", ")}.` : ""}</li>
        <li><b>Planning ahead:</b> {p.n} dives, checked every route first {pct(p.checkedFirst, p.n)}, right route first time {pct(p.rightFirst, p.n)}.</li>
        <li><b>Her own focus ratings:</b> {f.ratings.length ? f.ratings.slice(-5).map((r) => `${RATINGS.find((x) => x.id === r.rating)?.emoji} (${r.score})`).join(" · ") : "none yet"}. Breathing breaks: {f.breaths}.</li>
      </ul>
      <p className="ms-fine">This is practice, not a test or a diagnosis. Games like this mostly get better at themselves; the useful part is the habits (say it twice, look-think-tap, check every option) and noticing her own focus.</p>
    </div>
  );
}
