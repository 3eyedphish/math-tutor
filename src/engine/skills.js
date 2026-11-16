// Skill registry. Each skill makes questions ("items") at a difficulty level.
// Math is always computed here, never by the AI.
//
// Item fields used by the UI:
//   text, answerType ('number'|'choice'|'multi'|'blanks'|'tiles'), answer,
//   choices, tiles, template (blanks), column, table, visual, story(theme),
//   wrong (common-mistake answers), hint, steps (worked solution), parts.
import {
  rand, pick, chance, shuffle, fmt, roundTo, nDigits, cleanWrong,
  noBorrowSubtract, noCarryAdd, borrowCount, carryCount, PLACE_NAMES,
} from "./util.js";
import { toWords, toTiles } from "./words.js";

const num = (n) => String(n);
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ── Mental math ─────────────────────────────────────────────────────────────
function mental(level) {
  const kinds = {
    1: ["tens", "double", "tensSub"],
    2: ["makeTen", "hundredMinus", "timesTens"],
    3: ["compAdd", "compSub", "timesTens"],
    4: ["thousandMinus", "bigTens", "timesTensBoth"],
    5: ["compBig", "times25", "split"],
  }[level];
  const k = pick(kinds);
  let a, b, answer, text, steps, wrong = [], hint, mis;
  if (k === "tens") { a = rand(1, 8) * 10; b = rand(1, 9 - a / 10) * 10; answer = a + b; text = `${a} + ${b}`; hint = `${a / 10} tens + ${b / 10} tens`; steps = [`${a / 10} tens + ${b / 10} tens = ${answer / 10} tens`, `${answer / 10} tens = ${answer}`]; wrong = [answer + 10, answer - 10, a / 10 + b / 10]; }
  else if (k === "tensSub") { a = rand(4, 9) * 10; b = rand(1, a / 10 - 1) * 10; answer = a - b; text = `${a} − ${b}`; hint = `${a / 10} tens take away ${b / 10} tens`; steps = [`${a / 10} tens − ${b / 10} tens = ${answer / 10} tens = ${answer}`]; wrong = [answer + 10, answer - 10]; }
  else if (k === "double") { a = pick([15, 25, 35, 45, 50, 75, 125, 250]); answer = a * 2; text = `${a} + ${a}`; hint = `Double ${a}`; steps = [`Double the tens and the ones separately`, `${a} + ${a} = ${answer}`]; wrong = [answer + 10, answer - 10, answer + 100]; }
  else if (k === "makeTen") { a = rand(2, 9) * 10 + rand(6, 9); b = rand(11 - (a % 10), 9); answer = a + b; const need = 10 - (a % 10); text = `${a} + ${b}`; hint = `Give ${need} to ${a} to make ${a + need}`; steps = [`${a} + ${need} = ${a + need}`, `${b} − ${need} = ${b - need} left`, `${a + need} + ${b - need} = ${answer}`]; wrong = [answer - 10, answer + 10, a + b - 10]; }
  else if (k === "hundredMinus") { b = rand(11, 89); answer = 100 - b; text = `100 − ${b}`; hint = `What adds to ${b} to make 100?`; steps = [`Count up: ${b} → ${Math.ceil(b / 10) * 10} is ${Math.ceil(b / 10) * 10 - b}`, `${Math.ceil(b / 10) * 10} → 100 is ${100 - Math.ceil(b / 10) * 10}`, `Total: ${answer}`]; wrong = [answer + 10, answer - 10, 110 - b]; }
  else if (k === "timesTens") { a = rand(2, 9); b = rand(2, 9) * 10; answer = a * b; text = `${a} × ${b}`; hint = `${a} × ${b / 10} tens`; steps = [`${a} × ${b / 10} = ${a * b / 10}`, `${a * b / 10} tens = ${answer}`]; wrong = [a * b / 10, answer * 10, answer + b]; }
  else if (k === "compAdd") { a = rand(1, 8) * 100 + pick([98, 99, 97]); b = rand(110, 499); const up = Math.ceil(a / 100) * 100; answer = a + b; text = `${a} + ${b}`; hint = `${a} is close to ${up}`; steps = [`${up} + ${b} = ${up + b}`, `We added ${up - a} too many, so take ${up - a} away`, `${up + b} − ${up - a} = ${answer}`]; wrong = [up + b, answer + 10, answer - 100]; mis = { [up + b]: "forgotAdjust" }; }
  else if (k === "compSub") { a = rand(4, 9) * 100 + rand(1, 9); b = rand(1, 3) * 100 - pick([1, 2, 3]); const up = Math.ceil(b / 100) * 100; answer = a - b; text = `${a} − ${b}`; hint = `${b} is close to ${up}`; steps = [`${a} − ${up} = ${a - up}`, `We took away ${up - b} too many, so add ${up - b} back`, `${a - up} + ${up - b} = ${answer}`]; wrong = [a - up, answer - 2 * (up - b), answer + 10]; mis = { [a - up]: "forgotAdjust", [answer - 2 * (up - b)]: "adjustWrongWay" }; }
  else if (k === "thousandMinus") { b = rand(101, 899); answer = 1000 - b; text = `1,000 − ${b}`; hint = `What adds to ${b} to make 1,000?`; steps = [`Count up to the next hundred, then to 1,000`, `${b} + ${answer} = 1,000`]; wrong = [1100 - b, answer + 10, noBorrowSubtract(1000, b)]; }
  else if (k === "bigTens") { a = rand(1, 8) * 500; b = rand(1, 4) * 500; answer = a + b; text = `${fmt(a)} + ${fmt(b)}`; hint = `Count in hundreds`; steps = [`${a / 100} hundreds + ${b / 100} hundreds = ${answer / 100} hundreds = ${fmt(answer)}`]; wrong = [answer + 100, answer - 500]; }
  else if (k === "timesTensBoth") { a = rand(2, 9) * 10; b = rand(2, 9) * 10; answer = a * b; text = `${a} × ${b}`; hint = `${a / 10} × ${b / 10}, then add two zeros`; steps = [`${a / 10} × ${b / 10} = ${a * b / 100}`, `Two zeros: ${fmt(answer)}`]; wrong = [answer / 10, answer * 10]; }
  else if (k === "compBig") { a = rand(1, 7) * 1000 + 999; b = rand(1100, 3999); answer = a + b; text = `${fmt(a)} + ${fmt(b)}`; hint = `${fmt(a)} is 1 less than ${fmt(a + 1)}`; steps = [`${fmt(a + 1)} + ${fmt(b)} = ${fmt(a + 1 + b)}`, `Take the 1 back: ${fmt(answer)}`]; wrong = [answer + 1, answer + 10, answer - 1000]; }
  else if (k === "times25") { b = pick([4, 8, 12, 16, 20, 24]); answer = 25 * b; text = `25 × ${b}`; hint = `Four 25s make 100`; steps = [`${b} ÷ 4 = ${b / 4} groups of four`, `${b / 4} × 100 = ${answer}`]; wrong = [answer + 25, answer - 25, answer * 2]; }
  else { a = rand(11, 19); b = rand(3, 9); answer = a * b; text = `${a} × ${b}`; hint = `Split ${a} into 10 and ${a - 10}`; steps = [`10 × ${b} = ${10 * b}`, `${a - 10} × ${b} = ${(a - 10) * b}`, `${10 * b} + ${(a - 10) * b} = ${answer}`]; wrong = [10 * b + a - 10 + b, answer + b, answer - b]; }
  return { text: `${text} = ?`, answerType: "number", answer: num(answer), wrong: cleanWrong(answer, wrong), hint, steps, mental: true, misconceptions: mis };
}

