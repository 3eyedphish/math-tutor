// Spelling: the weekly word list, per-word memory (Leitner boxes), and answer checking.
// Pure functions on the learner state (state.spell), so they run in tests and in the app.

const DAY = 86400000;
// Days until a word comes back, by box. Box 0 = new or just missed.
export const BOX_DAYS = [0, 1, 2, 4, 7];

// This week's list (Unit 4, test Friday 2026-11-20), typed from Stella's sheet.
export const SEED_LIST = {
  id: "2026-u4",
  title: "Unit 4",
  testDate: "2026-11-20",
  words: [
    { w: "Thanksgiving", s: "We eat turkey with our whole family on Thanksgiving.", tip: "Two words stuck together: thanks + giving. Capital T, because it is a holiday." },
    { w: "knowledge", s: "Reading books gives you knowledge about the world.", tip: "know + ledge. Silent k at the start, and a d hides before the ge." },
    { w: "colonialism", s: "Colonialism is when one country takes control of land and people far away.", tip: "colony → colonial + ism. Say it in parts: col-o-ni-al-ism." },
    { w: "fasten", s: "Please fasten your seat belt before the car starts.", tip: "fast + en. The t is silent." },
    { w: "hustle", s: "We had to hustle to catch the school bus.", tip: "hus-tle. The t is silent, and it ends in le." },
    { w: "ghost", s: "The ghost in the story floated through the wall.", tip: "A silent h hides after the g: g-h-ost." },
    { w: "navigation", s: "Sailors used the stars for navigation.", tip: "navigate + ion: drop the e, add ion. nav-i-ga-tion." },
    { w: "monarchy", s: "A monarchy is a country ruled by a king or a queen.", tip: "mon + arch + y. The ch sounds like k." },
    { w: "companies", s: "Trading companies sent ships across the ocean.", tip: "company → change the y to i and add es." },
    { w: "merchant", s: "The merchant sold spices and silk at the market.", tip: "mer-chant. The er sound is spelled er." },
    { w: "conquistador", s: "A conquistador was a Spanish soldier who sailed to the Americas.", tip: "con-quis-ta-dor. The k sound in the middle is spelled qu." },
    { w: "astrolabe", s: "An astrolabe helped sailors measure the stars to find their way.", tip: "astro (star) + labe. as-tro-labe." },
  ],
};

export function freshSpell() {
  return { lists: [SEED_LIST], activeId: SEED_LIST.id, words: {}, log: [] };
}
export function ensureSpell(st) {
  if (!st.spell) st.spell = freshSpell();
  const sp = st.spell;
  sp.lists ||= []; sp.words ||= {}; sp.log ||= [];
  if (!sp.lists.length) { sp.lists.push(SEED_LIST); sp.activeId = SEED_LIST.id; }
  if (!sp.lists.find((l) => l.id === sp.activeId)) sp.activeId = sp.lists[sp.lists.length - 1].id;
  return sp;
}
export const activeList = (st) => { const sp = ensureSpell(st); return sp.lists.find((l) => l.id === sp.activeId); };
const key = (w) => w.toLowerCase();
export function wordRec(st, w) {
  const sp = ensureSpell(st);
  return (sp.words[key(w)] ||= { box: 0, due: 0, right: 0, wrong: 0, seen: 0, misses: [] });
}

// "word | sentence | tip" per line, or just "word". Commas or extra spaces are fine too.
export function parseList(text) {
  const out = []; const seen = new Set();
  for (const raw of String(text).split(/\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.includes("|") ? line.split("|").map((x) => x.trim()) : null;
    const items = parts ? [parts] : line.split(/[,;\t]+/).map((x) => [x.trim()]);
    for (const [w0, s, tip] of items) {
      const w = (w0 || "").replace(/^\d+[.)]\s*/, "").replace(/\s+/g, " ").trim();
      if (!w || !/[a-z]/i.test(w) || seen.has(key(w))) continue;
      seen.add(key(w));
      out.push({ w, s: s || "", tip: tip || "" });
    }
  }
  return out;
}
export const listToText = (list) => list.words.map((x) => [x.w, x.s, x.tip].filter((v, i) => v || i === 0).join(" | ")).join("\n");

