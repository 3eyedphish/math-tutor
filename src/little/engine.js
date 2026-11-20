// Little Learner (ages 3–5): preschool math and ABC letters. Everything is spoken, everything is a tap.
// Pure module (no React): units, lessons, question generators and progress. Tested in test/little.test.mjs.
//
// Math follows the usual pre-K progression (Head Start ELOF / pre-K standards leading into
// Kindergarten K.CC, K.MD, K.G): count to 5, count to 10, compare, shapes, patterns, then early
// number sense (quick dots, one more / one less, putting groups together, numbers to 20).
// Letters go through the alphabet four at a time: meet the letter, find it, big and little,
// first sounds, trace it, then a mix; a last unit adds ABC order, first letters and spelling your name.

// ── Helpers ─────────────────────────────────────────────────────────────────
export const pick = (a, rnd = Math.random) => a[Math.floor(rnd() * a.length)];
export const shuffle = (a, rnd = Math.random) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const int = (lo, hi, rnd) => lo + Math.floor(rnd() * (hi - lo + 1));
// n distinct numbers near `answer` within [lo, hi], answer included, shuffled.
export function numChoices(answer, lo, hi, n = 3, rnd = Math.random) {
  const set = new Set([answer]);
  const near = shuffle([answer - 1, answer + 1, answer - 2, answer + 2, answer + 3, answer - 3].filter((x) => x >= lo && x <= hi), rnd);
  for (const x of near) { if (set.size >= n) break; set.add(x); }
  while (set.size < Math.min(n, hi - lo + 1)) set.add(int(lo, hi, rnd));
  return shuffle([...set], rnd);
}
const NUM_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
export const numWord = (n) => NUM_WORDS[n] ?? String(n);

// Things to count. one/many are spoken.
export const THINGS = [
  { e: "🍎", one: "apple", many: "apples" }, { e: "🐶", one: "puppy", many: "puppies" }, { e: "⭐", one: "star", many: "stars" },
  { e: "🐠", one: "fish", many: "fish" }, { e: "🚗", one: "car", many: "cars" }, { e: "🦆", one: "duck", many: "ducks" },
  { e: "🍓", one: "strawberry", many: "strawberries" }, { e: "🎈", one: "balloon", many: "balloons" }, { e: "🐞", one: "ladybug", many: "ladybugs" },
  { e: "🦋", one: "butterfly", many: "butterflies" }, { e: "🍪", one: "cookie", many: "cookies" }, { e: "🐸", one: "frog", many: "frogs" },
  { e: "🌸", one: "flower", many: "flowers" }, { e: "🦖", one: "dinosaur", many: "dinosaurs" }, { e: "🐢", one: "turtle", many: "turtles" },
];
const thingName = (t, n) => (n === 1 ? t.one : t.many);

export const SHAPES = {
  circle: { name: "circle", sides: 0 }, square: { name: "square", sides: 4 }, triangle: { name: "triangle", sides: 3 },
  rectangle: { name: "rectangle", sides: 4 }, star: { name: "star", sides: 10 }, heart: { name: "heart", sides: 0 },
  oval: { name: "oval", sides: 0 }, diamond: { name: "diamond", sides: 4 },
};
export const SHAPE_COLORS = ["#e53935", "#1e88e5", "#43a047", "#fb8c00", "#8e24aa", "#fdd835", "#00acc1", "#ec407a"];

// ── Math question generators ───────────────────────────────────────────────
// Every question: { kind, say (spoken prompt), view, choices, answer, hint }.
// choices: [{ t: "num"|"group"|"shape"|"emoji"|"letter", v, ... }], answer = index into choices.
const withAnswer = (q, choices, isRight) => ({ ...q, choices, answer: choices.findIndex(isRight) });

