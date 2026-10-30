// Thinking Lab skills, after the picture languages of CSMP (the 1970s Comprehensive
// School Mathematics Program): the Papy Minicomputer, arrow roads and the string game.
// The problems and pictures here are our own; only the ideas come from CSMP.
// Same item format as skills.js, plus two answer types the Lab draws itself:
//   "mini": she puts checkers on minicomputer boards (response = boards)
//   "sort": she puts each number in a region of the strings (response = region per number)
import { rand, pick, chance, shuffle, cleanWrong, fmt } from "./util.js";

const num = (n) => String(n);

// ── Papy Minicomputer ───────────────────────────────────────────────────────
// One board per place (ones, tens, hundreds, …). Each board has four squares worth
// 8 4 / 2 1 of that place. A board is [ones-square, twos, fours, eights] checker counts.
export const SQ = [1, 2, 4, 8];
export const PLACE = ["ones", "tens", "hundreds", "thousands", "ten thousands", "hundred thousands"];
export const boardDigit = (b) => b.reduce((s, c, i) => s + c * SQ[i], 0);
export const boardsValue = (bs) => bs.reduce((s, b, p) => s + boardDigit(b) * 10 ** p, 0);
export const checkerCount = (bs) => bs.flat().reduce((s, c) => s + c, 0);
export const emptyBoards = (n) => Array.from({ length: n }, () => [0, 0, 0, 0]);
// The usual way to show a digit: at most one checker per square (9 = 8 + 1).
const digitBoard = (d) => SQ.map((v) => (d & v ? 1 : 0));
export function standardBoards(n, nb) {
  return Array.from({ length: nb }, (_, p) => digitBoard(Math.floor(n / 10 ** p) % 10));
}
export const minCheckers = (n) => checkerCount(standardBoards(n, String(n).length));
const parts = (d) => SQ.filter((v) => d & v).reverse();
const digitWords = (d) => (d ? (parts(d).length > 1 ? `${parts(d).join(" + ")} = ${d}` : `${d}`) : "0 (empty)");
// Swap checkers for the same value spread out: one 8 → two 4s, one 4 → two 2s, one 2 → two 1s,
// or one checker on a board's 1-square → 8 + 2 on the board to its right (10 = 8 + 2).
function unTrade(bs) {
  const moves = [];
  bs.forEach((b, p) => {
    for (let i = 1; i < 4; i++) if (b[i] > 0) moves.push(() => { b[i]--; b[i - 1] += 2; });
    if (p > 0 && b[0] > 0) moves.push(() => { b[0]--; bs[p - 1][3]++; bs[p - 1][1]++; });
  });
  if (moves.length) pick(moves)();
  return bs;
}
const placeSteps = (bs) => {
  const lines = [];
  for (let p = bs.length - 1; p >= 0; p--) {
    const d = boardDigit(bs[p]);
    if (!d) continue;
    const pcs = bs[p].flatMap((c, i) => Array(c).fill(SQ[i])).reverse();
    lines.push(`${PLACE[p][0].toUpperCase() + PLACE[p].slice(1)} board: ${pcs.length > 1 ? `${pcs.join(" + ")} = ${d}` : d}${d > 9 ? ` (that's ${Math.floor(d / 10)} ten${d >= 20 ? "s" : ""} and ${d % 10}, so trade!)` : ""}`);
  }
  return lines;
};
const readHint = "Add up each board on its own: the squares are worth 8, 4, 2 and 1. Then put the places together.";
const nbFor = (lv) => (lv === 1 ? 2 : lv <= 3 ? 3 : lv === 4 ? 4 : 6);
const numFor = (nb, small) => (nb === 2 ? rand(11, 99) : nb === 3 ? rand(small ? 101 : 120, 999) : nb === 4 ? rand(1001, 4999) : rand(10001, 999999));

function readItem(n, nb, extra = 0) {
  const bs = standardBoards(n, nb);
  for (let i = 0; i < extra; i++) unTrade(bs);
  const odd = extra > 0;
  const flip = Number(String(n).split("").reverse().join(""));
  return {
    text: odd ? "Some squares have more than one checker. What number is on the minicomputer?" : "What number is on the minicomputer?",
    answerType: "number", answer: num(n), wrong: cleanWrong(n, [flip, n + 10 ** (nb - 1), n - 1, n + 1]), misconceptions: flip !== n ? { [flip]: "readBackwards" } : {},
    hint: odd ? "Two checkers on the same square count twice. Add each board, and if a board makes 10 or more, trade 10 for one checker on the next board." : readHint,
    steps: [...placeSteps(bs), `Together: ${fmt(n)}`],
    visual: { kind: "mini", boards: bs }, showVisual: true, mini: "read",
  };
}
function buildItem(n, nb, fewest) {
  const std = standardBoards(n, nb);
  return {
    text: fewest ? `Show ${fmt(n)} on the minicomputer using as few checkers as you can.` : `Put checkers on the minicomputer to show ${fmt(n)}.`,
    answerType: "mini", answer: num(n), fewest: !!fewest, minCheckers: checkerCount(std),
    hint: fewest ? "One checker per square is the fewest. Build each digit from 8, 4, 2 and 1, biggest first." : "Work one digit at a time. Find its board, then make the digit from 8, 4, 2 and 1.",
    steps: std.map((b, p) => `${PLACE[p]}: ${digitWords(boardDigit(b))}`).reverse(),
    visual: { kind: "mini", boards: emptyBoards(nb), build: true, fewest: !!fewest, min: checkerCount(std) }, showVisual: true, mini: "build",
  };
}
function addItem(nb) {
  const max = 10 ** nb / 2 - 1, lo = 10 ** (nb - 2) * 2;
  const a = rand(lo, max), b = rand(lo, max), s = a + b;
  const A = standardBoards(a, nb), B = standardBoards(b, nb);
  const both = A.map((x, p) => x.map((c, i) => c + B[p][i]));
  const steps = [];
  for (let p = nb - 1; p >= 0; p--) {
    const d = boardDigit(both[p]);
    if (d) steps.push(`${PLACE[p][0].toUpperCase() + PLACE[p].slice(1)} board: ${boardDigit(A[p])} + ${boardDigit(B[p])} = ${d}${d > 9 ? ", trade 10 for one checker on the next board" : ""}`);
  }
  return {
    text: `Red checkers show ${fmt(a)}. Blue checkers show ${fmt(b)}. Put them all together: what number is it?`,
    answerType: "number", answer: num(s), wrong: cleanWrong(s, [s - 10, s + 10, s - 100]),
    hint: "Two checkers on one square make one checker on the next square up. Two 8s make 16: that's one on the next board's 1 and 6 here.",
    steps: [...steps, `${fmt(a)} + ${fmt(b)} = ${fmt(s)}`],
    visual: { kind: "mini", boards: A, boards2: B }, showVisual: true, mini: "add",
  };
}
function doubleItem(nb) {
  const n = rand(10 ** (nb - 1), Math.floor((10 ** nb - 1) / 2));
  const bs = standardBoards(n, nb);
  return {
    text: `This is ${fmt(n)}. Move every checker up one square (1 → 2, 2 → 4, 4 → 8, and an 8 becomes 16). What number do you get?`,
    answerType: "number", answer: num(2 * n), wrong: cleanWrong(2 * n, [n + 2, 2 * n + 10, 2 * n - 10]), misconceptions: { [n + 2]: "addedTwo" },
    hint: "Moving every checker up one square doubles it. So the answer is double the number.",
    steps: [...bs.map((b, p) => `${PLACE[p]}: double ${boardDigit(b)} = ${2 * boardDigit(b)}`).filter((_, p) => boardDigit(bs[p])).reverse(), `Double ${fmt(n)} = ${fmt(2 * n)}`],
    visual: { kind: "mini", boards: bs }, showVisual: true, mini: "double",
  };
}
function tradeItem() {
  const opts = [
    ["Two checkers on the 4-square are the same as one checker on the…", "8-square", "4 + 4 = 8"],
    ["Two checkers on the 2-square are the same as one checker on the…", "4-square", "2 + 2 = 4"],
    ["Two checkers on the 8-square (16) are the same as…", "one on the next board's 1-square, plus 4 and 2", "8 + 8 = 16 = 10 + 4 + 2"],
    ["One checker on the 8-square and one on the 2-square (10) are the same as…", "one checker on the next board's 1-square", "8 + 2 = 10, and 10 ones make 1 ten"],
  ];
  const [q, a, why] = pick(opts);
  const pool = ["8-square", "4-square", "1-square", "one checker on the next board's 1-square", "one on the next board's 1-square, plus 4 and 2", "two checkers on the 8-square"];
  return {
    text: `Minicomputer trade: ${q}`, answerType: "choice", answer: a,
    choices: shuffle([a, ...shuffle(pool.filter((x) => x !== a)).slice(0, 3)]),
    hint: "Add up what the checkers are worth, then find one square that's worth the same.", steps: [why], mini: "trade",
  };
}
export function minicomp(level) {
  const nb = nbFor(level);
  if (level === 1) return chance(0.5) ? readItem(numFor(2), 2) : buildItem(numFor(2), 2);
  if (level === 2) return chance(0.4) ? readItem(numFor(3, true), 3) : chance(0.5) ? buildItem(numFor(3, true), 3) : readItem(numFor(3, true), 3, 1);
  if (level === 3) { const r = Math.random(); return r < 0.45 ? readItem(numFor(3), 3, rand(2, 3)) : r < 0.75 ? addItem(3) : tradeItem(); }
  if (level === 4) { const r = Math.random(); return r < 0.3 ? addItem(4) : r < 0.55 ? doubleItem(3) : r < 0.8 ? buildItem(numFor(4), 4, true) : readItem(numFor(4), 4, rand(2, 4)); }
  const r = Math.random();
  return r < 0.35 ? readItem(numFor(nb), nb, rand(0, 2)) : r < 0.65 ? buildItem(numFor(nb), nb, chance(0.5)) : r < 0.85 ? addItem(5) : doubleItem(4);
}

// ── Arrow roads ─────────────────────────────────────────────────────────────
// Dots are numbers; a coloured arrow is a rule ("+3", "×2") that takes one dot to the next.
// visual: { kind: "arrows", nodes: [{ x, y, label, q }], edges: [{ from, to, color }], legend: [{ color, label }] }
export const RULES = {
  "+": (k) => ({ label: `+${k}`, f: (x) => x + k, back: (y) => y - k, inv: `−${k}` }),
  "−": (k) => ({ label: `−${k}`, f: (x) => x - k, back: (y) => y + k, inv: `+${k}` }),
  "×": (k) => ({ label: `×${k}`, f: (x) => x * k, back: (y) => y / k, inv: `÷${k}` }),
};
const COLORS = ["red", "blue", "green"];
const LETTERS = "ABCDEFG";
function chain(start, rule, n, hide) {
  const vals = [start];
  for (let i = 1; i < n; i++) vals.push(rule.f(vals[i - 1]));
  let li = 0;
  const nodes = vals.map((v, i) => (hide.includes(i) ? { x: i, y: 0, label: LETTERS[li++], q: true } : { x: i, y: 0, label: fmt(v) }));
  const edges = vals.slice(1).map((_, i) => ({ from: i, to: i + 1, color: "red" }));
  return { vals, nodes, edges };
}
function arrowFill(level) {
  const ruleSet = level === 1 ? [["+", rand(2, 12)], ["+", pick([10, 20, 25, 50])], ["−", rand(2, 9)]] : [["×", pick([2, 3, 5])], ["+", pick([15, 25, 99, 101])], ["−", pick([7, 11, 19, 30])]];
  const [op, k] = pick(ruleSet);
  const rule = RULES[op](k);
  const n = 5;
  const start = op === "−" ? rand(k * n + 5, k * n + 60) : op === "×" ? rand(1, k === 2 ? 6 : 3) : rand(1, 60);
  const hide = level === 1 ? shuffle([1, 2, 3, 4]).slice(0, 2).sort() : [0, ...shuffle([2, 3, 4]).slice(0, 1)];
  const { vals, nodes, edges } = chain(start, rule, n, hide);
  const back = hide.includes(0);
  return {
    text: `Every red arrow means ${rule.label}. Find the missing dots.`, answerType: "blanks",
    template: hide.map((i, j) => ({ pre: `${LETTERS[j]} = `, label: "?", post: "" })), answer: hide.map((i) => num(vals[i])),
    hint: back ? `To go backward against a ${rule.label} arrow, do the opposite: ${rule.inv}.` : `Follow the arrows: each dot is ${rule.label} from the dot before it.`,
    steps: hide.map((i, j) => (i === 0 ? `${LETTERS[j]} is one arrow before ${fmt(vals[1])}: ${fmt(vals[1])} ${rule.inv.replace(/^([+−÷×])/, "$1 ")} = ${fmt(vals[0])}` : `${LETTERS[j]} = ${fmt(vals[i - 1])} ${rule.label.replace(/^([+−×])/, "$1 ")} = ${fmt(vals[i])}`)),
    visual: { kind: "arrows", nodes, edges, legend: [{ color: "red", label: rule.label }] }, showVisual: true, arrows: "fill",
  };
}
function arrowRule(level) {
  const [op, k] = pick(level <= 2 ? [["+", rand(3, 12)], ["−", rand(2, 9)], ["×", 2], ["+", 10]] : [["×", pick([2, 3, 4, 5, 10])], ["+", pick([9, 11, 25, 100])], ["−", pick([8, 12, 50])]]);
  const rule = RULES[op](k);
  const start = op === "×" ? rand(1, 4) : op === "−" ? rand(4 * k + 5, 4 * k + 50) : rand(1, 40);
  const { vals, nodes, edges } = chain(start, rule, 4, []);
  const d = vals[1] - vals[0];
  const fakes = [d > 0 ? `+${d + 1}` : `−${-d + 1}`, `×${Math.max(2, Math.round(vals[1] / Math.max(1, vals[0])) + 1)}`, d > 0 ? `−${d}` : `+${-d}`, `+${Math.abs(d) * 2}`, "×2", "+10", "×3", "+5", "−1"];
  return {
    text: "What does the red arrow mean?", answerType: "choice", answer: rule.label,
    choices: shuffle([rule.label, ...shuffle([...new Set(fakes)].filter((x) => x !== rule.label && !vals.slice(1).every((v, i) => ruleOk(x, vals[i], v)))).slice(0, 3)]),
    hint: "Look at how the first dot turns into the second. Then check that the same rule works for every arrow.",
    steps: vals.slice(1).map((v, i) => `${fmt(vals[i])} ${rule.label.replace(/^([+−×])/, "$1 ")} = ${fmt(v)}`),
    visual: { kind: "arrows", nodes, edges, legend: [{ color: "red", label: "?" }] }, showVisual: true, arrows: "rule",
  };
}
const ruleOk = (lab, a, b) => { const m = lab.match(/^([+−×])(\d+)$/); return m ? RULES[m[1]](Number(m[2])).f(a) === b : false; };
// Two colours on one road: follow a path of red and blue arrows.
function arrowPath(level) {
  const pairs = level === 3 ? [[["+", 10], ["−", 1]], [["+", 10], ["+", 1]], [["+", 100], ["−", 10]], [["+", 5], ["−", 2]]] : [[["×", 2], ["+", 1]], [["×", 3], ["−", 2]], [["+", 10], ["×", 2]]];
  const [[o1, k1], [o2, k2]] = pick(pairs);
  const R = RULES[o1](k1), B = RULES[o2](k2);
  if (level === 3 && chance(0.4)) {
    // Composition: red then blue is the same as one arrow.
    const net = (o1 === "+" ? k1 : -k1) + (o2 === "+" ? k2 : -k2);
    const lab = net >= 0 ? `+${net}` : `−${-net}`;
    const start = rand(20, 80);
    const nodes = [{ x: 0, y: 0, label: fmt(start) }, { x: 1, y: 0, label: fmt(R.f(start)) }, { x: 2, y: 0, label: fmt(B.f(R.f(start))) }];
    return {
      text: "A red arrow and then a blue arrow. What ONE arrow goes straight from the first dot to the last?", answerType: "choice", answer: lab,
      choices: shuffle([lab, ...cleanWrong(lab, [`+${k1 + k2}`, `−${Math.abs(net)}`, `+${Math.abs(k1 - k2) + 1}`, `+${k1}`, `−${k1 + k2}`, `+${Math.abs(net) + 1}`, `−${Math.abs(net) + 2}`, `+${k1 * k2}`])]),
      hint: `Do both arrows: ${R.label} then ${B.label}. What's the change altogether?`,
      steps: [`${fmt(start)} ${R.label} = ${fmt(R.f(start))}`, `${fmt(R.f(start))} ${B.label} = ${fmt(B.f(R.f(start)))}`, `Altogether ${fmt(start)} → ${fmt(B.f(R.f(start)))} is ${lab}`],
      visual: { kind: "arrows", nodes, edges: [{ from: 0, to: 1, color: "red" }, { from: 1, to: 2, color: "blue" }, { from: 0, to: 2, color: "green", curve: true }], legend: [{ color: "red", label: R.label }, { color: "blue", label: B.label }, { color: "green", label: "?" }] }, showVisual: true, arrows: "compose",
    };
  }
  const len = rand(3, 4);
  const seq = Array.from({ length: len }, () => (chance(0.5) ? "red" : "blue"));
  if (!seq.includes("red")) seq[0] = "red";
  if (!seq.includes("blue")) seq[len - 1] = "blue";
  let start = o1 === "×" || o2 === "×" ? rand(1, 5) : rand(15, 60);
  const vals = [start];
  for (const c of seq) vals.push((c === "red" ? R : B).f(vals.at(-1)));
  if (vals.some((v) => v < 0)) return arrowFill(2);
  const nodes = vals.map((v, i) => (i === 0 ? { x: 0, y: 0, label: fmt(v) } : { x: i, y: 0, label: i === vals.length - 1 ? "?" : "", q: i === vals.length - 1 }));
  return {
    text: `Start at ${fmt(start)} and follow the arrows. Where do you end up?`, answerType: "number", answer: num(vals.at(-1)),
    wrong: cleanWrong(vals.at(-1), [vals.at(-2), vals.at(-1) + 1, vals.at(-1) - 1]),
    hint: "Take one arrow at a time. Write each dot's number as you go.",
    steps: seq.map((c, i) => `${c === "red" ? "Red" : "Blue"} ${(c === "red" ? R : B).label}: ${fmt(vals[i])} → ${fmt(vals[i + 1])}`),
    visual: { kind: "arrows", nodes, edges: seq.map((c, i) => ({ from: i, to: i + 1, color: c })), legend: [{ color: "red", label: R.label }, { color: "blue", label: B.label }] }, showVisual: true, arrows: "path",
  };
}
// Who am I? One mystery dot with two arrows going out of it (CSMP-style detective clues).
function arrowDetective() {
  const x = rand(3, 12), k = pick([2, 3, 4, 5, 6]), a = rand(3, 15), useMinus = chance(0.4) && x > 3;
  const out1 = x * k, out2 = useMinus ? x - (x > a ? a : 2) : x + a, lab2 = useMinus ? `−${x > a ? a : 2}` : `+${a}`;
  const nodes = [{ x: 0, y: 0.5, label: "?", q: true }, { x: 1.6, y: 0, label: fmt(out1) }, { x: 1.6, y: 1, label: fmt(out2) }];
  return {
    text: "Who am I? Find the mystery dot. Both arrows have to work.", answerType: "number", answer: num(x),
    wrong: cleanWrong(x, [out1 / k + 1, useMinus ? out2 - Number(lab2.slice(1)) : out2 - a + 1, x + 1]),
    hint: `Go backward along one arrow (${`×${k}`} backward is ÷${k}), then check the other arrow.`,
    steps: [`Backward along ×${k}: ${out1} ÷ ${k} = ${x}`, `Check: ${x} ${lab2} = ${out2} ✓`],
    visual: { kind: "arrows", nodes, edges: [{ from: 0, to: 1, color: "red" }, { from: 0, to: 2, color: "blue" }], legend: [{ color: "red", label: `×${k}` }, { color: "blue", label: lab2 }] }, showVisual: true, arrows: "detective",
  };
}
function arrowTimes() {
  const [a, b] = pick([[2, 2], [2, 5], [3, 4], [2, 3], [5, 2], [3, 3], [2, 6], [4, 3]]);
  const lab = `×${a * b}`;
  const start = rand(1, 5);
  const nodes = [{ x: 0, y: 0, label: fmt(start) }, { x: 1, y: 0, label: fmt(start * a) }, { x: 2, y: 0, label: fmt(start * a * b) }];
  return {
    text: `A ×${a} arrow and then a ×${b} arrow. What ONE arrow does the same job?`, answerType: "choice", answer: lab,
    choices: shuffle([lab, ...cleanWrong(lab, [`×${a + b}`, `+${a + b}`, `×${a * b + 1}`, `+${a * b}`, `×${a * b - 1}`, `×${2 * a * b}`])]),
    hint: `Try it on ${start}: ×${a} then ×${b}. How many times bigger did it get?`,
    steps: [`${start} × ${a} = ${start * a}`, `${start * a} × ${b} = ${start * a * b}`, `${start} → ${start * a * b} is ×${a * b}, because ${a} × ${b} = ${a * b}`],
    visual: { kind: "arrows", nodes, edges: [{ from: 0, to: 1, color: "red" }, { from: 1, to: 2, color: "blue" }, { from: 0, to: 2, color: "green", curve: true }], legend: [{ color: "red", label: `×${a}` }, { color: "blue", label: `×${b}` }, { color: "green", label: "?" }] }, showVisual: true, arrows: "compose",
  };
}
export function arrows(level) {
  if (level === 1) return chance(0.65) ? arrowFill(1) : arrowRule(1);
  if (level === 2) return chance(0.5) ? arrowFill(2) : arrowRule(2);
  if (level === 3) return chance(0.7) ? arrowPath(3) : arrowRule(3);
  if (level === 4) { const r = Math.random(); return r < 0.4 ? arrowPath(4) : r < 0.7 ? arrowFill(2) : arrowTimes(); }
  const r = Math.random();
  return r < 0.45 ? arrowDetective() : r < 0.75 ? arrowTimes() : arrowPath(4);
}

// ── The string game ─────────────────────────────────────────────────────────
// Coloured strings (loops) hold the numbers that fit their label; a number can be in
// both loops, one, or neither. Regions: one string "in"/"out"; two strings "a", "b", "ab", "out".
const isPrime = (n) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
const P = {
  even: { label: "even numbers", one: "an even number", t: (n) => n % 2 === 0 },
  odd: { label: "odd numbers", one: "an odd number", t: (n) => n % 2 === 1 },
  m3: { label: "multiples of 3", one: "a multiple of 3", t: (n) => n % 3 === 0 },
  m4: { label: "multiples of 4", one: "a multiple of 4", t: (n) => n % 4 === 0 },
  m5: { label: "multiples of 5", one: "a multiple of 5", t: (n) => n % 5 === 0 },
  m6: { label: "multiples of 6", one: "a multiple of 6", t: (n) => n % 6 === 0 },
  m9: { label: "multiples of 9", one: "a multiple of 9", t: (n) => n % 9 === 0 },
  m10: { label: "multiples of 10", one: "a multiple of 10", t: (n) => n % 10 === 0 },
  lt20: { label: "less than 20", one: "less than 20", t: (n) => n < 20 },
  lt30: { label: "less than 30", one: "less than 30", t: (n) => n < 30 },
  gt50: { label: "more than 50", one: "more than 50", t: (n) => n > 50 },
  f24: { label: "factors of 24", one: "a factor of 24", t: (n) => 24 % n === 0 },
  f36: { label: "factors of 36", one: "a factor of 36", t: (n) => 36 % n === 0 },
  f48: { label: "factors of 48", one: "a factor of 48", t: (n) => 48 % n === 0 },
  prime: { label: "prime numbers", one: "a prime number", t: isPrime },
  square: { label: "square numbers", one: "a square number", t: (n) => Number.isInteger(Math.sqrt(n)) },
};
export const STRING_PREDS = P;
const PAIRS = {
  1: [["even", "lt20"], ["m5", "even"], ["m3", "lt20"], ["odd", "lt20"], ["m10", "m5"]],
  2: [["even", "m3"], ["m5", "odd"], ["m4", "m6"], ["m3", "m5"], ["even", "lt30"]],
  3: [["f24", "even"], ["f36", "odd"], ["m4", "m6"], ["prime", "odd"], ["square", "even"], ["m3", "m9"]],
  4: [["f24", "f36"], ["prime", "lt30"], ["square", "odd"], ["f48", "m3"], ["m6", "m9"], ["prime", "even"]],
};
const ONE = ["even", "odd", "m3", "m5", "m10", "lt20"];
const rangeFor = (lv) => (lv === 1 ? 30 : lv === 2 ? 50 : 60);
export const regionOf = (n, preds) => {
  if (preds.length === 1) return P[preds[0]].t(n) ? "in" : "out";
  const a = P[preds[0]].t(n), b = P[preds[1]].t(n);
  return a && b ? "ab" : a ? "a" : b ? "b" : "out";
};
export const regionName = (r, preds) => ({
  in: `inside the string (${P[preds[0]]?.label})`, out: preds.length === 1 ? "outside the string" : "outside both strings",
  a: `only in red (${P[preds[0]]?.label})`, b: `only in blue (${P[preds[1]]?.label})`, ab: "in both strings",
}[r]);
// Pick numbers so most regions get one.
function pickNumbers(preds, max, n) {
  const byRegion = {};
  for (let x = 1; x <= max; x++) (byRegion[regionOf(x, preds)] ||= []).push(x);
  const regions = shuffle(Object.keys(byRegion));
  const out = new Set();
  for (const r of regions) if (out.size < n) out.add(pick(byRegion[r]));
  let guard = 0;
  while (out.size < n && guard++ < 200) out.add(rand(1, max));
  return shuffle([...out]);
}
const why = (x, preds) => preds.map((p, i) => `${x} is ${P[p].t(x) ? "" : "not "}${P[p].one}${preds.length > 1 ? ` (${i ? "blue" : "red"})` : ""}`).join(", ");
function sortItem(level) {
  const preds = level === 1 && chance(0.4) ? [pick(ONE)] : pick(PAIRS[Math.min(4, level)]);
  const nums = pickNumbers(preds, rangeFor(level), level === 1 ? 5 : 6);
  return {
    text: preds.length === 1 ? `Put each number inside or outside the string.` : `Put each number where it belongs: red string, blue string, both, or outside.`,
    answerType: "sort", choices: nums.map(num), answer: nums.map((x) => regionOf(x, preds)),
    hint: "Take one number at a time. Ask: does it fit the red label? Does it fit the blue label? Yes and yes means the middle.",
    steps: nums.map((x) => `${x}: ${why(x, preds)} → ${regionName(regionOf(x, preds), preds)}`),
    visual: { kind: "strings", preds, labels: preds.map((p) => P[p].label) }, showVisual: true, strings: "sort",
  };
}
// The labels are hidden; the numbers already sit in place. What could the red string be?
function guessItem(level) {
  const pair = pick(PAIRS[Math.min(4, Math.max(2, level))]);
  const nums = pickNumbers(pair, rangeFor(level), 8).map(Number);
  const placed = nums.map((x) => ({ n: x, r: regionOf(x, pair) }));
  const inRed = placed.filter((p) => p.r === "a" || p.r === "ab").map((p) => p.n);
  const outRed = placed.filter((p) => p.r === "b" || p.r === "out").map((p) => p.n);
  const fits = (k) => inRed.every((x) => P[k].t(x)) && outRed.every((x) => !P[k].t(x));
  const wrongs = shuffle(Object.keys(P).filter((k) => k !== pair[0] && k !== pair[1] && !fits(k))).slice(0, 3);
  if (!inRed.length || !outRed.length || wrongs.length < 3) return sortItem(level);
  const answer = P[pair[0]].label;
  return {
    text: `The red string's label fell off! The blue string is ${P[pair[1]].label}. What could the red string be?`,
    answerType: "choice", answer, choices: shuffle([answer, ...wrongs.map((k) => P[k].label)]),
    hint: "Look at the numbers inside red. What do they all have in common that the numbers outside red don't?",
    steps: [`Inside red: ${inRed.join(", ")}`, `Outside red: ${outRed.join(", ")}`, `Every number inside red is one of the ${answer}, and none outside are.`],
    visual: { kind: "strings", preds: pair, labels: ["?", P[pair[1]].label], placed }, showVisual: true, strings: "guess",
  };
}
// Tap every number that belongs in one region.
function pickRegionItem(level) {
  const preds = pick(PAIRS[4]);
  const nums = pickNumbers(preds, 60, 8);
  const target = pick(["ab", "a", "b"]);
  const ans = nums.filter((x) => regionOf(x, preds) === target);
  if (!ans.length) return sortItem(level);
  const ask = { ab: "inside BOTH strings", a: "inside red but NOT inside blue", b: "inside blue but NOT inside red" }[target];
  return {
    text: `Red: ${P[preds[0]].label}. Blue: ${P[preds[1]].label}.\nTap every number that goes ${ask}.`,
    answerType: "multi", choices: nums.map(num), answer: ans.map(num),
    hint: "Check each number against both labels before you tap it.",
    steps: nums.map((x) => `${x}: ${why(x, preds)}${regionOf(x, preds) === target ? " ✓" : ""}`),
    visual: { kind: "strings", preds, labels: preds.map((p) => P[p].label) }, showVisual: true, strings: "pick",
  };
}
export function strings(level) {
  if (level <= 2) return sortItem(level);
  if (level === 3) return chance(0.6) ? sortItem(3) : guessItem(3);
  if (level === 4) { const r = Math.random(); return r < 0.45 ? sortItem(4) : r < 0.75 ? pickRegionItem(4) : guessItem(4); }
  const r = Math.random();
  return r < 0.35 ? guessItem(4) : r < 0.7 ? pickRegionItem(5) : sortItem(4);
}

// lab: true keeps these out of adventures (the Lab draws their pictures and answers).
export const LAB_SKILLS = [
  { id: "minicomp", name: "Minicomputer", emoji: "🟫", maxLevel: 5, gen: minicomp, lab: true },
  { id: "arrows", name: "Arrow Roads", emoji: "🏹", maxLevel: 5, gen: arrows, lab: true },
  { id: "strings", name: "String Game", emoji: "🧶", maxLevel: 5, gen: strings, lab: true },
];