// Add (or replace, when the id is the same) a list and make it the active one.
export function saveList(st, { id, title, testDate, words }) {
  const sp = ensureSpell(st);
  const list = { id: id || `l${Date.now()}`, title: title || "Spelling", testDate: testDate || "", words };
  const i = sp.lists.findIndex((l) => l.id === list.id);
  if (i >= 0) sp.lists[i] = list; else sp.lists.push(list);
  sp.activeId = list.id;
  if (sp.lists.length > 12) sp.lists = sp.lists.slice(-12);
  return list;
}

export const sayText = (x) => (x.s ? `${x.w}. ${x.s} ${x.w}.` : `${x.w}.`);

// Compare what she typed with the word. Case only matters for the reminder, not the score.
export function check(word, typed) {
  const t = String(typed || "").trim().replace(/\s+/g, " ");
  const ok = t.toLowerCase() === word.toLowerCase();
  const capNote = ok && t !== word && /^[A-Z]/.test(word) && !/^[A-Z]/.test(t) ? `${word} starts with a capital ${word[0]}.` : "";
  return { ok, typed: t, capNote, diff: ok ? null : diffLetters(word, t) };
}
// Letter-by-letter alignment (edit distance) so the right answer can show which letters she missed.
// Returns [{ch, kind}] over the correct word: "ok" | "miss" (missing or wrong in hers).
export function diffLetters(word, typed) {
  const a = word.toLowerCase(), b = typed.toLowerCase();
  const n = a.length, m = b.length;
  const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  const kinds = Array(n).fill("miss");
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1] && d[i][j] === d[i - 1][j - 1]) { kinds[i - 1] = "ok"; i--; j--; }
    else if (d[i][j] === d[i - 1][j - 1] + 1) { i--; j--; }
    else if (d[i][j] === d[i - 1][j] + 1) i--;
    else j--;
  }
  return word.split("").map((ch, k) => ({ ch, kind: kinds[k] }));
}

// Record a first try. Practice moves boxes; a test only records (and drops misses to box 0).
export function record(st, w, ok, typed, mode, now = Date.now()) {
  const r = wordRec(st, w);
  r.seen++; r.last = now;
  if (ok) { r.right++; r.box = Math.min(BOX_DAYS.length - 1, r.box + 1); }
  else { r.wrong++; r.box = 0; r.misses = [...(r.misses || []), typed].slice(-5); }
  r.due = now + BOX_DAYS[r.box] * DAY;
  const sp = ensureSpell(st);
  sp.log.push({ t: now, w, ok, typed: ok ? undefined : typed, mode });
  if (sp.log.length > 400) sp.log = sp.log.slice(-400);
}

// Order for a practice round: due/weak words first (lowest box, most misses), the rest after, shuffled within ties.
export function practiceOrder(st, list, now = Date.now(), rnd = Math.random) {
  const score = (x) => { const r = wordRec(st, x.w); return (r.due <= now ? 0 : 100) + r.box * 10 - Math.min(r.wrong, 5) + rnd(); };
  return [...list.words].sort((a, b) => score(a) - score(b));
}
export const shuffle = (arr, rnd = Math.random) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// A word counts as "known" for the list once it is in box 2+ (right twice in a row at least).
export function listProgress(st, list) {
  const recs = list.words.map((x) => wordRec(st, x.w));
  return { known: recs.filter((r) => r.box >= 2).length, tried: recs.filter((r) => r.seen).length, total: list.words.length };
}
// The practice queue: a missed word comes back 3 words later, and must be spelled right
// twice in this round (once right after the fix, once later) before it leaves the queue.
export function requeue(queue, item, gap = 3) {
  const q = [...queue];
  q.splice(Math.min(gap, q.length), 0, { ...item, again: true });
  return q;
}