const G = {
  // Count a group. Tap each thing to count it, then pick the number.
  count({ lo = 1, hi = 5, dots = false }, rnd) {
    const n = int(lo, hi, rnd), t = pick(THINGS, rnd);
    const ch = numChoices(n, Math.max(1, lo - 1), hi + 1, 3, rnd).map((v) => ({ t: "num", v, dots }));
    return withAnswer({ kind: "count", say: `How many ${t.many}? Tap each one to count.`, view: { t: "objects", groups: [{ e: t.e, n }], countable: true }, hint: `Let's count them together. Touch each ${t.one} and say the number.`, reveal: `There are ${numWord(n)} ${thingName(t, n)}.` }, ch, (c) => c.v === n);
  },
  // Tap exactly n things, then the check button.
  show({ lo = 1, hi = 5 }, rnd) {
    const n = int(lo, hi, rnd), t = pick(THINGS, rnd);
    return { kind: "show", say: `Tap ${numWord(n)} ${thingName(t, n)}. Then press the green check.`, view: { t: "tapset", e: t.e, total: Math.max(hi, 5), n }, n, hint: `Count as you tap. Stop at ${numWord(n)}.`, reveal: `${numWord(n)} ${thingName(t, n)}.` };
  },
  // Find a numeral.
  numeral({ lo = 1, hi = 5, n: k = 4 }, rnd) {
    const n = int(lo, hi, rnd);
    const ch = numChoices(n, lo, hi, k, rnd).map((v) => ({ t: "num", v }));
    return withAnswer({ kind: "numeral", say: `Find the number ${numWord(n)}.`, view: null, hint: `${numWord(n)}. Look for the number ${numWord(n)}.`, reveal: `This is ${numWord(n)}.` }, ch, (c) => c.v === n);
  },
  // See a numeral, find the card with that many dots.
  dots({ lo = 1, hi = 10 }, rnd) {
    const n = int(lo, hi, rnd);
    const ch = numChoices(n, Math.max(1, lo), hi, 3, rnd).map((v) => ({ t: "dots", v }));
    return withAnswer({ kind: "dots", say: `This is the number ${numWord(n)}. Find the card with ${numWord(n)} dots.`, view: { t: "numeral", v: n }, hint: `Count the dots on each card.`, reveal: `${numWord(n)} dots.` }, ch, (c) => c.v === n);
  },
  // Number track with a missing number: what comes after k?
  next({ lo = 1, hi = 10 }, rnd) {
    const k = int(lo, hi - 1, rnd), from = Math.max(lo, Math.min(k - 2, hi - 5)), to = Math.min(hi, from + 5);
    const ch = numChoices(k + 1, lo, hi, 3, rnd).map((v) => ({ t: "num", v }));
    return withAnswer({ kind: "next", say: `What number comes after ${numWord(k)}?`, view: { t: "track", from, to, missing: k + 1 }, hint: `Count up: ${numWord(k - 1 >= lo ? k - 1 : k)}, ${numWord(k)}, ... what's next?`, reveal: `After ${numWord(k)} comes ${numWord(k + 1)}.` }, ch, (c) => c.v === k + 1);
  },
  // Two groups: which has more / fewer?
  compare({ word = "more", hi = 6 }, rnd) {
    const t = pick(THINGS, rnd);
    let a = int(1, hi, rnd), b = int(1, hi, rnd);
    while (Math.abs(a - b) < (hi > 6 ? 1 : 2)) { a = int(1, hi, rnd); b = int(1, hi, rnd); }
    const ch = [{ t: "group", e: t.e, n: a }, { t: "group", e: t.e, n: b }];
    const target = word === "more" ? Math.max(a, b) : Math.min(a, b);
    return withAnswer({ kind: "compare", say: `Which group has ${word} ${t.many}?`, view: null, hint: word === "more" ? "More means a bigger number. Count each group." : "Fewer means not as many. Count each group.", reveal: `This group has ${word}.` }, ch, (c) => c.n === target);
  },
  // Same thing, two sizes: which is bigger / smaller?
  size({ word = "bigger" }, rnd) {
    const t = pick(THINGS, rnd);
    const ch = shuffle([{ t: "emoji", v: t.e, scale: 1.6 }, { t: "emoji", v: t.e, scale: 0.75 }], rnd);
    return withAnswer({ kind: "size", say: `Which ${t.one} is ${word}?`, view: null, hint: word === "bigger" ? "Bigger takes up more room." : "Smaller is the little one.", reveal: `This one is ${word}.` }, ch, (c) => (word === "bigger" ? c.scale > 1 : c.scale < 1));
  },
  // Find a shape by name.
  shape({ set }, rnd) {
    const want = pick(set, rnd);
    const others = shuffle(set.filter((s) => s !== want), rnd).slice(0, 2);
    const colors = shuffle(SHAPE_COLORS, rnd);
    const ch = shuffle([want, ...others], rnd).map((v, i) => ({ t: "shape", v, color: colors[i] }));
    return withAnswer({ kind: "shape", say: `Find the ${SHAPES[want].name}.`, view: null, hint: shapeHint(want), reveal: `This is a ${SHAPES[want].name}.` }, ch, (c) => c.v === want);
  },
  // How many sides (straight edges)?
  sides(_, rnd) {
    const want = pick(["triangle", "square", "rectangle"], rnd), n = SHAPES[want].sides;
    const ch = shuffle([3, 4, 5], rnd).map((v) => ({ t: "num", v }));
    return withAnswer({ kind: "sides", say: `How many sides does this ${want} have? Tap each side to count.`, view: { t: "shape", v: want, color: pick(SHAPE_COLORS, rnd), countSides: true }, hint: "A side is a straight line. Touch each one.", reveal: `A ${want} has ${numWord(n)} sides.` }, ch, (c) => c.v === n);
  },
  // What comes next in the pattern?
  pattern({ kinds = ["AB"] }, rnd) {
    const k = pick(kinds, rnd);
    const pool = shuffle(["🍎", "🍌", "🐶", "🐱", "⭐", "🌙", "🔴", "🔵", "🟡", "🟢", "🚗", "🚀", "🌸", "🍀"], rnd);
    const unit = k.split("").map((ch) => pool["ABC".indexOf(ch)]);
    const len = unit.length * 2 + int(1, unit.length, rnd);
    const seq = Array.from({ length: len + 1 }, (_, i) => unit[i % unit.length]);
    const ans = seq[len];
    const opts = shuffle([...new Set([ans, ...unit, pool[3]])].slice(0, 3), rnd);
    const ch = opts.map((v) => ({ t: "emoji", v }));
    return withAnswer({ kind: "pattern", say: "What comes next in the pattern?", view: { t: "pattern", seq: seq.slice(0, len) }, hint: "Say the pattern out loud. What comes next?", reveal: "That keeps the pattern going." }, ch, (c) => c.v === ans);
  },
  // Which one does not belong?
  odd(_, rnd) {
    const sets = [
      { why: "fruit", items: ["🍎", "🍌", "🍇", "🍐", "🍊", "🍓"], odd: ["🚗", "🐶", "⚽", "🧦"] },
      { why: "animals", items: ["🐶", "🐱", "🐰", "🐮", "🐷", "🐸"], odd: ["🍎", "🚂", "⭐", "🎈"] },
      { why: "things that go", items: ["🚗", "🚌", "🚂", "✈️", "🚲", "🚀"], odd: ["🍌", "🐢", "🌸", "🧸"] },
      { why: "red", items: ["🍎", "🍓", "❤️", "🌹", "🚒", "🍒"], odd: ["🍌", "🐸", "💙", "🥦"] },
      { why: "clothes", items: ["🧦", "👕", "👖", "🧢", "👟", "🧤"], odd: ["🍪", "🐵", "🚗", "🌙"] },
    ];
    const s = pick(sets, rnd), odd = pick(s.odd, rnd);
    const ch = shuffle([...shuffle(s.items, rnd).slice(0, 3), odd], rnd).map((v) => ({ t: "emoji", v }));
    return withAnswer({ kind: "odd", say: "Which one does not belong?", view: null, hint: `Three of these go together. They are all ${s.why}.`, reveal: `The others are all ${s.why}.` }, ch, (c) => c.v === odd);
  },
  // Dots flash for a moment: how many? (subitizing)
  flash({ hi = 5 }, rnd) {
    const n = int(1, hi, rnd);
    const ch = numChoices(n, 1, hi, 3, rnd).map((v) => ({ t: "num", v }));
    return withAnswer({ kind: "flash", say: "Quick look! How many dots?", view: { t: "flash", n }, hint: "Look again. Can you see them without counting one by one?", reveal: `${numWord(n)} dots.` }, ch, (c) => c.v === n);
  },
  // n, then one more comes.
  onemore({ hi = 9 }, rnd) {
    const n = int(1, hi, rnd), t = pick(THINGS, rnd);
    const ch = numChoices(n + 1, 1, hi + 1, 3, rnd).map((v) => ({ t: "num", v }));
    return withAnswer({ kind: "onemore", say: `${cap(numWord(n))} ${thingName(t, n)}. One more comes. How many now?`, view: { t: "objects", groups: [{ e: t.e, n }, { e: t.e, n: 1, isNew: true }], op: "+", countable: true }, hint: `One more than ${numWord(n)} is the next number when you count.`, reveal: `${numWord(n)} and one more is ${numWord(n + 1)}.` }, ch, (c) => c.v === n + 1);
  },
  // n, then one goes away.
  oneless({ hi = 10 }, rnd) {
    const n = int(2, hi, rnd), t = pick(THINGS, rnd);
    const ch = numChoices(n - 1, 0, hi, 3, rnd).map((v) => ({ t: "num", v }));
    return withAnswer({ kind: "oneless", say: `${cap(numWord(n))} ${thingName(t, n)}. One goes away. How many are left?`, view: { t: "objects", groups: [{ e: t.e, n, gone: 1 }], countable: true }, hint: "Count the ones that are still here.", reveal: `${numWord(n)} take away one is ${numWord(n - 1)}.` }, ch, (c) => c.v === n - 1);
  },
  // Put two groups together.
  add({ hi = 5 }, rnd) {
    const a = int(1, hi - 1, rnd), b = int(1, hi - a, rnd), t = pick(THINGS, rnd);
    const ch = numChoices(a + b, 1, hi + 1, 3, rnd).map((v) => ({ t: "num", v }));
    return withAnswer({ kind: "add", say: `${cap(numWord(a))} ${thingName(t, a)} and ${numWord(b)} ${thingName(t, b)}. How many altogether?`, view: { t: "objects", groups: [{ e: t.e, n: a }, { e: t.e, n: b }], op: "+", countable: true }, hint: "Count them all, one by one.", reveal: `${numWord(a)} and ${numWord(b)} make ${numWord(a + b)}.` }, ch, (c) => c.v === a + b);
  },
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);
function shapeHint(s) {
  return {
    circle: "A circle is round, like a ball. No corners.", square: "A square has four sides, all the same length.", triangle: "A triangle has three sides and three corners.",
    rectangle: "A rectangle has four sides. Two are long and two are short.", star: "A star has five points.", heart: "A heart is the shape of love.",
    oval: "An oval is round and stretched, like an egg.", diamond: "A diamond is a square standing on its point, like a kite.",
  }[s];
}

