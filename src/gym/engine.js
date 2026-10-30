// Math Gym: short workouts that make fact relationships automatic.
// Reps come from the normal skills (facts, plus the gym skills in engine/gymskills.js)
// and every result goes through recordResult, so mistakes, second chances and the
// times-table heat map stay in one learning record. On top of that the gym tracks
// speed per fact: a fact is "strong" once she answers it right, on her own, under
// the speed goal twice in a row.
import { makeItem, FACT_TABLES } from "../engine/skills.js";
import { recordResult, makePickFact, reviewItem, factKey, freshGym } from "../engine/learner.js";

export const STATIONS = [
  { id: "sprint", title: "Fact Sprint", emoji: "⚡", skill: "facts", blurb: "Times tables, fast. Weak facts and 12s come up most." },
  { id: "links", title: "Fact Links", emoji: "🔗", skill: "factlinks", blurb: "Use a fact you know to find one you don't." },
  { id: "double", title: "Double & Halve", emoji: "✌️", skill: "doubling", blurb: "Doubles, halves and doubling chains." },
  { id: "shapes", title: "Shape Lab", emoji: "🟦", skill: "shapes", blurb: "Arrays, stretching and scaling shapes." },
];
export const STATION = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
export const GYM_SKILL_IDS = ["facts", ...STATIONS.slice(1).map((s) => s.skill)];
export const STATION_OF_SKILL = Object.fromEntries(STATIONS.map((s) => [s.skill, s.id]));

// Today's workout: warm up on facts she knows, then sprints with the other stations in between.
const WORKOUT = ["warm", "warm", "sprint", "links", "sprint", "double", "sprint", "shapes", "sprint", "sprint", "links", "sprint", "double", "sprint", "shapes", "sprint", "links", "sprint"];
export function workoutPlan(kind) {
  if (kind === "workout") return [...WORKOUT];
  return Array(12).fill(kind);
}

export const gymState = (st) => (st.gym ||= freshGym());
export const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const ALL_FACTS = TABLES.flatMap((a) => TABLES.filter((b) => b >= a).map((b) => [a, b])); // 66 facts, 2s–12s

// "strong": right, alone, under the speed goal twice in a row. "learning": seen. "new": not yet.
export function fluency(st, a, b) {
  const e = gymState(st).facts[factKey(a, b)];
  if (!e) return "new";
  return e.streak >= 2 ? "strong" : "learning";
}
export const strongCount = (st) => ALL_FACTS.filter(([a, b]) => fluency(st, a, b) === "strong").length;
export const FACT_COUNT = ALL_FACTS.length;
export const tableStrength = (st, t) => TABLES.filter((b) => fluency(st, t, b) === "strong").length;

// Sprint facts: weaker facts (heat map weight) and focus tables come up more; strong ones less.
export function pickSprintFact(st, recentKeys = [], warm = false) {
  const g = gymState(st);
  let pool = ALL_FACTS;
  if (warm) {
    const strong = ALL_FACTS.filter(([a, b]) => fluency(st, a, b) === "strong");
    pool = strong.length >= 4 ? strong : ALL_FACTS.filter(([a, b]) => [2, 5, 10].includes(a) || [2, 5, 10].includes(b));
  }
  const w = pool.map(([a, b]) => {
    if (recentKeys.slice(-4).includes(factKey(a, b))) return 0.001;
    let x = st.facts[factKey(a, b)] ?? 3;
    if (!warm && (g.focusTables.includes(a) || g.focusTables.includes(b))) x *= 2.5;
    if (!warm && fluency(st, a, b) === "strong") x *= 0.35;
    return x;
  });
  let r = Math.random() * w.reduce((s, v) => s + v, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return Math.random() < 0.5 ? pool[i] : [pool[i][1], pool[i][0]]; }
  return pool[0];
}
// The table group a fact belongs to, so a later "fresh one like it" comes from the same tables.
export const factLevel = (a, b) => {
  for (const lv of [4, 3, 2, 1]) if (FACT_TABLES[lv].includes(a) || FACT_TABLES[lv].includes(b)) return lv;
  return 5;
};
// A strategy that builds each fact from an easier one, so a miss teaches a relationship.
export function strategy(a, b) {
  const p = a * b;
  const [t, n] = [12, 11, 9, 8, 6, 4, 5, 10, 3, 7, 2].map((k) => (a === k ? [a, b] : b === k ? [b, a] : null)).find(Boolean) || [a, b];
  if (t === 10) return { hint: `Times 10: ${n} tens.`, steps: [`${n} tens = ${p}`] };
  if (t === 12) return { hint: `12 × ${n} = 10 × ${n} + 2 × ${n}`, steps: [`10 × ${n} = ${10 * n}`, `2 × ${n} = ${2 * n}`, `${10 * n} + ${2 * n} = ${p}`] };
  if (t === 11) return { hint: `11 × ${n} = 10 × ${n} + ${n}`, steps: [`10 × ${n} = ${10 * n}`, `${10 * n} + ${n} = ${p}`] };
  if (t === 9) return { hint: `9 × ${n} is one ${n} less than 10 × ${n}.`, steps: [`10 × ${n} = ${10 * n}`, `${10 * n} − ${n} = ${p}`] };
  if (t === 5) return { hint: `5 × ${n} is half of 10 × ${n}.`, steps: [`10 × ${n} = ${10 * n}`, `Half of ${10 * n} = ${p}`] };
  if (t === 8 || t === 6 || t === 4) return { hint: `${t} × ${n} is double ${t / 2} × ${n}.`, steps: [`${t / 2} × ${n} = ${(t / 2) * n}`, `Double ${(t / 2) * n} = ${p}`] };
  if (t === 2) return { hint: `2 × ${n} is double ${n}.`, steps: [`${n} + ${n} = ${p}`] };
  if (t === 3) return { hint: `3 × ${n} is double ${n}, plus one more ${n}.`, steps: [`Double ${n} = ${2 * n}`, `${2 * n} + ${n} = ${p}`] };
  return { hint: `7 × ${n} = 5 × ${n} + 2 × ${n}`, steps: [`5 × ${n} = ${5 * n}`, `2 × ${n} = ${2 * n}`, `${5 * n} + ${2 * n} = ${p}`] };
}
export function sprintItem(a, b, theme) {
  const it = makeItem("facts", 1, theme, { pickFact: () => [a, b] }); // level 1 = always the plain "a × b = ?" form
  const { story, ...rest } = it; // eslint-disable-line no-unused-vars
  // 11s and 12s are pictured as 10 + the rest, the way the hint builds them.
  const big = a >= 11 ? a : b >= 11 ? b : 0, other = big === a ? b : a;
  const visual = big ? { kind: "areaSplit", rows: other, cols: big, splits: [10] } : rest.visual;
  return { ...rest, ...strategy(a, b), visual, level: factLevel(a, b), approach: "gym", station: "sprint" };
}

