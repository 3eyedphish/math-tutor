// Thinking Lab: CSMP-style puzzles (Papy Minicomputer, arrow roads, the string game).
// Every answer goes through recordResult, so levels, mistakes and second chances work
// the same as everywhere else. The Lab adds its own two answer types: "mini" (checkers
// on boards) and "sort" (numbers placed in the strings).
import { makeItem } from "../engine/skills.js";
import { recordResult, reviewItem } from "../engine/learner.js";
import { isCorrect, answerText } from "../engine/check.js";
import { boardsValue, checkerCount, regionName, STRING_PREDS } from "../engine/labskills.js";
import { fmt } from "../engine/util.js";

export const STATIONS = [
  { id: "mini", title: "Minicomputer", emoji: "🟫", skill: "minicomp", blurb: "Checkers on 8-4-2-1 boards. Build, read, trade and add big numbers." },
  { id: "arrows", title: "Arrow Roads", emoji: "🏹", skill: "arrows", blurb: "Dots and coloured arrows. Find the missing dots and the secret rules." },
  { id: "strings", title: "String Game", emoji: "🧶", skill: "strings", blurb: "Sort numbers into loops of string. Crack the hidden labels." },
];
export const STATION = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
export const STATION_OF_SKILL = Object.fromEntries(STATIONS.map((s) => [s.skill, s.id]));
export const LAB_SKILL_IDS = STATIONS.map((s) => s.skill);

// How each station works, shown the first time she visits it (and any time from the menu).
export const INTRO = {
  mini: {
    title: "The Minicomputer",
    lines: [
      "Each board has 4 squares. The squares are worth 8, 4, 2 and 1.",
      "Put checkers on squares and add them up: a checker on 4 and one on 1 makes 5.",
      "Boards sit side by side like places: ones on the right, then tens, then hundreds.",
      "Two checkers on one square can trade for one checker on the next square up. 8 + 2 on a board is 10, so it trades for one checker on the next board's 1.",
    ],
    example: { kind: "mini", boards: [[1, 0, 1, 0], [0, 1, 0, 0]] }, exampleNote: "Tens board: 2. Ones board: 4 + 1 = 5. So this is 25.",
  },
  arrows: {
    title: "Arrow Roads",
    lines: [
      "Each dot is a number. An arrow takes one dot to another.",
      "Every arrow of the same colour follows the same rule, like +3 or ×2.",
      "Going backward against an arrow does the opposite: backward on +3 is −3, backward on ×2 is ÷2.",
    ],
    example: { kind: "arrows", nodes: [{ x: 0, y: 0, label: "4" }, { x: 1, y: 0, label: "7" }, { x: 2, y: 0, label: "10" }], edges: [{ from: 0, to: 1, color: "red" }, { from: 1, to: 2, color: "red" }], legend: [{ color: "red", label: "+3" }] },
    exampleNote: "Red means +3: 4 → 7 → 10.",
  },
  strings: {
    title: "The String Game",
    lines: [
      "Each loop of string has a label, like 'even numbers'. A number goes inside a string if it fits the label.",
      "Where two strings cross, the middle is for numbers that fit BOTH labels.",
      "Numbers that fit neither label go outside all the strings.",
    ],
    example: { kind: "strings", preds: ["even", "lt20"], labels: ["even numbers", "less than 20"], placed: [{ n: 8, r: "ab" }, { n: 30, r: "a" }, { n: 7, r: "b" }, { n: 25, r: "out" }] },
    exampleNote: "8 is even AND less than 20, so it's in the middle. 25 is neither, so it's outside.",
  },
};

// Today's lab: a few of each station, mixed. Or one station on its own.
const MIX = ["mini", "arrows", "strings", "mini", "strings", "arrows", "mini", "arrows", "strings"];
export const labPlan = (kind) => (kind === "mix" ? [...MIX] : Array(8).fill(kind));

export const labState = (st) => (st.lab ||= { intro: {}, sessions: 0, log: [] });