// ── Letters ─────────────────────────────────────────────────────────────────
// say: how the voice says the letter's name. A is the quoted capital letter: spelled "ay" it was
// read as "aye" (the sound of I), which confused him. snd: the sound, written for the voice.
// words: pictures that start with the letter (X: end with it).
export const LETTERS = {
  A: { say: '"A"', snd: "ah", words: [["apple", "🍎"], ["ant", "🐜"], ["alligator", "🐊"]] },
  B: { say: "bee", snd: "buh", words: [["ball", "⚽"], ["bear", "🐻"], ["banana", "🍌"], ["bus", "🚌"]] },
  C: { say: "see", snd: "kuh", words: [["cat", "🐱"], ["car", "🚗"], ["cake", "🎂"], ["cow", "🐮"]] },
  D: { say: "dee", snd: "duh", words: [["dog", "🐶"], ["duck", "🦆"], ["dinosaur", "🦕"], ["door", "🚪"]] },
  E: { say: "ee", snd: "eh", words: [["egg", "🥚"], ["elephant", "🐘"], ["envelope", "✉️"]] },
  F: { say: "eff", snd: "fuh", words: [["fish", "🐟"], ["frog", "🐸"], ["fox", "🦊"], ["fire", "🔥"]] },
  G: { say: "gee", snd: "guh", words: [["goat", "🐐"], ["gift", "🎁"], ["grapes", "🍇"], ["gorilla", "🦍"]] },
  H: { say: "aitch", snd: "huh", words: [["hat", "🎩"], ["horse", "🐴"], ["house", "🏠"], ["heart", "❤️"]] },
  I: { say: "eye", snd: "ih", words: [["iguana", "🦎"], ["ice cream", "🍦"], ["island", "🏝️"]] },
  J: { say: "jay", snd: "juh", words: [["juice", "🧃"], ["jeans", "👖"], ["jack-o'-lantern", "🎃"]] },
  K: { say: "kay", snd: "kuh", words: [["kite", "🪁"], ["key", "🔑"], ["kangaroo", "🦘"], ["king", "🤴"]] },
  L: { say: "el", snd: "luh", words: [["lion", "🦁"], ["lemon", "🍋"], ["leaf", "🍃"], ["lollipop", "🍭"]] },
  M: { say: "em", snd: "mmm", words: [["moon", "🌙"], ["monkey", "🐵"], ["mouse", "🐭"], ["milk", "🥛"]] },
  N: { say: "en", snd: "nuh", words: [["nose", "👃"], ["nine", "9️⃣"], ["noodles", "🍜"]] },
  O: { say: "oh", snd: "aw", words: [["octopus", "🐙"], ["otter", "🦦"], ["orange", "🍊"]] },
  P: { say: "pee", snd: "puh", words: [["pig", "🐷"], ["pizza", "🍕"], ["penguin", "🐧"], ["pear", "🍐"]] },
  Q: { say: "cue", snd: "kwuh", words: [["queen", "👸"], ["question mark", "❓"]] },
  R: { say: "are", snd: "ruh", words: [["rabbit", "🐰"], ["rainbow", "🌈"], ["robot", "🤖"], ["rocket", "🚀"]] },
  S: { say: "ess", snd: "sss", words: [["sun", "☀️"], ["snake", "🐍"], ["star", "⭐"], ["sock", "🧦"]] },
  T: { say: "tee", snd: "tuh", words: [["tiger", "🐯"], ["tree", "🌳"], ["turtle", "🐢"], ["train", "🚂"]] },
  U: { say: "you", snd: "uh", words: [["umbrella", "☂️"], ["up", "⬆️"], ["unicorn", "🦄"]] },
  V: { say: "vee", snd: "vuh", words: [["violin", "🎻"], ["volcano", "🌋"], ["van", "🚐"]] },
  W: { say: "double you", snd: "wuh", words: [["whale", "🐳"], ["watermelon", "🍉"], ["worm", "🪱"], ["watch", "⌚"]] },
  X: { say: "ex", snd: "ks", end: true, words: [["fox", "🦊"], ["box", "📦"], ["six", "6️⃣"]] },
  Y: { say: "why", snd: "yuh", words: [["yo-yo", "🪀"], ["yarn", "🧶"], ["yellow", "💛"]] },
  Z: { say: "zee", snd: "zzz", words: [["zebra", "🦓"], ["zero", "0️⃣"], ["zipper mouth", "🤐"]] },
};
export const ABC = Object.keys(LETTERS);
// Letters that look alike (for "big and little") and letters that sound alike (never distractors for each other).
const LOOKALIKE = { b: ["d", "p", "q"], d: ["b", "p", "q"], p: ["q", "b", "d"], q: ["p", "g", "d"], n: ["m", "u", "h"], m: ["n", "w"], u: ["n", "v"], w: ["m", "v"], i: ["l", "j"], l: ["i", "t"], g: ["q", "j"], a: ["e", "o"], e: ["a", "c"], c: ["o", "e"], o: ["c", "a"] };
const SOUNDALIKE = { C: ["K", "Q", "S"], K: ["C", "Q"], Q: ["C", "K"], S: ["C", "Z"], Z: ["S"] };
export const letterSay = (L) => LETTERS[L.toUpperCase()].say;
// How the voice introduces a letter: "B says buh, like ball."
export const soundLine = (L) => { const x = LETTERS[L]; return `${cap(x.say)} says ${x.snd}, like ${x.words[0][0]}.`; };