// ── Rounding ────────────────────────────────────────────────────────────────
function rounding(level, theme) {
  if (level === 5) {
    // Estimate a total by rounding each number (like the hot-dog question).
    const vals = [nDigits(4), nDigits(4), nDigits(4)];
    const rounded = vals.map((v) => roundTo(v, 1000));
    const answer = rounded.reduce((s, v) => s + v, 0);
    const exact = vals.reduce((s, v) => s + v, 0);
    return {
      text: `Round each number to the nearest thousand, then add to estimate the total.\n${vals.map(fmt).join(" + ")}`,
      answerType: "number", answer: num(answer),
      wrong: cleanWrong(answer, [roundTo(exact, 100), answer + 1000, answer - 1000, vals.map((v) => Math.floor(v / 1000) * 1000).reduce((s, v) => s + v, 0)]),
      hint: "Look at the hundreds digit: 5 or more rounds up.",
      steps: [...vals.map((v, i) => `${fmt(v)} → ${fmt(rounded[i])}`), `${rounded.map(fmt).join(" + ")} = ${fmt(answer)}`],
      story: (t) => `${t.place} sold ${t.things} three days in a row: ${vals.map(fmt).join(", ")}.\nRound each to the nearest thousand to estimate how many in all.`,
    };
  }
  const [digits, places] = { 1: [2, [10]], 2: [3, [10, 100]], 3: [4, [100, 1000]], 4: [5, [1000, 10000]] }[level];
  const place = pick(places);
  let n = nDigits(digits);
  // Make "exactly 5" boundary cases show up sometimes.
  if (chance(0.25)) n = Math.floor(n / (place * 10)) * place * 10 + 5 * (place / 10) + (place >= 100 ? rand(0, place / 10 - 1) : 0);
  if (n < place) n += place;
  const answer = roundTo(n, place);
  const lo = Math.floor(n / place) * place, hi = lo + place;
  return {
    text: `Round ${fmt(n)} to the nearest ${PLACE_NAMES[place]}.`,
    answerType: "number", answer: num(answer),
    wrong: cleanWrong(answer, [answer === lo ? hi : lo, roundTo(n, place * 10), roundTo(n, place / 10 || 1), n]),
    misconceptions: { [answer === lo ? hi : lo]: "roundWrongWay", [n]: "notRounded", [roundTo(n, place * 10)]: "wrongPlace", [roundTo(n, place / 10 || 1)]: "wrongPlace" },
    hint: `Is ${fmt(n)} closer to ${fmt(lo)} or ${fmt(hi)}?`,
    steps: [`${fmt(n)} is between ${fmt(lo)} and ${fmt(hi)}`, `Halfway is ${fmt(lo + place / 2)}`, `${fmt(n)} ${n >= lo + place / 2 ? "is at or past" : "is before"} halfway, so it rounds to ${fmt(answer)}`],
    visual: { kind: "numberline", lo, hi, value: n },
    story: (t) => `${t.hero} counted ${fmt(n)} ${t.things}. About how many is that, to the nearest ${PLACE_NAMES[place]}?`,
  };
}

// ── Estimate & check ────────────────────────────────────────────────────────
function makeEquation(digits) {
  const add = chance(0.5);
  let a = nDigits(digits), b = add ? nDigits(digits - rand(0, 1)) : rand(10 ** (digits - 2), a - 1);
  const truth = add ? a + b : a - b;
  return { a, b, op: add ? "+" : "−", truth };
}
function falseVersion(e) {
  const options = [
    e.op === "+" ? noCarryAdd(e.a, e.b) : noBorrowSubtract(e.a, e.b),
    e.truth + pick([1000, -1000, 10000, -10000, 100, -100]),
    e.truth + pick([2, -2, 20, -20]),
  ].filter((v) => v > 0 && v !== e.truth);
  return pick(options);
}
function estimate(level, theme) {
  if (level <= 2) {
    const digits = level + 2, place = level === 1 ? 100 : 1000;
    const e = makeEquation(digits);
    const ra = roundTo(e.a, place), rb = roundTo(e.b, place);
    const answer = e.op === "+" ? ra + rb : ra - rb;
    const choices = shuffle([answer, ...cleanWrong(answer, [answer + place, answer - place, answer + 2 * place, answer + 10 * place], 3)].map(fmt));
    return {
      text: `Which is the best estimate?\n${fmt(e.a)} ${e.op} ${fmt(e.b)}`,
      answerType: "choice", answer: fmt(answer), choices,
      hint: `Round both numbers to the nearest ${PLACE_NAMES[place]} first.`,
      steps: [`${fmt(e.a)} → ${fmt(ra)}`, `${fmt(e.b)} → ${fmt(rb)}`, `${fmt(ra)} ${e.op} ${fmt(rb)} = ${fmt(answer)}`],
    };
  }
  // Select all the true equations (like assessment question 7).
  const n = level === 3 ? 3 : 5, digits = level === 3 ? 4 : 5;
  const eqs = Array.from({ length: n }, () => {
    const e = makeEquation(digits);
    const isTrue = chance(0.45);
    return { ...e, shown: isTrue ? e.truth : falseVersion(e), isTrue };
  });
  if (!eqs.some((e) => e.isTrue)) { eqs[0].shown = eqs[0].truth; eqs[0].isTrue = true; }
  const label = (e) => `${fmt(e.a)} ${e.op} ${fmt(e.b)} = ${fmt(e.shown)}`;
  return {
    text: "Which equations are true? Select all that apply.",
    answerType: "multi", choices: eqs.map(label), answer: eqs.filter((e) => e.isTrue).map(label).sort(),
    hint: "Estimate first: round each number. If the answer is far from your estimate, it's false. Then check the ones digits.",
    steps: eqs.map((e) => `${fmt(e.a)} ${e.op} ${fmt(e.b)} really = ${fmt(e.truth)} → ${e.isTrue ? "TRUE ✓" : "false ✗"}`),
  };
}

