// Run: node test/learning.test.mjs
// Checks lessons, mistake classification and second-chance reviews.
import { SKILLS, makeItem } from "../src/engine/skills.js";
import { WORLDS } from "../src/engine/themes.js";
import { freshState, upgradeState, recordResult, makePickFact, dueReview, reviewItem } from "../src/engine/learner.js";
import { LESSON_STYLES, lessonNeed, buildLesson, recordLesson } from "../src/engine/lessons.js";
import { classifyError } from "../src/engine/mistakes.js";
import { isCorrect, answerText } from "../src/engine/check.js";
import { setCoveredThrough, chooseSkill, nextItem } from "../src/engine/learner.js";
import { UNITS, activeStudy, studyRanges, unitLessons } from "../src/engine/units.js";

let failures = 0;
const fail = (msg) => { failures++; if (failures < 30) console.log("FAIL", msg); };
const expect = (cond, msg) => { if (!cond) fail(msg); };
const goodResponse = (it) => (it.answerType === "tiles" ? it.answer.split(" ") : it.answer);

// 1. Every skill, level and lesson style builds a usable lesson with checkable practice.
// Thinking Lab skills teach with their own intro screens instead of mini-lessons.
for (const s of SKILLS.filter((x) => !x.lab)) for (let lv = 1; lv <= s.maxLevel; lv++) for (const ls of LESSON_STYLES) for (const w of WORLDS.slice(0, 3)) {
  const st = freshState();
  st.skills[s.id].level = lv;
  const L = buildLesson(st, s.id, w, { pickFact: makePickFact(st) }, { reason: "new", style: ls.id });
  const key = `${s.id} L${lv} ${ls.id}`;
  expect(L.idea && L.trick && L.title, `${key}: missing text`);
  expect(L.example && L.example.text && L.example.steps?.length, `${key}: example lacks text or steps`);
  expect(L.practice.length === 2, `${key}: needs 2 practice items`);
  for (const p of L.practice) {
    expect(p.answerType !== "parts", `${key}: practice is multi-step`);
    expect(isCorrect(p, goodResponse(p)), `${key}: practice answer doesn't check (${p.answerType} ${JSON.stringify(p.answer)})`);
  }
  recordLesson(st, L, [true, false], "happy");
  expect(st.lessonLog.length === 1 && st.skills[s.id].lessonCount === 1, `${key}: lesson not recorded`);
}

// 2. Misconception answers are classified, and never equal the right answer.
const named = {};
for (const s of SKILLS) for (let lv = 1; lv <= s.maxLevel; lv++) for (let i = 0; i < 300; i++) {
  const it = makeItem(s.id, lv, WORLDS[0], { pickFact: () => [7, 8] });
  for (const p of it.answerType === "parts" ? it.parts : [it]) for (const [wrong, type] of Object.entries(p.misconceptions || {})) {
    if (String(wrong) === String(p.answer)) continue;
    const got = classifyError(p, wrong);
    if (got !== type) fail(`${s.id} L${lv}: ${wrong} for ${p.answer} classified ${got}, expected ${type}`);
    named[type] = (named[type] || 0) + 1;
  }
}
expect(classifyError({ answerType: "number", answer: "352" }, "3520") === "placeValue", "placeValue");
expect(classifyError({ answerType: "number", answer: "352" }, "362") === "digitSlip", "digitSlip");
expect(classifyError({ answerType: "number", answer: "352" }, "253") === "digitOrder", "digitOrder");

// 3. A miss is logged, comes back as a second chance, and is fixed when she gets it.
{
  const st = upgradeState({ ...freshState(), mistakes: undefined, lessonLog: undefined });
  expect(Array.isArray(st.mistakes) && Array.isArray(st.lessonLog), "upgradeState fills new fields");
  const it = { ...makeItem("add", 3, WORLDS[0], {}), approach: "direct" };
  const ev = recordResult(st, it, { correct: false, firstTry: true, hintUsed: false, ms: 1000, given: '"1"', givenRaw: "1" });
  expect(ev.mistake && ev.mistake.status === "open", "miss logged as open");
  expect(!dueReview(st, []), "not due straight away");
  for (let i = 0; i < 4; i++) recordResult(st, { ...makeItem("facts", 3, WORLDS[0], { pickFact: () => [6, 7] }), approach: "direct" }, { correct: true, firstTry: true, hintUsed: false, ms: 1000, given: "" });
  const due = dueReview(st, ["facts"]);
  expect(due && due.id === ev.mistake.id, "miss is due after 4 more questions");
  const again = reviewItem(st, due, WORLDS[0]);
  expect(again.text === it.text && again.reviewOf === due.id, "first comeback is the same question");
  const levelBefore = st.skills.add.level;
  recordResult(st, again, { correct: false, firstTry: true, hintUsed: false, ms: 1000, given: '"2"', givenRaw: "2" });
  expect(due.status === "open" && due.misses === 2 && due.variant, "second miss keeps it open as a variant");
  expect(st.skills.add.level === levelBefore, "reviews don't move the level");
  const variant = reviewItem(st, due, WORLDS[0]);
  recordResult(st, variant, { correct: true, firstTry: true, hintUsed: false, ms: 1000, given: "" });
  expect(due.status === "fixed", "fixed after a right second chance");
}