function otherLetters(L, pool, n, rnd, avoid = []) {
  const bad = new Set([L, ...(SOUNDALIKE[L] || []), ...avoid]);
  const fromPool = shuffle(pool.filter((x) => !bad.has(x)), rnd);
  const rest = shuffle(ABC.filter((x) => !bad.has(x) && !fromPool.includes(x)), rnd);
  return [...fromPool, ...rest].slice(0, n);
}

const LG = {
  // Meet a letter: big and little, its sound, three pictures. No right or wrong.
  meet({ letters, i = 0 }) {
    const L = letters[i % letters.length], x = LETTERS[L];
    return { kind: "meet", letter: L, say: `This is the letter ${x.say}. Big ${x.say}, little ${x.say}. ${soundLine(L)} Tap the pictures!`, view: { t: "meet", letter: L } };
  },
  // Find the letter (big or little).
  find({ letters, lower = false, n = 3 }, rnd) {
    const L = pick(letters, rnd);
    const opts = shuffle([L, ...otherLetters(L, letters, n - 1, rnd)], rnd);
    const ch = opts.map((v) => ({ t: "letter", v: lower ? v.toLowerCase() : v }));
    return withAnswer({ kind: "find", letter: L, say: `Find the ${lower ? "little" : "big"} letter ${LETTERS[L].say}.`, view: null, hint: soundLine(L), reveal: `This is ${lower ? "little" : "big"} ${LETTERS[L].say}.` }, ch, (c) => c.v.toUpperCase() === L);
  },
  // Big letter shown, find its little letter.
  match({ letters }, rnd) {
    const L = pick(letters, rnd), l = L.toLowerCase();
    const look = (LOOKALIKE[l] || []).filter((x) => x !== l);
    const others = [...new Set([...shuffle(look, rnd).slice(0, 1), ...otherLetters(L, letters, 3, rnd).map((x) => x.toLowerCase())])].filter((x) => x !== l).slice(0, 2);
    const ch = shuffle([l, ...others], rnd).map((v) => ({ t: "letter", v }));
    return withAnswer({ kind: "match", letter: L, say: `Here is big ${LETTERS[L].say}. Find little ${LETTERS[L].say}.`, view: { t: "letter", v: L }, hint: `Little ${LETTERS[L].say} looks like this one's little sister.`, reveal: `Big ${LETTERS[L].say}, little ${LETTERS[L].say}.` }, ch, (c) => c.v === l);
  },
  // Which picture starts with this letter's sound?
  sound({ letters }, rnd) {
    const pool = letters.filter((x) => !LETTERS[x].end);
    const L = pick(pool.length ? pool : letters, rnd), x = LETTERS[L];
    const right = pick(x.words, rnd);
    const wrong = otherLetters(L, letters.filter((y) => !LETTERS[y].end), 2, rnd, ["X"]).map((y) => pick(LETTERS[y].words, rnd));
    const ch = shuffle([right, ...wrong], rnd).map(([word, e]) => ({ t: "emoji", v: e, word }));
    const say = x.end ? `Which picture ends with the ${x.snd} sound of ${x.say}?` : `${cap(x.say)} says ${x.snd}. Which picture starts with ${x.snd}?`;
    return withAnswer({ kind: "sound", letter: L, say, view: { t: "letter", v: L, small: true }, hint: `Say each picture's name. Listen for ${x.snd} at the start.`, reveal: `${cap(right[0])} starts with ${x.snd}. ${cap(x.say)}!` }, ch, (c) => c.word === right[0]);
  },
  // A picture: which letter does it start with?
  first({ letters }, rnd) {
    const pool = letters.filter((x) => !LETTERS[x].end);
    const L = pick(pool, rnd), [word, e] = pick(LETTERS[L].words, rnd);
    const ch = shuffle([L, ...otherLetters(L, pool, 2, rnd)], rnd).map((v) => ({ t: "letter", v }));
    return withAnswer({ kind: "first", letter: L, say: `${cap(word)}. What letter does ${word} start with?`, view: { t: "emoji", v: e, word }, hint: `${cap(word)} starts with ${LETTERS[L].snd}.`, reveal: `${cap(word)} starts with ${LETTERS[L].say}.` }, ch, (c) => c.v === L);
  },
  // Trace the letter with a finger.
  trace({ letters, lower = false, i }, rnd) {
    const L = i === undefined ? pick(letters, rnd) : letters[i % letters.length];
    return { kind: "trace", letter: L, glyph: lower ? L.toLowerCase() : L, say: `Trace the ${lower ? "little" : "big"} letter ${LETTERS[L].say} with your finger.`, view: { t: "trace" } };
  },
  // ABC order: what comes after?
  after(_, rnd) {
    const k = int(0, 24, rnd), L = ABC[k + 1];
    const ch = shuffle([L, ...otherLetters(L, [ABC[k + 2], ABC[k - 1]].filter(Boolean), 2, rnd, [ABC[k]])], rnd).map((v) => ({ t: "letter", v }));
    return withAnswer({ kind: "after", letter: L, say: `Sing the ABCs! What letter comes after ${LETTERS[ABC[k]].say}?`, view: { t: "abc", from: Math.max(0, k - 2), at: k + 1 }, hint: "Sing the alphabet song up to there.", reveal: `After ${LETTERS[ABC[k]].say} comes ${LETTERS[L].say}.` }, ch, (c) => c.v === L);
  },
  // Spell your own name by tapping the letters in order.
  name({ name }, rnd) {
    const letters = String(name || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 10).split("");
    if (!letters.length) return null;
    return { kind: "name", say: `Let's spell your name! ${letters.map((x) => LETTERS[x].say).join(", ")}. Tap the letters in order.`, letters, tiles: shuffle(letters.map((v, i) => ({ v, i })), rnd), view: { t: "name" } };
  },
};

