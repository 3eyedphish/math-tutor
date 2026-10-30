// Run: node test/generators.test.mjs
// Generates thousands of questions per skill and level and checks every answer.
import { SKILLS, makeItem } from "../src/engine/skills.js";
import { WORLDS } from "../src/engine/themes.js";
import { toWords } from "../src/engine/words.js";

const errors = {};
const fail = (key, msg) => { (errors[key] ||= []).length < 3 && errors[key].push(msg); errors[key].count = (errors[key].count || 0) + 1; };
const evalExpr = (s) => {
  const e = s.replace(/,/g, "").replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/");
  if (!/^[\d\s+\-*/()]+$/.test(e)) return null;
  return Function(`return (${e})`)();
};
// Fractions, mixed numbers ("2 3/4") and decimals, evaluated as plain numbers.
const evalFrac = (s) => {
  const e = s.replace(/\$/g, "").replace(/(\d+) (\d+)\/(\d+)/g, "($1+$2/$3)").replace(/,/g, "").replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/");
  if (!/^[\d\s+\-*/().]+$/.test(e)) return null;
  return Function(`return (${e})`)();
};
const close = (a, b) => Math.abs(a - b) < 1e-9;
function checkFractions(it, key) {
  const t = it.answerType;
  if (t === "blanks" && it.template.length === 1 && /\/\d+$/.test(it.template[0].post)) {
    const D = Number(it.template[0].post.slice(1)), expr = it.template[0].pre.replace(/ = $/, "").replace(/^Difference$/, "");
    const v = expr ? evalFrac(expr) : null;
    if (v !== null && !close(v, Number(it.answer[0]) / D)) fail(key, `FRAC ${expr} = ${it.answer[0]}/${D} (true ${v})`);
  }
  if (t === "blanks" && it.template.length === 2 && it.template[0].pre === "Whole number: ") {
    const D = Number(it.template[1].post.slice(1)), expr = it.text.split("\n")[0].replace(/ = \?$/, "");
    const v = evalFrac(expr), got = Number(it.answer[0]) + Number(it.answer[1]) / D;
    if (Number(it.answer[1]) >= D) fail(key, `mixed not simplified ${it.answer}`);
    if (v === null || !close(v, got)) fail(key, `MIXED ${expr} = ${it.answer} (true ${v})`);
  }
  if (t === "number" && it.allowDot) {
    const m = it.text.match(/^Write (\d+)\/(\d+) as a decimal/); if (m && !close(Number(it.answer), m[1] / m[2])) fail(key, `DEC ${it.text} ${it.answer}`);
    const mm = it.text.match(/^(\$[\d.]+ [+−] \$[\d.]+) = \?$/); if (mm && !close(Number(it.answer), evalFrac(mm[1]))) fail(key, `MONEY ${it.text} ${it.answer}`);
    if ((it.wrong || []).some((w) => close(Number(w), Number(it.answer)))) fail(key, `dec wrong==answer ${it.text}`);
  }
  const cm = it.text.match(/^Compare\. Use <, >, or =\.\n(\S+)  ○  (\S+)$/);
  if (cm) { const a = evalFrac(cm[1]), b = evalFrac(cm[2]); const sym = close(a, b) ? "=" : a < b ? "<" : ">"; if (sym !== it.answer) fail(key, `CMP ${cm[1]} ${it.answer} ${cm[2]}`); }
  if (t === "tiles" && /^\d+\/\d+( \d+\/\d+)+$/.test(it.answer)) { const v = it.answer.split(" ").map(evalFrac); if (!v.every((x, i) => i === 0 || x > v[i - 1])) fail(key, `ORDER ${it.answer}`); }
  const fm = it.text.match(/^Select ALL the (factors|multiples) of (\d+)\.$/);
  if (fm) { const n = Number(fm[2]); for (const c of it.choices) { const is = fm[1] === "factors" ? n % c === 0 : c % n === 0; if (is !== it.answer.includes(c)) fail(key, `${fm[1]} ${c} of ${n}`); } }
  const pm = it.text.match(/^Is (\d+) prime or composite\?$/);
  if (pm) { const n = +pm[1]; let f = 0; for (let d = 1; d <= n; d++) if (n % d === 0) f++; if ((f === 2 ? "prime" : "composite") !== it.answer) fail(key, `prime ${n}`); }
  const am = it.text.match(/^An angle measures (\d+)°/);
  if (am) { const d = +am[1]; const k = d < 90 ? "acute" : d === 90 ? "right" : d < 180 ? "obtuse" : "straight"; if (k !== it.answer) fail(key, `angle ${d}`); }
  const tm = it.text.match(/^A triangle has angles of (\d+)°, (\d+)° and (\d+)°/);
  if (tm) { const a = [+tm[1], +tm[2], +tm[3]]; if (a.reduce((x, y) => x + y) !== 180 || a.some((x) => x <= 0)) fail(key, `triangle ${a}`); }
  const um = it.text.match(/^(\d+) (\w+) = \? (\w+)$/);
  if (um) { const K = { "feet inches": 12, "yards feet": 3, "yards inches": 36, "meters centimeters": 100, "kilometers meters": 1000, "kilograms grams": 1000, "liters milliliters": 1000, "hours minutes": 60, "minutes seconds": 60, "days hours": 24, "pounds ounces": 16, "gallons quarts": 4, "quarts pints": 2, "pints cups": 2, "weeks days": 7 }[`${um[2]} ${um[3]}`]; if (!K || um[1] * K !== Number(it.answer)) fail(key, `units ${it.text} ${it.answer}`); }
  if (it.visual?.kind === "lineplot" && it.visual.points.some((p) => !(p.n >= 0))) fail(key, "lineplot n");
}
function checkItem(it, key) {
  const t = it.answerType;
  if (t === "parts") { it.parts.forEach((p, i) => checkItem(p, key + ".part" + i)); if (!it.table) fail(key, "parts without table"); return; }
  if (!it.text) fail(key, "no text");
  if (!it.steps?.length) fail(key, "no steps");
  if (t === "number") {
    if (!/^\d+(r\d+)?$/.test(it.answer) && !(it.allowDot && /^\d*\.\d+$/.test(it.answer))) fail(key, `bad answer ${it.answer} :: ${it.text}`);
    if ((it.wrong || []).some((w) => String(w) === it.answer)) fail(key, `wrong==answer ${it.text}`);
    // Re-derive the answer where the prompt is a plain expression "... = ?"
    const m = it.text.match(/^([^=\n]+)= \?$/);
    if (m) { const v = evalExpr(m[1]); if (v !== null && String(v) !== it.answer) fail(key, `MISMATCH ${it.text} expects ${it.answer} true ${v}`); }
    const dm = it.text.match(/^(\d+) ÷ (\d+) = \?  \(with a remainder\)$/);
    if (dm) { const q = Math.floor(dm[1] / dm[2]), r = dm[1] % dm[2]; if (`${q}r${r}` !== it.answer) fail(key, `REM ${it.text} ${it.answer}`); }
    const mm = it.text.match(/^(\d+) × \? = (\d+)$/); if (mm && String(mm[2] / mm[1]) !== it.answer) fail(key, "missing factor");
    const wm = it.text.match(/^Write the number:\n"(.*)"$/); if (wm && toWords(Number(it.answer)) !== wm[1]) fail(key, "words->number");
  } else if (t === "choice") {
    if (it.choices.filter((c) => c === it.answer).length !== 1) fail(key, `choice answer count :: ${it.text} ${it.answer} [${it.choices}]`);
    if (new Set(it.choices).size !== it.choices.length) fail(key, `dup choices ${it.choices}`);
    if (it.choices.length < 2) fail(key, `few choices ${it.choices.length}`);
  } else if (t === "multi") {
    if (!it.answer.length) fail(key, "multi empty answer");
    if (!it.answer.every((a) => it.choices.includes(a))) fail(key, "multi answer not in choices");
    if (new Set(it.choices).size !== it.choices.length) fail(key, "dup multi choices");
    // Verify equations of the form "a op b = c"
    for (const c of it.choices) {
      const em = c.match(/^([\d,]+) ([+−]) ([\d,]+) = ([\d,]+)$/);
      if (em) { const v = evalExpr(`${em[1]}${em[2]}${em[3]}`); const ok = v === Number(em[4].replace(/,/g, "")); if (ok !== it.answer.includes(c)) fail(key, `multi truth ${c}`); }
      const ev = c.match(/^(\d+) × (\d+) = n$/); if (ev && ((ev[1] * ev[2]) % 2 === 0) !== it.answer.includes(c)) fail(key, `even ${c}`);
      const ar = c.match(/^(\d+) cm × (\d+) cm$/); if (ar) { const target = Number(it.text.match(/area of (\d+)/)[1]); if ((ar[1] * ar[2] === target) !== it.answer.includes(c)) fail(key, `area ${c}`); }
    }
    const pm = it.text.match(/^(.*) = n\nSelect/);
    if (pm) { const total = evalExpr(pm[1]); for (const c of it.choices) { const v = evalExpr(c.replace(/ = n$/, "")); if ((v === total) !== it.answer.includes(c)) fail(key, `property ${c}`); } }
  } else if (t === "blanks") {
    const labels = it.template.filter((x) => x.label).length;
    if (labels !== it.answer.length) fail(key, `blanks count ${labels} vs ${it.answer.length}`);
    if (it.column?.puzzle) {
      const fill = (chars) => { let i = 0; return Number(chars.map((c) => (c === "A" ? it.answer[0] : c === "B" ? it.answer[1] : c)).join("")); };
      const [a, b] = it.column.rows.map(fill), r = fill(it.column.result);
      const ok = it.column.op === "−" ? a - b === r : a + b === r;
      if (!ok) fail(key, `puzzle ${a} ${it.column.op} ${b} = ${r}`);
      // uniqueness: no other digit choice works
      let sols = 0;
      const n = it.answer.length;
      for (let x = 0; x < 10 ** n; x++) {
        const d = String(x).padStart(n, "0").split("");
        const f2 = (chars) => chars.map((c) => (c === "A" ? d[0] : c === "B" ? d[1] : c)).join("");
        const A = f2(it.column.rows[0]), B = f2(it.column.rows[1]), R = f2(it.column.result);
        if (/^0/.test(A) || (/^0/.test(R) && R.length > 1)) continue;
        if (it.column.op === "−" ? +A - +B === +R : +A + +B === +R) sols++;
      }
      if (sols !== 1) fail(key, `puzzle has ${sols} solutions`);
    }
    if (it.joiner === "+") { const n = Number(it.text.match(/Write ([\d,]+) in/)[1].replace(/,/g, "")); let k = 0; const sum = it.template.reduce((s, x) => s + Number(x.label ? it.answer[k++] : x.fixed.replace(/,/g, "")), 0); if (sum !== n) fail(key, "expanded"); }
  } else if (t === "tiles") {
    const pool = [...it.tiles];
    for (const w of it.answer.split(" ")) { const i = pool.indexOf(w); if (i < 0) fail(key, `tile missing ${w}`); else pool.splice(i, 1); }
  } else if (t === "mini") {
    // Thinking Lab: checkers on minicomputer boards (checked in detail in lab.test.mjs).
    if (!/^\d+$/.test(it.answer) || Number(it.answer) >= 10 ** it.visual.boards.length) fail(key, `mini answer ${it.answer}`);
  } else if (t === "sort") {
    if (it.answer.length !== it.choices.length || new Set(it.choices).size !== it.choices.length) fail(key, "sort shape");
  } else fail(key, `unknown type ${t}`);
}
let total = 0;
for (const s of SKILLS) for (let lv = 1; lv <= s.maxLevel; lv++) for (let i = 0; i < 3000; i++) {
  const w = WORLDS[i % WORLDS.length];
  let it;
  try { it = makeItem(s.id, lv, w); } catch (e) { fail(`${s.id}.L${lv}`, "THROW " + e.message); continue; }
  checkItem(it, `${s.id}.L${lv}`);
  if (it.answerType !== "parts") checkFractions(it, `${s.id}.L${lv}`);
  if (it.story) { const st = it.story(w); if (!st || /undefined|NaN/.test(st)) fail(`${s.id}.L${lv}`, "story " + st); }
  if (/undefined|NaN/.test(it.text + (it.steps || []).join())) fail(`${s.id}.L${lv}`, "undefined/NaN in " + it.text);
  total++;
}
console.log(`${total} questions checked`);
if (Object.keys(errors).length) { console.log(JSON.stringify(errors, null, 1)); process.exit(1); } else console.log("ALL PASS");
