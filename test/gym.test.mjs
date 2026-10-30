// Math Gym: reps are always right, speed decides "strong", and misses come back.
import assert from "node:assert/strict";
import { makeItem, SKILL } from "../src/engine/skills.js";
import { freshState, upgradeState, chooseSkill, factKey } from "../src/engine/learner.js";
import { isCorrect } from "../src/engine/check.js";
import { classifyError } from "../src/engine/mistakes.js";
import { WORLDS } from "../src/engine/themes.js";
import { STATIONS, workoutPlan, gymItem, sprintItem, pickSprintFact, recordGym, gymDue, retryItem, fluency, strongCount, tableStrength, finishGym, FACT_COUNT } from "../src/gym/engine.js";

const W = WORLDS[0];
const good = (it) => it.answer;
const rect = (v) => v.kind === "scale" ? [v.w * v.kw, v.h * v.kh] : null;

// 1. Gym skills: answers re-derived from the numbers in the question.
for (let lv = 1; lv <= 5; lv++) for (let i = 0; i < 2000; i++) {
  const it = makeItem("doubling", lv, W, {});
  if (it.answerType === "number") {
    const d = it.text.match(/^Double (\d+) = \?$/), h = it.text.match(/^Half of (\d+) = \?$/);
    assert.ok(d || h, `doubling text ${it.text}`);
    assert.equal(Number(it.answer), d ? 2 * d[1] : h[1] / 2, it.text);
    assert.ok(!h || h[1] % 2 === 0, "only even numbers are halved");
  } else {
    // Chains double each line; halve-and-double keeps the product.
    const nums = it.answer.map(Number);
    if (lv === 3) { assert.equal(nums[1], 2 * nums[0]); assert.equal(nums[2], 2 * nums[1]); assert.equal(nums[0] % Number(it.template[0].pre.split(" ")[0]), 0); }
    if (lv === 5) { const [a, b] = it.template[0].pre.match(/(\d+) × (\d+)/).slice(1).map(Number); assert.equal(nums.at(-1), a * b); }
  }
}
for (let lv = 1; lv <= 4; lv++) for (let i = 0; i < 2000; i++) {
  const it = makeItem("factlinks", lv, W, {});
  if (lv === 1) { const n = it.answer.map(Number); if (n.length === 3) assert.equal(n[2], n[0] + n[1]); assert.equal(n.at(-1), Number(it.template.at(-1).pre.match(/^(\d+) × (\d+)/).slice(1).reduce((a, b) => a * b))); }
  if (lv === 2 || lv === 4) { const m = it.text.match(/^(\d+) × (\d+) = (\d+)\.\nSo (\d+) × (\d+) = \?$/); assert.ok(m, it.text); assert.equal(m[1] * m[2], +m[3]); assert.equal(m[4] * m[5], Number(it.answer)); }
}
for (let lv = 1; lv <= 5; lv++) for (let i = 0; i < 2000; i++) {
  const it = makeItem("shapes", lv, W, {});
  assert.ok(it.visual && it.showVisual, "shape lab always has a picture");
  const v = it.visual;
  if (lv === 1) assert.equal(Number(it.answer), v.rows * v.cols);
  if (lv === 2 && /How many squares now/.test(it.text)) assert.equal(Number(it.answer), rect(v)[0] * rect(v)[1]);
  if (lv === 3 && /How many squares in the big/.test(it.text)) assert.equal(Number(it.answer), rect(v)[0] * rect(v)[1]);
  if (lv === 3 && /fit inside/.test(it.text)) assert.equal(Number(it.answer), v.kw * v.kh);
  if (lv === 4) { assert.equal(Number(it.answer), v.h * v.kh); assert.equal(v.hideBig, "h"); }
  if (lv === 5) { const m = it.text.match(/has (\d+) blue tiles and (\d+) gold.*There are (\d+) blue/); assert.equal(Number(it.answer), (m[3] / m[1]) * m[2]); }
  if (v.kind === "scale") assert.ok(v.w * v.kw <= 24 && v.h * v.kh <= 24, "scaled shapes stay drawable");
  // Additive thinking ("same shape, so add the difference") is named, not just "wrong".
  for (const [w, type] of Object.entries(it.misconceptions || {})) if (String(w) !== it.answer) assert.equal(classifyError(it, w), type);
}

// 2. Gym skills stay out of adventures unless a grown-up turns them on, for new and old profiles.
{
  const st = freshState();
  for (const id of ["doubling", "factlinks", "shapes"]) assert.equal(st.skills[id].focus, "off");
  for (let i = 0; i < 400; i++) assert.ok(!SKILL[chooseSkill(st, [])].gym);
  const old = freshState(); delete old.gym; delete old.skills.shapes; upgradeState(old);
  assert.ok(old.gym && old.gym.fastMs === 4000 && old.gym.focusTables.includes(12) && old.skills.shapes.focus === "off");
}

