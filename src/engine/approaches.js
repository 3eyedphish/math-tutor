// Teaching approaches: different ways to present the same math.
// The learner model (learner.js) tracks which ones help this child most.
import { shuffle, pick, fmt, roundTo, chance } from "./util.js";
import { makeItem } from "./skills.js";

const showNum = (a) => (/r/.test(a) ? a.replace("r", " R ") : fmt(a));

export const APPROACHES = [
  { id: "direct", name: "Solve it", emoji: "✏️", desc: "The problem written the way it is on a worksheet.",
    applies: () => true,
    apply: (it) => it },
  { id: "story", name: "Story time", emoji: "📖", desc: "The same math told as a little story in her chosen world.",
    applies: (it) => !!it.story,
    apply: (it, ctx) => ({ ...it, text: it.story(ctx.theme), column: undefined }) },
  { id: "visual", name: "See it", emoji: "👀", desc: "Adds a picture: blocks, a number line, an array or a shape.",
    applies: (it) => !!it.visual,
    apply: (it) => ({ ...it, showVisual: true }) },
  { id: "choice", name: "Pick one", emoji: "🔘", desc: "Multiple choice, where the wrong options are the mistakes kids usually make.",
    applies: (it) => it.answerType === "number" && (it.wrong?.length || 0) >= 2,
    apply: (it) => {
      const opts = shuffle([it.answer, ...it.wrong.slice(0, 3)].map(String)).map(showNum);
      return { ...it, answerType: "choice", choices: opts, answer: showNum(it.answer) };
    } },
  { id: "detective", name: "Math detective", emoji: "🕵️", desc: "A character shows an answer (sometimes wrong). She checks it and gives the right one.",
    applies: (it) => it.answerType === "number" && (it.wrong?.length || 0) >= 1,
    apply: (it, ctx) => {
      const right = chance(0.35);
      const shown = right ? it.answer : String(it.wrong[0]);
      const isExpr = / = \?$/.test(it.text);
      const text = isExpr
        ? `🕵️ ${ctx.theme.hero} worked out:\n${it.text.replace(/ = \?$/, "")} = ${showNum(shown)}\nIs that right? Type the correct answer.`
        : `${it.text}\n\n🕵️ ${ctx.theme.hero} says the answer is ${showNum(shown)}. Is that right? Type the correct answer.`;
      return { ...it, text, detectiveShown: shown,
        hint: "Check it: estimate first, or use the opposite operation (add to check subtraction)." };
    } },
  { id: "worked", name: "Watch, then try", emoji: "🧑‍🏫", desc: "Shows a fully worked example first, then a similar problem to try.",
    applies: (it) => (it.steps?.length || 0) >= 2,
    apply: (it, ctx) => {
      // Find an example of the same kind (same operation symbols and answer type).
      const sig = (x) => `${x.answerType}|${x.text.replace(/[\d,]/g, "").slice(0, 40)}`;
      let ex = null;
      for (let i = 0; i < 25; i++) {
        const cand = makeItem(it.skill, it.level, ctx.theme, ctx.genCtx);
        if (cand.answerType === "parts" || cand.text === it.text) continue;
        if (!ex) ex = cand;
        if (sig(cand) === sig(it)) { ex = cand; break; }
      }
      if (!ex) return it;
      return { ...it, example: { text: ex.text, steps: ex.steps } };
    } },
  { id: "estimateFirst", name: "Estimate first", emoji: "🎯", desc: "Guess the ballpark before solving, then check the exact answer against it.",
    applies: (it) => !!it.num && it.answerType === "number",
    apply: (it) => {
      const { nums, op } = it.num;
      const big = Math.max(...nums);
      const place = 10 ** Math.max(1, String(big).length - 1);
      const r = nums.map((n) => roundTo(n, place));
      const est = op === "+" ? r.reduce((s, v) => s + v, 0) : r[0] - r[1];
      const choices = shuffle([est, est + place, est - place, est + 2 * place].filter((v, i, a) => v >= 0 && a.indexOf(v) === i)).slice(0, 3).map(fmt);
      if (!choices.includes(fmt(est))) choices[0] = fmt(est);
      return { ...it, answerType: "parts", parts: [
        { text: `First, estimate: round to the nearest ${fmt(place)}.\n${nums.map(fmt).join(` ${op} `)} is about…`, answerType: "choice", choices, answer: fmt(est), hint: `Round each number to the nearest ${fmt(place)}.`, steps: [`${nums.map(fmt).join(` ${op} `)} → ${r.map(fmt).join(` ${op} `)} = ${fmt(est)}`] },
        { text: `Now solve exactly. Your answer should be close to ${fmt(est)}.\n${it.text}`, answerType: "number", answer: it.answer, column: it.column, hint: it.hint, steps: it.steps },
      ] };
    } },
  { id: "speed", name: "Lightning round", emoji: "⚡", desc: "Quick mental-math facts with a friendly timer and a bonus star for speed.",
    applies: (it) => !!it.mental && it.answerType === "number",
    apply: (it) => ({ ...it, timer: 12 }) },
];
export const APPROACH = Object.fromEntries(APPROACHES.map((a) => [a.id, a]));
