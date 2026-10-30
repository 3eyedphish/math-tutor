// The learner model: skill levels (targets ~80% correct), spaced repetition,
// and a bandit that learns which teaching approaches work best for this child.
import { SKILLS, SKILL, makeItem, FACT_TABLES } from "./skills.js";
import { APPROACHES, APPROACH } from "./approaches.js";
import { rand } from "./util.js";
import { classifyError } from "./mistakes.js";
import { creditLessonTransfer } from "./lessons.js";
import { studyRanges, clampLevel } from "./units.js";

const START_LEVEL = { doubling: 1, factlinks: 1, shapes: 1, mental: 2, facts: 3, division: 1, rounding: 2, estimate: 1, add: 3, subtract: 3, missing: 1, placevalue: 2, tables: 1, words: 1, area: 1, properties: 1, compare: 1, multiply: 1 };
// The class starts the year on Topic 1; skills from later topics stay off until a grown-up moves this on.
export const DEFAULT_COVERED = 2;
export const topicOn = (s, through) => !s.gym && !s.lab && (!s.topic || s.topic <= through);

export function freshState() {
  return {
    version: 2, name: "", worldId: "unicorn", counter: 0, stars: 0,
    sessionLength: 15, timers: true,
    study: null, // { on, unit, lessons, label, date } — practice only a school unit before a test
    coveredThrough: DEFAULT_COVERED, // the last enVision topic her class has finished
    skills: Object.fromEntries(SKILLS.map((s) => [s.id, { level: START_LEVEL[s.id] || 1, recent: [], seen: 0, correct: 0, lastSeen: -99, focus: topicOn(s, DEFAULT_COVERED) ? "normal" : "off" }])),
    facts: {}, // "7x8" -> weight (higher = needs more practice)
    bandit: { global: {}, bySkill: {} }, // approach -> {a, b}
    pendingTransfer: {}, // skill -> approach used last time (credited by the next result)
    stickers: {}, // worldId -> number earned
    history: [], // recent answers, newest last (capped)
    moods: [],
    mistakes: [], // every miss, with its kind; open ones come back later for a second chance
    lessonBandit: { global: {}, bySkill: {} }, // lesson style -> {a, b}
    pendingLesson: {}, // skill -> lesson waiting to be judged by the next 3 answers
    lessonLog: [],
    gym: freshGym(), // Math Gym: fact fluency (speed + accuracy) and settings
  };
}
// Math Gym: per-fact fluency ("7x12" -> { n, ok, streak, best, last }), the speed goal and the
// tables that get extra reps (12s by default: her known weak spot).
export const freshGym = () => ({ facts: {}, fastMs: 4000, focusTables: [12], sessions: 0, log: [] });
// Older saved states get the newer fields.
export function upgradeState(st) {
  const f = freshState();
  for (const key of ["mistakes", "lessonBandit", "pendingLesson", "lessonLog", "study", "gym"]) if (st[key] === undefined) st[key] = f[key];
  if (st.coveredThrough === undefined) st.coveredThrough = DEFAULT_COVERED;
  for (const s of SKILLS) if (!st.skills[s.id]) st.skills[s.id] = { ...f.skills[s.id], focus: topicOn(s, st.coveredThrough) ? "normal" : "off" };
  return st;
}
// Her class has finished through this topic: switch skills from those topics on, later ones off.
export function setCoveredThrough(st, through) {
  const before = st.coveredThrough ?? DEFAULT_COVERED;
  st.coveredThrough = through;
  for (const s of SKILLS) {
    if (!s.topic) continue;
    const k = st.skills[s.id];
    if (s.topic <= through && (k.focus === "off" || s.topic > before)) k.focus = k.focus === "focus" ? "focus" : "normal";
    if (s.topic > through) k.focus = "off";
  }
  return st;
}
export const mastery = (st, id) => {
  const k = st.skills[id], max = SKILL[id].maxLevel;
  const acc = k.recent.length ? k.recent.reduce((a, b) => a + b, 0) / k.recent.length : 0.5;
  return Math.min(1, (k.level - 1 + acc) / max);
};

