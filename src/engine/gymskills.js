// Math Gym skills: the fact relationships that make times tables automatic.
// Doubling and halving, linking a hard fact to easy ones, and shapes that show
// why it works (area models, stretching and scaling, ratios).
// Same item format as skills.js, so lessons, mistakes and reviews all work.
import { rand, pick, chance, shuffle, cleanWrong } from "./util.js";

const num = (n) => String(n);
// Hard facts first: 12s, then 6s–9s, then the rest.
const factorPick = () => pick([12, 12, 12, 11, 9, 8, 7, 6, 4, 3]);

// ── Double & halve ──────────────────────────────────────────────────────────
// Splitting into tens and ones keeps big doubles mental: double 36 = 60 + 12.
const splitSteps = (n, op) => {
  const t = n - (n % 10), o = n % 10;
  if (!t || !o) return [];
  return op === "double"
    ? [`Double ${t} = ${2 * t}`, `Double ${o} = ${2 * o}`, `${2 * t} + ${2 * o} = ${2 * n}`]
    : [`Half of ${t} = ${t / 2}`, `Half of ${o} = ${o / 2}`, `${t / 2} + ${o / 2} = ${n / 2}`];
};
function doubleOrHalf(n, half) {
  if (half) {
    const m = 2 * n; // ask for half of m (always even)
    return { text: `Half of ${m} = ?`, answerType: "number", answer: num(n), wrong: cleanWrong(n, [2 * m, n + 1, n - 1, m - 2]), misconceptions: { [2 * m]: "doubledNotHalved" }, hint: `Half means split into 2 equal parts. What doubles to make ${m}?`, steps: [...(m % 10 && m > 20 && (m % 10) % 2 === 0 ? splitSteps(m, "half") : [`${n} + ${n} = ${m}`]), `Half of ${m} is ${n}`], visual: n <= 12 ? { kind: "array", rows: 2, cols: n } : undefined, story: (t) => `${t.hero} shares ${m} ${t.things} equally with a friend. How many does each get?`, mental: true };
  }
  return { text: `Double ${n} = ?`, answerType: "number", answer: num(2 * n), wrong: cleanWrong(2 * n, [n + 2, 2 * n + 1, 2 * n - 1, 2 * n + 10]), misconceptions: { [n + 2]: "addedTwo" }, hint: n > 10 ? `Double the tens, double the ones, then add.` : `Double means add it to itself: ${n} + ${n}.`, steps: [...splitSteps(n, "double"), `Double ${n} = ${n} + ${n} = ${2 * n}`], visual: n <= 12 ? { kind: "array", rows: 2, cols: n } : undefined, story: (t) => `${t.hero} has ${n} ${t.things}, then gets the same number again. How many now?`, mental: true };
}
function doubling(level) {
  if (level === 1) return doubleOrHalf(rand(2, 20), chance(0.4));
  if (level === 2) return doubleOrHalf(rand(13, 49), chance(0.45));
  if (level === 3) {
    // A doubling chain builds the hard tables: 2s → 4s → 8s, or 3s → 6s → 12s.
    const n = rand(3, 12), start = chance(0.5) ? 3 : 2;
    const t = [start, 2 * start, 4 * start];
    const tmpl = [
      { pre: `${t[0]} × ${n} = `, label: "?", post: "" },
      { pre: `Double it: ${t[1]} × ${n} = `, label: "?", post: "" },
      { pre: `Double again: ${t[2]} × ${n} = `, label: "?", post: "" },
    ];
    return { text: `Doubling chain: each line is double the line before.`, answerType: "blanks", template: tmpl, answer: t.map((k) => num(k * n)), hint: `Start with the easy fact, then double it twice.`, steps: [`${t[0]} × ${n} = ${t[0] * n}`, `Double ${t[0] * n} = ${t[1] * n}, so ${t[1]} × ${n} = ${t[1] * n}`, `Double ${t[1] * n} = ${t[2] * n}, so ${t[2]} × ${n} = ${t[2] * n}`], visual: { kind: "areaSplit", rows: n, cols: t[2], splits: [t[1]] } };
  }
  if (level === 4) {
    const half = chance(0.45);
    const n = half ? rand(51, 499) : rand(105, 499);
    const m = 2 * n;
    const parts = (x) => [x - (x % 100), x % 100 - (x % 10), x % 10].filter(Boolean);
    if (half) return { text: `Half of ${m} = ?`, answerType: "number", answer: num(n), wrong: cleanWrong(n, [2 * m, n + 10, n - 10, n + 50]), misconceptions: { [2 * m]: "doubledNotHalved" }, hint: `Split ${m} into friendly parts and halve each one.`, steps: [`${m} = ${parts(m).join(" + ")}`, `Halves: ${parts(m).map((p) => p / 2).join(" + ")} = ${n}`], mental: true };
    return { text: `Double ${n} = ?`, answerType: "number", answer: num(m), wrong: cleanWrong(m, [m + 100, m - 10, m + 10, n + 2]), misconceptions: { [n + 2]: "addedTwo" }, hint: `Double the hundreds, the tens and the ones, then add.`, steps: [`${n} = ${parts(n).join(" + ")}`, `Doubles: ${parts(n).map((p) => 2 * p).join(" + ")} = ${m}`], mental: true };
  }
  // Level 5: double one factor, halve the other. The product stays the same.
  if (chance(0.5)) {
    const a = 2 * rand(6, 24);
    return { text: `Halve one number, double the other.`, answerType: "blanks", template: [{ pre: `${a} × 5 = `, label: "?", post: " × 10" }, { pre: "= ", label: "?", post: "" }], answer: [num(a / 2), num(a * 5)], hint: `Half of ${a} is ${a / 2}. Double 5 is 10.`, steps: [`Half of ${a} = ${a / 2}, double 5 = 10`, `${a / 2} × 10 = ${a * 5}`] };
  }
  const a = 4 * rand(3, 12);
  return { text: `Halve and double twice to reach 100.`, answerType: "blanks", template: [{ pre: `${a} × 25 = `, label: "?", post: " × 50" }, { pre: "= ", label: "?", post: " × 100" }, { pre: "= ", label: "?", post: "" }], answer: [num(a / 2), num(a / 4), num(a * 25)], hint: `Halve ${a}, double 25. Then do it again.`, steps: [`${a} × 25 = ${a / 2} × 50`, `${a / 2} × 50 = ${a / 4} × 100`, `${a / 4} × 100 = ${a * 25}`] };
}

