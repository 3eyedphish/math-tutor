// Mission mode: math that makes something happen on the ship.
// Puzzles use the same skills and levels as the main game, and every result goes
// through recordResult, so levels, mistakes and "on her own" vs "with help" stay
// in one learning record.
import { makeItem } from "../engine/skills.js";
import { recordResult } from "../engine/learner.js";
import { rand, pick, shuffle, fmt, roundTo } from "../engine/util.js";

// Each mission is one scene with three stations, played in order the first time.
export const MISSIONS = [
  {
    id: "cruiser", title: "Comet Cruiser Rescue", unit: "Unit 2 · Add and subtract", scene: "moon",
    headline: "The Comet Cruiser is stuck!",
    story: (name) => `A meteor shower knocked out the Comet Cruiser on the far side of the Moon. Commander ${name}, your robot co-pilot Bolt can fix almost anything, but Bolt needs your math to do it.`,
    finale: (name) => `Commander ${name} got the Comet Cruiser home. Bolt says it's the best repair job in the galaxy.`,
    doneLabel: "Fixed ✓", allDone: "The ship is fixed! Want to play a station again?",
    stations: [
      { id: "reactor", title: "Power the reactor", emoji: "⚡", skill: "mental", blurb: "Load energy cells until the reactor reads exactly full." },
      { id: "shield", title: "Patch the shield", emoji: "🛡️", skill: "subtract", blurb: "Work out how big the patch must be to close the hole." },
      { id: "gate", title: "Fly through the star gate", emoji: "🌀", skill: "estimate", blurb: "Pick the fuel cell that lands the ship inside the gate." },
    ],
  },
  {
    id: "mars", title: "Supply Run to Mars", unit: "Unit 3 · Multiply by 1-digit numbers", scene: "mars",
    headline: "Mars Base needs supplies!",
    story: (name) => `The explorers at Mars Base are running low on supplies. Commander ${name}, load the Comet Cruiser, keep it balanced, and land it safely. Bolt will help, but the multiplying is up to you.`,
    finale: (name) => `Commander ${name} delivered every crate to Mars Base. The explorers are throwing a pancake party in your honor.`,
    doneLabel: "Done ✓", allDone: "Delivery complete! Want to play a station again?",
    stations: [
      { id: "cargo", title: "Load the cargo bay", emoji: "📦", skill: "multiply", blurb: "Fill each section of the hold with rows of crates." },
      { id: "balance", title: "Balance the ship", emoji: "⚖️", skill: "mental", blurb: "Find the loads that weigh the same as the other side." },
      { id: "land", title: "Land the cargo", emoji: "🛬", skill: "estimate", blurb: "Estimate which loads the lander can carry." },
    ],
  },
  {
    id: "ocean", title: "Deep Sea Rescue", unit: "Unit 4 · Multiply by 2-digit numbers", scene: "ocean",
    buddy: { name: "Pip", kind: "axolotl" }, home: "Sub", rank: "Captain", go: "Dive in 🌊",
    headline: "The Coral Kingdom needs help!",
    story: (name) => `A big storm swirled through the Coral Kingdom. The sea creatures' pearls got scattered, and a baby narwhal is stuck in the kelp. Captain ${name}, take the submarine down. Pip the axolotl will ride along and help, but the multiplying is up to you.`,
    finale: (name) => `Captain ${name} delivered every pearl and brought the baby narwhal home. The whole reef is having a bubble party for you!`,
    doneLabel: "Done ✓", allDone: "The reef is saved! Want to play a station again?",
    focus: true,
    stations: [
      { id: "octo", title: "Octopus messages", emoji: "🐙", skill: "mult2", focusSkill: "Remembering", blurb: "Inky shows the pearl orders, then hides them in ink. Remember them!" },
      { id: "bubbles", title: "Bubble patrol", emoji: "🫧", skill: "mult2", focusSkill: "Stop and think", blurb: "Pop only the bubbles that fit the rule. Let the others float by." },
      { id: "route", title: "Narwhal navigator", emoji: "🧭", skill: "mult2", focusSkill: "Planning ahead", blurb: "Plan a route with enough air to reach the baby narwhal." },
    ],
  },
];
export const MISSION = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));
export const STATIONS = MISSIONS.flatMap((m) => m.stations);
export const STATION = Object.fromEntries(STATIONS.map((s) => [s.id, s]));