// ── Choosing what to practise next ──────────────────────────────────────────
export function chooseSkill(st, recentSkills) {
  const ranges = studyRanges(st);
  const pool = ranges ? SKILLS.filter((s) => ranges[s.id]) : SKILLS.filter((s) => !s.lab && st.skills[s.id].focus !== "off");
  const weights = pool.map((s) => {
    const k = st.skills[s.id];
    if (recentSkills.slice(-2).includes(s.id)) return 0.02; // interleave: avoid back-to-back repeats
    const due = Math.min(1, (st.counter - k.lastSeen) / 25);
    return 0.3 + (1 - mastery(st, s.id)) * 1.2 + due * 0.8 + (k.seen === 0 ? 0.5 : 0) + (k.focus === "focus" ? 1.5 : 0);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i].id; }
  return pool[pool.length - 1].id;
}

// Times-table facts: weaker facts come up more often.
export function makePickFact(st) {
  return (tables) => {
    const facts = [];
    for (const a of tables) for (let b = 1; b <= 12; b++) facts.push([a, b]);
    const w = facts.map(([a, b]) => st.facts[factKey(a, b)] ?? 3);
    let r = Math.random() * w.reduce((x, y) => x + y, 0);
    for (let i = 0; i < facts.length; i++) { r -= w[i]; if (r <= 0) return Math.random() < 0.5 ? facts[i] : [facts[i][1], facts[i][0]]; }
    return facts[0];
  };
}
export const factKey = (a, b) => `${Math.min(a, b)}x${Math.max(a, b)}`;

