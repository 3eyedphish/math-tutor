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
import { isServer } from "../engine/store.js";

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
function deviceSay(text, slow, v) { const s = stopDevice(); try { s?.speak(utter(text, slow, v)); } catch {} }

// ── Natural voice (online) ──────────────────────────────────────────────────
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
let audio = null;
const getAudio = () => (audio ||= Object.assign(new Audio(), { preload: "auto" }));
const urls = new Map(); // text -> Promise<objectURL | null>
const ready = new Map(); // text -> objectURL
function fetchVoice(text) {
  if (serverOff || !isServer()) return Promise.resolve(null);
  if (!urls.has(text)) urls.set(text, fetch("/api/tts", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) })
    .then(async (r) => {
      if (r.status === 503) serverOff = true;
      if (!r.ok || !(r.headers.get("content-type") || "").includes("audio")) { urls.delete(text); return null; }
      const u = URL.createObjectURL(await r.blob()); ready.set(text, u); return u;
    })
    .catch(() => { urls.delete(text); return null; }));
  return urls.get(text);
}
function naturalSay(text, slow, my, onend) {
  try { window.speechSynthesis?.cancel(); } catch {}
  const a = getAudio();
  a.onended = onend || null;
  const fallback = () => { if (my === seq) deviceSay(text, slow, bestVoice(loadVoices())); };
  const play = (url) => { a.pause(); a.src = url; a.playbackRate = slow ? 0.75 : 1; return a.play(); };
  const url = ready.get(text);
  if (url) { play(url).catch(fallback); return; }
  try { a.src = SILENT; a.play().catch(() => {}); } catch {} // unlock audio inside the tap (iPad)
  const slowNet = setTimeout(() => { if (my === seq && !ready.get(text)) { seq++; fallback(); } }, 2500);
  fetchVoice(text).then((u) => { clearTimeout(slowNet); if (my !== seq) return; if (u) play(u).catch(fallback); else fallback(); });
}

// ── Public ──────────────────────────────────────────────────────────────────
export function say(text, slow) {
  const my = ++seq;
  if (!text) return;
  const c = current();
  if (c.kind === "natural") naturalSay(text, slow, my);
  else { try { getAudio().pause(); } catch {} deviceSay(text, slow, c.voice); }
}
// Fetch the natural voice ahead of time so a tap plays at once (no-op for device voices).
export function warm(texts) { if (current().kind === "natural") for (const t of texts || []) if (t) fetchVoice(t); }

// Longer text (a whole story): sentence by sentence, since iOS can cut off long utterances.
export function sayLong(text) {
  const parts = String(text).match(/[^.!?]+[.!?]+["”’]?\s*|[^.!?]+$/g)?.map((p) => p.trim()).filter(Boolean) || [];
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
