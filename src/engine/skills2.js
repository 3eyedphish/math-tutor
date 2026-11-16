// Skills for the rest of the Grade 4 year (enVision Topics 4–16).
// Same item format as skills.js. Math is always computed here, never by the AI.
import { rand, pick, chance, shuffle, fmt, roundTo, cleanWrong } from "./util.js";

const num = (n) => String(n);
const DEFAULT_T = { hero: "Pip", things: "stickers", names: ["Ana", "Ben", "Cy", "Dee"], place: "the shop" };
const who = (t) => (t?.names?.length ? t : DEFAULT_T);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const fr = (n, d) => `${n}/${d}`;
const mixed = (n, d) => (n % d === 0 ? `${n / d}` : n > d ? `${Math.floor(n / d)} ${n % d}/${d}` : `${n}/${d}`);
const SYMBOLS = ["<", "=", ">"];
const cmp = (a, b) => (a < b ? "<" : a > b ? ">" : "=");
// Fraction blanks: "a/b = [?]/d" style templates.
const blankFrac = (pre, den) => ({ pre, label: "?", post: `/${den}` });

// ── Topic 4: multiply by 2-digit numbers ────────────────────────────────────
// Levels follow the school lessons 4-1 to 4-7 (Savvas enVision Grade 4, Topic 4).
const splitTO = (n) => [n - (n % 10), n % 10];
// Box area model (not to scale): side labels and the product (or "?") in each box.
const areaModel = (a, b, hide = true) => {
  const rows = splitTO(a).filter(Boolean), cols = splitTO(b).filter(Boolean);
  return { kind: "areaModel", rows, cols, cells: rows.map((r) => cols.map((c) => (hide ? null : r * c))) };
};
const partialsOf = (a, b) => {
  const [at, ao] = splitTO(a), [bt, bo] = splitTO(b);
  return [[at, bt], [at, bo], [ao, bt], [ao, bo]].filter(([x, y]) => x && y);
};
// Nearest "friendly" number (multiple of 25 or 10) for compatible-number estimates.
const friendly = (n) => {
  const opts = [roundTo(n, 10), roundTo(n, 25)].filter((v) => v > 0);
  return opts.sort((x, y) => Math.abs(x - n) - Math.abs(y - n))[0];
};

