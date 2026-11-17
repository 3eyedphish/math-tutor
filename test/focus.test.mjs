// Deep Sea Rescue (focus missions): puzzles are always fair and unambiguous, the
// memory span adapts the right way, and results land in the normal learning record.
import assert from "node:assert/strict";
import { messagePuzzle, judgeMessage, updateSpan, ensureFocus, SPAN_MIN, SPAN_MAX, bubbleRound, scoreBubbles, recordBubbleFocus,
  routePuzzle, recordPlan, addRating, focusSummary, messageItem, bubbleItem, routeItem } from "../src/mission/focus.js";
import { recordMission, MISSION, STATION } from "../src/mission/engine.js";
import { roundTo } from "../src/engine/util.js";
import { freshState } from "../src/engine/learner.js";

assert.equal(MISSION.ocean.stations.length, 3);
for (const id of ["octo", "bubbles", "route"]) assert.ok(STATION[id]);

// Octopus messages: distinct products; a slip can never look like another order.
for (let lv = 1; lv <= 7; lv++) for (let span = SPAN_MIN; span <= SPAN_MAX; span++) for (let i = 0; i < 400; i++) {
  const p = messagePuzzle(lv, span);
  assert.equal(p.msgs.length, span);
  assert.equal(new Set(p.msgs.map((m) => m.who)).size, span, "different creatures");
  const prods = p.msgs.map((m) => m.ans);
  assert.equal(new Set(prods).size, span);
  assert.ok(p.ask >= 0 && p.ask < span);
  const want = p.msgs[p.ask].ans;
  assert.equal(judgeMessage(p, want).kind, "right");
  assert.equal(judgeMessage(p, want * 10).kind, "slip");
  for (let j = 0; j < span; j++) if (j !== p.ask) assert.equal(judgeMessage(p, prods[j]).kind, "mixup");
  for (const m of p.msgs) assert.equal(m.ans, m.a * m.b);
}
// Span: up after two clean recalls, down after a mix-up, unchanged after a math slip or a peek.
{
  const st = freshState(); const f = ensureFocus(st);
  assert.equal(f.span, 2);
  updateSpan(f, "right", false); assert.equal(f.span, 2);
  updateSpan(f, "right", false); assert.equal(f.span, 3);
  updateSpan(f, "slip", false); assert.equal(f.span, 3);
  updateSpan(f, "right", true); updateSpan(f, "right", true); assert.equal(f.span, 3, "peeks don't grow the span");
  updateSpan(f, "mixup", false); assert.equal(f.span, 2);
  updateSpan(f, "mixup", false); assert.equal(f.span, SPAN_MIN, "never below the minimum");
  for (let i = 0; i < 20; i++) updateSpan(f, "right", false);
  assert.equal(f.span, SPAN_MAX); assert.equal(f.spanBest, SPAN_MAX);
}
// Bubble patrol: 10 bubbles, 6 to pop, the first two are always pop bubbles, lures are
// close to (or equal to) the line, and at estimate levels rounding gives the right verdict.
for (let lv = 1; lv <= 7; lv++) for (let i = 0; i < 500; i++) {
  const r = bubbleRound(lv);
  assert.equal(r.bubbles.length, 10);
  assert.equal(r.bubbles.filter((b) => b.go).length, 6);
  assert.ok(r.bubbles[0].go && r.bubbles[1].go);
  for (const b of r.bubbles) {
    assert.equal(b.v, b.a * b.b); assert.equal(b.go, b.v > r.T);
    if (r.est) assert.equal(roundTo(b.a, 10) * roundTo(b.b, 10) > r.T, b.go, "estimate decides it");
  }
  assert.equal(r.bubbles.filter((b) => b.lure).length, 2);
  assert.equal(new Set(r.bubbles.map((b) => `${Math.min(b.a, b.b)}x${Math.max(b.a, b.b)}`)).size, 10);
  const perfect = r.bubbles.map((b) => (b.go ? "pop" : "pass"));
  assert.equal(scoreBubbles(r, perfect).right, 10);
  const allPop = r.bubbles.map(() => "pop");
  const s = scoreBubbles(r, allPop);
  assert.equal(s.popsWrong, 4); assert.equal(s.lureWrong, 2);
}
// Narwhal routes: exactly one fits, never close to the limit, and estimates agree.
for (let lv = 1; lv <= 7; lv++) for (let i = 0; i < 500; i++) {
  const p = routePuzzle(lv);
  assert.equal(p.routes.filter((r) => r.fits).length, 1);
  assert.ok(p.routes[p.good].fits);
  for (const r of p.routes) {
    assert.equal(r.total, r.legs[0].a * r.legs[0].b + r.legs[1].a * r.legs[1].b);
    assert.ok(Math.abs(r.total - p.limit) >= p.limit * 0.1);
    if (p.est) assert.equal(r.estTotal < p.limit, r.fits);
  }
}
// Recording goes through the normal learning record under Multiply by 2 Digits.
{
  const st = freshState(); const f = ensureFocus(st);
  const before = st.history.length;
  const p = messagePuzzle(1, 2);
  const r = recordMission(st, "octo", messageItem(p), { correct: false, help: ["peek"], given: "1" });
  assert.equal(st.history.length, before + 1);
  assert.equal(st.history.at(-1).mission, "octo");
  assert.equal(r.support.key, "missed");
  const ok = recordMission(st, "bubbles", bubbleItem(bubbleRound(2)), { correct: true, help: ["peek"] });
  assert.equal(ok.support.key, "helped");
  assert.match(ok.support.label, /second look/);
  recordMission(st, "route", routeItem(routePuzzle(3)), { correct: true, help: [] });
  assert.ok(st.history.slice(-3).every((h) => h.skill === "mult2"));
  const round = bubbleRound(1);
  recordBubbleFocus(f, round, round.bubbles.map((b) => (b.go ? "pop" : "pass")), 8);
  recordPlan(f, true, false);
  addRating(f, "bubbles", "sharp", "10/10");
  const sum = focusSummary(st);
  assert.equal(sum.bubbles.hits, 100); assert.equal(sum.bubbles.holds, 100);
  assert.equal(sum.plans.checked, 100); assert.equal(sum.plans.right, 0);
  assert.equal(sum.ratings.length, 1);
  assert.deepEqual(sum.bubbles.goals, [{ goal: 8, got: 10 }]);
}
console.log("focus missions ok");