// ── Fact links: use a fact you know to find one you don't ───────────────────
function factLinks(level, theme, ctx) {
  if (level === 1) {
    // 12 = 10 + 2, 11 = 10 + 1, 9 = 10 − 1.
    const t = pick([12, 12, 12, 11, 9]), n = rand(3, 12);
    if (t === 9) return { text: `Use 10 × ${n} to find 9 × ${n}.`, answerType: "blanks", template: [{ pre: `10 × ${n} = `, label: "?", post: "" }, { pre: `9 × ${n} = ${10 * n} − ${n} = `, label: "?", post: "" }], answer: [num(10 * n), num(9 * n)], hint: `9 groups is one group less than 10 groups.`, steps: [`10 × ${n} = ${10 * n}`, `Take away one ${n}: ${10 * n} − ${n} = ${9 * n}`], visual: { kind: "areaSplit", rows: n, cols: 10, splits: [9] } };
    const extra = t - 10;
    return { text: `Split ${t} into 10 and ${extra} to find ${t} × ${n}.`, answerType: "blanks", template: [{ pre: `10 × ${n} = `, label: "?", post: "" }, { pre: `${extra} × ${n} = `, label: "?", post: "" }, { pre: `${t} × ${n} = `, label: "?", post: "" }], answer: [num(10 * n), num(extra * n), num(t * n)], hint: `${t} × ${n} is 10 × ${n} plus ${extra} × ${n}.`, steps: [`10 × ${n} = ${10 * n}`, `${extra} × ${n} = ${extra * n}`, `${10 * n} + ${extra * n} = ${t * n}`], visual: { kind: "areaSplit", rows: n, cols: t, splits: [10] } };
  }
  if (level === 2) {
    // One more group, or one less group.
    const a = rand(3, 11), b = factorPick(), more = chance(0.5) || a === 3;
    const k = more ? a + 1 : a - 1, ans = k * b;
    const mis = {};
    for (const [v, type] of [[a * b + a, "addedWrongGroup"], [a * b - a, "addedWrongGroup"], [a * b + 1, "addedOne"], [a * b - 1, "addedOne"]]) if (v !== ans && mis[v] === undefined) mis[v] = type;
    return { text: `${a} × ${b} = ${a * b}.\nSo ${k} × ${b} = ?`, answerType: "number", answer: num(ans), wrong: cleanWrong(ans, [more ? a * b + a : a * b - a, more ? a * b + 1 : a * b - 1, ans + b]), misconceptions: mis, hint: more ? `${k} groups of ${b} is one more ${b} than ${a} groups.` : `${k} groups of ${b} is one ${b} less than ${a} groups.`, steps: [`${a} × ${b} = ${a * b}`, more ? `Add one more ${b}: ${a * b} + ${b} = ${ans}` : `Take away one ${b}: ${a * b} − ${b} = ${ans}`], visual: { kind: "areaSplit", rows: b, cols: Math.max(a, k), splits: [Math.min(a, k)] } };
  }
  if (level === 3) {
    // The same three numbers, four facts.
    let [a, b] = [factorPick(), rand(3, 12)];
    for (let i = 0; i < 10 && ctx?.pickFact; i++) { const f = ctx.pickFact([12, 11, 9, 8, 7, 6]); if (Math.min(...f) >= 2) { [a, b] = f; break; } }
    const p = a * b;
    if (chance(0.5)) return { fact: [a, b], text: `${p} ÷ ${a} = ?`, answerType: "number", answer: num(b), wrong: cleanWrong(b, [b + 1, b - 1, a]), hint: `Think: ${a} × what = ${p}?`, steps: [`${a} × ${b} = ${p}`, `So ${p} ÷ ${a} = ${b}`], visual: { kind: "array", rows: a, cols: b }, mental: true };
    return { fact: [a, b], text: `${a} × ? = ${p}`, answerType: "number", answer: num(b), wrong: cleanWrong(b, [b + 1, b - 1, p - a]), hint: `Skip count by ${a}s to ${p}, or use ${p} ÷ ${a}.`, steps: [`${a} × ${b} = ${p}`, `${b} × ${a} = ${p} too (turn it around)`], visual: { kind: "array", rows: a, cols: b }, mental: true };
  }
  // Level 4: a fact times 10 or 100.
  const a = factorPick(), b = rand(3, 9), scale = pick([10, 10, 100]);
  const p = a * b, ans = p * scale;
  return { text: `${a} × ${b} = ${p}.\nSo ${a} × ${b * scale} = ?`, answerType: "number", answer: num(ans), wrong: cleanWrong(ans, [ans * 10, ans / 10, p + scale]), hint: `${b * scale} is ${b} × ${scale}. So the answer is ${p} × ${scale}.`, steps: [`${a} × ${b * scale} = ${a} × ${b} × ${scale}`, `${p} × ${scale} = ${ans}`] };
}

