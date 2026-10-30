import { normalize } from "./util.js";

// Strip commas, spaces and leading zeros so "09,392" counts the same as "9392".
const normNum = (s) => {
  const n = normalize(s);
  if (/^\d*\.\d*$/.test(n) && n !== ".") return String(Number(n)); // 0.50 = .5 = 0.5
  const m = n.match(/^0*(\d+)(r0*(\d+))?$/);
  if (!m) return n;
  return m[2] ? `${m[1] || "0"}r${m[3] || "0"}` : m[1] || "0";
};
export function isCorrect(item, response) {
  if (response === null || response === undefined) return false;
  switch (item.answerType) {
    case "number": return normNum(response) === normNum(item.answer);
    case "choice": return response === item.answer;
    case "multi": return [...response].sort().join("|") === [...item.answer].sort().join("|");
    case "blanks": return item.answer.every((a, i) => normNum(response[i] ?? "") === normNum(a));
    case "tiles": return response.join(" ") === item.answer;
    default: return false;
  }
}
// What to show as "the right answer" after a miss.
export function answerText(item) {
  const a = item.answer;
  if (item.answerType === "multi") return a.join("\n");
  if (item.answerType === "blanks") return (item.template.filter((t) => t.label).map((t, i) => `${t.label === "?" ? `Blank ${i + 1}` : t.label} = ${a[i]}`)).join(", ");
  if (item.answerType === "number" && /r/.test(a)) return a.replace("r", " R ");
  if (item.answerType === "number" && /\./.test(a)) return a;
  if (item.answerType === "number") return Number(a).toLocaleString("en-US");
  return a;
}