export function labItem(st, station, theme) {
  const skill = STATION[station].skill;
  return { ...makeItem(skill, st.skills[skill].level, theme, {}), approach: "lab", station };
}
export function labDue(st, max = 2) {
  return st.mistakes.filter((m) => m.status === "open" && m.dueAt <= st.counter && LAB_SKILL_IDS.includes(m.skill)).slice(0, max);
}
export function retryItem(st, m, theme) {
  return { ...reviewItem(st, m, theme), approach: "lab", station: STATION_OF_SKILL[m.skill] };
}

// An empty answer for each kind of question.
export function emptyResponse(item) {
  if (item.answerType === "mini") return item.visual.boards.map((b) => [...b]);
  if (item.answerType === "sort") return item.choices.map(() => null);
  if (item.answerType === "multi") return [];
  if (item.answerType === "blanks") return item.answer.map(() => "");
  return "";
}
export function ready(item, resp) {
  if (item.answerType === "number") return !!resp;
  if (item.answerType === "blanks") return resp.every((v) => v);
  if (item.answerType === "sort") return resp.every((v) => v);
  if (item.answerType === "mini") return checkerCount(resp) > 0;
  if (item.answerType === "choice") return !!resp;
  return true;
}
export function labCorrect(item, resp) {
  if (item.answerType === "mini") return boardsValue(resp) === Number(item.answer) && (!item.visual.fewest || checkerCount(resp) === item.visual.min);
  if (item.answerType === "sort") return item.answer.every((r, i) => resp[i] === r);
  return isCorrect(item, resp);
}
// What she answered, as text for the mistakes log.
export function givenText(item, resp) {
  if (item.answerType === "mini") return `${fmt(boardsValue(resp))} (${checkerCount(resp)} checkers)`;
  if (item.answerType === "sort") return item.choices.map((c, i) => `${c}: ${resp[i] ? REGION_SHORT[resp[i]] : "?"}`).join(", ");
  return resp;
}
const REGION_SHORT = { in: "inside", out: "outside", a: "red only", b: "blue only", ab: "both" };
export function labAnswerText(item) {
  if (item.answerType === "mini") return item.visual.fewest ? `${fmt(Number(item.answer))} with ${item.visual.min} checkers` : fmt(Number(item.answer));
  if (item.answerType === "sort") return item.choices.map((c, i) => `${c} → ${REGION_SHORT[item.answer[i]]}`).join(" · ");
  return answerText(item);
}
// A short reason a "mini" answer was wrong, so she knows what to fix.
export function miniFeedback(item, resp) {
  const v = boardsValue(resp), n = Number(item.answer);
  if (v !== n) return `Your checkers show ${fmt(v)}, not ${fmt(n)}.`;
  if (item.visual.fewest) return `That's ${fmt(n)}, but with ${checkerCount(resp)} checkers. It can be done with ${item.visual.min}.`;
  return "";
}
export const regionLabel = (r, preds) => regionName(r, preds);
export const predLabel = (p) => STRING_PREDS[p]?.label;

// Record one answer. outcome: { correct, help: [], ms, given }
export function recordLab(st, item, outcome) {
  const help = [...new Set(outcome.help || [])];
  const given = typeof outcome.given === "string" ? outcome.given : JSON.stringify(outcome.given ?? "");
  const ev = recordResult(st, { ...item, approach: "lab" }, {
    correct: outcome.correct, firstTry: true, hintUsed: help.length > 0, help, ms: outcome.ms, given, givenRaw: given,
  });
  const h = st.history[st.history.length - 1];
  if (h) h.lab = item.station || true;
  if (ev.mistake?.snap) ev.mistake.snap.approach = "lab";
  return { ...ev, clean: outcome.correct && !help.length };
}
export function finishLab(st, summary) {
  const l = labState(st);
  l.sessions++;
  l.log = [...l.log, { t: Date.now(), kind: summary.kind, n: summary.n, clean: summary.clean }].slice(-60);
}
