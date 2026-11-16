// Plain-words descriptions of the pictures on screen, so the AI helper knows what she is
// looking at (a minicomputer board, an arrow road, strings, a split rectangle…).
import { SQ, PLACE, boardDigit, boardsValue, checkerCount } from "./labskills.js";

const boardWords = (b) => {
  const on = b.flatMap((c, i) => Array(c).fill(SQ[i])).reverse();
  return on.length ? `checkers on ${on.join(", ")} (= ${boardDigit(b)})` : "no checkers";
};
const boardsWords = (bs) => bs.map((b, p) => `${PLACE[p]} board: ${boardWords(b)}`).reverse().join("; ");

function mini(v) {
  const lines = [`A Papy Minicomputer with ${v.boards.length} boards side by side (ones on the right, then tens, hundreds…). Each board has 4 squares worth 8, 4, 2 and 1 of that place; two checkers on one square trade for one on the next square up, and 10 on a board trades for one checker on the next board's 1.`];
  if (v.build) lines.push(`The boards start empty; she taps squares to put checkers on.${v.fewest ? ` She should use as few checkers as possible (${v.min} is the fewest).` : ""}`);
  else if (v.boards2) lines.push(`Red checkers: ${boardsWords(v.boards)}. Blue checkers: ${boardsWords(v.boards2)}.`);
  else lines.push(`Checkers: ${boardsWords(v.boards)}.`);
  return lines.join(" ");
}

function arrows(v) {
  const name = (i) => (v.nodes[i].q ? `dot ${v.nodes[i].label} (missing)` : `dot ${v.nodes[i].label}`);
  const rules = (v.legend || []).map((l) => `${l.color} arrow = ${l.label === "?" ? "unknown rule (she has to find it)" : l.label}`).join(", ");
  const edges = v.edges.map((e) => `${e.color} arrow from ${name(e.from)} to ${name(e.to)}`).join("; ");
  return `An arrow road: dots are numbers, and every arrow of one colour follows the same rule. Going backward against an arrow does the opposite rule. Rules: ${rules}. Arrows: ${edges}.`;
}

function strings(v) {
  const two = v.preds.length > 1;
  const labels = two ? `Red string: ${v.labels[0] === "?" ? "label hidden (she has to work it out)" : v.labels[0]}. Blue string: ${v.labels[1]}. Where they overlap is for numbers that fit both.` : `One string labelled ${v.labels[0]}.`;
  const where = { in: "inside", out: two ? "outside both" : "outside", a: "red only", b: "blue only", ab: "in both" };
  const placed = v.placed?.length ? ` Numbers already placed: ${v.placed.map((p) => `${p.n} ${where[p.r]}`).join(", ")}.` : "";
  return `The string game: loops of string hold the numbers that fit their label; numbers that fit neither go outside. ${labels}${placed}`;
}

export function describePicture(v) {
  if (!v) return "";
  if (v.kind === "mini") return mini(v);
  if (v.kind === "arrows") return arrows(v);
  if (v.kind === "strings") return strings(v);
  if (v.kind === "array") return `An array of dots: ${v.rows} rows of ${v.cols}.`;
  if (v.kind === "areaSplit") return `A rectangle of squares, ${v.rows} rows by ${v.cols} columns, with a line splitting it after column ${(v.splits || []).join(" and ")} so it shows two smaller rectangles.`;
  if (v.kind === "areaModel") return `An area model (boxes, not to scale) with ${v.rows.join(" + ")} down the side and ${v.cols.join(" + ")} across the top. Box contents: ${v.rows.map((r, i) => v.cols.map((c, j) => `${r} × ${c} = ${v.cells?.[i]?.[j] ?? "?"}`).join("; ")).join("; ")}.`;
  if (v.kind === "scale") return `Two rectangles of squares: a small one ${v.w} wide and ${v.h} tall, and a big one ${v.w * v.kw} wide and ${v.hideBig === "h" ? "of unknown height" : `${v.h * v.kh} tall`}.`;
  if (v.kind === "ratio") return `A repeating tile pattern: every group has ${v.a} blue tiles and ${v.b} gold tiles.`;
  if (v.kind === "rect") return `A rectangle ${v.w} ${v.unit || ""} long and ${v.h} ${v.unit || ""} wide${v.grid ? ", drawn on a grid of unit squares" : ""}.`;
  return `A ${v.kind} picture: ${JSON.stringify(v).slice(0, 400)}`;
}

// What she has built so far on a minicomputer or in the strings (the AI must not just correct it for her).
export function describeWork(item, resp) {
  if (item.answerType === "mini" && Array.isArray(resp)) return checkerCount(resp) ? `So far her checkers show ${boardsValue(resp)} (${boardsWords(resp)}; ${checkerCount(resp)} checkers).` : "She hasn't put any checkers on yet.";
  if (item.answerType === "sort" && Array.isArray(resp)) {
    const where = { in: "inside", out: "outside", a: "red only", b: "blue only", ab: "both" };
    const done = item.choices.map((c, i) => (resp[i] ? `${c} → ${where[resp[i]]}` : null)).filter(Boolean);
    return `Numbers to place: ${item.choices.join(", ")}. ${done.length ? `She has placed: ${done.join(", ")}.` : "She hasn't placed any yet."}`;
  }
  return "";
}