// ── Units and lessons ───────────────────────────────────────────────────────
// A lesson is a list of question makers [[generatorName, options], ...]; a round picks from them.
const L5 = 5; // questions per round: short, for a four-year-old's attention
const lesson = (id, title, emoji, makers, extra = {}) => ({ id, title, emoji, makers, len: L5, ...extra });
const SET1 = ["circle", "square", "triangle"], SET2 = [...SET1, "rectangle", "star", "heart"], SET3 = [...SET2, "oval", "diamond"];

export const MATH_UNITS = [
  { id: "m1", title: "Counting to 5", emoji: "🍎", color: "#e53935",
    tip: "Count everyday things out loud together: stairs, grapes on a plate, socks in the wash. Touch each one as you say the number.",
    lessons: [
      lesson("m1-1", "Count 1, 2, 3", "🐣", [["count", { lo: 1, hi: 3, dots: true }]]),
      lesson("m1-2", "Count to 5", "🍎", [["count", { lo: 1, hi: 5, dots: true }]]),
      lesson("m1-3", "Show me", "👆", [["show", { lo: 1, hi: 5 }]]),
      lesson("m1-4", "Find the number", "🔢", [["numeral", { lo: 1, hi: 5, n: 3 }]]),
      lesson("m1-5", "Counting party", "🎉", [["count", { lo: 1, hi: 5 }], ["show", { lo: 2, hi: 5 }], ["numeral", { lo: 1, hi: 5 }]]),
    ] },
  { id: "m2", title: "Counting to 10", emoji: "🐞", color: "#fb8c00",
    tip: "Play 'hide the toys': hide up to 10 small toys and count them as they're found. Point out numbers on doors, buses and clocks.",
    lessons: [
      lesson("m2-1", "Count to 10", "🐞", [["count", { lo: 5, hi: 10 }]]),
      lesson("m2-2", "Numbers to 10", "🔟", [["numeral", { lo: 0, hi: 10, n: 4 }]]),
      lesson("m2-3", "Show me 10", "👆", [["show", { lo: 3, hi: 10 }]]),
      lesson("m2-4", "Number and dots", "🎲", [["dots", { lo: 1, hi: 10 }]]),
      lesson("m2-5", "What comes next?", "➡️", [["next", { lo: 1, hi: 10 }]]),
      lesson("m2-6", "Ten party", "🎉", [["count", { lo: 3, hi: 10 }], ["numeral", { lo: 0, hi: 10 }], ["next", { lo: 1, hi: 10 }], ["dots", { lo: 1, hi: 10 }]]),
    ] },
  { id: "m3", title: "More, fewer, big, small", emoji: "⚖️", color: "#43a047",
    tip: "At snack time ask 'Who has more crackers?' Line toys up from smallest to biggest.",
    lessons: [
      lesson("m3-1", "Which has more?", "➕", [["compare", { word: "more", hi: 6 }]]),
      lesson("m3-2", "Which has fewer?", "➖", [["compare", { word: "fewer", hi: 6 }]]),
      lesson("m3-3", "Big and small", "🐘", [["size", { word: "bigger" }], ["size", { word: "smaller" }]]),
      lesson("m3-4", "Compare party", "🎉", [["compare", { word: "more", hi: 9 }], ["compare", { word: "fewer", hi: 9 }], ["size", { word: "bigger" }], ["size", { word: "smaller" }]]),
    ] },
  { id: "m4", title: "Shapes", emoji: "🔺", color: "#1e88e5",
    tip: "Go on a shape hunt: a round plate, a square window, a triangle sandwich. Draw shapes in sand or with sidewalk chalk.",
    lessons: [
      lesson("m4-1", "Circle, square, triangle", "🔵", [["shape", { set: SET1 }]]),
      lesson("m4-2", "More shapes", "⭐", [["shape", { set: SET2 }]]),
      lesson("m4-3", "Oval and diamond", "🥚", [["shape", { set: SET3 }]]),
      lesson("m4-4", "Count the sides", "📐", [["sides", {}]]),
      lesson("m4-5", "Shape party", "🎉", [["shape", { set: SET3 }], ["sides", {}]]),
    ] },
  { id: "m5", title: "Patterns and sorting", emoji: "🎨", color: "#8e24aa",
    tip: "Make patterns with snacks or blocks (red, blue, red, blue) and ask what comes next. Sort laundry by color or toys by kind.",
    lessons: [
      lesson("m5-1", "AB patterns", "🔴", [["pattern", { kinds: ["AB"] }]]),
      lesson("m5-2", "Trickier patterns", "🌈", [["pattern", { kinds: ["AAB", "ABB", "ABC"] }]]),
      lesson("m5-3", "Which one doesn't belong?", "🤔", [["odd", {}]]),
      lesson("m5-4", "Pattern party", "🎉", [["pattern", { kinds: ["AB", "AAB", "ABB", "ABC"] }], ["odd", {}]]),
    ] },
  { id: "m6", title: "Number fun", emoji: "✨", color: "#00acc1",
    tip: "Roll a die and say the number without counting the dots. Ask 'If one more friend comes, how many will we be?'",
    lessons: [
      lesson("m6-1", "Quick look", "👀", [["flash", { hi: 5 }]]),
      lesson("m6-2", "One more", "➕", [["onemore", { hi: 9 }]]),
      lesson("m6-3", "One less", "🎈", [["oneless", { hi: 10 }]]),
      lesson("m6-4", "Put together", "🤝", [["add", { hi: 5 }]]),
      lesson("m6-5", "Count to 20", "🚀", [["next", { lo: 10, hi: 20 }]]),
      lesson("m6-6", "Number party", "🎉", [["flash", { hi: 6 }], ["onemore", { hi: 9 }], ["oneless", { hi: 10 }], ["add", { hi: 6 }], ["next", { lo: 1, hi: 20 }]]),
    ] },
];