// ── Shape lab: arrays, area models, stretching and scaling ──────────────────
function shapeLab(level, theme) {
  if (level === 1) {
    // Count squares fast by multiplying, with the 10 + extra split shown.
    // The split shows a fact she knows inside the one she's learning: 12 = 10 + 2, 8 = 4 + 4, 7 = 5 + 2.
    const w = pick([12, 12, 11, 9, 8, 7, 6]), h = rand(3, 9);
    const cut = w > 10 ? 10 : w % 2 === 0 ? w / 2 : 5, rest = w - cut;
    const splits = [cut];
    const how = rest === cut ? `${w} is double ${cut}: ${cut} × ${h} = ${cut * h}, double it.` : `Do the ${cut} columns and the ${rest} columns, then add.`;
    return { text: `How many squares in this ${w} by ${h} rectangle?`, answerType: "number", answer: num(w * h), wrong: cleanWrong(w * h, [2 * (w + h), w + h, w * h + h]), misconceptions: { [2 * (w + h)]: "areaPerimeter", [w + h]: "wrongOperation" }, hint: how, steps: [`${cut} × ${h} = ${cut * h}`, `${rest} × ${h} = ${rest * h}`, rest === cut ? `Double ${cut * h} = ${w * h}` : `${cut * h} + ${rest * h} = ${w * h}`], visual: { kind: "areaSplit", rows: h, cols: w, splits }, showVisual: true, story: (t) => `${t.hero} tiles a floor ${w} tiles long and ${h} tiles wide. How many tiles?` };
  }
  if (level === 2) {
    // Stretch one side: the area grows by the same factor.
    const k = pick([2, 2, 3, 4]), h = rand(2, 6), w = rand(2, Math.floor(12 / k));
    const area = w * h, big = w * k * h;
    if (chance(0.35)) return { text: `The ${w} by ${h} rectangle is stretched to be ${k} times as long. How many times as many squares does it have now?`, answerType: "number", answer: num(k), wrong: cleanWrong(k, [k * k, k + 1, big]), misconceptions: { [k * k]: "scaledBothSides" }, hint: `Only one side got longer.`, steps: [`Before: ${w} × ${h} = ${area}`, `After: ${w * k} × ${h} = ${big}`, `${big} is ${k} times ${area}`], visual: { kind: "scale", w, h, kw: k, kh: 1 }, showVisual: true };
    return { text: `This ${w} by ${h} rectangle has ${area} squares. Stretch it to be ${k} times as long. How many squares now?`, answerType: "number", answer: num(big), wrong: cleanWrong(big, [area + k, big * h, area * k * k, (w + k) * h]), misconceptions: { [area * k * k]: "scaledBothSides", [(w + k) * h]: "addedNotScaled" }, hint: `The new rectangle is ${w * k} by ${h}.`, steps: [`New size: ${w * k} by ${h}`, `${w * k} × ${h} = ${big}`, `That's ${k} × ${area}`], visual: { kind: "scale", w, h, kw: k, kh: 1 }, showVisual: true };
  }
  if (level === 3) {
    // Scale both sides: the area grows by k × k.
    const k = pick([2, 2, 3]), w = rand(1, Math.floor(12 / k)), h = rand(2, Math.floor(12 / k));
    const area = w * h, big = area * k * k;
    if (chance(0.4)) return { text: `Both sides of the small rectangle are ${k} times as long in the big one. How many small rectangles fit inside the big one?`, answerType: "number", answer: num(k * k), wrong: cleanWrong(k * k, [k, 2 * k, k * k + 1, 2 * k * k]), misconceptions: { [k]: "scaledOneSide", [2 * k]: "addedNotScaled" }, hint: `${k} across and ${k} down.`, steps: [`${k} small rectangles fit across, ${k} fit down`, `${k} × ${k} = ${k * k}`], visual: { kind: "scale", w, h, kw: k, kh: k }, showVisual: true };
    return { text: `The small rectangle is ${w} by ${h}. The big one has sides ${k} times as long. How many squares in the big one?`, answerType: "number", answer: num(big), wrong: cleanWrong(big, [area * k, big + k, (w + k) * (h + k)]), misconceptions: { [area * k]: "scaledOneSide", [(w + k) * (h + k)]: "addedNotScaled" }, hint: `The big one is ${w * k} by ${h * k}.`, steps: [`Big size: ${w * k} by ${h * k}`, `${w * k} × ${h * k} = ${big}`, `That's ${k} × ${k} = ${k * k} times ${area}`], visual: { kind: "scale", w, h, kw: k, kh: k }, showVisual: true };
  }
  if (level === 4) {
    // Same shape, bigger: multiply both sides by the same number (not add).
    const k = pick([2, 3, 3, 4, 6]), w = rand(1, Math.floor(12 / k)), h = rand(w + 1, Math.max(w + 1, Math.floor(12 / k)) + 1);
    const H = h * k, add = h + (w * k - w);
    return { text: `These rectangles are the same shape. The small one is ${w} wide and ${h} tall. The big one is ${w * k} wide. How tall is it?`, answerType: "number", answer: num(H), wrong: cleanWrong(H, [add, H + k, h * w]), misconceptions: add !== H ? { [add]: "addedNotScaled" } : {}, hint: `${w * k} is ${k} times ${w}. Do the same to the height.`, steps: [`Width: ${w} × ${k} = ${w * k}`, `Height: ${h} × ${k} = ${H}`], visual: { kind: "scale", w, h, kw: k, kh: k, hideBig: "h" }, showVisual: true };
  }
  // Level 5: ratio groups. For every a blue there are b gold.
  const a = rand(2, 5), b = rand(1, 6), kk = rand(2, 6);
  const blue = a * kk, gold = b * kk, add = b + (blue - a);
  const mis = {};
  if (add !== gold && add > 0) mis[add] = "addedNotScaled";
  return { text: `In this pattern, every group has ${a} blue tiles and ${b} gold tiles. There are ${blue} blue tiles. How many gold tiles?`, answerType: "number", answer: num(gold), wrong: cleanWrong(gold, [add, gold + b, blue]), misconceptions: mis, hint: `How many groups make ${blue} blue tiles?`, steps: [`${blue} ÷ ${a} = ${kk} groups`, `${kk} × ${b} = ${gold} gold tiles`], visual: { kind: "ratio", a, b }, showVisual: true };
}

export const GYM_SKILLS = [
  { id: "doubling", name: "Double & Halve", emoji: "✌️", maxLevel: 5, gen: doubling, gym: true },
  { id: "factlinks", name: "Fact Links", emoji: "🔗", maxLevel: 4, gen: factLinks, gym: true },
  { id: "shapes", name: "Shape Lab", emoji: "🟦", maxLevel: 5, gen: shapeLab, gym: true },
];
