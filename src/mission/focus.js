// Mission 3, Deep Sea Rescue: Unit 4 math (multiply by 2-digit numbers) plus practice
// of three "focus" skills. Each station pairs the math with one of them:
//   🐙 Octopus Messages  → working memory (hold several orders, recall one)
//   🫧 Bubble Patrol     → impulse control (pop only the bubbles that fit the rule)
//   🧭 Narwhal Navigator → planning (check every route before you dive)
// This is practice and engagement, not treatment. Research on "brain training" finds
// gains mostly on the trained task itself, so the design leans on supports with better
// evidence: short rounds, instant feedback, picking a goal, rating your own focus,
// and strategies (say it again, check every option) that she can use anywhere.
import { recordMission } from "./engine.js";
import { rand, pick, shuffle, fmt, roundTo } from "../engine/util.js";

// ── Where the focus practice is kept (st.focus). Older saved states get it on first use.
export function ensureFocus(st) {
  if (!st.focus) st.focus = {
    span: 2, spanBest: 2, streak: 0,
    memory: { n: 0, right: 0, mixups: 0, slips: 0, peeks: 0 },
    bubbles: { rounds: 0, go: 0, nogo: 0, hits: 0, holds: 0, popsWrong: 0, missed: 0, goals: [] },
    plans: { n: 0, checkedFirst: 0, rightFirst: 0 },
    ratings: [], breaths: 0,
  };
  return st.focus;
}

// The sea creatures that appear in messages (drawn in oceanart.js).
export const CREATURES = {
  seahorse: { one: "seahorse", many: "seahorses" },
  axolotl: { one: "axolotl", many: "axolotls" },
  narwhal: { one: "narwhal", many: "narwhals" },
  octopus: { one: "octopus", many: "octopuses" },
  jelly: { one: "jellyfish", many: "jellyfish" },
  crab: { one: "crab", many: "crabs" },
  turtle: { one: "turtle", many: "sea turtles" },
  star: { one: "starfish", many: "starfish" },
};
const RECIPIENTS = ["seahorse", "axolotl", "narwhal", "jelly", "crab", "turtle", "star"];

// A factor pair at her mult2 level. Levels 1–2: tens × tens (Lesson 4-1, 30 × 40).
// Level 3 and up: a 2-digit number × a multiple of ten (Lesson 4-2, 23 × 30).
function factorPair(level) {
  if (level <= 2) return [rand(2, 9) * 10, rand(2, 9) * 10];
  let a; do a = rand(11, 49); while (a % 10 === 0);
  return [a, rand(2, 5) * 10];
}

// ══ 🐙 Octopus Messages: working memory ══════════════════════════════════════
// Inky shows `span` orders one at a time ("30 seahorses, 40 pearls each"), then the
// ink cloud hides them and Inky asks about ONE creature. She has to remember which
// numbers went with it, then multiply. Every product is different, so a wrong answer
// that equals another order's product is clearly a memory mix-up, not a math slip.
export const SPAN_MIN = 2, SPAN_MAX = 5;
export function messagePuzzle(level, span) {
  span = Math.max(SPAN_MIN, Math.min(SPAN_MAX, span));
  for (let t = 0; t < 500; t++) {
    const who = shuffle(RECIPIENTS).slice(0, span);
    const msgs = who.map((w) => { const [a, b] = factorPair(level); return { who: w, a, b, ans: a * b }; });
    const prods = msgs.map((m) => m.ans);
    if (new Set(prods).size < span) continue;
    // A place-value slip (×10 or ÷10) must never equal another order, or we couldn't tell them apart.
    if (prods.some((p) => prods.includes(p * 10) || prods.includes(p / 10))) continue;
    // Numbers that repeat across orders are too easy to mix up honestly; keep factors varied.
    if (new Set(msgs.flatMap((m) => [m.a, m.b])).size < Math.min(span * 2, span + 3)) continue;
    return { level, span, msgs, ask: rand(0, span - 1) };
  }
  return { level, span: 2, msgs: [{ who: "seahorse", a: 30, b: 40, ans: 1200 }, { who: "crab", a: 20, b: 70, ans: 1400 }], ask: 0 };
}
export const messageText = (m) => `${m.a} ${CREATURES[m.who].many}, ${m.b} pearls each`;
// right | mixup (another creature's order) | slip (a zero too many or too few) | calc
export function judgeMessage(pz, given) {
  const want = pz.msgs[pz.ask].ans, g = Number(given);
  if (g === want) return { kind: "right" };
  const other = pz.msgs.findIndex((m, i) => i !== pz.ask && m.ans === g);
  if (other >= 0) return { kind: "mixup", other };
  if (g === want * 10 || g * 10 === want) return { kind: "slip" };
  const usedOther = pz.msgs.find((m, i) => i !== pz.ask && (g === m.a * pz.msgs[pz.ask].b || g === pz.msgs[pz.ask].a * m.b));
  if (usedOther) return { kind: "mixup", other: pz.msgs.indexOf(usedOther), partial: true };
  return { kind: "calc" };
}
// The span grows after two clean recalls in a row and shrinks after a memory mix-up.
// A math slip doesn't change it (that's the math, not the memory). A peek pauses growth.
export function updateSpan(focus, kind, peeked) {
  const m = focus.memory;
  m.n++;
  if (peeked) m.peeks++;
  if (kind === "right") m.right++;
  if (kind === "mixup") m.mixups++;
  if (kind === "slip" || kind === "calc") m.slips++;
  let change = 0;
  if (kind === "right" && !peeked) {
    focus.streak++;
    if (focus.streak >= 2 && focus.span < SPAN_MAX) { focus.span++; focus.streak = 0; change = 1; }
  } else if (kind === "mixup") {
    focus.streak = 0;
    if (focus.span > SPAN_MIN) { focus.span--; change = -1; }
  } else focus.streak = 0;
  focus.spanBest = Math.max(focus.spanBest, focus.span);
  return change;
}
export const messageItem = (pz) => {
  const m = pz.msgs[pz.ask];
  return {
    skill: "mult2", level: pz.level, answerType: "mission",
    text: `Octopus messages (${pz.span} to remember): ${pz.msgs.map(messageText).join("; ")}. Asked: pearls for the ${CREATURES[m.who].many}`,
    answer: String(m.ans),
  };
};