// 4. Lesson triggers: new skill, repeated mistake pattern, and a slump.
{
  const st = freshState();
  expect(lessonNeed(st, "rounding")?.reason === "new", "new skill gets a lesson");
  st.skills.rounding.lessonCount = 1; st.skills.rounding.lastLessonAt = 0; st.skills.rounding.seen = 10; st.counter = 20;
  expect(lessonNeed(st, "rounding") === null, "no lesson without a reason");
  st.mistakes.push({ skill: "rounding", counter: 18, errorType: "roundWrongWay" }, { skill: "rounding", counter: 19, errorType: "roundWrongWay" });
  const need = lessonNeed(st, "rounding");
  expect(need?.reason === "pattern" && need.errorType === "roundWrongWay", "repeated mistake gets a targeted lesson");
  st.mistakes = []; st.skills.rounding.justDropped = true;
  expect(lessonNeed(st, "rounding")?.reason === "struggling", "level drop gets a lesson");
}

// 6. School topics: later topics start off and switch on as the class moves forward.
{
  const st = freshState();
  const on = (id) => st.skills[id].focus !== "off";
  expect(on("add") && on("compare") && on("facts") && !on("multiply") && !on("mult2") && !on("geometry"), "fresh profile: topics 1-2 on, 3+ off");
  for (let i = 0; i < 300; i++) { const sk = chooseSkill(st, []); expect(!SKILLS.find((s) => s.id === sk).topic || SKILLS.find((s) => s.id === sk).topic <= 2, `chose later-topic skill ${sk}`); }
  setCoveredThrough(st, 5);
  expect(on("multiply") && on("mult2") && on("divide1") && !on("operations"), "through topic 5");
  st.skills.mult2.focus = "focus"; setCoveredThrough(st, 6);
  expect(st.skills.mult2.focus === "focus" && on("operations"), "keeps a grown-up's focus");
  setCoveredThrough(st, 3);
  expect(on("multiply") && !on("mult2"), "moving back switches later topics off");
  const old = freshState(); delete old.coveredThrough; delete old.skills.decimals; upgradeState(old);
  expect(old.coveredThrough === 2 && old.skills.decimals?.focus === "off", "older profiles get new skills switched off");
}
// 7. Study mode can pick any unit, including ones not reached yet; inventory mixes everything so far.
{
  for (const u of UNITS) {
    const st = freshState(); st.study = { on: true, unit: u.id, lessons: [] };
    const r = studyRanges(st);
    const want = new Set(u.lessons.flatMap((l) => Object.keys(l.skills)));
    for (let i = 0; i < 40; i++) { const it = nextItem(st, WORLDS[0], [], [], i % 10 === 9); expect(want.has(it.skill), `${u.id}: practised ${it.skill}`); const [lo, hi] = r[it.skill]; expect(it.level >= lo && it.level <= hi, `${u.id}: ${it.skill} level ${it.level} outside ${lo}-${hi}`); }
  }
  const st = freshState(); st.coveredThrough = 4; st.study = { on: true, unit: "inv", lessons: [] };
  const s = activeStudy(st), r = studyRanges(st);
  expect(s.unitName === "Inventory" && /Unit 4/.test(s.unitTitle), "inventory title");
  expect(r.facts && r.area && r.placevalue && r.add && r.multiply && r.mult2 && !r.divide1 && !r.decimals, "inventory through 4 covers review + units 1-4 only");
  st.study.through = 16;
  expect(studyRanges(st).geometry && studyRanges(st).decimals, "end-of-year inventory covers all topics");
  expect(unitLessons("inv", 16).length === UNITS.reduce((n, u) => n + u.lessons.length, 0) + 5, "inventory lesson count");
}
// 8. Decimal answers.
{
  const it = { answerType: "number", answer: "0.5", allowDot: true };
  expect(isCorrect(it, "0.5") && isCorrect(it, ".5") && isCorrect(it, "0.50") && !isCorrect(it, "5") && !isCorrect(it, "0.05"), "decimal normalisation");
  expect(answerText({ answerType: "number", answer: "4.71" }) === "4.71", "decimal answer text");
  expect(isCorrect({ answerType: "number", answer: "1200" }, "1,200") && isCorrect({ answerType: "number", answer: "21r1" }, "21r1"), "whole numbers still check");
}

console.log("misconceptions checked:", JSON.stringify(named));
if (failures) { console.log(`${failures} FAILURES`); process.exit(1); }
console.log("ALL PASS");