// ── Reactor: build an exact total from energy cells (mental math, Lesson 2-1) ──
// Every subset of cells (as a bitmask) that adds up to the target.
export function waysToMake(cells, target) {
  const ways = [];
  for (let m = 1; m < 1 << cells.length; m++) {
    let s = 0;
    for (let i = 0; i < cells.length; i++) if ((m >> i) & 1) s += cells[i];
    if (s === target) ways.push(m);
  }
  return ways;
}
const TIERS = {
  1: { targets: [800, 900, 1000, 1200], step: 100 },
  2: { targets: [1000, 1500, 2000], step: 25 }, // compatible numbers like 375 + 625
  3: { targets: [2500, 3000, 4000, 5000], step: 50 }, // like 1,250 + 1,750
};
export function reactorPuzzle(level) {
  const tier = level <= 2 ? 1 : level === 3 ? 2 : 3;
  const { targets, step } = TIERS[tier];
  for (let t = 0; t < 500; t++) {
    const target = pick(targets);
    const part = () => rand(Math.ceil((target * 0.15) / step), Math.floor((target * 0.85) / step)) * step;
    const a = part(), b = part();
    const cells = [a, target - a, b, target - b];
    if (new Set(cells).size < 4) continue;
    if (tier === 2 && cells.every((c) => c % 100 === 0)) continue; // keep the friendly-number practice
    const d1 = part(), d2 = part();
    const all = [...cells, d1, d2];
    if (new Set(all).size < 6) continue;
    const ways = waysToMake(all, target);
    if (ways.length < 2 || ways.length > 4) continue;
    return { target, cells: shuffle(all), step, tier, level };
  }
  return { target: 1000, cells: shuffle([300, 700, 450, 550, 250, 600]), step: 50, tier: 1, level };
}
export function wayText(cells, mask) {
  return cells.filter((_, i) => (mask >> i) & 1).map(fmt).join(" + ");
}

// ── Shield: find the missing part (subtraction across zeros, Lessons 2-5 to 2-7) ──
// The real subtraction generator; the story frames it as part + ? = whole.
export function shieldItem(level, world) {
  const item = makeItem("subtract", level, world);
  const [whole, part] = item.column.rows;
  return { ...item, whole, part };
}

// ── Star gate: decide with a relationship (estimate, Lesson 2-2) ──
// The gate opens only for a charge MORE than lo and LESS than hi. One cell lands
// inside; one lands on an edge or just outside; one misses by a lot.
const GATE = {
  1: { charge: () => rand(20, 60) * 10, width: 150, cell: () => rand(20, 80) * 5, round: 10 },
  2: { charge: () => rand(1200, 3900), width: 500, cell: () => rand(400, 2400), round: 100 },
  3: { charge: () => rand(12000, 39000), width: 2000, cell: () => rand(3000, 9800), round: 1000 },
};
export function gatePuzzle(level) {
  const tier = Math.min(3, Math.max(1, level));
  const g = GATE[tier];
  for (let t = 0; t < 500; t++) {
    const charge = g.charge();
    const lo = Math.ceil((charge + g.cell()) / g.round) * g.round, hi = lo + g.width;
    const good = rand(lo + 1, hi - 1) - charge;
    if (good <= 0) continue;
    const edgeCase = Math.random() < 0.5;
    const near = edgeCase ? pick([lo, hi]) - charge : (Math.random() < 0.5 ? lo - rand(1, g.width / 3) : hi + rand(1, g.width / 3)) - charge;
    const far = (Math.random() < 0.5 ? hi + rand(g.width, g.width * 3) : lo - rand(g.width, g.width * 2)) - charge;
    const cells = [good, near, far];
    if (cells.some((c) => c <= 0) || new Set(cells).size < 3) continue;
    // Not too easy: cells shouldn't be round numbers at the levels that practise estimating.
    if (tier > 1 && cells.filter((c) => c % 100 === 0).length > 1) continue;
    return { charge, lo, hi, cells: shuffle(cells), good, near, edge: edgeCase, round: g.round, tier, level };
  }
  return { charge: 400, lo: 600, hi: 750, cells: [250, 350, 600], good: 250, near: 350, edge: true, round: 10, tier: 1, level };
}
export const inGate = (pz, cell) => pz.charge + cell > pz.lo && pz.charge + cell < pz.hi;