export function mult2(level, theme) {
  const t = who(theme);
  if (level === 1) {
    // 4-1: multiply multiples of 10 (tens × tens), or find the missing factor.
    const x = rand(2, 9), y = rand(1, 9), a = x * 10, b = y * 10, ans = a * b;
    if (chance(0.4)) {
      const left = chance(0.7);
      return { text: left ? `${a} × ? = ${fmt(ans)}` : `? × ${a} = ${fmt(ans)}`, answerType: "number", answer: num(b), wrong: cleanWrong(b, [y, b * 10, b + 10]), misconceptions: { [y]: "placeValue", [b * 10]: "placeValue" }, hint: `${fmt(ans)} is ${fmt(ans / 100)} hundreds. ${x} tens times how many tens makes ${fmt(ans / 100)} hundreds?`, steps: [`${x} × ${y} = ${x * y}`, `${x} tens × ${y} tens = ${x * y} hundreds = ${fmt(ans)}`, `So the missing factor is ${b}`], mental: true };
    }
    const zeroTrap = (x * y) % 10 === 0; // like 50 × 60 = 3,000: the fact already ends in 0
    return { text: `${a} × ${b} = ?`, answerType: "number", answer: num(ans), wrong: cleanWrong(ans, [ans / 10, ans * 10, x * y]), misconceptions: { [ans / 10]: "placeValue", [ans * 10]: "placeValue", [x * y]: "placeValue" }, hint: zeroTrap ? `${x} × ${y} = ${x * y}. That already ends in a zero, and you still need 2 more zeros for the two tens.` : `Use the fact ${x} × ${y}, then think: tens × tens = hundreds.`, steps: [`${x} × ${y} = ${x * y}`, `${x} tens × ${y} tens = ${x * y} hundreds`, `= ${fmt(ans)}`], mental: true, story: (th) => `${who(th).hero} buys ${b} boxes of ${who(th).things}. Each box holds ${a}. How many ${who(th).things} in all?` };
  }
  if (level === 2) {
    // 4-2: a multiple of 10 times a 2-digit number, with an area model.
    const a = rand(1, 9) * 10, b = rand(11, 49) + (chance(0.3) ? 40 : 0), [bt, bo] = splitTO(b);
    if (!bo) return mult2(2, theme);
    const p1 = a * bt, p2 = a * bo, ans = a * b;
    const base = { hint: `${a} × ${b} means ${a} groups of ${bt} plus ${a} groups of ${bo}.`, steps: [`${a} × ${bt} = ${fmt(p1)}`, `${a} × ${bo} = ${fmt(p2)}`, `${fmt(p1)} + ${fmt(p2)} = ${fmt(ans)}`], visual: { kind: "areaModel", rows: [a], cols: [bt, bo], cells: [[null, null]] }, showVisual: true };
    if (chance(0.55)) return { ...base, text: `Use the area model to find ${a} × ${b}.`, answerType: "blanks", template: [{ pre: `${a} × ${bt} = `, label: "?", post: "" }, { pre: `${a} × ${bo} = `, label: "?", post: "" }, { pre: `${a} × ${b} = `, label: "?", post: "" }], answer: [num(p1), num(p2), num(ans)] };
    return { ...base, text: `${a} × ${b} = ?`, answerType: "number", answer: num(ans), wrong: cleanWrong(ans, [p1 + bo, ans / 10, p1, (a / 10) * b]), misconceptions: { [p1 + bo]: "partialProducts", [(a / 10) * b]: "placeValue" }, story: (th) => `A building has ${a} floors. Each floor is ${b} feet tall. How tall is the building in feet?` };
  }
  if (level === 3) {
    // 4-3: estimate with rounding or compatible numbers.
    const kind = pick(["round", "compat", "compat", "overunder"]);
    if (kind === "round") {
      const a = rand(12, 98), b = rand(12, 98), ra = roundTo(a, 10), rb = roundTo(b, 10), ans = ra * rb;
      if (a % 10 === 0 || b % 10 === 0) return mult2(3, theme);
      return { text: `Estimate ${a} × ${b} by rounding each number to the nearest ten.`, answerType: "number", answer: num(ans), wrong: cleanWrong(ans, [a * b, (ra + 10) * rb, ra * (rb - 10)]), misconceptions: { [a * b]: "notRounded" }, hint: "Round both numbers first, then multiply the tens.", steps: [`${a} → ${ra}, ${b} → ${rb}`, `${ra} × ${rb} = ${fmt(ans)}`] };
    }
    if (kind === "compat") {
      // One factor sits near 25 or 75 so a compatible pair beats plain rounding.
      const a = pick([23, 24, 26, 27, 48, 49, 51, 52, 73, 74, 76, 77]), b = rand(3, 9) * 10 + pick([-2, -1, 1, 2]);
      const ca = friendly(a), cb = roundTo(b, 10), est = ca * cb;
      const right = `${ca} × ${cb}`;
      const cands = [right, `${ca} × ${cb + 10}`, `${ca + 25} × ${cb}`, `${a} × ${cb}`, `${ca} × ${cb - 10}`].filter((c, i, arr) => arr.indexOf(c) === i);
      const choices = shuffle([right, ...shuffle(cands.slice(1)).slice(0, 2)]);
      if (chance(0.5)) return { text: `Which compatible numbers are best for estimating ${a} × ${b}?`, answerType: "choice", answer: right, choices, hint: `Compatible numbers are close to the real numbers and easy to multiply in your head. ${a} is close to ${ca}.`, steps: [`${a} is close to ${ca}`, `${b} is close to ${cb}`, `${right} = ${fmt(est)}`] };
      return { text: `Estimate ${a} × ${b} with compatible numbers.\n${a} is close to ${ca}. ${b} is close to ${cb}.`, answerType: "number", answer: num(est), wrong: cleanWrong(est, [a * b, est * 10, est / 10]), misconceptions: { [est * 10]: "placeValue", [est / 10]: "placeValue", [a * b]: "notRounded" }, hint: ca % 25 === 0 ? `${ca} is a quarter-friendly number: 4 × 25 = 100.` : `Multiply the friendly numbers in your head.`, steps: [`${a} → ${ca}, ${b} → ${cb}`, `${ca} × ${cb} = ${fmt(est)}`], story: (th) => `About ${a} people ride a train each trip. It makes ${b} trips. About how many riders is that? (${a} is close to ${ca}, ${b} is close to ${cb}.)` };
    }
    // Is the estimate greater or less than the exact product?
    let a, b;
    do { a = rand(12, 98); b = rand(12, 98); } while (a % 10 === 0 || b % 10 === 0 || (a % 10 < 5) !== (b % 10 < 5));
    const ra = roundTo(a, 10), rb = roundTo(b, 10), up = ra > a;
    const ans = up ? "greater than" : "less than";
    return { text: `Nathan estimates ${a} × ${b} by finding ${ra} × ${rb}.\nWill his estimate be greater than or less than the real product?`, answerType: "choice", answer: ans, choices: ["greater than", "less than"], hint: `Did he round both numbers up, or both down?`, steps: [`${a} → ${ra} and ${b} → ${rb}: both rounded ${up ? "up" : "down"}`, `Bigger factors make a bigger product, so the estimate is ${ans} ${fmt(a * b)}`] };
  }
  // Levels 4–7 use two 2-digit numbers with no zero ones digits.
  let a, b;
  do { a = rand(11, 98); b = rand(11, 98); } while (a % 10 === 0 || b % 10 === 0);
  if (level <= 5 && chance(0.5)) { a = rand(11, 39); b = rand(11, 59); if (a % 10 === 0 || b % 10 === 0) return mult2(level, theme); }
  const parts = partialsOf(a, b), prods = parts.map(([x, y]) => x * y), ans = a * b;
  const [at, ao] = splitTO(a), [bt, bo] = splitTO(b);
  const digitsOnly = (at / 10) * (bt / 10) + (at / 10) * bo + ao * (bt / 10) + ao * bo; // multiplied digits, not values
  const forgotTens = ans - at * bt;
  const steps = [...parts.map(([x, y], i) => `${x} × ${y} = ${fmt(prods[i])}`), `${prods.map(fmt).join(" + ")} = ${fmt(ans)}`];
  const hint = `Break both numbers into tens and ones: ${a} = ${at} + ${ao}, ${b} = ${bt} + ${bo}. Multiply every part by every part, then add.`;
  if (level === 4) {
    // 4-4: arrays and the four partial products.
    return { text: `Find ${a} × ${b} with partial products.`, answerType: "blanks", template: [...parts.map(([x, y]) => ({ pre: `${x} × ${y} = `, label: "?", post: "" })), { pre: "Total = ", label: "?", post: "" }], answer: [...prods.map(num), num(ans)], hint, steps, visual: areaModel(a, b), showVisual: true };
  }
  if (level === 5) {
    // 4-5: area models and the Distributive Property.
    const kind = pick(["missing", "pick", "ways"]);
    if (kind === "missing") {
      const hideIdx = shuffle([0, 1, 2, 3]).slice(0, 2).sort();
      const v = areaModel(a, b, false);
      hideIdx.forEach((i) => { v.cells[i >> 1][i & 1] = null; });
      return { text: `Fill in the missing parts of the area model for ${a} × ${b}, then add.`, answerType: "blanks", template: [...hideIdx.map((i) => ({ pre: `${parts[i][0]} × ${parts[i][1]} = `, label: "?", post: "" })), { pre: `${a} × ${b} = `, label: "?", post: "" }], answer: [...hideIdx.map((i) => num(prods[i])), num(ans)], hint, steps, visual: v, showVisual: true };
    }
    if (kind === "pick") {
      const right = prods.map(fmt).join(", ");
      const bad = [
        [(at / 10) * (bt / 10), (at / 10) * bo, ao * (bt / 10), ao * bo], // digits only
        [at * bt, at * bo, ao * bo], // a part left out
        [at * bt * 10, at * bo * 10, ao * bt, ao * bo], // too many zeros
        [at + bt, at * bo, ao * bt, ao * bo],
      ].map((x) => x.map(fmt).join(", ")).filter((c) => c !== right);
      const choices = shuffle([right, ...shuffle([...new Set(bad)]).slice(0, 3)]);
      return { text: `Which list has all the partial products for ${a} × ${b}?`, answerType: "choice", answer: right, choices, hint, steps: [`${a} × ${b} = (${at} + ${ao}) × (${bt} + ${bo})`, ...steps], misconceptions: { [bad[0]]: "partialProducts" } };
    }
    // Select all the ways (distributive property). The test checks each expression's value.
    const ok = [`(${at} × ${b}) + (${ao} × ${b})`, `(${at} × ${bt}) + (${at} × ${bo}) + (${ao} × ${bt}) + (${ao} × ${bo})`, `(${a} × ${bt}) + (${a} × ${bo})`];
    const near = bo >= 7 ? `${a} × (${bt + 10} − ${10 - bo})` : null;
    if (near) ok.push(near);
    const no = [[`(${at} × ${bt}) + (${ao} × ${bo})`, at * bt + ao * bo], [`(${at} × ${ao}) + (${bt} × ${bo})`, at * ao + bt * bo], [`(${at} × ${b}) + ${ao}`, at * b + ao]].filter(([, v]) => v !== ans).map(([e]) => e);
    const choices = shuffle([...shuffle(ok).slice(0, 2 + (near ? 1 : 0)), ...shuffle(no).slice(0, 2)]);
    const answer = choices.filter((c) => !no.includes(c));
    return { text: `${a} × ${b} = n\nSelect all the ways to find n.`, answerType: "multi", choices, answer, hint: `Every part of ${a} has to be multiplied by every part of ${b}. Check each choice: is anything left out?`, steps: [`${a} × ${b} = (${at} + ${ao}) × (${bt} + ${bo})`, ...steps] };
  }
  if (level === 6) {
    // 4-6: partial products to multiply by 2-digit numbers, plus missing factors.
    if (chance(0.3)) {
      const left = chance(0.5), other = a, f = b, prod = other * f;
      const wrongs = shuffle([f + 1, f - 1, f + 10, f - 10, Number(String(f).split("").reverse().join(""))].filter((w) => w !== f && w > 10 && w < 100 && other * w !== prod));
      const choices = shuffle([f, ...[...new Set(wrongs)].slice(0, 3)].map(num));
      return { text: left ? `${other} × ? = ${fmt(prod)}` : `? × ${other} = ${fmt(prod)}`, answerType: "choice", answer: num(f), choices, hint: `Try each choice. Check the ones digit first: ${ao} × the ones digit has to end in ${prod % 10}.`, steps: [`${other} × ${f} = ${fmt(prod)}`, `So the missing factor is ${f}`] };
    }
    return { text: `${a} × ${b} = ?`, answerType: "number", answer: num(ans), wrong: cleanWrong(ans, [forgotTens, digitsOnly, ans + 10, ans - 100]), misconceptions: { [forgotTens]: "partialProducts", [digitsOnly]: "partialProducts" }, hint: `First estimate: about ${roundTo(a, 10)} × ${roundTo(b, 10)} = ${fmt(roundTo(a, 10) * roundTo(b, 10))}. ${hint}`, steps, story: (th) => `At ${who(th).place} there are ${b} boxes with ${a} ${who(th).things} in each. How many ${who(th).things} in all?` };
  }
  // Level 7 (4-7): make sense and persevere with multi-step problems.
  const [n1, n2] = shuffle(t.names);
  const kind = pick(["chain", "two", "profit", "more", "after"]);
  if (kind === "chain") {
    const g = rand(12, 25), per = rand(11, 19), each = rand(3, 8), mid = g * per, tot = mid * each;
    return { text: `${n1} fills ${g} baskets with ${per} plants each. Every plant has ${each} flowers. How many flowers in all?`, answerType: "number", answer: num(tot), wrong: cleanWrong(tot, [mid, g * per + each, g * each * 10]), misconceptions: { [mid]: "partWrong" }, hint: `Hidden question first: how many plants are there?`, steps: [`Plants: ${g} × ${per} = ${fmt(mid)}`, `Flowers: ${fmt(mid)} × ${each} = ${fmt(tot)}`] };
  }
  if (kind === "two") {
    const b1 = rand(12, 39), s1 = rand(11, 29), b2 = rand(2, 5) * 10, s2 = rand(12, 35), p1 = b1 * s1, p2 = b2 * s2;
    return { text: `${n1} orders ${b1} boxes of ${s1} pencils and ${b2} boxes of ${s2} erasers. How many items is that altogether?`, answerType: "number", answer: num(p1 + p2), wrong: cleanWrong(p1 + p2, [p1, p2, (b1 + b2) * (s1 + s2)]), misconceptions: { [p1]: "partWrong", [p2]: "partWrong" }, hint: `Find the pencils and the erasers separately, then add.`, steps: [`Pencils: ${b1} × ${s1} = ${fmt(p1)}`, `Erasers: ${b2} × ${s2} = ${fmt(p2)}`, `${fmt(p1)} + ${fmt(p2)} = ${fmt(p1 + p2)}`] };
  }
  if (kind === "profit") {
    const cost = rand(21, 59), sell = cost + rand(12, 45), n = rand(12, 29), gain = sell - cost, tot = gain * n;
    return { text: `A store pays $${cost} for each camera and sells it for $${sell}. It sells ${n} cameras. How many dollars does the store earn (selling price minus what it paid)?`, answerType: "number", answer: num(tot), wrong: cleanWrong(tot, [sell * n, cost * n, gain]), misconceptions: { [sell * n]: "partWrong", [gain]: "partWrong" }, hint: `Hidden question first: how much does the store earn on ONE camera?`, steps: [`One camera: $${sell} − $${cost} = $${gain}`, `${n} cameras: ${gain} × ${n} = $${fmt(tot)}`] };
  }
  if (kind === "more") {
    const r1 = rand(3, 7) * 10, r2 = r1 + rand(1, 3) * 10, d = pick([28, 30, 31]), diff = (r2 - r1) * d;
    return { text: `${n1} reads ${r1} minutes a day. ${n2} reads ${r2} minutes a day. How many more minutes does ${n2} read in a month with ${d} days?`, answerType: "number", answer: num(diff), wrong: cleanWrong(diff, [r2 * d, r2 - r1, r1 * d]), misconceptions: { [r2 * d]: "partWrong", [r2 - r1]: "partWrong" }, hint: `How many more minutes each day? Then multiply by the days.`, steps: [`Each day: ${r2} − ${r1} = ${r2 - r1}`, `${r2 - r1} × ${d} = ${fmt(diff)}`] };
  }
  const start = rand(105, 395), box = rand(11, 15), boxes = rand(12, 25), got = box * boxes;
  return { text: `${n1} has ${start} marbles, then buys ${boxes} more bags with ${box} marbles in each bag. How many marbles does ${n1} have now?`, answerType: "number", answer: num(start + got), wrong: cleanWrong(start + got, [got, start + box + boxes, start * box]), misconceptions: { [got]: "partWrong", [start + box + boxes]: "wrongOperation" }, hint: `First find how many marbles are in the bags.`, steps: [`Bags: ${boxes} × ${box} = ${fmt(got)}`, `${start} + ${fmt(got)} = ${fmt(start + got)}`] };
}