// Beta sample via two gamma draws (Marsaglia–Tsang).
function gamma(k) {
  if (k < 1) return gamma(k + 1) * Math.random() ** (1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { x = randn(); v = 1 + c * x; } while (v <= 0);
    v = v ** 3;
    const u = Math.random();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
function randn() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
export const betaSample = (a, b) => { const x = gamma(a); return x / (x + gamma(b)); };

const stat = (st, skill, ap) => {
  const g = st.bandit.global[ap] || { a: 0, b: 0 };
  const s = st.bandit.bySkill[skill]?.[ap] || { a: 0, b: 0 };
  // Skill-specific evidence counts fully; evidence from other skills counts half.
  return { a: 1 + s.a + 0.5 * (g.a - s.a), b: 1 + s.b + 0.5 * (g.b - s.b) };
};
export function approachScores(st, skill) {
  return APPROACHES.map((ap) => {
    const { a, b } = stat(st, skill, ap.id);
    return { id: ap.id, mean: a / (a + b), n: a + b - 2 };
  });
}
export function chooseApproach(st, item, recentApproaches) {
  if (item.answerType === "parts") return "direct";
  const options = APPROACHES.filter((a) => a.applies(item));
  if (Math.random() < 0.12) return options[rand(0, options.length - 1)].id; // keep exploring
  let best = null, bestScore = -1;
  for (const ap of options) {
    const { a, b } = stat(st, item.skill, ap.id);
    let score = betaSample(a, b);
    if (recentApproaches.slice(-2).includes(ap.id)) score *= 0.8; // variety keeps it fun
    if (score > bestScore) { bestScore = score; best = ap.id; }
  }
  return best;
}

// A missed question that's due for its second chance, if any.
export function dueReview(st, recentSkills) {
  const ranges = studyRanges(st);
  const allowed = (sk) => !SKILL[sk]?.lab && (ranges ? !!ranges[sk] : st.skills[sk]?.focus !== "off");
  return st.mistakes.find((m) => m.status === "open" && m.dueAt <= st.counter && allowed(m.skill) && !recentSkills.slice(-1).includes(m.skill)) || null;
}
export function reviewItem(st, m, theme) {
  // First comeback: the exact same question. After that: a fresh one of the same kind.
  if (m.snap && !m.variant) return { ...m.snap, reviewOf: m.id };
  const genCtx = { pickFact: makePickFact(st) };
  let base;
  for (let i = 0; i < 20; i++) { base = makeItem(m.skill, m.level, theme, genCtx); if (base.answerType !== "parts") break; }
  return { ...base, approach: "direct", reviewOf: m.id };
}

export function nextItem(st, theme, recentSkills, recentApproaches, boss, forcedSkill) {
  // The boss question at the end of each adventure is always a multi-step data-table problem.
  // In study mode the boss comes from the unit (data tables only if the unit has them).
  const ranges = studyRanges(st);
  const bossSkill = !ranges || ranges.tables ? "tables" : chooseSkill(st, recentSkills);
  const skill = boss ? bossSkill : forcedSkill || chooseSkill(st, recentSkills);
  const genCtx = { pickFact: makePickFact(st) };
  const max = SKILL[skill].maxLevel;
  const level = boss && skill === "tables" ? clampLevel(Math.max(3, st.skills.tables.level), ranges?.tables, max)
    : boss ? (ranges?.[skill]?.[1] || max) : clampLevel(st.skills[skill].level, ranges?.[skill], max);
  const base = makeItem(skill, level, theme, genCtx);
  const approach = boss ? "direct" : chooseApproach(st, base, recentApproaches);
  const item = APPROACH[approach].apply(base, { theme, genCtx });
  return { ...item, approach };
}

// ── Recording a result ──────────────────────────────────────────────────────
function credit(st, skill, ap, reward, weight) {
  const g = (st.bandit.global[ap] ||= { a: 0, b: 0 });
  const s = ((st.bandit.bySkill[skill] ||= {})[ap] ||= { a: 0, b: 0 });
  for (const t of [g, s]) { t.a += weight * reward; t.b += weight * (1 - reward); }
}
// outcome: { correct, firstTry, hintUsed, ms, given }
export function recordResult(st, item, outcome) {
  const k = st.skills[item.skill];
  const success = outcome.correct && outcome.firstTry && !outcome.hintUsed ? 1 : 0;
  const events = { levelUp: false, levelDown: false };
  st.counter++;
  k.seen++; k.correct += outcome.correct ? 1 : 0; k.lastSeen = st.counter;
  // Staircase toward ~80%: 4 clean in a row → up; 2 misses in the last 3 → down.
  // Second-chance questions don't move levels or teaching scores (she has already seen them).
  const isReview = !!item.reviewOf || !!outcome.skipped;
  if (!isReview) k.recent = [...k.recent, success].slice(-5);
  const last4 = k.recent.slice(-4), last3 = k.recent.slice(-3);
  if (isReview) { /* no level change */ }
  else if (last4.length === 4 && last4.every(Boolean) && k.level < SKILL[item.skill].maxLevel) { k.level++; k.recent = []; events.levelUp = true; k.justDropped = false; }
  else if (last3.length === 3 && last3.filter((x) => !x).length >= 2 && k.level > 1) { k.level--; k.recent = []; events.levelDown = true; k.justDropped = true; }
  // Times-table fact weights.
  if (item.fact) {
    const key = factKey(...item.fact), w = st.facts[key] ?? 3;
    st.facts[key] = success ? Math.max(0.5, w * 0.6) : Math.min(10, w * 1.6 + 1);
  }
  // Approach learning. Immediate success counts a little (easier formats inflate it);
  // what really counts is how she does on the NEXT question of the same skill.
  if (isReview) {
    st.history = [...st.history, { t: Date.now(), counter: st.counter, skill: item.skill, level: item.level, approach: item.approach, ok: success, correct: outcome.correct, help: outcome.help?.length ? outcome.help : undefined, skipped: outcome.skipped || undefined, ms: outcome.ms, q: item.text, given: outcome.given, answer: item.answer, review: !!item.reviewOf }].slice(-300);
    events.mistake = logMistake(st, item, outcome);
    return events;
  }
  const immediate = success ? 1 : outcome.correct ? 0.4 : 0;
  const speedBonus = item.timer && outcome.ms < item.timer * 1000 && success ? 0.1 : 0;
  credit(st, item.skill, item.approach, Math.min(1, immediate + speedBonus), 0.4);
  const prev = st.pendingTransfer[item.skill];
  if (prev) credit(st, item.skill, prev, success, 1.0);
  st.pendingTransfer[item.skill] = item.approach;
  if (!outcome.hintUsed) creditLessonTransfer(st, item.skill, success);
  st.history = [...st.history, { t: Date.now(), counter: st.counter, skill: item.skill, level: item.level, approach: item.approach, ok: success, correct: outcome.correct, help: outcome.help?.length ? outcome.help : undefined, ms: outcome.ms, q: item.text, given: outcome.given, answer: item.answer, review: !!item.reviewOf }].slice(-300);
  events.mistake = logMistake(st, item, outcome);
  return events;
}
// How she felt about the last few questions also counts toward the approaches used.
export function recordMood(st, mood) {
  const reward = { happy: 1, ok: 0.6, meh: 0.1 }[mood];
  const recent = st.history.slice(-6);
  for (const h of recent) credit(st, h.skill, h.approach, reward, 0.25);
  st.moods = [...st.moods, { t: Date.now(), mood }].slice(-100);
}

// ── Mistakes: record every miss; bring it back later for a second chance ─────
const snapshot = (item) => {
  if (item.answerType === "parts") return null;
  const keep = ["skill", "level", "approach", "text", "answerType", "answer", "choices", "tiles", "template", "joiner", "shapes", "column", "table", "visual", "showVisual", "example", "hint", "steps", "allowR", "allowDot", "misconceptions", "detectiveShown", "wrong"];
  return JSON.parse(JSON.stringify(Object.fromEntries(keep.filter((k) => item[k] !== undefined).map((k) => [k, item[k]]))));
};
// outcome.miss = { part, given } for the part she got wrong (multi-step problems).
function logMistake(st, item, outcome) {
  const prior = item.reviewOf ? st.mistakes.find((m) => m.id === item.reviewOf) : null;
  // Right on her own: fixed. Right only with help: it comes back so she can try it alone.
  const helped = outcome.correct && outcome.hintUsed;
  if (outcome.correct && !helped) {
    if (prior) { prior.status = "fixed"; prior.fixedAt = Date.now(); prior.snap = null; }
    return null;
  }
  const part = outcome.miss?.part || item;
  const given = helped ? "(right, with help)" : outcome.skipped ? "(skipped)" : outcome.miss?.given ?? outcome.givenRaw;
  const kind = outcome.skipped ? "skipped" : classifyError(part, given);
  const errorType = helped ? "neededHelp" : outcome.skipped ? "skipped" : item.answerType === "parts" && kind === "other" ? "partWrong" : kind;
  if (prior) {
    prior.misses++; prior.variant = true; prior.lastGiven = String(given ?? ""); prior.lastErrorType = errorType;
    prior.counter = st.counter;
    if (prior.misses >= 3) { prior.status = "parked"; prior.snap = null; } else prior.dueAt = st.counter + 8;
    return prior;
  }
  const m = {
    id: `${Date.now()}-${rand(100, 999)}`, t: Date.now(), counter: st.counter,
    skill: item.skill, level: item.level, approach: item.approach,
    q: item.answerType === "parts" ? `${item.text} ${part.text}` : item.text,
    given: Array.isArray(given) ? given.join(", ") : String(given ?? ""),
    answer: Array.isArray(part.answer) ? part.answer.join(", ") : String(part.answer),
    errorType, status: "open", misses: 1, dueAt: st.counter + 4, help: outcome.help?.length ? outcome.help : undefined,
    snap: snapshot(item),
  };
  // Multi-step problems come back as a fresh question of the same skill.
  if (!m.snap) m.variant = true;
  // Keep the log bounded: drop the oldest fixed ones first.
  st.mistakes = [...st.mistakes, m];
  if (st.mistakes.length > 200) {
    const i = st.mistakes.findIndex((x) => x.status !== "open");
    st.mistakes.splice(i >= 0 ? i : 0, 1);
  }
  return m;
}