// ── Addition with regrouping ────────────────────────────────────────────────
function addition(level) {
  let nums;
  if (level === 1) { do nums = [rand(15, 79), rand(15, 79)]; while (carryCount(...nums) < 1 || nums[0] + nums[1] > 99); }
  else if (level === 2) { do nums = [nDigits(3), nDigits(3)]; while (carryCount(...nums) < 1 || nums[0] + nums[1] > 999); }
  else if (level === 3) { do nums = [nDigits(4), nDigits(4)]; while (carryCount(...nums) < 2); }
  else if (level === 4) nums = [nDigits(4), nDigits(4), nDigits(4)];
  else if (level === 5) { do nums = [nDigits(5), nDigits(5)]; while (carryCount(...nums) < 2); }
  // Lesson 2-4: greater numbers, up to hundred thousands.
  else { do nums = chance(0.6) ? [nDigits(6), rand(10000, 399999)] : [nDigits(6), nDigits(5), nDigits(5)]; while (carryCount(nums[0], nums[1]) < 2 || nums.reduce((s, v) => s + v, 0) > 999999); }
  const answer = nums.reduce((s, v) => s + v, 0);
  const noCarry = nums.reduce((s, v) => noCarryAdd(s, v));
  return {
    text: `${nums.map(fmt).join(" + ")} = ?`,
    answerType: "number", answer: num(answer),
    column: { rows: nums, op: "+" },
    wrong: cleanWrong(answer, [noCarry, answer + 10, answer - 100, answer + 1000]),
    misconceptions: { [noCarry]: "forgotCarry" },
    hint: "Start with the ones. If a column adds to 10 or more, carry the ten to the next column.",
    steps: [`Line up the places and add right to left`, `Carry whenever a column makes 10 or more`, `Total: ${fmt(answer)}`, `Check: does ${nums.map((v) => fmt(roundTo(v, 10 ** (String(v).length - 1)))).join(" + ")} come out close? ✓`],
    visual: { kind: "placevalue", nums, op: "+" },
    num: { nums, op: "+" },
    story: (t) => nums.length === 2
      ? `${t.hero} found ${fmt(nums[0])} ${t.things} on Monday and ${fmt(nums[1])} on Tuesday. How many ${t.things} in all?`
      : `${t.place} sold ${nums.map(fmt).join(", ")} ${t.things} on three days. How many altogether?`,
  };
}

// ── Subtraction with regrouping ─────────────────────────────────────────────
function subtraction(level) {
  let a, b;
  if (level === 1) { do { a = rand(30, 99); b = rand(11, a - 5); } while (borrowCount(a, b) < 1); }
  else if (level === 2) { do { a = nDigits(3); b = rand(100, a - 10); } while (borrowCount(a, b) !== 1); }
  else if (level === 3) { do { a = nDigits(3); b = rand(100, a - 10); } while (borrowCount(a, b) < 2); }
  else if (level === 4) { do { a = nDigits(4); b = rand(1000, a - 50); } while (borrowCount(a, b) < 2); }
  else if (level === 5) { a = pick([rand(2, 9) * 1000, rand(2, 9) * 1000 + rand(1, 9), rand(2, 9) * 1000 + rand(1, 9) * 100]); do b = rand(1001, a - 100); while (borrowCount(a, b) < 2); }
  else if (level === 6) { do { a = nDigits(5); b = rand(10000, a - 500); } while (borrowCount(a, b) < 2); }
  // Lesson 2-7: six-digit numbers and regrouping across zeros (700,402 − 297,354).
  else { do { a = rand(2, 9) * 100000 + pick([0, rand(1, 9) * 100, rand(1, 9) * 10000 + rand(1, 9) * 100, rand(0, 9) * 100 + rand(1, 9)]); b = rand(100000, a - 5000); } while (borrowCount(a, b) < 3); }
  const answer = a - b;
  return {
    text: `${fmt(a)} − ${fmt(b)} = ?`,
    answerType: "number", answer: num(answer),
    column: { rows: [a, b], op: "−" },
    wrong: cleanWrong(answer, [noBorrowSubtract(a, b), answer + 10, answer + 100, answer - 1000]),
    misconceptions: { [noBorrowSubtract(a, b)]: "noRegroup" },
    hint: "Start with the ones. If the top digit is smaller, regroup: borrow 1 from the next place.",
    steps: [`Work right to left`, `When the top digit is too small, borrow from the next place${/0/.test(String(a)) ? " (across zeros, borrow from the first non-zero digit)" : ""}`, `${fmt(a)} − ${fmt(b)} = ${fmt(answer)}`, `Check with addition: ${fmt(answer)} + ${fmt(b)} = ${fmt(a)} ✓`],
    visual: { kind: "placevalue", nums: [a, b], op: "−" },
    num: { nums: [a, b], op: "−" },
    story: (t) => `${t.hero} had ${fmt(a)} ${t.things}. ${fmt(b)} ${t.away}. How many ${t.things} are left?`,
  };
}

// ── Missing-digit puzzles ───────────────────────────────────────────────────
function puzzleSolutions(rows, result, op) {
  const letters = ["A", "B"].filter((L) => [...rows.flat(), ...result].includes(L));
  let count = 0;
  for (let x = 0; x < 10 ** letters.length; x++) {
    const d = String(x).padStart(letters.length, "0");
    const f = (chars) => chars.map((c) => (c === "A" ? d[0] : c === "B" ? d[1] : c)).join("");
    const A = f(rows[0]), B = f(rows[1]), R = f(result);
    if (A[0] === "0" || (R.length > 1 && R[0] === "0")) continue;
    if (op === "−" ? +A - +B === +R : +A + +B === +R) count++;
  }
  return count;
}
function missingDigit(level) {
  for (let tries = 0; tries < 50; tries++) {
    const it = missingDigitOnce(level);
    if (puzzleSolutions(it.column.rows, it.column.result, it.column.op) === 1) return it;
  }
  return missingDigitOnce(1, true);
}
function missingDigitOnce(level, single) {
  const digits = level + 2;
  const sub = chance(0.6);
  let a, b, r;
  if (sub) { do { a = nDigits(digits); b = rand(10 ** (digits - 1), a - 10); } while (borrowCount(a, b) < 1); r = a - b; }
  else { do { a = nDigits(digits); b = nDigits(digits); } while (carryCount(a, b) < 1); r = a + b; }
  const rows = sub ? [a, b, r] : [a, b, r];
  // Hide one digit in the top number and one in the result (two at level 3).
  const hideCount = single ? 1 : level === 3 ? 2 : pick([1, 2]);
  const slots = [];
  const usedRows = shuffle([0, 2]).slice(0, hideCount);
  for (const row of usedRows) {
    const s = String(rows[row]);
    const pos = rand(row === 0 ? 1 : 0, s.length - 1); // never hide a leading digit of the top number
    slots.push({ row, pos, digit: s[pos] });
  }
  const letters = ["A", "B"];
  const display = rows.map((v, row) => {
    const chars = String(v).split("");
    slots.forEach((sl, i) => { if (sl.row === row) chars[sl.pos] = letters[i]; });
    return chars;
  });
  return {
    text: `Find the missing digits.`,
    answerType: "blanks",
    template: slots.map((_, i) => ({ pre: `${letters[i]} = `, label: letters[i], post: "" })),
    answer: slots.map((s) => s.digit),
    column: { rows: display.slice(0, 2), result: display[2], op: sub ? "−" : "+", puzzle: true },
    hint: sub ? "Use addition to check: bottom + answer = top." : "Work column by column from the right, remembering carries.",
    steps: [`The full problem is ${fmt(a)} ${sub ? "−" : "+"} ${fmt(b)} = ${fmt(r)}`, ...slots.map((s, i) => `${letters[i]} = ${s.digit}`)],
  };
}