// ── Topic 5: divide by 1-digit numbers ──────────────────────────────────────
export function divide1(level, theme) {
  const t = who(theme);
  if (level === 1) {
    const d = rand(2, 9), q = rand(2, 9), z = pick([10, 100]), n = d * q * z;
    return { text: `${fmt(n)} ÷ ${d} = ?`, answerType: "number", answer: num(q * z), wrong: cleanWrong(q * z, [q, q * z * 10, q * z + d]), hint: `Use the fact ${d * q} ÷ ${d} = ${q}, then think in ${z === 10 ? "tens" : "hundreds"}.`, steps: [`${d * q} ÷ ${d} = ${q}`, `${d * q} ${z === 10 ? "tens" : "hundreds"} ÷ ${d} = ${q} ${z === 10 ? "tens" : "hundreds"} = ${fmt(q * z)}`], mental: true };
  }
  if (level === 2) {
    // Compatible numbers: the dividend sits close to a basic-fact multiple of 10.
    const d = rand(3, 9), q = rand(3, 9), base = d * q * 10, n = base + rand(-4, 4) || base + 1;
    const ans = q * 10;
    const choices = shuffle([ans, ans + 10, ans - 10, q * 100].map(num));
    return { text: `Which is the best estimate of ${fmt(n)} ÷ ${d}?`, answerType: "choice", answer: num(ans), choices, hint: `Find a number close to ${fmt(n)} that ${d} divides easily, like ${fmt(base)}.`, steps: [`${fmt(n)} is close to ${fmt(base)}`, `${fmt(base)} ÷ ${d} = ${ans}`] };
  }
  if (level === 5) {
    // What does the remainder mean?
    const d = rand(3, 8), q = rand(4, 12), r = rand(1, d - 1), n = d * q + r;
    const kind = pick(["up", "down"]);
    if (kind === "up") return { text: `${n} friends are going to ${t.place}. Each car holds ${d} people. How many cars do they need so everyone can go?`, answerType: "number", answer: num(q + 1), wrong: cleanWrong(q + 1, [q, r, q + r]), hint: "Divide, then think: what about the people left over?", steps: [`${n} ÷ ${d} = ${q} R ${r}`, `The ${r} left over still need a car, so ${q + 1} cars`] };
    return { text: `${t.hero} has ${n} ${t.things} and puts ${d} in each bag. How many full bags can ${t.hero} make?`, answerType: "number", answer: num(q), wrong: cleanWrong(q, [q + 1, r, n - d]), hint: "Divide. Only FULL bags count.", steps: [`${n} ÷ ${d} = ${q} R ${r}`, `${q} bags are full; ${r} ${t.things} are left over`] };
  }
  const d = rand(2, 9);
  const q = level === 3 ? rand(11, 99) : rand(101, 999);
  const r = chance(0.6) ? rand(1, d - 1) : 0;
  const n = d * q + r;
  const answer = r ? `${q}r${r}` : num(q);
  return {
    text: `${fmt(n)} ÷ ${d} = ?${r ? "  (with a remainder)" : ""}`, answerType: "number", allowR: !!r, answer,
    wrong: r ? [`${q + 1}r${r}`, `${q}r${(r + 1) % d}`] : cleanWrong(q, [q + 1, q * 10, q - 10]),
    hint: "Divide from the left: how many groups of " + d + " in each place? Multiply, subtract, bring down the next digit.",
    steps: [`Estimate: ${fmt(n)} ÷ ${d} is about ${fmt(roundTo(q, q > 100 ? 100 : 10))}`, `${d} × ${fmt(q)} = ${fmt(d * q)}`, r ? `${fmt(n)} − ${fmt(d * q)} = ${r} left over, so ${q} R ${r}` : `So ${fmt(n)} ÷ ${d} = ${fmt(q)}`],
    story: (th) => `${who(th).hero} shares ${fmt(n)} ${who(th).things} equally into ${d} groups. How many in each group${r ? ", and how many are left over" : ""}?`,
  };
}