// ══ 🫧 Bubble Patrol: impulse control ═══════════════════════════════════════
// Bubbles float up slowly, each with a product. Rule: pop the ones worth MORE than T,
// let the rest float by. Most bubbles are "pop" bubbles, so popping becomes a habit,
// and a few tempting ones (exactly T, or just under it) test stopping to check.
// Scored on being right, never on being fast.
export const BUBBLES_PER_ROUND = 10;
export function bubbleRound(level) {
  const est = level >= 3;
  for (let t = 0; t < 400; t++) {
    const T = est ? pick([1000, 1500, 2000]) : pick([1000, 1200, 1500, 2000, 2400]);
    const pool = { go: [], lure: [], no: [] };
    for (let k = 0; k < 600; k++) {
      let a, b;
      if (est) { a = rand(11, 59); b = rand(11, 59); if (a % 10 === 0 || b % 10 === 0) continue; }
      else { a = rand(2, 9) * 10; b = rand(2, 9) * 10; }
      const v = a * b, e = roundTo(a, 10) * roundTo(b, 10);
      if (est) {
        // Rounding both factors must give the same verdict as the exact product, with room to spare.
        if (Math.abs(v - T) < T * 0.12 || (e > T) !== (v > T) || Math.abs(e - T) < T * 0.08) continue;
      }
      const b0 = { a, b, v, go: v > T };
      if (v > T) { if (v < T * 2.6) pool.go.push(b0); }
      else if (v === T || v >= T * 0.75) pool.lure.push({ ...b0, lure: true });
      else if (v >= T * 0.3) pool.no.push(b0);
    }
    const uniq = (arr) => { const seen = new Set(); return shuffle(arr).filter((x) => { const key = `${Math.min(x.a, x.b)}x${Math.max(x.a, x.b)}`; if (seen.has(key)) return false; seen.add(key); return true; }); };
    const go = uniq(pool.go).slice(0, 6), lure = uniq(pool.lure).slice(0, 2), no = uniq(pool.no).slice(0, 2);
    if (go.length < 6 || lure.length < 2 || no.length < 2) continue;
    // Never two no-go bubbles at the very start: the pop habit has to form first.
    let list = shuffle([...go, ...lure, ...no]);
    for (let s = 0; s < 50 && (!list[0].go || !list[1].go); s++) list = shuffle(list);
    if (!list[0].go || !list[1].go) continue;
    if (!est && !lure.some((x) => x.v === T)) {
      // Tens × tens can make exactly T; include one "equal" lure when possible (more than, not equal to).
      const eq = [];
      for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) if (a * b * 100 === T) eq.push({ a: a * 10, b: b * 10, v: T, go: false, lure: true });
      if (eq.length) { const i = list.indexOf(lure[0]); list[i] = pick(eq); }
    }
    return { level, T, est, bubbles: list };
  }
  return { level, T: 1000, est: false, bubbles: [] };
}
export function scoreBubbles(round, results) {
  // results[i]: "pop" | "pass"
  let right = 0, popsWrong = 0, missed = 0, lureWrong = 0;
  round.bubbles.forEach((b, i) => {
    const r = results[i];
    if (!r) return;
    if ((r === "pop") === b.go) right++;
    else if (r === "pop") { popsWrong++; if (b.lure) lureWrong++; }
    else missed++;
  });
  return { right, popsWrong, missed, lureWrong, total: round.bubbles.length };
}
export function recordBubbleFocus(focus, round, results, goal) {
  const s = scoreBubbles(round, results), f = focus.bubbles;
  f.rounds++;
  f.go += round.bubbles.filter((b) => b.go).length; f.nogo += round.bubbles.filter((b) => !b.go).length;
  f.hits += round.bubbles.filter((b, i) => b.go && results[i] === "pop").length;
  f.holds += round.bubbles.filter((b, i) => !b.go && results[i] === "pass").length;
  f.popsWrong += s.popsWrong; f.missed += s.missed;
  if (goal) f.goals = [...f.goals, { goal, got: s.right }].slice(-20);
  return s;
}
export const bubbleItem = (round) => ({
  skill: "mult2", level: round.level, answerType: "mission",
  text: `Bubble patrol: pop bubbles worth more than ${fmt(round.T)}. Bubbles: ${round.bubbles.map((b) => `${b.a} × ${b.b}`).join(", ")}`,
  answer: round.bubbles.filter((b) => b.go).map((b) => `${b.a} × ${b.b}`).join(", "),
});

