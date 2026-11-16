// Run: node test/unit4.test.mjs
// Unit 4 (Topic 4, multiply by 2-digit numbers): each level matches its school lesson 4-1 to 4-7.
import { makeItem, SKILL } from "../src/engine/skills.js";
import { UNITS } from "../src/engine/units.js";
import { WORLDS } from "../src/engine/themes.js";
import { describePicture } from "../src/engine/picture.js";

let fails = 0;
const expect = (ok, msg) => { if (!ok) { fails++; if (fails < 20) console.log("FAIL", msg); } };
const n = (s) => Number(String(s).replace(/[,$]/g, ""));
const evalExpr = (s) => Function(`return (${s.replace(/,/g, "").replace(/−/g, "-").replace(/×/g, "*")})`)();

expect(SKILL.mult2.maxLevel === 7, "mult2 has 7 levels");
const u4 = UNITS.find((u) => u.id === "u4");
expect(u4.lessons.map((l) => l.id).join() === "4-1,4-2,4-3,4-4,4-5,4-6,4-7", "unit 4 uses school lesson numbers");
u4.lessons.forEach((l, i) => expect(l.skills.mult2[0] === i + 1, `lesson ${l.id} maps to level ${i + 1}`));

const seen = {};
for (let lv = 1; lv <= 7; lv++) for (let i = 0; i < 4000; i++) {
  const it = makeItem("mult2", lv, WORLDS[i % WORLDS.length]);
  const key = `L${lv}:${it.answerType}`; seen[key] = (seen[key] || 0) + 1;
  // Missing factor: "a × ? = p" or "? × a = p"
  const mf = it.text.match(/^(?:(\d+) × \?|\? × (\d+)) = ([\d,]+)$/);
  if (mf) { const f = n(mf[1] || mf[2]); expect(f * n(it.answer) === n(mf[3]), `missing factor ${it.text} -> ${it.answer}`); if (it.choices) expect(it.choices.filter((c) => f * n(c) === n(mf[3])).length === 1, `one factor fits ${it.text} [${it.choices}]`); }
  // Partial-product blanks: every "x × y = " row is right and the total is the sum of the rows.
  if (it.answerType === "blanks") {
    let k = 0; const vals = [];
    for (const row of it.template) {
      if (!row.label) continue;
      const got = n(it.answer[k++]); const m = row.pre.match(/^(\d+) × (\d+) = $/);
      if (m && /^Total|^\d+ × \d+ = $/.test(row.pre) && k < it.answer.length) { expect(m[1] * m[2] === got, `partial ${row.pre}${got}`); vals.push(got); }
    }
    const tm = it.text.match(/(\d+) × (\d+)/), total = n(it.answer[it.answer.length - 1]);
    expect(tm && tm[1] * tm[2] === total, `total ${it.text} ${total}`);
    if (it.visual?.cells) { const shown = it.visual.cells.flat().filter((c) => c != null); expect(shown.reduce((a, b) => a + b, 0) + vals.reduce((a, b) => a + b, 0) === total, `area model adds up ${it.text}`); }
  }
  // Plain products and compatible-number estimates.
  const pm = it.text.match(/^(\d+) × (\d+) = \?$/); if (pm) expect(pm[1] * pm[2] === n(it.answer), `product ${it.text}`);
  const cm = it.text.match(/is close to (\d+)\. \d+ is close to (\d+)\./); if (cm) expect(cm[1] * cm[2] === n(it.answer), `compat ${it.text}`);
  if (/^Which compatible numbers/.test(it.text)) { const [x, y] = it.answer.split(" × ").map(Number); const [a, b] = it.text.match(/(\d+) × (\d+)/).slice(1).map(Number); expect(Math.abs(x - a) <= 3 && Math.abs(y - b) <= 2, `compatible pair close ${it.text} ${it.answer}`); }
  const ou = it.text.match(/estimates (\d+) × (\d+) by finding (\d+) × (\d+)/);
  if (ou) expect((ou[3] * ou[4] > ou[1] * ou[2] ? "greater than" : "less than") === it.answer, `over/under ${it.text}`);
  if (/^Which list has all the partial products/.test(it.text)) { const [a, b] = it.text.match(/(\d+) × (\d+)/).slice(1).map(Number); expect(it.answer.split(", ").map(n).reduce((x, y) => x + y) === a * b, `partials list ${it.text}`); expect(it.choices.filter((c) => c.split(", ").map(n).reduce((x, y) => x + y) === a * b && c.split(", ").length === 4).length === 1, `only one list works ${it.choices}`); }
  if (it.answerType === "multi") { const total = evalExpr(it.text.split(" = n")[0]); for (const c of it.choices) expect((evalExpr(c) === total) === it.answer.includes(c), `ways ${c}`); expect(it.answer.length >= 2, "at least two ways"); }
  // Multi-step stories: answer recomputed from the steps' last line.
  if (lv === 7) { expect(it.answerType === "number" && it.steps.length >= 2, "multi-step has steps"); const last = it.steps[it.steps.length - 1].split("= ").pop(); expect(n(last) === n(it.answer), `L7 steps end at answer ${it.text}`); expect(!/undefined|NaN/.test(it.text), "L7 text"); }
  if (it.visual) expect(!/undefined|NaN/.test(describePicture(it.visual)), "picture description");
}
for (const k of ["L1:number", "L2:blanks", "L2:number", "L3:number", "L3:choice", "L4:blanks", "L5:blanks", "L5:choice", "L5:multi", "L6:number", "L6:choice", "L7:number"]) expect(seen[k] > 50, `variety: ${k} seen ${seen[k] || 0}`);
console.log(fails ? `${fails} unit 4 checks failed` : "Unit 4: ALL PASS");
if (fails) process.exit(1);