// ── Topic 6: use operations to solve problems ───────────────────────────────
export function operations(level, theme) {
  const t = who(theme);
  const [A, B] = shuffle(t.names);
  if (level === 1) {
    const small = rand(3, 12), k = rand(2, 9), big = small * k;
    if (chance(0.5)) return { text: `${A} has ${small} ${t.things}. ${B} has ${k} times as many. How many ${t.things} does ${B} have?`, answerType: "number", answer: num(big), wrong: cleanWrong(big, [small + k, big + small, small * (k + 1)]), misconceptions: { [small + k]: "wrongOperation" }, hint: `"${k} times as many" means multiply by ${k}.`, steps: [`${small} × ${k} = ${big}`] };
    return { text: `${B} has ${big} ${t.things}. That is ${k} times as many as ${A}. How many ${t.things} does ${A} have?`, answerType: "number", answer: num(small), wrong: cleanWrong(small, [big - k, big * k, small + 1]), misconceptions: { [big - k]: "wrongOperation", [big * k]: "wrongOperation" }, hint: `${A} × ${k} = ${big}. What times ${k} is ${big}?`, steps: [`${big} ÷ ${k} = ${small}`] };
  }
  if (level === 2) {
    const small = rand(3, 12), k = rand(2, 9), big = small * k;
    return { text: `${A} read ${big} pages. ${B} read ${small} pages. How many times as many pages did ${A} read as ${B}?`, answerType: "number", answer: num(k), wrong: cleanWrong(k, [big - small, k + 1, big + small]), misconceptions: { [big - small]: "wrongOperation" }, hint: `How many groups of ${small} make ${big}?`, steps: [`${big} ÷ ${small} = ${k}`, `${A} read ${k} times as many pages`] };
  }
  // Multi-step.
  const kind = pick(["packsShare", "buyChange", "rowsMinus"]);
  if (kind === "packsShare") {
    const people = rand(2, 6), each = rand(4, 15), extra = rand(1, 3) * people, packs = rand(2, 6), per = (people * each - extra) / packs;
    if (Number.isInteger(per) && per > 1) return { text: `${t.hero} buys ${packs} packs of ${per} ${t.things} and finds ${extra} more. The ${t.things} are shared equally among ${people} friends. How many does each friend get?`, answerType: "number", answer: num(each), wrong: cleanWrong(each, [packs * per + extra, (packs * per) / people, each + 1]), hint: "First find how many in all, then share them.", steps: [`${packs} × ${per} = ${packs * per}`, `${packs * per} + ${extra} = ${packs * per + extra}`, `${packs * per + extra} ÷ ${people} = ${each}`] };
  }
  if (kind === "buyChange") {
    const price = rand(3, 19), n = rand(2, 6), pay = roundTo(price * n + rand(5, 40), 10) + 10, change = pay - price * n;
    return { text: `${A} buys ${n} books that cost $${price} each. ${A} pays with $${pay}. How much change does ${A} get?`, answerType: "number", answer: num(change), wrong: cleanWrong(change, [pay - price, price * n, pay - price - n]), hint: "First find the total cost, then subtract from what was paid.", steps: [`${n} × $${price} = $${price * n}`, `$${pay} − $${price * n} = $${change}`] };
  }
  const rows = rand(4, 12), per = rand(5, 15), gone = rand(3, rows * per - 5), left = rows * per - gone;
  return { text: `${t.place} sets out ${rows} rows of ${per} chairs. ${gone} chairs are taken. How many chairs are still empty?`, answerType: "number", answer: num(left), wrong: cleanWrong(left, [rows * per, rows + per - gone, left + per]), hint: "How many chairs in all? Then take away the ones that are taken.", steps: [`${rows} × ${per} = ${rows * per}`, `${rows * per} − ${gone} = ${left}`] };
}

// ── Topic 7: factors and multiples ──────────────────────────────────────────
const factorsOf = (n) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
const isPrime = (n) => n > 1 && factorsOf(n).length === 2;
export function factors(level) {
  if (level === 1) {
    const n = pick([12, 16, 18, 20, 24, 28, 30, 32, 36, 40, 42, 45, 48]);
    const fs = factorsOf(n).filter((d) => d > 1 && d < n);
    const right = shuffle(fs).slice(0, Math.min(3, fs.length));
    const nonf = shuffle(Array.from({ length: 14 }, (_, i) => i + 2).filter((d) => n % d)).slice(0, 6 - right.length);
    const choices = shuffle([...right, ...nonf]).map(num);
    return { text: `Select ALL the factors of ${n}.`, answerType: "multi", choices, answer: right.map(num).sort(), hint: `A factor divides ${n} with nothing left over. Think: ${n} ÷ ? has no remainder.`, steps: [`Factor pairs of ${n}: ${fs.filter((d) => d * d <= n).map((d) => `${d} × ${n / d}`).concat([`1 × ${n}`]).join(", ")}`] };
  }
  if (level === 2) {
    const n = rand(2, 60);
    const fs = factorsOf(n);
    const ans = isPrime(n) ? "prime" : "composite";
    return { text: `Is ${n} prime or composite?`, answerType: "choice", choices: ["prime", "composite"], answer: ans, hint: "A prime number has exactly two factors: 1 and itself.", steps: [`Factors of ${n}: ${fs.join(", ")}`, `${fs.length === 2 ? "Only two factors, so it is prime" : `More than two factors, so it is composite`}`] };
  }
  if (chance(0.5)) {
    const k = rand(3, 9);
    const mults = shuffle(Array.from({ length: 10 }, (_, i) => k * (i + 2))).slice(0, 3);
    const nons = [];
    while (nons.length < 3) { const x = rand(10, 90); if (x % k && !nons.includes(x)) nons.push(x); }
    return { text: `Select ALL the multiples of ${k}.`, answerType: "multi", choices: shuffle([...mults, ...nons]).map(num), answer: mults.map(num).sort(), hint: `Multiples of ${k} are in the ${k}s times table: ${k}, ${2 * k}, ${3 * k}, …`, steps: mults.map((m) => `${k} × ${m / k} = ${m}`) };
  }
  const a = rand(2, 9), b = rand(12, 81), yes = b % a === 0;
  return { text: `Is ${a} a factor of ${b}?`, answerType: "choice", choices: ["yes", "no"], answer: yes ? "yes" : "no", hint: `Does ${b} ÷ ${a} come out even?`, steps: [yes ? `${a} × ${b / a} = ${b}, so yes` : `${b} ÷ ${a} = ${Math.floor(b / a)} R ${b % a}, so no`] };
}