// ── Recording results in the shared learning record ───────────────────────────
// outcome: { correct (first answer), help: ["hint"|"visual"], ms, given, part }
// Mission-only formats (reactor, gate) can't be replayed in the main game, so a miss
// comes back there as a fresh question of the same skill. The shield is a real
// subtraction item, so a missed one comes back exactly as it was.
export function recordMission(st, station, item, outcome) {
  const help = [...new Set(outcome.help || [])];
  const ev = recordResult(st, { ...item, approach: "mission" }, {
    correct: outcome.correct, firstTry: true, hintUsed: help.length > 0, help, ms: outcome.ms,
    given: JSON.stringify(outcome.given ?? ""), givenRaw: outcome.given,
    miss: outcome.correct ? null : { part: outcome.part || item, given: outcome.given },
  });
  const h = st.history[st.history.length - 1];
  if (h) h.mission = station;
  if (ev.mistake) {
    if (ev.mistake.snap && ev.mistake.snap.answerType !== "mission") ev.mistake.snap.approach = "direct";
    else { ev.mistake.snap = null; ev.mistake.variant = true; }
    ev.mistake.mission = station;
  }
  return { ...ev, support: supportOf(outcome.correct, help) };
}
// How the grown-ups' log describes one result. Hint and picture help can both happen.
export function supportOf(correct, help) {
  if (!correct) return { key: "missed", label: "Missed first try" };
  if (!help.length) return { key: "independent", label: "On her own" };
  const names = { hint: "a hint", visual: "a picture", asked: "a question to the helper", peek: "a second look at the message" };
  return { key: "helped", label: `Right with ${help.map((k) => names[k] || k).join(" and ")}` };
}

// Mission items in the shape recordResult and the Grown-ups log expect.
export const reactorItem = (pz) => {
  const best = waysToMake(pz.cells, pz.target)[0];
  return { skill: "mental", level: pz.level, answerType: "mission", text: `Reactor: make ${fmt(pz.target)} from ${pz.cells.map(fmt).join(", ")}`, answer: wayText(pz.cells, best) };
};
export const gateItem = (pz) => ({
  skill: "estimate", level: pz.level, answerType: "mission",
  text: `Star gate: charge ${fmt(pz.charge)}, gate opens for more than ${fmt(pz.lo)} and less than ${fmt(pz.hi)}. Cells: ${pz.cells.map((c) => "+" + fmt(c)).join(", ")}`,
  answer: `+${fmt(pz.good)}`,
});

// ══ Mission 2: Supply Run to Mars (Unit 3, multiply by 1-digit numbers) ══════

// ── Cargo bay: partial products (Lessons 3-3 to 3-5). A real multiply item from the
// skill generator, always the partial-products form, so a miss replays in the main game.
export function cargoItem(level, world) {
  const lv = Math.max(3, Math.min(5, level));
  for (let i = 0; i < 80; i++) {
    const it = makeItem("multiply", lv, world);
    if (it.answerType === "blanks") return withCargo(it);
  }
  // Build the same shape by hand if the generator kept choosing the other form.
  const a = rand(3, 9), n = rand(102, 989);
  const parts = String(n).split("").map((d, i, arr) => Number(d) * 10 ** (arr.length - 1 - i)).filter((v) => v > 0);
  const prods = parts.map((p) => a * p);
  return withCargo({
    skill: "multiply", level: lv, text: `Use partial products to find ${a} × ${fmt(n)}.`, answerType: "blanks",
    template: [...parts.map((p) => ({ pre: `${a} × ${fmt(p)} = `, label: "?", post: "" })), { pre: "Total = ", label: "?", post: "" }],
    answer: [...prods.map(String), String(a * n)],
    hint: `Break ${fmt(n)} into ${parts.map(fmt).join(" + ")}. Multiply each part by ${a}, then add.`,
    steps: [`${fmt(n)} = ${parts.map(fmt).join(" + ")}`, ...parts.map((p, i) => `${a} × ${fmt(p)} = ${fmt(prods[i])}`), `${prods.map(fmt).join(" + ")} = ${fmt(a * n)}`],
  });
}
function withCargo(it) {
  const m = it.text.match(/find (\d+) × ([\d,]+)/);
  const rows = Number(m[1]), n = Number(m[2].replace(/,/g, ""));
  const parts = String(n).split("").map((d, i, arr) => Number(d) * 10 ** (arr.length - 1 - i)).filter((v) => v > 0);
  return { ...it, rows, n, parts };
}