// ── Place value & number names ──────────────────────────────────────────────
function placeValue(level) {
  const digits = { 1: 3, 2: 4, 3: 5, 4: 6, 5: pick([4, 5, 6]) }[level];
  let n = nDigits(digits);
  if (chance(0.3)) { const s = String(n).split(""); s[rand(1, s.length - 2)] = "0"; n = Number(s.join("")); }
  const kind = pick(level === 5 ? ["toNumber", "valueOf", "moreLess", "expanded"] : ["toWords", "toNumber", "expanded", "valueOf", "nameChoice"]);
  if (kind === "toWords") {
    const tiles = toTiles(n);
    const near = toTiles(n + pick([1, 10, 100, 2]));
    const extras = shuffle(near.filter((w) => !tiles.includes(w))).slice(0, 3);
    return {
      text: `Build the number name for ${fmt(n)}.`,
      answerType: "tiles", answer: tiles.join(" "), tiles: shuffle([...tiles, ...extras]),
      hint: "Say the number out loud, then tap the words in order. Commas tell you where 'thousand' goes.",
      steps: [`${fmt(n)} is read "${toWords(n)}"`],
    };
  }
  if (kind === "nameChoice") {
    const s = String(n);
    const swap = Number(s.slice(0, -2) + s.slice(-1) + s.slice(-2, -1));
    const choices = shuffle([n, ...cleanWrong(n, [n + 2, n - 4, swap, n + 10 * pick([1, -1]), n - 18], 3)].map(toWords));
    return { text: `Which is the number name for ${fmt(n)}?`, answerType: "choice", answer: toWords(n), choices, hint: "Read it out loud, one comma group at a time.", steps: [`${fmt(n)} = "${toWords(n)}"`] };
  }
  if (kind === "toNumber") {
    return { text: `Write the number:\n"${toWords(n)}"`, answerType: "number", answer: num(n), wrong: cleanWrong(n, [Number(String(n).replace(/0/g, "")) || n + 1, n * 10, n + 1000]), hint: "Write the thousands part first, then a comma, then the rest.", steps: [`"${toWords(n)}" = ${fmt(n)}`] };
  }
  if (kind === "expanded") {
    const parts = String(n).split("").map((d, i, arr) => Number(d) * 10 ** (arr.length - 1 - i)).filter((v) => v > 0);
    const hideIdx = shuffle(parts.map((_, i) => i)).slice(0, Math.min(2, parts.length - 1));
    return {
      text: `Write ${fmt(n)} in expanded form.`,
      answerType: "blanks",
      template: parts.map((p, i) => (hideIdx.includes(i) ? { label: "?" } : { fixed: fmt(p) })),
      answer: hideIdx.sort((x, y) => x - y).map((i) => num(parts[i])),
      joiner: "+",
      hint: "Each digit times its place value. Skip any zeros.",
      steps: [`${fmt(n)} = ${parts.map(fmt).join(" + ")}`],
    };
  }
  if (kind === "moreLess") {
    const step = pick([10, 100, 1000]), more = chance(0.5);
    const answer = more ? n + step : n - step;
    return { text: `What is ${fmt(step)} ${more ? "more" : "less"} than ${fmt(n)}?`, answerType: "number", answer: num(answer), wrong: cleanWrong(answer, [more ? n + step / 10 : n - step / 10, more ? n + step * 10 : n - step * 10]), hint: `Only the ${PLACE_NAMES[step]}s digit changes (unless it has to regroup).`, steps: [`${fmt(n)} ${more ? "+" : "−"} ${fmt(step)} = ${fmt(answer)}`] };
  }
  // valueOf
  const s = String(n);
  const idx = rand(0, s.length - 1);
  if (s[idx] === "0") return placeValue(level);
  const value = Number(s[idx]) * 10 ** (s.length - 1 - idx);
  return { text: `What is the value of the ${s[idx]} in ${fmt(n)}?`, answerType: "number", answer: num(value), wrong: cleanWrong(value, [Number(s[idx]), value * 10, value / 10]), misconceptions: { [Number(s[idx])]: "digitNotValue" }, hint: "Find its place: ones, tens, hundreds, thousands…", steps: [`The ${s[idx]} is in the ${["ones", "tens", "hundreds", "thousands", "ten thousands", "hundred thousands"][s.length - 1 - idx]} place`, `So it is worth ${fmt(value)}`] };
}

// ── Data-table word problems ────────────────────────────────────────────────
function dataTables(level, theme) {
  const t = theme;
  if (level <= 2) {
    const d = level === 1 ? 3 : 4;
    const days = ["Friday", "Saturday", "Sunday"];
    const vals = days.map(() => nDigits(d));
    const pickTwo = level === 1;
    const used = pickTwo ? shuffle([0, 1, 2]).slice(0, 2).sort() : [0, 1, 2];
    const answer = used.reduce((s, i) => s + vals[i], 0);
    return {
      text: pickTwo ? `How many ${t.things} were sold on ${used.map((i) => days[i]).join(" and ")} together?` : `How many ${t.things} were sold over the whole weekend?`,
      table: { title: cap(`${t.place}: ${t.things} sold`), headers: ["Day", "Sold"], rows: days.map((dname, i) => [dname, fmt(vals[i])]) },
      answerType: "number", answer: num(answer),
      wrong: cleanWrong(answer, [used.slice(0, -1).reduce((s, i) => s + vals[i], 0), vals.reduce((s, v) => s + v, 0), answer + 100]),
      hint: "Find the right rows in the table first, then add.",
      steps: [...used.map((i) => `${days[i]}: ${fmt(vals[i])}`), `${used.map((i) => fmt(vals[i])).join(" + ")} = ${fmt(answer)}`],
    };
  }
  // Two-group comparison (like the birds-in-the-park question), done in parts.
  const [k1, k2] = t.kinds;
  const last = [nDigits(4), nDigits(4)], now = [nDigits(4), nDigits(4)];
  const tl = last[0] + last[1], tn = now[0] + now[1];
  const more = tn >= tl ? "this year" : "last year";
  const diff = Math.abs(tn - tl);
  const table = { title: cap(`${k1} and ${k2} spotted in ${t.place}`), headers: ["Year", k1, k2], rows: [["Last year", fmt(last[0]), fmt(last[1])], ["This year", fmt(now[0]), fmt(now[1])]] };
  const parts = [
    { text: `Step 1: How many ${k1.toLowerCase()} and ${k2.toLowerCase()} in all LAST year?`, answerType: "number", answer: num(tl), wrong: cleanWrong(tl, [noCarryAdd(...last), tl + 100]), hint: "Add across the 'Last year' row.", steps: [`${fmt(last[0])} + ${fmt(last[1])} = ${fmt(tl)}`] },
    { text: `Step 2: How many in all THIS year?`, answerType: "number", answer: num(tn), wrong: cleanWrong(tn, [noCarryAdd(...now), tn + 100]), hint: "Add across the 'This year' row.", steps: [`${fmt(now[0])} + ${fmt(now[1])} = ${fmt(tn)}`] },
    { text: `Step 3: How many more were seen ${more}?`, answerType: "number", answer: num(diff), wrong: cleanWrong(diff, [noBorrowSubtract(Math.max(tl, tn), Math.min(tl, tn)), diff + 100, tl + tn]), hint: "Subtract the smaller total from the bigger total.", steps: [`${fmt(Math.max(tl, tn))} − ${fmt(Math.min(tl, tn))} = ${fmt(diff)}`] },
  ];
  if (level === 4) {
    const est = Math.abs((roundTo(now[0], 100) + roundTo(now[1], 100)) - (roundTo(last[0], 100) + roundTo(last[1], 100)));
    parts.push({ text: `Step 4: Check it. Round every number to the nearest hundred and find the difference again.`, answerType: "number", answer: num(est), wrong: cleanWrong(est, [roundTo(diff, 100), est + 100]), hint: "Round all four numbers first, then do steps 1–3 again with the rounded numbers.", steps: [`Rounded difference = ${fmt(est)}`, `Is ${fmt(diff)} close to ${fmt(est)}? Then your answer is reasonable ✓`] });
  }
  return { text: `Use the table. We'll solve it in steps.`, table, parts, answerType: "parts", answer: null, hint: "Big problems are just small problems in a row." };
}