// ── Topic 8: fraction equivalence and comparing ─────────────────────────────
const DENS = [2, 3, 4, 5, 6, 8, 10, 12];
const randFrac = (dens = DENS) => { const d = pick(dens), n = rand(1, d - 1); return [n, d]; };
export function fracEquiv(level) {
  if (level === 1) {
    const [n, d] = randFrac([2, 3, 4, 5, 6]), k = rand(2, 4);
    return { text: `Find the equivalent fraction.\n${fr(n, d)} = ?/${d * k}`, answerType: "blanks", template: [blankFrac(`${fr(n, d)} = `, d * k)], answer: [num(n * k)], hint: `${d} × ${k} = ${d * k}, so multiply the top by ${k} too.`, steps: [`${fr(n, d)} = ${fr(n + " × " + k, d + " × " + k)} = ${fr(n * k, d * k)}`], visual: { kind: "fracbar", n, d } };
  }
  if (level === 2) {
    const [n, d] = randFrac([2, 3, 4, 5, 6]), k = rand(2, 4);
    if (gcd(n, d) !== 1) return fracEquiv(level);
    return { text: `Find the equivalent fraction.\n${fr(n * k, d * k)} = ?/${d}`, answerType: "blanks", template: [blankFrac(`${fr(n * k, d * k)} = `, d)], answer: [num(n)], hint: `${d * k} ÷ ${k} = ${d}, so divide the top by ${k} too.`, steps: [`${fr(n * k, d * k)} = ${fr(`${n * k} ÷ ${k}`, `${d * k} ÷ ${k}`)} = ${fr(n, d)}`] };
  }
  if (level === 3) {
    let a, b;
    do { a = randFrac(); b = randFrac(); } while (a[1] === b[1] && a[0] === b[0]);
    const va = a[0] / a[1], vb = b[0] / b[1], sym = cmp(va, vb);
    const L = (a[1] * b[1]) / gcd(a[1], b[1]);
    return { text: `Compare. Use <, >, or =.\n${fr(...a)}  ○  ${fr(...b)}`, answerType: "choice", choices: SYMBOLS, answer: sym, hint: "Use a common denominator, or compare each to 1/2.", steps: [`${fr(...a)} = ${fr(a[0] * (L / a[1]), L)}`, `${fr(...b)} = ${fr(b[0] * (L / b[1]), L)}`, `So ${fr(...a)} ${sym} ${fr(...b)}`] };
  }
  const set = [];
  while (set.length < 3) { const f = randFrac(); if (!set.some((g) => g[0] * f[1] === f[0] * g[1])) set.push(f); }
  const order = [...set].sort((x, y) => x[0] / x[1] - y[0] / y[1]).map((f) => fr(...f));
  return { text: `Order from least to greatest.`, answerType: "tiles", tiles: shuffle(set.map((f) => fr(...f))), answer: order.join(" "), hint: "Rename them with the same denominator, or compare each to 1/2 and 1.", steps: [order.join(" < ")] };
}

// ── Topic 9: add and subtract fractions ─────────────────────────────────────
export function fracAdd(level, theme) {
  const t = who(theme);
  const d = pick([3, 4, 5, 6, 8, 10, 12]);
  if (level === 1) {
    if (chance(0.3)) {
      const n = rand(3, d - 1), a = rand(1, n - 1), b = n - a;
      const right = `${fr(a, d)} + ${fr(b, d)}`;
      const choices = shuffle([right, `${fr(a, d)} + ${fr(b + 1, d)}`, `${fr(a, d * 2)} + ${fr(b, d * 2)}`, `${fr(a, d)} + ${fr(b, d + 1)}`]);
      return { text: `Which shows ${fr(n, d)} as a sum of fractions?`, answerType: "choice", choices, answer: right, hint: `The parts must have denominator ${d}, and the tops must add to ${n}.`, steps: [`${a} + ${b} = ${n}, so ${right} = ${fr(n, d)}`] };
    }
    const a = rand(1, d - 2), b = rand(1, d - 1 - a);
    return { text: `${fr(a, d)} + ${fr(b, d)} = ?`, answerType: "blanks", template: [blankFrac(`${fr(a, d)} + ${fr(b, d)} = `, d)], answer: [num(a + b)], hint: "Same denominator: add the tops, keep the bottom.", steps: [`${a} + ${b} = ${a + b}`, `${fr(a, d)} + ${fr(b, d)} = ${fr(a + b, d)}`], visual: { kind: "fracbar", n: a + b, d, label: false } };
  }
  if (level === 2) {
    const a = rand(2, d - 1), b = rand(1, a - 1);
    return { text: `${fr(a, d)} − ${fr(b, d)} = ?`, answerType: "blanks", template: [blankFrac(`${fr(a, d)} − ${fr(b, d)} = `, d)], answer: [num(a - b)], hint: "Same denominator: subtract the tops, keep the bottom.", steps: [`${a} − ${b} = ${a - b}`, `${fr(a, d)} − ${fr(b, d)} = ${fr(a - b, d)}`], story: (th) => `${who(th).hero} had ${fr(a, d)} of a pizza and ate ${fr(b, d)} of the pizza. How much is left?` };
  }
  // Mixed numbers (level 3 add, level 4 subtract with regrouping).
  const w1 = rand(1, 5), n1 = rand(1, d - 1), w2 = rand(1, 4), n2 = rand(1, d - 1);
  const A = w1 * d + n1, B = w2 * d + n2;
  if (level === 3) {
    const S = A + B;
    return { text: `${w1} ${fr(n1, d)} + ${w2} ${fr(n2, d)} = ?\nWrite the answer as a mixed number.`, answerType: "blanks", template: [{ pre: "Whole number: ", label: "?", post: "" }, { pre: "Fraction: ", label: "?", post: `/${d}` }], answer: [num(Math.floor(S / d)), num(S % d)], hint: "Add the wholes, add the fractions. If the fraction is more than 1, regroup it into a whole.", steps: [`${w1} + ${w2} = ${w1 + w2}`, `${fr(n1, d)} + ${fr(n2, d)} = ${fr(n1 + n2, d)}${n1 + n2 >= d ? ` = 1 ${fr(n1 + n2 - d, d)}` : ""}`, `Total: ${mixed(S, d)}`], story: (th) => `${who(th).hero} walked ${w1} ${fr(n1, d)} miles, then ${w2} ${fr(n2, d)} more miles. How far in all? Write a mixed number.` };
  }
  const big = Math.max(A, B) + d, small = Math.min(A, B), D = big - small;
  return { text: `${mixed(big, d)} − ${mixed(small, d)} = ?\nWrite the answer as a mixed number.`, answerType: "blanks", template: [{ pre: "Whole number: ", label: "?", post: "" }, { pre: "Fraction: ", label: "?", post: `/${d}` }], answer: [num(Math.floor(D / d)), num(D % d)], hint: "If the first fraction is too small, regroup 1 whole into " + d + "/" + d + ".", steps: [`${mixed(big, d)} = ${fr(big, d)}, ${mixed(small, d)} = ${fr(small, d)}`, `${fr(big, d)} − ${fr(small, d)} = ${fr(D, d)} = ${mixed(D, d)}`] };
}

