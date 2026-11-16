// 🙋 Help in the Math Gym and Thinking Lab: the AI sees the picture, helped answers never count clean.
import assert from "node:assert/strict";
import { makeItem } from "../src/engine/skills.js";
import { freshState, upgradeState, factKey } from "../src/engine/learner.js";
import { WORLDS } from "../src/engine/themes.js";
import { helpPrompt, revealsAnswer } from "../src/engine/ai.js";
import { describePicture, describeWork } from "../src/engine/picture.js";
import { STATIONS as GYM, gymItem, sprintItem, recordGym, fluency } from "../src/gym/engine.js";
import { STATIONS as LAB, INTRO, labItem, emptyResponse, labAnswerText, recordLab } from "../src/lab/engine.js";

const W = WORLDS[0];

// 1. Every Lab and Gym picture gets a plain-words description, and the prompt fits the Worker's limits (2,000 / 4,000).
for (const s of LAB) for (let lv = 1; lv <= 5; lv++) for (let i = 0; i < 300; i++) {
  const st = upgradeState(freshState());
  st.skills[s.skill].level = lv;
  const it = labItem(st, s.id, W);
  const pic = describePicture(it.visual); // minicomputer trade questions have no picture
  if (it.visual) assert.ok(pic.length > 40 && !pic.includes("[object") && !pic.includes("undefined"), `${s.id} L${lv} picture: ${pic}`);
  if (it.visual?.kind === "mini") assert.match(pic, /Minicomputer/);
  if (it.visual?.kind === "arrows") assert.match(pic, /arrow road/);
  if (it.visual?.kind === "strings") assert.match(pic, /string game/);
  const ctx = `Thinking Lab, ${s.title} station. How it works: ${INTRO[s.id].lines.join(" ")} ${describeWork(it, emptyResponse(it))}`;
  const p = helpPrompt("Stella", W, it, "what do I do with the 8 square? ".repeat(10), { context: ctx, answer: labAnswerText(it) });
  assert.ok(p.system.length <= 2000, "system prompt fits");
  assert.ok(p.user.length <= 4000, `${s.id} L${lv} user prompt is ${p.user.length} chars`);
  assert.ok(p.user.includes(pic), "picture is in the prompt");
  if (it.answerType === "sort") assert.ok(!/answer is (in|out|a|b|ab),/.test(p.user), "string game answer is given in words");
}
for (const s of GYM) for (let i = 0; i < 300; i++) {
  const st = upgradeState(freshState());
  const it = gymItem(st, s.id, W);
  if (it.visual) assert.ok(describePicture(it.visual).length > 20 && !describePicture(it.visual).includes("undefined"), `${s.id} picture ${describePicture(it.visual)}`);
}

// 2. The answer guard: a reply that names a hidden answer is caught; a number already on screen is fine.
const sprint = sprintItem(7, 8, W);
assert.ok(revealsAnswer("It's 56!", sprint));
assert.ok(!revealsAnswer("Try 5 × 8 first, then add 2 × 8.", sprint));
const build = { text: "Put checkers on the minicomputer to show 347.", answer: "347" };
assert.ok(!revealsAnswer("You need to make 347. Start with the hundreds board.", build));
assert.ok(revealsAnswer("Together that makes 1,694", { text: "This is 847. Move every checker up one square.", answer: "1694" }));

// 3. Gym: a helped rep is never clean or fast, and breaks the strong-fact streak, however quick.
{
  const st = upgradeState(freshState());
  const k = factKey(12, 7);
  recordGym(st, sprintItem(12, 7, W), { correct: true, help: [], ms: 1500, given: "84" });
  assert.equal(st.gym.facts[k].streak, 1);
  const r = recordGym(st, sprintItem(12, 7, W), { correct: true, help: ["anotherWay"], ms: 1200, given: "84" });
  assert.equal(r.clean, false); assert.equal(r.fast, false); assert.equal(r.becameStrong, false);
  assert.equal(st.gym.facts[k].streak, 0, "help resets the speed streak");
  assert.equal(fluency(st, 12, 7), "learning");
  assert.deepEqual(st.history.at(-1).help, ["anotherWay"]); assert.equal(st.history.at(-1).ok, 0);
}
// 4. Lab: a helped right answer isn't clean.
{
  const st = upgradeState(freshState());
  const it = labItem(st, "arrows", W);
  assert.equal(recordLab(st, it, { correct: true, help: ["asked"], ms: 5000, given: "x" }).clean, false);
  assert.equal(recordLab(st, it, { correct: true, help: [], ms: 5000, given: "x" }).clean, true);
}
console.log("help tests passed");