// ══ 🧭 Narwhal Navigator: planning ═════════════════════════════════════════
// Three routes to the trapped narwhal calf, two legs each. A leg costs
// (minutes × oxygen per minute). The tank holds less than `limit`, and exactly one
// route fits. She plans before she dives; once the sub leaves, the route is set.
export function routePuzzle(level) {
  const est = level >= 3;
  for (let t = 0; t < 2000; t++) {
    const limit = est ? pick([1000, 1200, 1500]) : pick([1000, 1200, 1500, 2000]);
    const leg = () => {
      if (est) { let a, b; do { a = rand(11, 29); b = rand(11, 39); } while (a % 10 === 0 || b % 10 === 0); return { a, b, v: a * b, e: roundTo(a, 10) * roundTo(b, 10) }; }
      const a = rand(1, 4) * 10, b = rand(2, 9) * 10; return { a, b, v: a * b, e: a * b };
    };
    const routes = [0, 1, 2].map(() => { const legs = [leg(), leg()]; const total = legs[0].v + legs[1].v, estTotal = legs[0].e + legs[1].e; return { legs, total, estTotal, fits: total < limit }; });
    if (routes.filter((r) => r.fits).length !== 1) continue;
    if (routes.some((r) => Math.abs(r.total - limit) < limit * 0.1 || r.total > limit * 1.8 || r.total < limit * 0.45)) continue;
    if (est && routes.some((r) => (r.estTotal < limit) !== r.fits || Math.abs(r.estTotal - limit) < limit * 0.06)) continue;
    // The fitting route shouldn't be given away by having the smallest first leg.
    const good = routes.find((r) => r.fits);
    if (routes.every((r) => r === good || r.legs[0].v > good.legs[0].v)) continue;
    if (new Set(routes.map((r) => r.total)).size < 3) continue;
    return { level, est, limit, routes, good: routes.indexOf(good) };
  }
  return { level, est: false, limit: 1500, good: 1, routes: [
    { legs: [{ a: 20, b: 40, v: 800, e: 800 }, { a: 30, b: 30, v: 900, e: 900 }], total: 1700, estTotal: 1700, fits: false },
    { legs: [{ a: 30, b: 20, v: 600, e: 600 }, { a: 20, b: 30, v: 600, e: 600 }], total: 1200, estTotal: 1200, fits: true },
    { legs: [{ a: 40, b: 30, v: 1200, e: 1200 }, { a: 10, b: 50, v: 500, e: 500 }], total: 1700, estTotal: 1700, fits: false },
  ] };
}
export const ROUTE_NAMES = ["Kelp Forest", "Octopus Caves", "Jellyfish Drift"];
export const routeItem = (pz) => ({
  skill: "mult2", level: pz.level, answerType: "mission",
  text: `Narwhal route: tank holds less than ${fmt(pz.limit)}. ${pz.routes.map((r, i) => `${ROUTE_NAMES[i]}: ${r.legs.map((l) => `${l.a} × ${l.b}`).join(" + ")}`).join("; ")}`,
  answer: ROUTE_NAMES[pz.good],
});
export function recordPlan(focus, checkedAll, rightFirst) {
  const p = focus.plans;
  p.n++; if (checkedAll) p.checkedFirst++; if (rightFirst) p.rightFirst++;
}

// ── Self-check after a station: how focused did she feel, next to how she did ──
export const RATINGS = [
  { id: "wobbly", label: "Wobbly", emoji: "🐢" },
  { id: "okay", label: "Pretty good", emoji: "🐬" },
  { id: "sharp", label: "Super sharp", emoji: "🦈" },
];
export function addRating(focus, station, rating, score) {
  focus.ratings = [...focus.ratings, { station, rating, score, t: Date.now() }].slice(-40);
}

// ── For grown-ups: a plain summary of the focus practice ──
export function focusSummary(st) {
  const f = st.focus;
  if (!f) return null;
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);
  const m = f.memory, b = f.bubbles, p = f.plans;
  return {
    span: f.span, spanBest: f.spanBest,
    memory: { n: m.n, right: pct(m.right, m.n), mixups: m.mixups, slips: m.slips, peeks: m.peeks },
    bubbles: { rounds: b.rounds, hits: pct(b.hits, b.go), holds: pct(b.holds, b.nogo), popsWrong: b.popsWrong, missed: b.missed, goals: b.goals.slice(-5) },
    plans: { n: p.n, checked: pct(p.checkedFirst, p.n), right: pct(p.rightFirst, p.n) },
    ratings: f.ratings.slice(-6), breaths: f.breaths,
  };
}

// Recording: same learning record as every other mission station.
export const recordOcean = recordMission;