// ── Balance: multiply by multiples of 10, 100 and 1,000 (Lessons 3-1 and 3-6) ──
// The left pod holds a × m. Two of four loads on offer weigh exactly the same.
const singleDigitTimesPow = (v) => { for (let z = 0; z <= 4; z++) { const d = v / 10 ** z; if (Number.isInteger(d) && d >= 1 && d <= 9) return { d, z }; } return null; };
export function balancePuzzle(level) {
  const maxZ = level <= 2 ? 1 : level === 3 ? 2 : 3;
  for (let t = 0; t < 800; t++) {
    const a = rand(2, 9), b = rand(2, 9), z = rand(1, maxZ), m = b * 10 ** z, target = a * m;
    const same = [];
    for (let c = 2; c <= 9; c++) {
      if (c === a || target % c) continue;
      const f = singleDigitTimesPow(target / c);
      if (f && f.z >= 1) same.push({ c, m: target / c });
    }
    if (same.length < 2) continue;
    const picks = shuffle(same).slice(0, 2);
    const used = new Set([target]);
    const wrongs = [];
    const tryWrong = (c, mm) => { const v = c * mm; if (c >= 2 && c <= 9 && mm >= 10 && mm <= 10000 && !used.has(v) && !wrongs.some((w) => w.c === c && w.m === mm)) { wrongs.push({ c, m: mm }); used.add(v); } };
    const p0 = picks[0];
    tryWrong(p0.c, p0.m / 10); tryWrong(p0.c, p0.m * 10); // a place-value slip
    tryWrong(picks[1].c + 1, picks[1].m); tryWrong(picks[1].c - 1, picks[1].m);
    if (wrongs.length < 2) continue;
    const loads = shuffle([...picks.map((p) => ({ ...p, ok: true })), ...shuffle(wrongs).slice(0, 2).map((w) => ({ ...w, ok: false }))]);
    if (loads.some((l) => l.ok && l.c * l.m !== target) || loads.some((l) => !l.ok && l.c * l.m === target)) continue;
    return { a, m, target, loads, level };
  }
  return { a: 6, m: 400, target: 2400, loads: shuffle([{ c: 3, m: 800, ok: true }, { c: 8, m: 300, ok: true }, { c: 3, m: 80, ok: false }, { c: 4, m: 300, ok: false }]), level };
}
export const balanceItem = (pz) => ({
  skill: "mental", level: pz.level, answerType: "mission",
  text: `Balance: ${pz.a} × ${fmt(pz.m)} on the left. Loads: ${pz.loads.map((l) => `${l.c} × ${fmt(l.m)}`).join(", ")}`,
  answer: pz.loads.filter((l) => l.ok).map((l) => `${l.c} × ${fmt(l.m)}`).join(" or "),
});

// ── Land: estimate products to decide (Lesson 3-2) ──
// The lander carries at most `limit` kg per trip. Each load is "c crates of w kg".
// Exact products sit well away from the limit so rounding always decides it.
export function landPuzzle(level) {
  const big = level >= 2;
  for (let t = 0; t < 800; t++) {
    const limit = big ? pick([2000, 2500, 3000, 4000, 5000]) : pick([200, 300, 400, 500]);
    const loads = [];
    for (let i = 0; i < 3; i++) {
      const c = rand(3, 9), w = big ? rand(110, 980) : rand(21, 98);
      loads.push({ c, w, total: c * w, fits: c * w < limit });
    }
    const place = big ? 100 : 10;
    // Rounding has to give the same verdict as the exact answer, with room to spare.
    if (loads.some((l) => l.total < limit * 0.45 || l.total > limit * 1.7 || Math.abs(l.total - limit) < limit * 0.08 || (l.c * roundTo(l.w, place) < limit) !== l.fits)) continue;
    const nFit = loads.filter((l) => l.fits).length;
    if (nFit === 0 || nFit === 3) continue;
    if (new Set(loads.map((l) => l.total)).size < 3) continue;
    return { limit, loads, place, level };
  }
  return { limit: 3000, loads: [{ c: 4, w: 512, total: 2048, fits: true }, { c: 7, w: 489, total: 3423, fits: false }, { c: 6, w: 398, total: 2388, fits: true }], place: 100, level };
}
export const landItem = (pz) => ({
  skill: "estimate", level: pz.level, answerType: "mission",
  text: `Lander limit ${fmt(pz.limit)} kg. Loads: ${pz.loads.map((l) => `${l.c} × ${fmt(l.w)} kg`).join(", ")}. Which fit?`,
  answer: pz.loads.map((l) => `${l.c} × ${fmt(l.w)}: ${l.fits ? "fits" : "too heavy"}`).join("; "),
});
