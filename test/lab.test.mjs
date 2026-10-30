// Thinking Lab: every puzzle's answer is re-derived from its picture, and lab skills stay out of adventures.
import assert from "node:assert/strict";
import { makeItem, SKILL, SKILLS } from "../src/engine/skills.js";
import { freshState, upgradeState, chooseSkill, dueReview } from "../src/engine/learner.js";
import { WORLDS } from "../src/engine/themes.js";
import { boardsValue, checkerCount, standardBoards, minCheckers, regionOf, STRING_PREDS, RULES } from "../src/engine/labskills.js";
import { STATIONS, labPlan, labItem, labCorrect, emptyResponse, ready, recordLab, labDue, retryItem, finishLab, labState, givenText } from "../src/lab/engine.js";
import { classifyError } from "../src/engine/mistakes.js";

const W = WORLDS[0];
const ruleF = (lab) => { const m = lab.match(/^([+−×])(\d+)$/); return RULES[m[1]](Number(m[2])).f; };
const parseNum = (s) => Number(String(s).replace(/,/g, ""));

// 1. Minicomputer basics.
assert.equal(boardsValue(standardBoards(4096, 4)), 4096);
assert.equal(boardsValue([[2, 0, 0, 1], [0, 0, 0, 0]]), 10);
assert.equal(minCheckers(999), 6);
for (let n = 1; n < 2000; n++) assert.equal(boardsValue(standardBoards(n, 4)), n);

for (let lv = 1; lv <= 5; lv++) for (let i = 0; i < 1500; i++) {
  const it = makeItem("minicomp", lv, W, {});
  if (it.mini === "read") assert.equal(Number(it.answer), boardsValue(it.visual.boards), it.text);
  if (it.mini === "add") assert.equal(Number(it.answer), boardsValue(it.visual.boards) + boardsValue(it.visual.boards2));
  if (it.mini === "double") assert.equal(Number(it.answer), 2 * boardsValue(it.visual.boards));
  if (it.mini === "build") {
    const n = Number(it.answer);
    assert.ok(n < 10 ** it.visual.boards.length, "number fits the boards");
    const std = standardBoards(n, it.visual.boards.length);
    assert.ok(labCorrect(it, std), "the usual way is always right");
    assert.equal(checkerCount(emptyResponse(it)), 0);
    // Any spread-out way is right too, unless she was asked for the fewest checkers.
    const spread = std.map((b) => [...b]);
    const p = spread.findIndex((b) => b[1] > 0);
    if (p >= 0) { spread[p][1]--; spread[p][0] += 2; assert.equal(labCorrect(it, spread), !it.visual.fewest); }
    const off = std.map((b) => [...b]); off[0][0]++;
    assert.ok(!labCorrect(it, off));
  }
  if (it.answerType === "choice") assert.ok(it.choices.includes(it.answer) && new Set(it.choices).size === it.choices.length);
  assert.ok(lv > 1 || it.answerType !== "choice");
}

// 2. Arrow roads: blanks follow the rule; paths and detectives check out.
for (let lv = 1; lv <= 5; lv++) for (let i = 0; i < 1500; i++) {
  const it = makeItem("arrows", lv, W, {});
  const v = it.visual;
  assert.equal(v.kind, "arrows");
  if (it.answerType === "choice") assert.equal(it.choices.length, 4, `4 choices: ${it.choices}`);
  for (const e of v.edges) assert.ok(v.nodes[e.from] && v.nodes[e.to]);
  if (it.arrows === "fill") {
    const f = ruleF(v.legend[0].label);
    const vals = []; let qi = 0;
    for (const n of v.nodes) vals.push(n.q ? Number(it.answer[qi++]) : parseNum(n.label));
    for (let k = 1; k < vals.length; k++) assert.equal(f(vals[k - 1]), vals[k], it.text + JSON.stringify(vals));
    assert.ok(vals.every((x) => Number.isInteger(x) && x >= 0));
  }
  if (it.arrows === "rule") {
    const f = ruleF(it.answer);
    for (const e of v.edges) assert.equal(f(parseNum(v.nodes[e.from].label)), parseNum(v.nodes[e.to].label));
    assert.equal(new Set(it.choices).size, it.choices.length);
    for (const c of it.choices) if (c !== it.answer) assert.ok(!v.edges.every((e) => ruleF(c)(parseNum(v.nodes[e.from].label)) === parseNum(v.nodes[e.to].label)), `distractor ${c} also fits`);
  }
  if (it.arrows === "path") {
    const rule = Object.fromEntries(v.legend.map((l) => [l.color, ruleF(l.label)]));
    let x = parseNum(v.nodes[0].label);
    for (const e of v.edges) x = rule[e.color](x);
    assert.equal(Number(it.answer), x);
  }
  if (it.arrows === "compose") {
    const [r, b] = v.legend;
    const s = parseNum(v.nodes[0].label);
    assert.equal(ruleF(it.answer)(s), ruleF(b.label)(ruleF(r.label)(s)));
    assert.ok(it.choices.includes(it.answer) && new Set(it.choices).size === it.choices.length);
  }
  if (it.arrows === "detective") {
    const x = Number(it.answer);
    for (const e of v.edges) assert.equal(ruleF(v.legend.find((l) => l.color === e.color).label)(x), parseNum(v.nodes[e.to].label));
  }
}

