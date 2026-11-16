// Optional AI touches (celebrations, "explain it another way", the end-of-session note).
// The math itself never comes from the AI. The key is entered by a parent and stays on this device.
import { describePicture } from "./picture.js";

const MODEL = "claude-haiku-5-5";

export async function askClaude(apiKey, system, user, maxTokens = 200) {
  if (!apiKey) return "";
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) return "";
    const d = await res.json();
    return d.content?.[0]?.text?.trim() || "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

const STYLE_HINTS = {
  direct: "a clear step-by-step explanation",
  story: "a tiny story with characters from her world",
  visual: "a picture she can imagine (blocks, a number line, groups of objects)",
  choice: "comparing the right answer with a common mistake",
  detective: "spotting where a mistake could happen",
  worked: "a similar worked example with smaller numbers",
  estimateFirst: "estimating first, then checking",
  speed: "a quick mental-math trick",
};
export function explainPrompt(name, theme, item, given, styleId) {
  return {
    system: `You are a warm, patient math tutor for ${name || "a gifted 8-year-old girl"}. Explain in 3 short sentences max, using ${STYLE_HINTS[styleId] || STYLE_HINTS.direct}. Theme: ${theme.label}. Never say the child is wrong in a discouraging way. Use plain text, no markdown.`,
    user: `Problem: ${item.text.replace(/\n/g, " ")}\nCorrect answer: ${Array.isArray(item.answer) ? item.answer.join(", ") : item.answer}\nShe answered: ${given}\nWorked solution: ${(item.steps || []).join("; ")}\nExplain it a different way.`,
  };
}

// Help she asks for BEFORE answering: guide her, never give the answer away.
const KID_STYLE = "Write for a young child (about 7 or 8) who is still learning to read: at most 4 very short sentences, simple everyday words, no markdown, no lists, no emoji except maybe one at the end. Be warm and encouraging.";
// opts.context: where she is and what the picture shows (Gym station, Lab boards, arrows…).
// opts.answer: the answer in words, when item.answer is not readable on its own (string game regions).
export function helpPrompt(name, theme, item, question, opts = {}) {
  const answer = opts.answer || (Array.isArray(item.answer) ? item.answer.join(", ") : item.answer);
  const context = [opts.context, opts.picture ?? (item.showVisual ? describePicture(item.visual) : "")].filter(Boolean).join("\n");
  return {
    system: `You are a kind math helper inside a kids' math game for ${name || "a child"}. ${KID_STYLE} The game theme is ${theme.label}. NEVER say the final answer or any number that is the final answer, even if she asks for it; instead help her take the next small step on her own. If she asks about something that is not this math problem, gently bring her back to the problem in one sentence.`,
    user: `The problem on her screen: ${item.text.replace(/\n/g, " ")}\n${context ? `What she sees: ${context}\n` : ""}(For you only, do not reveal: the answer is ${answer}. Worked steps: ${(item.steps || []).join("; ")})\n${question ? `She asked out loud: "${question.slice(0, 300)}"\nAnswer her question.` : "She asked to see it explained another way. Explain the idea a different way without solving it for her."}`,
  };
}
// A guard in case the reply gives the answer away anyway.
export function revealsAnswer(text, item) {
  const ans = Array.isArray(item.answer) ? item.answer : [item.answer];
  const unComma = (x) => x.replace(/(\d),(\d)/g, "$1$2");
  const has = (x, d) => new RegExp(`(^|[^\\d])${d}([^\\d]|$)`).test(unComma(x));
  return ans.some((a) => {
    const d = String(a).replace(/,/g, "");
    if (!/^\d{2,}/.test(d)) return false; // single digits appear naturally in explanations
    if (has(item.text || "", d)) return false; // already on her screen ("Show 347 on the minicomputer")
    return has(text, d);
  });
}