const GROUPS = [["A", "B", "C", "D"], ["E", "F", "G", "H"], ["I", "J", "K", "L"], ["M", "N", "O", "P"], ["Q", "R", "S", "T"], ["U", "V", "W", "X"], ["Y", "Z"]];
const GROUP_COLORS = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#ec407a"];
const GROUP_TIPS = [
  "Point out these letters on signs and cereal boxes. Say the sound, not just the name: 'B says buh, like ball.'",
  "Play 'I spy something that starts with fff'. Let him find a letter on a page in a favorite book.",
  "Make letters with play-dough or with your fingers. Trace them on his back and let him guess.",
  "Sing the ABC song slowly and point to each letter as you sing it.",
  "Write his name and talk about its letters. Which letter is first?",
  "Draw letters in the air with big arm movements before drawing them on paper.",
  "Celebrate finishing the alphabet! Read an ABC book together and find each letter.",
];
export const ABC_UNITS = [
  ...GROUPS.map((g, gi) => {
    const id = `a${gi + 1}`, title = `Letters ${g[0]}${g.length > 2 ? " to " : " and "}${g[g.length - 1]}`;
    const lessons = [
      lesson(`${id}-1`, "Meet the letters", "👋", g.map((_, i) => ["meet", { letters: g, i }]), { len: g.length, ordered: true }),
      lesson(`${id}-2`, "Find the big letter", "🔎", [["find", { letters: g }]]),
      lesson(`${id}-3`, "Big and little", "👫", [["match", { letters: g }], ["find", { letters: g, lower: true }]]),
      lesson(`${id}-4`, "First sounds", "👂", [["sound", { letters: g }]]),
      lesson(`${id}-5`, "Trace the letters", "✍️", g.map((_, i) => ["trace", { letters: g, i }]), { len: g.length, ordered: true }),
      lesson(`${id}-6`, "Letter party", "🎉", [["find", { letters: g }], ["match", { letters: g }], ["sound", { letters: g }], ["find", { letters: g, lower: true }]]),
    ];
    return { id, title, emoji: g.join(""), color: GROUP_COLORS[gi], letters: g, tip: GROUP_TIPS[gi], lessons };
  }),
  { id: "a8", title: "ABC adventures", emoji: "🔤", color: "#00acc1",
    tip: "Ask what sound his favorite things start with. Write a short shopping list together and let him find the first letters.",
    lessons: [
      lesson("a8-1", "My name", "📛", [["name", {}]], { len: 2 }),
      lesson("a8-2", "ABC order", "🎵", [["after", {}]]),
      lesson("a8-3", "First letters", "🅰️", [["first", { letters: ABC }]]),
      lesson("a8-4", "All the little letters", "🔡", [["find", { letters: ABC, lower: true, n: 4 }], ["match", { letters: ABC }]]),
      lesson("a8-5", "Trace little letters", "✏️", [["trace", { letters: ABC, lower: true }]], { len: 4 }),
      lesson("a8-6", "Alphabet party", "🎉", [["find", { letters: ABC, n: 4 }], ["sound", { letters: ABC }], ["first", { letters: ABC }], ["after", {}]]),
    ] },
];
export const SUBJECTS = { math: MATH_UNITS, abc: ABC_UNITS };
export const allLessons = (subject) => SUBJECTS[subject].flatMap((u) => u.lessons.map((l) => ({ ...l, unit: u })));
export const findLesson = (subject, id) => allLessons(subject).find((l) => l.id === id);