// ── Topic 10: multiply fractions by whole numbers ───────────────────────────
export function fracMult(level, theme) {
  const d = pick([2, 3, 4, 5, 6, 8, 10]), w = rand(2, 9);
  if (level === 1) {
    return { text: `${w} × ${fr(1, d)} = ?`, answerType: "blanks", template: [blankFrac(`${w} × ${fr(1, d)} = `, d)], answer: [num(w)], hint: `${w} groups of ${fr(1, d)}: count ${w} unit fractions.`, steps: [`${w} × ${fr(1, d)} = ${fr(w, d)}`] };
  }
  const n = rand(2, Math.max(2, d - 1));
  if (level === 2) {
    return { text: `${w} × ${fr(n, d)} = ?`, answerType: "blanks", template: [blankFrac(`${w} × ${fr(n, d)} = `, d)], answer: [num(w * n)], hint: "Multiply the whole number by the top. Keep the bottom.", steps: [`${w} × ${n} = ${w * n}`, `${w} × ${fr(n, d)} = ${fr(w * n, d)}`], story: (th) => `${who(th).hero} uses ${fr(n, d)} cup of flour for each batch and makes ${w} batches. How many cups of flour? (Answer as ?/${d})` };
  }
  const P = w * n;
  if (P < d || P % d === 0) return fracMult(level, theme);
  return { text: `${w} × ${fr(n, d)} = ?\nWrite the answer as a mixed number.`, answerType: "blanks", template: [{ pre: "Whole number: ", label: "?", post: "" }, { pre: "Fraction: ", label: "?", post: `/${d}` }], answer: [num(Math.floor(P / d)), num(P % d)], hint: `First find ${w} × ${n} = ${P}. Then see how many wholes are in ${fr(P, d)}.`, steps: [`${w} × ${fr(n, d)} = ${fr(P, d)}`, `${P} ÷ ${d} = ${Math.floor(P / d)} R ${P % d}`, `${fr(P, d)} = ${mixed(P, d)}`] };
}

// ── Topic 11: line plots ────────────────────────────────────────────────────
export function linePlot(level, theme) {
  const t = who(theme);
  const d = pick([4, 8]);
  const labels = d === 4 ? ["0", "1/4", "2/4", "3/4", "1"] : ["0", "1/8", "2/8", "3/8", "4/8", "5/8", "6/8", "7/8", "1"];
  const lo = rand(1, labels.length - 4), hi = lo + rand(2, 3);
  const pts = labels.slice(lo, hi + 1).map((l, i) => ({ label: l, n: rand(i === 0 || i === hi - lo ? 1 : 0, 5) }));
  const total = pts.reduce((s, p) => s + p.n, 0);
  const visual = { kind: "lineplot", title: `Lengths of ${t.things} (inches)`, points: pts };
  const base = { visual, showVisual: true };
  const nonEmpty = pts.filter((p) => p.n > 0);
  if (level === 1) {
    const p = pick(pts);
    return { ...base, text: `The line plot shows the lengths of some ${t.things}. How many ${t.things} are ${p.label} inch long?`, answerType: "number", answer: num(p.n), wrong: cleanWrong(p.n, [p.n + 1, total, p.n - 1]), hint: "Count the X's above that mark.", steps: [`There are ${p.n} X's above ${p.label}`] };
  }
  if (level === 2) {
    if (chance(0.5)) return { ...base, text: `The line plot shows the lengths of some ${t.things}. How many ${t.things} were measured in all?`, answerType: "number", answer: num(total), wrong: cleanWrong(total, [pts.length, total - 1, total + 1]), hint: "Count every X on the plot.", steps: [`${pts.map((p) => p.n).join(" + ")} = ${total}`] };
    const [a, b] = shuffle(pts).slice(0, 2).sort((x, y) => y.n - x.n);
    return { ...base, text: `How many more ${t.things} are ${a.label} inch long than ${b.label} inch long?`, answerType: "number", answer: num(a.n - b.n), wrong: cleanWrong(a.n - b.n, [a.n + b.n, a.n, b.n]), hint: "Count the X's at each mark, then subtract.", steps: [`${a.n} − ${b.n} = ${a.n - b.n}`] };
  }
  const longest = nonEmpty[nonEmpty.length - 1], shortest = nonEmpty[0];
  const top = labels.indexOf(longest.label), bot = labels.indexOf(shortest.label);
  return { ...base, text: `What is the difference between the longest and shortest ${t.things}?`, answerType: "blanks", template: [blankFrac("Difference = ", d)], answer: [num(top - bot)], hint: `Find the X's farthest right and farthest left. Subtract: write both in ${d}ths.`, steps: [`Longest: ${longest.label}, shortest: ${shortest.label}`, `${fr(top, d)} − ${fr(bot, d)} = ${fr(top - bot, d)}`] };
}

// ── Topic 12: decimals ──────────────────────────────────────────────────────
const dec = (x) => String(Math.round(x * 100) / 100);
export function decimals(level, theme) {
  if (level === 1) {
    if (chance(0.5)) {
      const tenths = chance(0.5), n = tenths ? rand(1, 9) : pick([rand(1, 9), rand(11, 99)]), d = tenths ? 10 : 100;
      if (!tenths && n % 10 === 0) return decimals(level, theme);
      return { text: `Write ${fr(n, d)} as a decimal.`, answerType: "number", allowDot: true, answer: dec(n / d), wrong: tenths ? [`0.0${n}`, String(n)] : n < 10 ? [`0.${n}`, String(n)] : [`${Math.floor(n / 10)}.${n % 10}0`.replace(/0$/, ""), String(n)].filter((w) => w !== dec(n / d)), hint: tenths ? "Tenths go in the first place after the decimal point." : "Hundredths use two places after the decimal point.", steps: [`${fr(n, d)} = ${dec(n / d)}`] };
    }
    const n = rand(1, 99);
    return { text: `Write ${dec(n / 100)} as a fraction.\n${dec(n / 100)} = ?/100`, answerType: "blanks", template: [blankFrac(`${dec(n / 100)} = `, 100)], answer: [num(n)], hint: "Two places after the decimal point means hundredths.", steps: [`${dec(n / 100)} is ${n} hundredths = ${fr(n, 100)}`] };
  }
  if (level === 2) {
    // Includes the classic trap: 0.5 vs 0.45 (more digits is not bigger).
    let a, b;
    if (chance(0.4)) { a = rand(1, 9) / 10; b = rand(11, 99) / 100; } else { a = rand(1, 99) / 100; b = rand(1, 99) / 100; }
    if (chance(0.5)) [a, b] = [b, a];
    const sym = cmp(a, b);
    return { text: `Compare. Use <, >, or =.\n${dec(a)}  ○  ${dec(b)}`, answerType: "choice", choices: SYMBOLS, answer: sym, hint: "Write both with two decimal places (0.5 = 0.50), then compare.", steps: [`${dec(a)} = ${(a).toFixed(2)}, ${dec(b)} = ${(b).toFixed(2)}`, `So ${dec(a)} ${sym} ${dec(b)}`] };
  }
  if (level === 3) {
    if (chance(0.5)) {
      const n = rand(1, 9);
      return { text: `Find the equivalent fraction.\n${fr(n, 10)} = ?/100`, answerType: "blanks", template: [blankFrac(`${fr(n, 10)} = `, 100)], answer: [num(n * 10)], hint: "1 tenth = 10 hundredths.", steps: [`${fr(n, 10)} = ${fr(n * 10, 100)}`] };
    }
    const a = rand(1, 9), b = rand(1, 99 - a * 10);
    return { text: `${fr(a, 10)} + ${fr(b, 100)} = ?/100`, answerType: "blanks", template: [blankFrac(`${fr(a, 10)} + ${fr(b, 100)} = `, 100)], answer: [num(a * 10 + b)], hint: "Change the tenths into hundredths first.", steps: [`${fr(a, 10)} = ${fr(a * 10, 100)}`, `${fr(a * 10, 100)} + ${fr(b, 100)} = ${fr(a * 10 + b, 100)}`] };
  }
  // Money.
  const a = rand(105, 995), b = rand(15, 395);
  const add = chance(0.5) || b > a;
  const ans = add ? a + b : a - b;
  const money = (c) => `$${(c / 100).toFixed(2)}`;
  return { text: `${money(a)} ${add ? "+" : "−"} ${money(b)} = ?`, answerType: "number", allowDot: true, answer: dec(ans / 100), wrong: [dec((ans + 10) / 100)], hint: "Line up the decimal points. Add or subtract cents first, then dollars.", steps: [`${money(a)} ${add ? "+" : "−"} ${money(b)} = ${money(ans)}`], story: (th) => `${who(th).hero} has ${money(a)} and ${add ? "earns" : "spends"} ${money(b)}. How much money now? (Use a decimal point.)` };
}

