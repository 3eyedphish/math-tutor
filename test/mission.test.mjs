// Mission puzzles: always solvable, never ambiguous, and recorded like normal answers.
import assert from "node:assert/strict";
import { reactorPuzzle, waysToMake, gatePuzzle, inGate, shieldItem, recordMission, reactorItem, gateItem, cargoItem, balancePuzzle, landPuzzle, MISSIONS, STATION } from "../src/mission/engine.js";
import { roundTo } from "../src/engine/util.js";
import { freshState } from "../src/engine/learner.js";
import { WORLDS } from "../src/engine/themes.js";

for (let lv = 1; lv <= 5; lv++) for (let i = 0; i < 3000; i++) {
  const p = reactorPuzzle(lv);
  const ways = waysToMake(p.cells, p.target).length;
  assert.ok(ways >= 2 && ways <= 4, `reactor L${lv} ways ${ways}`);
  assert.ok(p.cells.every((c) => c > 0 && c < p.target), "reactor cell sizes");
}
for (let lv = 1; lv <= 4; lv++) for (let i = 0; i < 3000; i++) {
  const g = gatePuzzle(lv);
  assert.equal(g.cells.filter((c) => inGate(g, c)).length, 1, `gate L${lv}: exactly one cell fits`);
  assert.ok(inGate(g, g.good) && g.cells.every((c) => c > 0));
  assert.ok(g.lo > g.charge);
}
for (let lv = 1; lv <= 7; lv++) for (let i = 0; i < 500; i++) {
  const it = shieldItem(lv, WORLDS[1]);
  assert.equal(Number(it.answer), it.whole - it.part);
}

// Mission 2 (Mars): cargo is a real partial-products item; balance has exactly two matches;
// rounding always gives the same verdict as the exact weight.
for (let lv = 1; lv <= 5; lv++) for (let i = 0; i < 1000; i++) {
  const c = cargoItem(lv, WORLDS[1]);
  assert.equal(c.answerType, "blanks");
  assert.equal(c.answer.length, c.parts.length + 1);
  assert.equal(c.parts.reduce((a, b) => a + b, 0), c.n);
  assert.equal(Number(c.answer.at(-1)), c.rows * c.n);
  c.parts.forEach((p, k) => assert.equal(Number(c.answer[k]), c.rows * p));
  const b = balancePuzzle(lv);
  assert.equal(b.loads.length, 4);
  assert.equal(b.loads.filter((l) => l.c * l.m === b.target).length, 2, "two loads balance");
  assert.ok(b.loads.every((l) => (l.c * l.m === b.target) === l.ok));
}
for (let lv = 1; lv <= 4; lv++) for (let i = 0; i < 3000; i++) {
  const l = landPuzzle(lv);
  const n = l.loads.filter((x) => x.fits).length;
  assert.ok(n >= 1 && n <= 2, "some fit, some don't");
  for (const x of l.loads) assert.equal(x.c * roundTo(x.w, l.place) < l.limit, x.total < l.limit, "estimate agrees with exact");
}
{ const ids = MISSIONS.flatMap((m) => m.stations.map((s) => s.id)); assert.equal(new Set(ids).size, ids.length, "station ids are unique"); }
assert.ok(STATION.cargo && STATION.land);

// Recording: first answer counts, help is kept separate, misses come back safely.
const st = freshState();
let r = recordMission(st, "reactor", reactorItem(reactorPuzzle(3)), { correct: true, help: [], ms: 1000, given: "x" });
assert.equal(r.support.key, "independent");
assert.equal(st.history.at(-1).mission, "reactor");
assert.equal(st.history.at(-1).ok, 1);
r = recordMission(st, "gate", gateItem(gatePuzzle(2)), { correct: true, help: ["hint", "visual"], ms: 1000, given: "+1" });
assert.equal(r.support.key, "helped");
assert.equal(st.history.at(-1).ok, 0, "helped answers are not clean");
const open = st.mistakes.find((m) => m.mission === "gate");
assert.ok(open && open.errorType === "neededHelp" && open.snap === null && open.variant, "gate help comes back as a fresh estimate question");
const sh = shieldItem(5, WORLDS[1]);
r = recordMission(st, "shield", sh, { correct: false, help: [], ms: 1000, given: "123" });
assert.equal(r.support.key, "missed");
assert.equal(r.mistake.snap.approach, "direct", "a missed shield problem replays in the main game as a normal question");
console.log("mission tests passed");