// Build a round of questions for a lesson. ctx = { name } (the child's name, for "My name").
export function makeRound(lessonObj, ctx = {}, rnd = Math.random) {
  const gens = { ...G, ...LG };
  const out = [];
  let guard = 0;
  const off = Math.floor(rnd() * lessonObj.makers.length);
  while (out.length < lessonObj.len && guard++ < 60) {
    // Mixed lessons go through their question kinds in turn (shuffled), so every kind shows up.
    const m = lessonObj.makers;
    const [g, opts] = lessonObj.ordered || m.length === 1 ? m[out.length % m.length] : m[(out.length + off) % m.length];
    const q = gens[g]({ ...opts, ...ctx }, rnd);
    if (!q) continue;
    // Don't ask the very same thing twice in a row.
    const last = out[out.length - 1];
    if (last && !lessonObj.ordered && q.kind !== "name" && q.say === last.say && guard < 50) continue;
    out.push(q);
  }
  if (!out.length && lessonObj.makers[0][0] === "name") out.push(...[0, 1].map(() => LG.find({ letters: ABC }, rnd)));
  return out;
}

// Every spoken line a round will need (to fetch the natural voice ahead of time).
export function roundLines(round) {
  const lines = [];
  for (const q of round) {
    lines.push(q.say, q.hint, q.reveal);
    if (q.kind === "meet") { const x = LETTERS[q.letter]; lines.push(...x.words.map((w) => cap(w[0]) + "."), `${cap(x.say)}.`); }
    for (const c of q.choices || []) if (c.word) lines.push(cap(c.word) + ".");
    for (const c of q.choices || []) if (c.t === "num") lines.push(cap(numWord(c.v)) + ".");
  }
  return [...new Set(lines.filter(Boolean))];
}