// 3. Sprint picks: every fact is 2–12, focus tables (12s) come up far more than their share.
{
  const st = freshState();
  let twelves = 0;
  for (let i = 0; i < 4000; i++) { const [a, b] = pickSprintFact(st, []); assert.ok(a >= 2 && a <= 12 && b >= 2 && b <= 12); if (a === 12 || b === 12) twelves++; }
  assert.ok(twelves / 4000 > 0.3, `12s share ${twelves / 4000}`);
  const it = sprintItem(12, 7, W);
  assert.equal(it.text, "12 × 7 = ?"); assert.equal(it.answer, "84"); assert.equal(it.level, 4);
  assert.deepEqual(it.visual, { kind: "areaSplit", rows: 7, cols: 12, splits: [10] });
  for (const k of ["workout", ...STATIONS.map((s) => s.id)]) for (const station of workoutPlan(k)) {
    const r = gymItem(st, station, W, []);
    assert.ok(isCorrect(r, good(r)), `${station} rep checks`);
  }
}

// 4. Speed: right + fast twice = strong. Slow or helped answers don't count toward it.
{
  const st = freshState();
  const rep = (a, b, o) => recordGym(st, sprintItem(a, b, W), { help: [], given: String(a * b), correct: true, ...o });
  rep(7, 12, { ms: 2000 });
  assert.equal(fluency(st, 7, 12), "learning");
  const r = rep(12, 7, { ms: 2500 });
  assert.ok(r.becameStrong && fluency(st, 7, 12) === "strong" && strongCount(st) === 1 && tableStrength(st, 12) === 1);
  assert.equal(st.skills.facts.level, freshState().skills.facts.level, "gym reps don't move the adventure's Times Tables level");
  rep(8, 12, { ms: 1500 }); rep(8, 12, { ms: 9000 });
  assert.equal(fluency(st, 8, 12), "learning", "a slow answer resets the speed streak");
  const before = st.facts[factKey(8, 12)];
  rep(8, 12, { ms: 9000 });
  assert.ok(st.facts[factKey(8, 12)] >= before * 0.9 - 1e-9, "slow facts keep most of their weight");
  rep(6, 12, { ms: 1000, help: ["show"] }); rep(6, 12, { ms: 1000, help: ["show"] });
  assert.equal(fluency(st, 6, 12), "learning", "help doesn't make a fact strong");
  assert.equal(FACT_COUNT, 66);
}

// 5. A miss is logged, comes back as the same fact (still a sprint), and is fixed when she gets it.
{
  const st = freshState();
  const it = sprintItem(12, 9, W);
  const r = recordGym(st, it, { correct: false, help: [], ms: 3000, given: "98" });
  assert.equal(r.mistake.status, "open");
  assert.deepEqual(r.mistake.snap.fact, [12, 9]);
  assert.equal(st.history.at(-1).gym, "sprint");
  const again = retryItem(st, r.mistake, W);
  assert.equal(again.text, it.text); assert.equal(again.station, "sprint"); assert.ok(again.reviewOf);
  recordGym(st, again, { correct: true, help: [], ms: 2000, given: "108" });
  assert.equal(r.mistake.status, "fixed");
  // Gym-skill misses wait for a later workout (adventures skip them while the skill is off).
  const sh = makeItem("shapes", 4, W, {});
  const r2 = recordGym(st, { ...sh, approach: "gym", station: "shapes" }, { correct: false, help: [], ms: 5000, given: "1" });
  assert.ok(!gymDue(st).length);
  st.counter += 4;
  assert.equal(gymDue(st)[0].id, r2.mistake.id);
  finishGym(st, { kind: "workout", reps: 3, clean: 1, fast: 1 });
  assert.equal(st.gym.sessions, 1); assert.equal(st.gym.log.length, 1);
}
console.log("gym tests passed");

// 6. Every fact's strategy hint lands on the right product.
import { strategy } from "../src/gym/engine.js";
for (let a = 2; a <= 12; a++) for (let b = 2; b <= 12; b++) {
  const s = strategy(a, b);
  assert.ok(s.hint && s.steps.length);
  assert.ok(s.steps.at(-1).endsWith(String(a * b)), `${a}×${b}: ${s.steps.at(-1)}`);
  for (const step of s.steps) for (const m of step.matchAll(/(\d+) ([×+−]) (\d+) = (\d+)/g)) assert.equal({ "×": m[1] * m[3], "+": +m[1] + +m[3], "−": m[1] - m[3] }[m[2]], +m[4], step);
}
console.log("strategy hints checked");