// ── Multi-step word problems ────────────────────────────────────────────────
function wordProblems(level, theme) {
  const t = theme;
  const [p1, p2, p3] = shuffle(t.names);
  if (level === 1) {
    const k = pick(["groups", "share", "left"]);
    if (k === "groups") { const a = rand(3, 9), b = rand(4, 12), answer = a * b; return { text: `${a} friends each have ${b} ${t.things}. How many ${t.things} in all?`, answerType: "number", answer: num(answer), wrong: cleanWrong(answer, [a + b, answer + a]), misconceptions: { [a + b]: "wrongOperation" }, hint: `${a} equal groups of ${b}`, steps: [`${a} × ${b} = ${answer}`] }; }
    if (k === "share") { const g = rand(3, 9), each = rand(3, 10), total = g * each; return { text: `${p1} put ${total} ${t.things} into ${g} equal boxes. How many in each box?`, answerType: "number", answer: num(each), wrong: cleanWrong(each, [total - g, each + 1]), hint: `${total} ÷ ${g}`, steps: [`${total} ÷ ${g} = ${each}`, `Check: ${g} × ${each} = ${total} ✓`] }; }
    const a = rand(120, 400), b = rand(25, 99), answer = a - b; return { text: `A trip to ${t.place} is ${a} miles. ${p1} has gone ${b} miles. How many more miles to go?`, answerType: "number", answer: num(answer), wrong: cleanWrong(answer, [a + b, noBorrowSubtract(a, b)]), misconceptions: { [a + b]: "wrongOperation", [noBorrowSubtract(a, b)]: "noRegroup" }, hint: "Total minus the part already done.", steps: [`${a} − ${b} = ${answer}`] };
  }
  if (level === 2) {
    // "Lisa travels 9 less than Dean; Pam twice as far as Lisa."
    const a = rand(10, 30), less = rand(2, a - 3), times = pick([2, 3]);
    const mid = a - less, answer = mid * times;
    return { text: `${p1} has ${a} ${t.things}. ${p2} has ${less} fewer than ${p1}. ${p3} has ${times === 2 ? "twice" : "three times"} as many as ${p2}. How many ${t.things} does ${p3} have?`, answerType: "number", answer: num(answer), wrong: cleanWrong(answer, [a * times, mid, (a + less) * times, a - less * times]), hint: `First find how many ${p2} has.`, steps: [`${p2}: ${a} − ${less} = ${mid}`, `${p3}: ${mid} × ${times} = ${answer}`] };
  }
  if (level === 3) {
    const packs = rand(3, 8), per = rand(6, 12), gave = rand(5, packs * per - 5);
    const answer = packs * per - gave;
    return { text: `${p1} bought ${packs} packs of ${t.things} with ${per} in each pack. ${p1} gave ${gave} to ${p2}. How many are left?`, answerType: "number", answer: num(answer), wrong: cleanWrong(answer, [packs * per, packs + per - gave, packs * per + gave]), hint: "Step 1: how many in all? Step 2: take away what was given.", steps: [`${packs} × ${per} = ${packs * per}`, `${packs * per} − ${gave} = ${answer}`] };
  }
  const price = rand(3, 9), qty = rand(4, 9), paid = Math.ceil((price * qty + rand(1, 20)) / 10) * 10, friends = pick([2, 3, 4]);
  const cost = price * qty;
  return { text: `At ${t.place}, ${t.things} cost $${price} each. ${p1} buys ${qty} and pays with $${paid}. How much change?`, answerType: "number", answer: num(paid - cost), wrong: cleanWrong(paid - cost, [cost, paid - price - qty, paid - cost + price]), hint: "Find the cost first, then subtract from what was paid.", steps: [`Cost: ${qty} × $${price} = $${cost}`, `Change: $${paid} − $${cost} = $${paid - cost}`] };
}

// ── Times tables (per-fact spaced repetition) ───────────────────────────────
export const FACT_TABLES = { 1: [2, 5, 10], 2: [3, 4, 6], 3: [7, 8, 9], 4: [11, 12], 5: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };
function facts(level, theme, ctx) {
  const tables = FACT_TABLES[level];
  // ctx.pickFact chooses the weakest facts more often (spaced repetition).
  const [a, b] = ctx?.pickFact ? ctx.pickFact(tables) : [pick(tables), rand(1, 12)];
  const answer = a * b;
  const form = level >= 2 && chance(0.25) ? pick(["missing", "family", "even"]) : "plain";
  const base = { fact: [a, b] };
  if (form === "missing") return { ...base, text: `${a} × ? = ${answer}`, answerType: "number", answer: num(b), wrong: cleanWrong(b, [b + 1, b - 1, answer - a]), hint: `Count by ${a}s until you reach ${answer}.`, steps: [`${a} × ${b} = ${answer}`, `So ${answer} ÷ ${a} = ${b}`] };
  if (form === "family") return { ...base, text: `Complete the fact family.`, answerType: "blanks", template: [{ pre: `${a} × `, label: "?", post: ` = ${answer}` }, { pre: "", label: "?", post: ` × ${a} = ${answer}` }, { pre: `${answer} ÷ ${a} = `, label: "?", post: "" }], answer: [num(b), num(b), num(b)], hint: "All four facts use the same three numbers.", steps: [`${a} × ${b} = ${answer}`, `${b} × ${a} = ${answer}`, `${answer} ÷ ${a} = ${b}`, `${answer} ÷ ${b} = ${a}`] };
  if (form === "even") {
    const eqs = shuffle([[a, b], [rand(1, 9), rand(1, 9)], [pick([3, 5, 7, 9]), pick([3, 5, 7])], [pick([2, 4, 6]), rand(1, 9)], [rand(1, 9), rand(1, 9)]]);
    const uniq = [...new Map(eqs.map((e) => [`${e[0]} × ${e[1]}`, e])).values()];
    const label = (e) => `${e[0]} × ${e[1]} = n`;
    return { ...base, text: "Select all the equations with an EVEN product.", answerType: "multi", choices: uniq.map(label), answer: uniq.filter((e) => (e[0] * e[1]) % 2 === 0).map(label).sort(), hint: "If either number is even, the product is even!", steps: uniq.map((e) => `${e[0]} × ${e[1]} = ${e[0] * e[1]} → ${(e[0] * e[1]) % 2 === 0 ? "even ✓" : "odd"}`) };
  }
  return { ...base, text: `${a} × ${b} = ?`, answerType: "number", answer: num(answer), wrong: cleanWrong(answer, [answer + a, answer - a, a + b, answer + b]), misconceptions: { [a + b]: "wrongOperation", [answer + a]: "skipCountSlip", [answer - a]: "skipCountSlip", [answer + b]: "skipCountSlip" }, hint: a === 12 || b === 12 ? `12 × ${a === 12 ? b : a} = 10 × ${a === 12 ? b : a} + 2 × ${a === 12 ? b : a}` : `Skip count by ${a}s, ${b} times.`, steps: [a === 12 || b === 12 ? `10 × ${a === 12 ? b : a} = ${10 * (a === 12 ? b : a)}, 2 × ${a === 12 ? b : a} = ${2 * (a === 12 ? b : a)}, total ${answer}` : `${a} × ${b} = ${answer}`], visual: { kind: "array", rows: a, cols: b }, story: (t) => `${t.hero} lines up ${t.things} in ${a} rows of ${b}. How many ${t.things}?`, mental: true };
}

