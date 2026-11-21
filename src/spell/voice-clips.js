// Pre-made recordings for short spoken lines (made by tools/voice, stored in public/voice/<id>.mp3).
// A line's id is a hash of its exact text, so the app finds a recording without a lookup table,
// and CLIP_IDS (generated) says which ones exist. Pure module: also used by the tools and tests.
import { CLIP_IDS } from "./clip-ids.js";

// FNV-1a 32-bit over the UTF-8 bytes, as 8 hex digits. tools/voice/make.py must match this.
export function clipId(text) {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(text)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
const have = new Set(CLIP_IDS.split(" ").filter(Boolean));
export const hasClip = (sentence) => have.has(clipId(sentence));
export const clipUrl = (sentence) => `/voice/${clipId(sentence)}.mp3`;

// Split text into sentences the same way everywhere (the tool records one clip per sentence).
export const sentences = (text) => String(text || "").match(/[^.!?]+[.!?]+["”’]?\s*|[^.!?]+$/g)?.map((p) => p.trim()).filter(Boolean) || [];

// Letter marks: [B] = the letter's name, [/B/] = its sound. Used only when no recording can play:
// these are the least-bad plain spellings for a speech engine.
const NAME = { A: "A", B: "bee", C: "see", D: "dee", E: "E", F: "ef", G: "gee", H: "aitch", I: "I", J: "jay", K: "kay", L: "el", M: "em", N: "en", O: "O", P: "pee", Q: "cue", R: "ar", S: "es", T: "tee", U: "U", V: "vee", W: "double-u", X: "ex", Y: "why", Z: "zee" };
const SOUND = { A: "a, as in apple", B: "buh", C: "kuh", D: "duh", E: "e, as in egg", F: "fff", G: "guh", H: "huh", I: "i, as in igloo", J: "juh", K: "kuh", L: "lll", M: "mmm", N: "nnn", O: "o, as in octopus", P: "puh", Q: "kwuh", R: "rrr", S: "sss", T: "tuh", U: "u, as in up", V: "vvv", W: "wuh", X: "ks", Y: "yuh", Z: "zzz" };
export const speakable = (text) => String(text || "").replace(/\[\/([A-Z])\/\]/g, (_, L) => SOUND[L]).replace(/\[([A-Z])\]/g, (_, L) => NAME[L]);