// The next rep for a station.
export function gymItem(st, station, theme, recentKeys = []) {
  if (station === "warm" || station === "sprint") {
    const [a, b] = pickSprintFact(st, recentKeys, station === "warm");
    return sprintItem(a, b, theme);
  }
  const skill = STATION[station].skill;
  for (let i = 0; i < 20; i++) {
    const it = makeItem(skill, st.skills[skill].level, theme, { pickFact: makePickFact(st) });
    if (it.answerType !== "parts") return { ...it, approach: "gym", station };
  }
  return { ...makeItem(skill, 1, theme, {}), approach: "gym", station };
}

// Misses from earlier gym sessions that are due for a second chance.
export function gymDue(st, max = 2) {
  return st.mistakes.filter((m) => m.status === "open" && m.dueAt <= st.counter && GYM_SKILL_IDS.includes(m.skill)).slice(0, max);
}
export function retryItem(st, m, theme) {
  const it = reviewItem(st, m, theme);
  return { ...it, approach: "gym", station: STATION_OF_SKILL[m.skill] || "sprint" };
}

// Record one rep. outcome: { correct, help: [], ms, given }
// Times-table reps don't move the adventure's Times Tables level (the gym has its own
// speed record); the gym skills level up and down like any other skill.
export function recordGym(st, item, outcome) {
  const g = gymState(st);
  const help = [...new Set(outcome.help || [])];
  const helped = help.length > 0;
  const k = st.skills[item.skill];
  const keep = item.skill === "facts" ? { level: k.level, recent: [...k.recent], justDropped: k.justDropped } : null;
  const key = item.fact ? factKey(...item.fact) : null;
  const weightBefore = key ? st.facts[key] ?? 3 : null;
  const ev = recordResult(st, { ...item, approach: "gym" }, {
    correct: outcome.correct, firstTry: true, hintUsed: helped, help, ms: outcome.ms,
    given: JSON.stringify(outcome.given ?? ""), givenRaw: outcome.given,
  });
  if (keep) { Object.assign(k, keep); ev.levelUp = false; ev.levelDown = false; }
  const h = st.history[st.history.length - 1];
  if (h) h.gym = item.station || true;
  const clean = outcome.correct && !helped;
  const fast = clean && !!key && outcome.ms <= g.fastMs; // speed counts for times-table facts only
  let becameStrong = false;
  if (key) {
    const e = (g.facts[key] ||= { n: 0, ok: 0, streak: 0, best: null, last: null });
    const wasStrong = e.streak >= 2;
    e.n++;
    if (clean) { e.ok++; e.last = outcome.ms; e.best = e.best === null ? outcome.ms : Math.min(e.best, outcome.ms); }
    e.streak = fast ? e.streak + 1 : 0;
    becameStrong = !wasStrong && e.streak >= 2;
    // Right but slow still needs practice, so the fact keeps most of its weight.
    if (clean && !fast) st.facts[key] = Math.max(st.facts[key], Math.max(0.5, weightBefore * 0.9));
  }
  if (ev.mistake?.snap) { ev.mistake.snap.approach = "gym"; if (item.fact) ev.mistake.snap.fact = item.fact; }
  return { ...ev, fast, clean, becameStrong };
}

export function finishGym(st, summary) {
  const g = gymState(st);
  g.sessions++;
  g.log = [...g.log, { t: Date.now(), kind: summary.kind, reps: summary.reps, clean: summary.clean, fast: summary.fast, strong: strongCount(st) }].slice(-60);
}