// ── Division ────────────────────────────────────────────────────────────────
function division(level, theme) {
  if (level === 1) { const divisor = rand(2, 9), quotient = rand(2, 10), dividend = divisor * quotient; return { text: `${dividend} ÷ ${divisor} = ?`, answerType: "number", answer: num(quotient), wrong: cleanWrong(quotient, [dividend - divisor, quotient + 1, divisor]), hint: `What times ${divisor} equals ${dividend}?`, steps: [`${divisor} × ${quotient} = ${dividend}`, `So ${dividend} ÷ ${divisor} = ${quotient}`], visual: { kind: "array", rows: divisor, cols: quotient }, story: (t) => `${dividend} ${t.things} are shared equally among ${divisor} friends. How many each?`, mental: true }; }
  if (level === 2) { const divisor = rand(3, 12), quotient = rand(3, 12), dividend = divisor * quotient; return { text: `${dividend} ÷ ? = ${quotient}`, answerType: "number", answer: num(divisor), wrong: cleanWrong(divisor, [quotient, divisor + 1, dividend - quotient]), hint: `${quotient} × ? = ${dividend}`, steps: [`${quotient} × ${divisor} = ${dividend}`, `So ${dividend} ÷ ${divisor} = ${quotient}`] }; }
  const divisor = rand(3, 9), quotient = rand(3, 12), remainder = rand(1, divisor - 1), dividend = divisor * quotient + remainder;
  return { text: `${dividend} ÷ ${divisor} = ?  (with a remainder)`, answerType: "number", allowR: true, answer: `${quotient}r${remainder}`, wrong: [`${quotient + 1}r${remainder}`, `${quotient}r${remainder + 1 < divisor ? remainder + 1 : 0}`], hint: `Find the biggest ${divisor}× fact that fits under ${dividend}.`, steps: [`${divisor} × ${quotient} = ${divisor * quotient}`, `${dividend} − ${divisor * quotient} = ${remainder} left over`, `Answer: ${quotient} R ${remainder}`], story: (t) => `${dividend} ${t.things} go into bags of ${divisor}. How many full bags, and how many left over? (type like 7r2)` };
}

// ── Area & perimeter ────────────────────────────────────────────────────────
function areaPerimeter(level, theme) {
  const w = rand(2, level >= 3 ? 12 : 9), h = rand(2, 9);
  if (level === 1) return { text: `What is the area of this rectangle?`, answerType: "number", answer: num(w * h), wrong: cleanWrong(w * h, [2 * (w + h), w + h, w * h + w]), misconceptions: { [2 * (w + h)]: "areaPerimeter", [w + h]: "wrongOperation" }, hint: "Area = length × width (count the squares!)", steps: [`${w} × ${h} = ${w * h} square units`], visual: { kind: "rect", w, h, grid: true, unit: "cm" }, showVisual: true, story: (t) => `${t.hero}'s garden is ${w} feet long and ${h} feet wide. What is its area in square feet?` };
  if (level === 2) return { text: `What is the perimeter of this rectangle?`, answerType: "number", answer: num(2 * (w + h)), wrong: cleanWrong(2 * (w + h), [w * h, w + h]), misconceptions: { [w * h]: "areaPerimeter", [w + h]: "halfPerimeter" }, hint: "Perimeter = add up all four sides.", steps: [`${w} + ${h} + ${w} + ${h} = ${2 * (w + h)}`], visual: { kind: "rect", w, h, unit: "ft" }, showVisual: true, story: (t) => `${t.hero} builds a fence around a ${w} ft by ${h} ft pen. How many feet of fence?` };
  if (level === 3) {
    const target = pick([12, 16, 18, 24, 36]);
    const goods = [];
    for (let i = 1; i <= 12; i++) if (target % i === 0 && target / i <= 12 && i <= target / i) goods.push([i, target / i]);
    const right = shuffle(goods).slice(0, rand(1, Math.min(3, goods.length)));
    const wrongs = [];
    while (wrongs.length < 5 - right.length) { const a = rand(2, 9), b = rand(2, 12); if (a * b !== target && !wrongs.some((x) => x[0] === a && x[1] === b)) wrongs.push([a, b]); }
    const all = shuffle([...right, ...wrongs]);
    const label = (r) => `${r[0]} cm × ${r[1]} cm`;
    return { text: `Select ALL the rectangles with an area of ${target} square cm.`, answerType: "multi", choices: all.map(label), answer: right.map(label).sort(), shapes: all, hint: "Multiply the two sides of each one.", steps: all.map((r) => `${label(r)} = ${r[0] * r[1]} sq cm ${r[0] * r[1] === target ? "✓" : ""}`) };
  }
  const area = w * h;
  return chance(0.5)
    ? { text: `A rectangle has an area of ${area} square cm. One side is ${w} cm. How long is the other side?`, answerType: "number", answer: num(h), wrong: cleanWrong(h, [area - w, h + 1]), hint: `${w} × ? = ${area}`, steps: [`${area} ÷ ${w} = ${h} cm`] }
    : { text: `A rectangle has a perimeter of ${2 * (w + h)} cm. One side is ${w} cm. How long is the other side?`, answerType: "number", answer: num(h), wrong: cleanWrong(h, [2 * (w + h) - w, (2 * (w + h)) / 2]), hint: "Two sides of each length. Half the perimeter is one long + one short side.", steps: [`Half of ${2 * (w + h)} = ${w + h}`, `${w + h} − ${w} = ${h} cm`] };
}