// ── Topic 13: measurement ───────────────────────────────────────────────────
const UNITS = [
  ["feet", "inches", 12], ["yards", "feet", 3], ["yards", "inches", 36], ["meters", "centimeters", 100], ["kilometers", "meters", 1000],
  ["kilograms", "grams", 1000], ["liters", "milliliters", 1000], ["hours", "minutes", 60], ["minutes", "seconds", 60], ["days", "hours", 24],
  ["pounds", "ounces", 16], ["gallons", "quarts", 4], ["quarts", "pints", 2], ["pints", "cups", 2], ["weeks", "days", 7],
];
export function measurement(level, theme) {
  const t = who(theme);
  const [big, small, k] = pick(UNITS);
  if (level === 1) {
    const n = rand(2, k >= 100 ? 9 : 12);
    return { text: `${n} ${big} = ? ${small}`, answerType: "number", answer: num(n * k), wrong: cleanWrong(n * k, [n + k, n * k * 10, Math.round(n / k) || n * k + k]), misconceptions: { [n + k]: "wrongOperation" }, hint: `1 ${big.replace(/s$/, "")} = ${fmt(k)} ${small}. Multiply.`, steps: [`${n} × ${fmt(k)} = ${fmt(n * k)} ${small}`] };
  }
  if (level === 2) {
    const n = rand(2, 9), extra = rand(1, k - 1);
    return { text: `${n} ${big} ${extra} ${small} = ? ${small}`, answerType: "number", answer: num(n * k + extra), wrong: cleanWrong(n * k + extra, [n * k, n + extra, n * k - extra]), hint: `Change the ${big} into ${small}, then add the extra ${extra}.`, steps: [`${n} × ${fmt(k)} = ${fmt(n * k)}`, `${fmt(n * k)} + ${extra} = ${fmt(n * k + extra)} ${small}`] };
  }
  // A two-step story in a unit that fits it.
  const STORY = {
    feet: (n, c) => `${t.hero} has a ribbon ${n} feet long and cuts off ${c} inches. How many inches of ribbon are left?`,
    meters: (n, c) => `${t.hero} has a rope ${n} meters long and cuts off ${c} centimeters. How many centimeters of rope are left?`,
    liters: (n, c) => `${t.hero} has ${n} liters of juice and pours out ${c} milliliters. How many milliliters are left?`,
    hours: (n, c) => `${t.hero} has ${n} hours to play and has used ${c} minutes. How many minutes are left?`,
    pounds: (n, c) => `${t.hero} has ${n} pounds of clay and uses ${c} ounces. How many ounces are left?`,
  };
  const [b3, s3, k3] = pick(UNITS.filter(([u]) => STORY[u]));
  const n = rand(2, 9), cut = rand(1, n * k3 - 1);
  return { text: STORY[b3](n, cut), answerType: "number", answer: num(n * k3 - cut), wrong: cleanWrong(n * k3 - cut, [n * k3 + cut, n * 10 - cut, (n - 1) * k3]), hint: `Change ${n} ${b3} into ${s3} first.`, steps: [`${n} ${b3} = ${n} × ${fmt(k3)} = ${fmt(n * k3)} ${s3}`, `${fmt(n * k3)} − ${cut} = ${fmt(n * k3 - cut)} ${s3}`] };
}

// ── Topic 14: patterns ──────────────────────────────────────────────────────
const SHAPES = ["▲", "●", "■", "★", "◆"];
export function patterns(level) {
  if (level === 1) {
    const start = rand(1, 20), step = rand(2, 12), nth = rand(4, 7);
    const seq = Array.from({ length: nth }, (_, i) => start + i * step);
    return { text: `Rule: add ${step}. The first number is ${start}. What is number ${nth} in the pattern?`, answerType: "number", answer: num(seq[nth - 1]), wrong: cleanWrong(seq[nth - 1], [seq[nth - 2], start + nth * step, start * nth]), hint: "Write the numbers out one at a time, adding each time.", steps: [seq.join(", ")] };
  }
  if (level === 2) {
    const mult = chance(0.3);
    const start = mult ? rand(1, 5) : rand(1, 30), step = mult ? rand(2, 3) : rand(3, 15);
    const seq = Array.from({ length: 5 }, (_, i) => (mult ? start * step ** i : start + i * step));
    if (chance(0.5)) {
      const right = mult ? `Multiply by ${step}` : `Add ${step}`;
      const choices = shuffle([right, mult ? `Add ${seq[1] - seq[0]}` : `Multiply by ${Math.max(2, Math.round(seq[1] / seq[0]))}`, mult ? `Multiply by ${step + 1}` : `Add ${step + 1}`, mult ? `Add ${step}` : `Subtract ${step}`].filter((v, i, a) => a.indexOf(v) === i));
      return { text: `What is the rule?\n${seq.slice(0, 4).join(", ")}, …`, answerType: "choice", choices, answer: right, hint: "Look at how you get from each number to the next. Check the rule works for EVERY step.", steps: [`${seq.slice(0, 4).join(" → ")}: ${right.toLowerCase()} each time`] };
    }
    const hole = rand(1, 3);
    return { text: `Find the missing number.\n${seq.map((v, i) => (i === hole ? "?" : v)).join(", ")}`, answerType: "number", answer: num(seq[hole]), wrong: cleanWrong(seq[hole], [seq[hole] + 1, seq[hole - 1] + 1]), hint: "Find the rule from the numbers you can see.", steps: [`Rule: ${mult ? `multiply by ${step}` : `add ${step}`}`, seq.join(", ")] };
  }
  const len = rand(2, 4), unit = shuffle(SHAPES).slice(0, len), pos = rand(10, 30);
  const ans = unit[(pos - 1) % len];
  return { text: `This pattern repeats: ${unit.join(" ")} ${unit.join(" ")} …\nWhat is shape number ${pos}?`, answerType: "choice", choices: unit, answer: ans, hint: `The pattern repeats every ${len} shapes. Divide ${pos} by ${len} and look at the remainder.`, steps: [`${pos} ÷ ${len} = ${Math.floor(pos / len)} R ${pos % len}`, pos % len === 0 ? `Remainder 0 means the LAST shape of the group: ${ans}` : `Remainder ${pos % len} means shape ${pos % len} in the group: ${ans}`] };
}