// ── Progress ────────────────────────────────────────────────────────────────
// state.little = { math: { lessonId: { stars, plays, best, last } }, abc: {...}, stickers: [], log: [], unlockAll }
export const STICKERS = ["🦁", "🐯", "🐻", "🐼", "🐨", "🐸", "🐵", "🦊", "🐰", "🐶", "🐱", "🦄", "🐲", "🦕", "🦖", "🐳", "🐬", "🐙", "🦋", "🐝", "🐞", "🚀", "🚒", "🚜", "🚂", "✈️", "🚁", "⚽", "🏀", "🎸", "🌈", "⭐", "🌻", "🍦", "🍩", "🎂"];
export function ensureLittle(st) {
  if (!st.little) st.little = { math: {}, abc: {}, stickers: [], log: [], unlockAll: false };
  for (const k of ["math", "abc"]) st.little[k] ||= {};
  st.little.stickers ||= []; st.little.log ||= [];
  return st.little;
}
export const isLittle = (st) => st?.stage === "preschool";
export function setStage(st, stage) { st.stage = stage === "preschool" ? "preschool" : "big"; if (st.stage === "preschool") ensureLittle(st); return st; }
export const lessonRec = (st, subject, id) => ensureLittle(st)[subject][id] || { stars: 0, plays: 0, best: 0 };
// Stars for a round from first-try answers: all or all-but-one = 3, at least half = 2, finished = 1.
export function starsFor(firstTry, total) {
  if (!total) return 3;
  if (firstTry >= total - (total >= 4 ? 1 : 0)) return 3;
  if (firstTry * 2 >= total) return 2;
  return 1;
}
// Finish a round: record it, add stars, maybe give a sticker. Returns what was earned.
export function finishLesson(st, subject, id, firstTry, total, now = Date.now(), rnd = Math.random) {
  const lt = ensureLittle(st);
  const prev = lt[subject][id] || { stars: 0, plays: 0, best: 0 };
  const stars = starsFor(firstTry, total);
  const rec = { stars: Math.max(prev.stars, stars), plays: prev.plays + 1, best: Math.max(prev.best || 0, total ? firstTry / total : 1), last: now };
  lt[subject][id] = rec;
  st.stars = (st.stars || 0) + stars;
  const sticker = prev.stars === 0 || stars === 3 ? pick(STICKERS, rnd) : null; // a sticker for a first finish or a perfect round
  if (sticker) lt.stickers = [...lt.stickers, sticker].slice(-200);
  lt.log = [...lt.log, { t: now, subject, id, firstTry, total, stars }].slice(-300);
  return { stars, sticker, first: prev.stars === 0 };
}
// A lesson is open when it's the first one, or the one before it is finished (or a grown-up unlocked all).
export function isOpen(st, subject, id) {
  const lt = ensureLittle(st);
  if (lt.unlockAll) return true;
  const list = allLessons(subject);
  const i = list.findIndex((l) => l.id === id);
  if (i <= 0) return true;
  const prev = list[i - 1];
  // Each unit's first lesson opens once the previous unit's first lesson is done, so a child can
  // move between units (shapes before counting to 10 is fine) without finishing every lesson first.
  if (list[i].unit.lessons[0].id === id) { const pu = SUBJECTS[subject][SUBJECTS[subject].indexOf(list[i].unit) - 1]; return !!lt[subject][pu.lessons[0].id]?.stars; }
  return !!lt[subject][prev.id]?.stars;
}
// The next lesson to play: the first open lesson not yet finished, else the weakest finished one.
export function nextLesson(st, subject) {
  const list = allLessons(subject);
  const lt = ensureLittle(st);
  const todo = list.find((l) => !lt[subject][l.id]?.stars && isOpen(st, subject, l.id));
  if (todo) return todo;
  return [...list].sort((a, b) => (lt[subject][a.id]?.stars || 0) - (lt[subject][b.id]?.stars || 0) || (lt[subject][a.id]?.last || 0) - (lt[subject][b.id]?.last || 0))[0];
}
export function unitProgress(st, subject, unit) {
  const lt = ensureLittle(st);
  const done = unit.lessons.filter((l) => lt[subject][l.id]?.stars).length;
  const stars = unit.lessons.reduce((a, l) => a + (lt[subject][l.id]?.stars || 0), 0);
  return { done, total: unit.lessons.length, stars, max: unit.lessons.length * 3 };
}