// ── Properties & expressions ────────────────────────────────────────────────
function properties(level) {
  if (level === 1) {
    const a = rand(3, 8), b = rand(2, 9);
    const rep = (n, k) => Array(k).fill(n).join(" + ");
    const right = rep(b, a);
    const choices = shuffle([right, ...cleanWrong(right, [rep(b, a - 1), rep(b, a + 1), rep(a + b, 2)], 3)]);
    return { text: `Which addition shows ${a} × ${b}?`, answerType: "choice", answer: right, choices, hint: `${a} × ${b} means ${a} groups of ${b}.`, steps: [`${a} groups of ${b}: ${right} = ${a * b}`] };
  }
  if (level === 2) {
    const a = rand(6, 9), b = rand(6, 9), split = rand(2, b - 2);
    return { text: `Break apart to multiply.`, answerType: "blanks", template: [{ pre: `${a} × ${b} = ${a} × ${split} + ${a} × `, label: "?", post: "" }, { pre: `${a * split} + ${a * (b - split)} = `, label: "?", post: "" }], answer: [num(b - split), num(a * b)], hint: `${split} + ? = ${b}`, steps: [`${split} + ${b - split} = ${b}`, `${a} × ${split} = ${a * split}`, `${a} × ${b - split} = ${a * (b - split)}`, `Total ${a * b}`] };
  }
  // Which rewrites keep the same total? (like assessment question 9)
  const nums = [rand(11, 19) * 100 + pick([25, 50, 75]), rand(11, 19) * 100 + pick([25, 50]), rand(10, 19) * 100 + 50];
  const [x, y, z] = nums;
  const total = x + y + z;
  const opts = [
    [`${fmt(y)} + ${fmt(z)} + ${fmt(x)} = n`, true],
    [`(${fmt(x)} + ${fmt(z)}) + ${fmt(y)} = n`, true],
    [`${fmt(x)} + ${fmt(z)} = n`, false],
    [`(${fmt(x - (x % 100))} + ${fmt(y - (y % 100))} + ${fmt(z - (z % 100))}) + (${x % 100} + ${y % 100} + ${z % 100}) = n`, true],
    [`${fmt(x)} + ${fmt(y)} + ${fmt(z + 100)} = n`, false],
  ];
  return { text: `${nums.map(fmt).join(" + ")} = n\nSelect ALL the equations that give the same n.`, answerType: "multi", choices: shuffle(opts.map((o) => o[0])), answer: opts.filter((o) => o[1]).map((o) => o[0]).sort(), hint: "You can change the ORDER or GROUPING, or split numbers into parts, but you can't drop or change a number.", steps: opts.map((o) => `${o[0]} → ${o[1] ? "same ✓" : "different ✗"}`) };
}

// ── Comparing numbers & place-value patterns (Lessons 1-2, 1-3) ──────────────
const PLACE_WORD = ["ones", "tens", "hundreds", "thousands", "ten thousands", "hundred thousands"];
const SYMBOLS = ["<", "=", ">"];
function compareNums(level) {
  if (level <= 2) {
    // Two numbers that share their first digits, so she has to find the first place that differs.
    const d = level === 1 ? pick([3, 4]) : pick([5, 6]);
    const a = nDigits(d);
    const s = String(a).split("");
    const at = rand(1, d - 1);
    let b;
    if (chance(0.12)) b = a;
    else { do { s[at] = String(rand(0, 9)); b = Number(s.join("")); } while (b === a); }
    const sym = a < b ? "<" : a > b ? ">" : "=";
    const placeIdx = d - 1 - at;
    if (level === 2 && chance(0.35) && a !== b) {
      const choices = shuffle([PLACE_WORD[placeIdx], ...PLACE_WORD.slice(0, d).filter((p) => p !== PLACE_WORD[placeIdx]).slice(-3)]).slice(0, 4);
      if (!choices.includes(PLACE_WORD[placeIdx])) choices[0] = PLACE_WORD[placeIdx];
      return { text: `Which place do you use to compare these numbers?\n${fmt(a)}\n${fmt(b)}`, answerType: "choice", answer: PLACE_WORD[placeIdx], choices, hint: "Start at the left. Find the first place where the digits are different.", steps: [`The digits match until the ${PLACE_WORD[placeIdx]} place`, `${fmt(a)} ${sym} ${fmt(b)}`] };
    }
    return {
      text: `Compare. Use <, >, or =.\n${fmt(a)}  ○  ${fmt(b)}`,
      answerType: "choice", answer: sym, choices: SYMBOLS,
      hint: "Line up the places. Start at the left and find the first digit that is different. The open side of < or > faces the bigger number.",
      steps: a === b ? [`Every digit is the same, so ${fmt(a)} = ${fmt(b)}`] : [`Same digits until the ${PLACE_WORD[placeIdx]} place`, `${String(a)[at]} ${sym} ${String(b)[at]} in that place`, `So ${fmt(a)} ${sym} ${fmt(b)}`],
      story: (t) => `${t.hero} counted ${fmt(a)} ${t.things}. A friend counted ${fmt(b)}. Compare with <, >, or =.\n${fmt(a)}  ○  ${fmt(b)}`,
    };
  }
  if (level === 3) {
    // "Ten times as great" (Lesson 1-2).
    const kind = pick(["times", "of", "digits"]);
    if (kind === "times") { const n = rand(1, 9) * 10 ** rand(0, 3); return { text: `What number is ten times as great as ${fmt(n)}?`, answerType: "number", answer: num(n * 10), wrong: cleanWrong(n * 10, [n * 100, n + 10, n]), hint: "Ten times as great moves every digit one place to the left (add a zero).", steps: [`${fmt(n)} × 10 = ${fmt(n * 10)}`] }; }
    if (kind === "of") { const n = rand(1, 9) * 10 ** rand(2, 4); return { text: `${fmt(n)} is ten times as great as what number?`, answerType: "number", answer: num(n / 10), wrong: cleanWrong(n / 10, [n / 100, n * 10, n - 10]), hint: "Go one place to the right (take away a zero).", steps: [`${fmt(n / 10)} × 10 = ${fmt(n)}`] }; }
    const dgt = rand(1, 9), hi = rand(1, 5), lo = hi - 1;
    let digs = String(nDigits(6)).split("");
    digs[5 - hi] = String(dgt); digs[5 - lo] = String(dgt);
    const n = Number(digs.join(""));
    return { text: `In ${fmt(n)}, the ${dgt} in the ${PLACE_WORD[hi]} place is how many times the value of the ${dgt} in the ${PLACE_WORD[lo]} place?`, answerType: "number", answer: "10", wrong: ["100", "1", "2"], hint: "Each place to the left is worth 10 times as much.", steps: [`${dgt} ${PLACE_WORD[hi]} = ${fmt(dgt * 10 ** hi)}`, `${dgt} ${PLACE_WORD[lo]} = ${fmt(dgt * 10 ** lo)}`, `${fmt(dgt * 10 ** hi)} is 10 times ${fmt(dgt * 10 ** lo)}`] };
  }
  // Put three numbers in order, greatest to least.
  const base = nDigits(5);
  const set = new Set([base]);
  while (set.size < 3) set.add(base + pick([-1, 1]) * rand(1, 9) * 10 ** rand(1, 3));
  const nums = [...set];
  const order = [...nums].sort((x, y) => y - x).map(fmt);
  return { text: `Order from greatest to least.`, answerType: "tiles", tiles: shuffle(nums.map(fmt)), answer: order.join(" "), hint: "Compare from the left. The first place that is different tells you which is greater.", steps: [`${order.join(" > ")}`] };
}