// ── Topic 15: angles ────────────────────────────────────────────────────────
export function angles(level) {
  if (level === 1) {
    const n = pick([2, 3, 4, 5, 6, 8, 9, 10, 12, 18, 36]), k = rand(1, n - 1);
    if (gcd(k, n) !== 1) return angles(level);
    const deg = (360 * k) / n;
    return { text: `An angle turns through ${fr(k, n)} of a circle. How many degrees is the angle?`, answerType: "number", answer: num(deg), wrong: cleanWrong(deg, [360 / n, (180 * k) / n, 360 - deg]), hint: `A full circle is 360°. Find ${fr(1, n)} of 360, then multiply by ${k}.`, steps: [`360 ÷ ${n} = ${360 / n}°`, `${k} × ${360 / n}° = ${deg}°`], visual: { kind: "angle", deg } };
  }
  if (level === 2) {
    const deg = pick([rand(10, 85), 90, rand(95, 175), 180]);
    const ans = deg < 90 ? "acute" : deg === 90 ? "right" : deg < 180 ? "obtuse" : "straight";
    return { text: `An angle measures ${deg}°. What kind of angle is it?`, answerType: "choice", choices: ["acute", "right", "obtuse", "straight"], answer: ans, hint: "Acute is less than 90°, right is exactly 90°, obtuse is between 90° and 180°, straight is 180°.", steps: [`${deg}° is ${ans}`], visual: { kind: "angle", deg } };
  }
  const kind = pick(["sum", "right", "straight"]);
  if (kind === "sum") {
    const a = rand(15, 80), b = rand(15, 90);
    return { text: `Angle ABC is made of two angles that measure ${a}° and ${b}°. What is the measure of angle ABC?`, answerType: "number", answer: num(a + b), wrong: cleanWrong(a + b, [Math.abs(a - b), 180 - a - b]), hint: "Angle measures add when angles sit side by side.", steps: [`${a}° + ${b}° = ${a + b}°`], visual: { kind: "angle", deg: a + b, split: a }, showVisual: true };
  }
  const whole = kind === "right" ? 90 : 180, a = rand(10, whole - 10);
  return { text: `A ${kind} angle (${whole}°) is split into two angles. One is ${a}°. What is the other?`, answerType: "number", answer: num(whole - a), wrong: cleanWrong(whole - a, [whole + a, (kind === "right" ? 180 : 90) - a]), hint: `The two parts add up to ${whole}°.`, steps: [`${whole}° − ${a}° = ${whole - a}°`], visual: { kind: "angle", deg: whole, split: a }, showVisual: true };
}

// ── Topic 16: lines, angles and shapes ──────────────────────────────────────
const LINE_Q = [
  ["Lines that never meet, no matter how long they are, are called…", "parallel", ["parallel", "perpendicular", "intersecting"]],
  ["Lines that meet to form right angles are called…", "perpendicular", ["parallel", "perpendicular", "intersecting"]],
  ["Lines that cross at one point (not always at a right angle) are called…", "intersecting", ["parallel", "perpendicular", "intersecting"]],
  ["Part of a line with ONE endpoint that goes on forever in one direction is a…", "ray", ["ray", "line segment", "line"]],
  ["Part of a line with TWO endpoints is a…", "line segment", ["ray", "line segment", "line"]],
];
const SYMMETRY = [["square", 4], ["rectangle (not a square)", 2], ["equilateral triangle", 3], ["isosceles triangle", 1], ["scalene triangle", 0], ["regular hexagon", 6], ["regular pentagon", 5], ["rhombus (not a square)", 2], ["parallelogram (not a rectangle)", 0]];
const QUADS = [
  ["4 equal sides and 4 right angles", "square"], ["opposite sides equal and 4 right angles, but not all sides equal", "rectangle"],
  ["4 equal sides but no right angles", "rhombus"], ["exactly one pair of parallel sides", "trapezoid"],
  ["two pairs of parallel sides, no right angles and not all sides equal", "parallelogram"],
];
export function geometry(level) {
  if (level === 1) { const [q, a, c] = pick(LINE_Q); return { text: q, answerType: "choice", choices: c, answer: a, hint: "Parallel = never meet. Perpendicular = meet at a square corner (right angle).", steps: [`The answer is: ${a}`] }; }
  if (level === 2) {
    if (chance(0.5)) {
      const a = pick([rand(20, 70), 90, rand(100, 140)]), b = rand(15, Math.min(70, 170 - a)), c = 180 - a - b;
      const kinds = [a, b, c];
      const ans = kinds.some((x) => x === 90) ? "right" : kinds.some((x) => x > 90) ? "obtuse" : "acute";
      return { text: `A triangle has angles of ${a}°, ${b}° and ${c}°. What kind of triangle is it?`, answerType: "choice", choices: ["acute", "right", "obtuse"], answer: ans, hint: "Look for a right angle (90°) or an angle bigger than 90°. If neither, it's acute.", steps: [`${ans === "right" ? "One angle is 90°" : ans === "obtuse" ? "One angle is more than 90°" : "All three angles are less than 90°"}, so it's ${ans}`] };
    }
    const s = pick([[5, 5, 5], [6, 6, 4], [7, 7, 3], [3, 4, 5], [5, 7, 9], [8, 8, 8], [4, 9, 9]]);
    const eq = new Set(s).size;
    const ans = eq === 1 ? "equilateral" : eq === 2 ? "isosceles" : "scalene";
    return { text: `A triangle has sides of ${s.join(" cm, ")} cm. What kind of triangle is it?`, answerType: "choice", choices: ["equilateral", "isosceles", "scalene"], answer: ans, hint: "All 3 sides equal: equilateral. Exactly 2 equal: isosceles. None equal: scalene.", steps: [`${eq === 1 ? "All three sides are equal" : eq === 2 ? "Two sides are equal" : "No sides are equal"}, so it's ${ans}`] };
  }
  if (chance(0.5)) { const [shape, n] = pick(SYMMETRY); return { text: `How many lines of symmetry does a ${shape} have?`, answerType: "number", answer: num(n), wrong: cleanWrong(n, [n + 1, n + 2, 4]), hint: "A line of symmetry folds the shape into two matching halves. Imagine folding it every way.", steps: [`A ${shape} has ${n} line${n === 1 ? "" : "s"} of symmetry`] }; }
  const [desc, ans] = pick(QUADS);
  return { text: `Which quadrilateral has ${desc}?`, answerType: "choice", choices: shuffle(["square", "rectangle", "rhombus", "trapezoid", "parallelogram"]), answer: ans, hint: "Check the sides (equal? parallel?) and the angles (right angles?).", steps: [`A ${ans} has ${desc}`] };
}
