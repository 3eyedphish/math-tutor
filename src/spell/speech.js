// Speech for spelling and the little learner.
//
// Two kinds of voice:
//  • Device voices (speechSynthesis): free, offline. Best is Allison (Enhanced) if the device
//    lets web pages use it. iPhone/iPad Safari often does NOT list downloaded Enhanced/Premium
//    voices to websites or home-screen apps, so the app can't always reach Allison.
//  • Natural voice (online): the Worker's /api/tts (Workers AI Aura), cached on the device.
//
// The choice is per device (Grown-ups → Settings → Voice): "auto" (default), "natural", or a
// device voice by name. Auto = an Enhanced/Premium device voice if one is listed, otherwise the
// natural online voice when the server is reachable, otherwise the best plain device voice.
// Lines that have a pre-made recording (all Little learner lines, see voice-clips.js) play that
// recording instead, whatever the choice, so letter names and sounds are always said right.
import { isServer } from "../engine/store.js";
import { hasClip, clipUrl, sentences, speakable } from "./voice-clips.js";

const LS_KEY = "mt.voice";
const getChoice = () => { try { return localStorage.getItem(LS_KEY) || "auto"; } catch { return "auto"; } };
export function setVoiceChoice(c) { try { c && c !== "auto" ? localStorage.setItem(LS_KEY, c) : localStorage.removeItem(LS_KEY); } catch {} }
export const voiceChoice = getChoice;

// ── Device voices ───────────────────────────────────────────────────────────
export function scoreVoice(v) {
  const name = v.name || "";
  const lang = String(v.lang || "").replace("_", "-");
  if (!/^en(-|$)/i.test(lang)) return -1;
  const better = isBetter(v);
  let s = 0;
  if (/allison/i.test(name)) s += better ? 100 : 20;
  if (better) s += 50;
  if (/ava|samantha|aria|jenny|zoe|evan|nathan|google us english/i.test(name)) s += 5;
  if (/^en-US$/i.test(lang)) s += 3;
  if (/novelty|whisper|bells|bad news|good news|jester|organ|bubbles|cellos|trinoids|zarvox|boing|wobble|albert|fred|junior|ralph|kathy|superstar|grandma|grandpa|rocko|shelley|eddy|flo|reed|sandy/i.test(name)) s -= 40;
  if (v.localService) s += 1;
  return s;
}
// Enhanced/Premium voices show it in the name ("Allison (Enhanced)") or, on Apple, in the voiceURI.
const isBetter = (v) => /enhanced|premium|neural|natural/i.test(`${v.name} ${v.voiceURI || ""}`);
export function bestVoice(voices) {
  return voices.map((v) => [scoreVoice(v), v]).filter(([s]) => s >= 0).sort((a, b) => b[0] - a[0])[0]?.[1] || null;
}
let voices = [];
function loadVoices() { try { const v = speechSynthesis.getVoices(); if (v.length) voices = v; } catch {} return voices; }
// iPhone/iPad Safari fills the voice list late and often never fires "voiceschanged", so keep asking for a while.
try {
  loadVoices();
  speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
  let tries = 0; const t = setInterval(() => { loadVoices(); if (++tries > 20) clearInterval(t); }, 500);
} catch {}
// English device voices, best first (for the Grown-ups picker).
export function deviceVoices() {
  return loadVoices().filter((v) => scoreVoice(v) >= 0).sort((a, b) => scoreVoice(b) - scoreVoice(a)).map((v) => ({ name: v.name, lang: v.lang, better: isBetter(v), uri: v.voiceURI }));
}

// What will actually speak right now: { kind: "natural" } or { kind: "device", voice }.
let serverOff = false;
function current() {
  const c = getChoice(), list = loadVoices();
  if (c === "natural" && isServer() && !serverOff) return { kind: "natural" };
  if (c !== "auto" && c !== "natural") { const v = list.find((x) => x.name === c); if (v) return { kind: "device", voice: v }; }
  const best = bestVoice(list);
  if (c === "auto" && !(best && isBetter(best)) && isServer() && !serverOff) return { kind: "natural" };
  return { kind: "device", voice: best };
}
export function voiceName() {
  const c = current();
  return c.kind === "natural" ? "Natural voice (online)" : c.voice ? `${c.voice.name}${isBetter(c.voice) && !/enhanced|premium/i.test(c.voice.name) ? " (Enhanced)" : ""}` : "Device default voice";
}

let seq = 0;
function utter(text, slow, v) {
  const u = new SpeechSynthesisUtterance(text);
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
  u.rate = slow ? 0.6 : 0.9;
  return u;
}
function stopDevice() {
  try {
    const s = window.speechSynthesis;
    if (s.speaking || s.pending) s.cancel(); // cancel() when idle can swallow the next line on iOS
    s.resume?.();
    return s;
  } catch { return null; }
}
function deviceSay(text, slow, v, onend) {
  const s = stopDevice();
  let once = false, t = 0;
  const end = () => { if (once) return; once = true; clearTimeout(t); onend?.(); };
  try { const u = utter(text, slow, v); if (onend) { u.onend = end; u.onerror = end; } s?.speak(u); } catch { if (onend) setTimeout(end, 0); return; }
  // Some devices never fire "end" (or have no voice at all): carry on after about as long as it takes to say.
  if (onend) t = setTimeout(end, 1500 + text.length * (slow ? 120 : 80));
}