// 3. String game: regions match the labels; hidden labels have exactly one fitting choice.
for (let lv = 1; lv <= 5; lv++) for (let i = 0; i < 1500; i++) {
  const it = makeItem("strings", lv, W, {});
  const preds = it.visual.preds;
  if (it.answerType === "sort") {
    it.choices.forEach((c, k) => assert.equal(it.answer[k], regionOf(Number(c), preds)));
    assert.equal(new Set(it.choices).size, it.choices.length);
    assert.ok(labCorrect(it, it.answer) && !ready(it, emptyResponse(it)));
  }
  if (it.answerType === "multi") {
    const target = /BOTH/.test(it.text) ? "ab" : /inside red but/.test(it.text) ? "a" : "b";
    assert.deepEqual(it.answer, it.choices.filter((c) => regionOf(Number(c), preds) === target));
  }
  if (it.answerType === "choice") {
    const fits = (label) => { const k = Object.keys(STRING_PREDS).find((p) => STRING_PREDS[p].label === label); return it.visual.placed.every((p) => ((p.r === "a" || p.r === "ab") === STRING_PREDS[k].t(p.n))); };
    assert.equal(it.choices.filter(fits).length, 1, it.choices.join("|"));
    assert.ok(fits(it.answer));
  }
}

// 4. Lab skills never show up in adventures, even if a saved state has them on.
const st = upgradeState(freshState());
for (const s of SKILLS.filter((x) => x.lab)) assert.equal(st.skills[s.id].focus, "off");
for (const s of SKILLS.filter((x) => x.lab)) st.skills[s.id].focus = "focus";
for (let i = 0; i < 2000; i++) assert.ok(!SKILL[chooseSkill(st, [])].lab);
const old = freshState(); delete old.skills.minicomp; delete old.lab;
assert.ok(upgradeState(old).skills.minicomp);

// 5. Recording: misses come back in the Lab (not in adventures), fixes close them.
const s2 = freshState();
const it = labItem(s2, "mini", W);
const res = recordLab(s2, it, { correct: false, ms: 900, given: givenText(it, emptyResponse(it)) });
assert.equal(res.mistake.status, "open");
assert.equal(s2.history.at(-1).lab, "mini");
s2.counter += 10;
assert.equal(labDue(s2).length, 1);
assert.equal(dueReview(s2, []), null, "a lab miss never comes back in an adventure");
const again = retryItem(s2, labDue(s2)[0], W);
assert.equal(again.station, "mini");
assert.equal(again.reviewOf, res.mistake.id);
const ans = again.answerType === "mini" ? standardBoards(Number(again.answer), again.visual.boards.length) : again.answerType === "blanks" ? again.answer : again.answer;
assert.ok(labCorrect(again, ans));
recordLab(s2, again, { correct: true, ms: 800, given: "ok" });
assert.equal(s2.mistakes[0].status, "fixed");
const sortIt = makeItem("strings", 2, W, {});
assert.equal(classifyError(sortIt, "1: red only"), "other");
finishLab(s2, { kind: "mix", n: 9, clean: 7 });
assert.equal(labState(s2).sessions, 1);
assert.equal(labPlan("mix").length, 9);
assert.deepEqual(STATIONS.map((x) => x.skill), ["minicomp", "arrows", "strings"]);

console.log("lab tests passed");