// ── Multiplying by 1-digit numbers (Topic 3) ────────────────────────────────
function multiply(level) {
  if (level === 1) {
    // Lesson 3-1: multiples of 10, 100 and 1,000.
    const a = rand(2, 9), b = rand(2, 9), z = rand(1, 3), m = b * 10 ** z, answer = a * m;
    const tens = ["tens", "hundreds", "thousands"][z - 1];
    return { text: `${a} × ${fmt(m)} = ?`, answerType: "number", answer: num(answer), wrong: cleanWrong(answer, [answer / 10, answer * 10, a * b]), hint: `Use the fact ${a} × ${b}, then think in ${tens}.`, steps: [`${a} × ${b} = ${a * b}`, `${a} × ${b} ${tens} = ${a * b} ${tens}`, `= ${fmt(answer)}`], mental: true, story: (t) => `${t.hero} packs ${a} boxes with ${fmt(m)} ${t.things} in each. How many ${t.things}?` };
  }
  if (level === 2) {
    // Lesson 3-2: estimate products by rounding.
    const a = rand(3, 9), n = pick([rand(21, 98), rand(110, 980)]);
    const place = n < 100 ? 10 : 100, r = roundTo(n, place), answer = a * r;
    return { text: `Estimate ${a} × ${fmt(n)} by rounding ${fmt(n)} to the nearest ${place === 10 ? "ten" : "hundred"}.`, answerType: "number", answer: num(answer), wrong: cleanWrong(answer, [a * n, a * (r + place), a * (r - place)]), hint: `Round ${fmt(n)} first, then multiply.`, steps: [`${fmt(n)} rounds to ${fmt(r)}`, `${a} × ${fmt(r)} = ${fmt(answer)}`] };
  }
  // Lessons 3-3 to 3-5: partial products with 2-, 3- and 4-digit numbers.
  const a = rand(3, 9), n = level === 3 ? rand(12, 98) : level === 4 ? rand(102, 989) : rand(1012, 9876);
  const parts = String(n).split("").map((d, i, arr) => Number(d) * 10 ** (arr.length - 1 - i)).filter((v) => v > 0);
  const prods = parts.map((p) => a * p), answer = a * n;
  const glued = Number(String(n).split("").map((d) => a * Number(d)).join(""));
  const base = {
    hint: `Break ${fmt(n)} into ${parts.map(fmt).join(" + ")}. Multiply each part by ${a}, then add.`,
    steps: [`${fmt(n)} = ${parts.map(fmt).join(" + ")}`, ...parts.map((p, i) => `${a} × ${fmt(p)} = ${fmt(prods[i])}`), `${prods.map(fmt).join(" + ")} = ${fmt(answer)}`],
  };
  if (chance(0.4) && parts.length >= 2) {
    return { ...base, text: `Use partial products to find ${a} × ${fmt(n)}.`, answerType: "blanks", template: [...parts.map((p, i) => ({ pre: `${a} × ${fmt(p)} = `, label: "?", post: "" })), { pre: "Total = ", label: "?", post: "" }], answer: [...prods.map(num), num(answer)] };
  }
  return { ...base, text: `${a} × ${fmt(n)} = ?`, answerType: "number", answer: num(answer), wrong: cleanWrong(answer, [glued, answer + 10, answer - a * 10]), misconceptions: { [glued]: "partialProducts" }, story: (t) => `${t.place} has ${a} shelves with ${fmt(n)} ${t.things} on each. How many ${t.things} in all?` };
}

// ── Registry ────────────────────────────────────────────────────────────────
import { mult2, divide1, operations, factors, fracEquiv, fracAdd, fracMult, linePlot, decimals, measurement, patterns, angles, geometry } from "./skills2.js";
import { GYM_SKILLS } from "./gymskills.js";
import { LAB_SKILLS } from "./labskills.js";

// topic: the enVision Grade 4 topic the skill belongs to. Skills without one are
// review from earlier grades and are always available. Skills with a topic later
// than the class has reached start switched off (a grown-up turns them on).
export const SKILLS = [
  { id: "mental", name: "Mental Math", emoji: "🧠", maxLevel: 5, gen: mental },
  { id: "facts", name: "Times Tables", emoji: "✖️", maxLevel: 5, gen: facts },
  { id: "division", name: "Division", emoji: "➗", maxLevel: 3, gen: division },
  { id: "rounding", name: "Rounding", emoji: "🎯", maxLevel: 5, gen: rounding },
  { id: "estimate", name: "Estimate & Check", emoji: "🔍", maxLevel: 4, gen: estimate },
  { id: "add", name: "Big Addition", emoji: "➕", maxLevel: 6, gen: addition },
  { id: "subtract", name: "Subtraction with Regrouping", emoji: "➖", maxLevel: 7, gen: subtraction },
  { id: "missing", name: "Missing Digits", emoji: "🧩", maxLevel: 3, gen: missingDigit },
  { id: "placevalue", name: "Number Names & Place Value", emoji: "🔢", maxLevel: 5, gen: placeValue },
  { id: "tables", name: "Data Tables", emoji: "📊", maxLevel: 4, gen: dataTables },
  { id: "words", name: "Word Problems", emoji: "📖", maxLevel: 4, gen: wordProblems },
  { id: "area", name: "Area & Perimeter", emoji: "📐", maxLevel: 4, gen: areaPerimeter },
  { id: "properties", name: "Properties", emoji: "🔀", maxLevel: 3, gen: properties },
  { id: "compare", name: "Compare Numbers", emoji: "⚖️", maxLevel: 4, gen: compareNums, topic: 1 },
  { id: "multiply", name: "Multiply by 1 Digit", emoji: "✳️", maxLevel: 5, gen: multiply, topic: 3 },
  { id: "mult2", name: "Multiply by 2 Digits", emoji: "✴️", maxLevel: 7, gen: mult2, topic: 4 },
  { id: "divide1", name: "Long Division", emoji: "🍕", maxLevel: 5, gen: divide1, topic: 5 },
  { id: "operations", name: "Times As Many & Multi-Step", emoji: "🧮", maxLevel: 3, gen: operations, topic: 6 },
  { id: "factors", name: "Factors & Multiples", emoji: "🔑", maxLevel: 3, gen: factors, topic: 7 },
  { id: "fracEquiv", name: "Equivalent Fractions", emoji: "🍰", maxLevel: 4, gen: fracEquiv, topic: 8 },
  { id: "fracAdd", name: "Add & Subtract Fractions", emoji: "🥧", maxLevel: 4, gen: fracAdd, topic: 9 },
  { id: "fracMult", name: "Multiply Fractions", emoji: "🍫", maxLevel: 3, gen: fracMult, topic: 10 },
  { id: "linePlot", name: "Line Plots", emoji: "📈", maxLevel: 3, gen: linePlot, topic: 11 },
  { id: "decimals", name: "Decimals & Money", emoji: "💲", maxLevel: 4, gen: decimals, topic: 12 },
  { id: "measurement", name: "Measurement", emoji: "📏", maxLevel: 3, gen: measurement, topic: 13 },
  { id: "patterns", name: "Patterns", emoji: "🔁", maxLevel: 3, gen: patterns, topic: 14 },
  { id: "angles", name: "Angles", emoji: "📐", maxLevel: 3, gen: angles, topic: 15 },
  { id: "geometry", name: "Lines & Shapes", emoji: "🔷", maxLevel: 3, gen: geometry, topic: 16 },
  // Math Gym skills (gym: true) are practised in the gym and stay out of adventures unless a grown-up turns them on.
  ...GYM_SKILLS,
  // Thinking Lab skills (lab: true) use answer types only the Lab can show, so they never join adventures.
  ...LAB_SKILLS,
];
export const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export function makeItem(skillId, level, theme, ctx) {
  const s = SKILL[skillId];
  const lv = Math.max(1, Math.min(level, s.maxLevel));
  return { ...s.gen(lv, theme, ctx), skill: skillId, level: lv };
}