// ── Playing audio (natural voice and pre-made clips) ────────────────────────
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
let audio = null;
const getAudio = () => (audio ||= Object.assign(new Audio(), { preload: "auto" }));
const urls = new Map(); // key -> Promise<objectURL | null>
const ready = new Map(); // key -> objectURL
function load(key, req) {
  if (!urls.has(key)) urls.set(key, req()
    .then(async (r) => {
      if (r.status === 503) serverOff = true;
      // A missing clip comes back as the app page (text/html), so check that it really is audio.
      if (!r.ok || !(r.headers.get("content-type") || "").includes("audio")) { urls.delete(key); return null; }
      const u = URL.createObjectURL(await r.blob()); ready.set(key, u); return u;
    })
    .catch(() => { urls.delete(key); return null; }));
  return urls.get(key);
}
function fetchVoice(text) {
  if (serverOff || !isServer()) return Promise.resolve(null);
  return load(text, () => fetch("/api/tts", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) }));
}
const fetchClip = (sentence) => load("clip|" + sentence, () => fetch(clipUrl(sentence), { credentials: "same-origin" }));

// Play audio from `get` (a key in `ready`, or a fetch). onend runs when it finishes; fallback runs
// instead if it can't play (offline, missing, slow network), so a line is never just skipped.
function playAudio(key, get, slow, my, onend, fallback) {
  try { window.speechSynthesis?.cancel(); } catch {}
  const a = getAudio();
  let settled = false;
  const fail = () => { if (settled || my !== seq) return; settled = true; fallback(); };
  const play = (url) => {
    if (settled || my !== seq) return;
    settled = true;
    a.onended = onend || null; // set only now: the silent unlock below must not count as the end
    a.pause(); a.src = url; a.playbackRate = slow ? 0.75 : 1;
    a.play().catch(() => { settled = false; fail(); });
  };
  const url = ready.get(key);
  if (url) { play(url); return; }
  try { a.onended = null; a.src = SILENT; a.play().catch(() => {}); } catch {} // unlock audio inside the tap (iPad)
  const slowNet = setTimeout(() => { if (!ready.get(key)) fail(); }, 2500);
  get().then((u) => { clearTimeout(slowNet); if (u) play(u); else fail(); });
}
function naturalSay(text, slow, my, onend) {
  playAudio(text, () => fetchVoice(text), slow, my, onend, () => deviceSay(text, slow, bestVoice(loadVoices()), onend));
}

// ── Public ──────────────────────────────────────────────────────────────────
// A line is split into sentences. A sentence with a pre-made clip plays the clip (letter names and
// sounds are always right that way); the rest go to the chosen voice, with [B]/[/B/] marks made plain.
function plan(text) {
  const segs = [];
  for (const s of sentences(text)) {
    if (hasClip(s)) segs.push({ clip: s });
    else { missing.add(s); const last = segs[segs.length - 1]; if (last && last.text) last.text += " " + s; else segs.push({ text: s }); }
  }
  return segs;
}
const missing = new Set(); // sentences said without a clip (checked by the browser tests)
export const missingClips = () => [...missing];
try { window.__voiceMisses = missingClips; } catch {}
function speakText(text, slow, my, c, onend) {
  const t = speakable(text);
  if (c.kind === "natural") naturalSay(t, slow, my, onend);
  else { try { getAudio().pause(); } catch {} deviceSay(t, slow, c.voice, onend); }
}
function run(segs, slow, my) {
  const c = current();
  let i = 0;
  const next = () => {
    if (my !== seq || i >= segs.length) return;
    const g = segs[i++];
    if (g.clip) playAudio("clip|" + g.clip, () => fetchClip(g.clip), slow, my, next, () => speakText(g.clip, slow, my, c, next));
    else speakText(g.text, slow, my, c, next);
  };
  next();
}
export function say(text, slow) {
  const my = ++seq;
  if (!text) return;
  run(plan(text), slow, my);
}
// Fetch clips and the natural voice ahead of time so a tap plays at once.
export function warm(texts) {
  const natural = current().kind === "natural";
  for (const t of texts || []) for (const g of plan(t || "")) {
    if (g.clip) fetchClip(g.clip);
    else if (natural) fetchVoice(speakable(g.text));
  }
}

// Longer text (a whole story): sentence by sentence, since iOS can cut off long utterances.
export function sayLong(text) {
  const parts = sentences(text);
  if (parts.length < 2) { say(text); return; }
  const id = ++seq;
  const c = current();
  let i = 0;
  if (c.kind === "natural") {
    warm(parts);
    const next = () => { if (id !== seq || i >= parts.length) return; naturalSay(parts[i++], false, id, next); };
    next();
    return;
  }
  const s = stopDevice();
  if (!s) return;
  const next = () => {
    if (id !== seq || i >= parts.length) return;
    const u = utter(parts[i++], false, c.voice);
    u.onend = next;
    try { s.speak(u); } catch {}
  };
  next();
}
