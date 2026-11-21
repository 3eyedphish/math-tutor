// Pre-made voice clips: every Little learner sentence has one, ids are stable, fallback text is plain.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { clipId, hasClip, sentences, speakable } from "../src/spell/voice-clips.js";
import { allSentences } from "../tools/voice/lines.mjs";
import { ABC, soundLine } from "../src/little/engine.js";

let n = 0;
const t = (name, fn) => { fn(); n++; };

t("clip ids are FNV-1a of the UTF-8 text (tools/voice/make.py relies on the same ids)", () => {
  assert.equal(clipId("a"), "e40c292c");
  assert.equal(clipId(""), "811c9dc5");
  assert.equal(clipId("[A] says [/A/], like apple."), clipId("[A] says [/A/], like apple."));
  assert.notEqual(clipId("[A]."), clipId("[a]."));
});

t("sentences split like the recorder", () => {
  assert.deepEqual(sentences("Not quite. [B] says [/B/], like ball."), ["Not quite.", "[B] says [/B/], like ball."]);
  assert.deepEqual(sentences("Yes! Great job!"), ["Yes!", "Great job!"]);
});

const all = allSentences();
t("tools/voice/lines.json is up to date (run node tools/voice/lines.mjs, then make.py)", () => {
  const listed = JSON.parse(readFileSync(new URL("../tools/voice/lines.json", import.meta.url), "utf8")).map((l) => l.text).sort();
  assert.deepEqual(listed, all);
});

t("every Little learner sentence has a recording", () => {
  const miss = all.filter((s) => !hasClip(s));
  assert.equal(miss.length, 0, `no recording for: ${miss.slice(0, 5).join(" | ")}`);
});

t("every recording is listed and still used", () => {
  const files = readdirSync(new URL("../public/voice/", import.meta.url)).filter((f) => f.endsWith(".mp3")).map((f) => f.slice(0, -4));
  const used = new Set(all.map(clipId));
  assert.deepEqual(files.filter((f) => !used.has(f)), []);
  for (const f of files) assert.ok(readFileSync(new URL(`../public/voice/${f}.mp3`, import.meta.url)).length > 500, f);
});

t("letter marks become plain words when no recording can play", () => {
  assert.equal(speakable("[B] says [/B/], like ball."), "bee says buh, like ball.");
  for (const L of ABC) assert.doesNotMatch(speakable(soundLine(L)), /[[\]/]/);
});

t("every letter line uses marks, never a guessed spelling", () => {
  for (const s of all) assert.doesNotMatch(s, /"A"|\b(ay|buh|kuh|mmm|sss|zzz)\b/, s);
});

console.log(`voice: ${n} checks passed`);
