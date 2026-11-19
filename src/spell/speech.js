// Speech for spelling. On the live site the words are spoken by a natural voice (Workers AI,
// via /api/tts) and cached on the device; the browser's built-in voice is the fallback.
import { isServer } from "../engine/store.js";

// ---- Built-in browser voice (fallback): prefer the better-sounding voices when present ----
let voice = null;
function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices().filter((v) => /^en[-_]US/i.test(v.lang));
    const score = (v) => (/premium|enhanced|natural|neural/i.test(v.name) ? 10 : 0) + (/samantha|ava|allison|aria|jenny|google us english/i.test(v.name) ? 5 : 0) + (v.localService ? 1 : 0);
    voice = vs.sort((a, b) => score(b) - score(a))[0] || null;
  } catch {}
}
try { pickVoice(); speechSynthesis.addEventListener?.("voiceschanged", pickVoice); } catch {}
function browserSay(text, slow) {
  try {
    const s = window.speechSynthesis;
    if (s.speaking || s.pending) s.cancel(); // cancel() right before speak() can swallow the next line on iOS
    s.resume?.();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = "en-US";
    u.rate = slow ? 0.6 : 0.85;
    s.speak(u);
  } catch {}
}

// ---- Natural voice from the server ----
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
let audio = null;
const getAudio = () => (audio ||= Object.assign(new Audio(), { preload: "auto" }));
const urls = new Map(); // text -> Promise<objectURL | null>
let serverOff = false;
function fetchVoice(text) {
  if (serverOff || !isServer()) return Promise.resolve(null);
  if (!urls.has(text)) urls.set(text, fetch("/api/tts", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) })
    .then(async (r) => {
      if (r.status === 503) serverOff = true;
      if (!r.ok || !(r.headers.get("content-type") || "").includes("audio")) { urls.delete(text); return null; }
      return URL.createObjectURL(await r.blob());
    })
    .catch(() => { urls.delete(text); return null; }));
  return urls.get(text);
}
let ready = new Map(); // text -> objectURL once fetched
let token = 0;
let longSeq = 0;
export function say(text, slow) { longSeq++; speak(text, slow); }
function speak(text, slow) {
  if (!text) return;
  const my = ++token;
  try { window.speechSynthesis?.cancel(); } catch {}
  const a = getAudio();
  a.onended = null;
  const play = (url) => { a.pause(); a.src = url; a.playbackRate = slow ? 0.7 : 1; return a.play(); };
  const url = ready.get(text);
  if (url) { play(url).catch(() => browserSay(text, slow)); return; }
  if (serverOff || !isServer()) { browserSay(text, slow); return; }
  // Unlock the audio element inside the tap, then play when the voice arrives.
  try { a.src = SILENT; a.play().catch(() => {}); } catch {}
  const p = fetchVoice(text);
  const slowNet = setTimeout(() => { if (my === token && !ready.get(text)) { token++; browserSay(text, slow); } }, 2500);
  p.then((u) => {
    clearTimeout(slowNet);
    if (u) ready.set(text, u);
    if (my !== token) return;
    if (u) play(u).catch(() => browserSay(text, slow)); else browserSay(text, slow);
  });
}
// Fetch ahead so a tap plays instantly (and inside the tap, which iPad Safari requires).
export function warm(texts) { for (const t of texts) if (t) fetchVoice(t).then((u) => u && ready.set(t, u)); }

// Longer text (a whole story): split into sentences and play them one after another.
export function sayLong(text) {
  const parts = (String(text).match(/[^.!?]+[.!?]+["”’]?\s*|[^.!?]+$/g) || [text]).reduce((acc, s) => {
    if (acc.length && (acc[acc.length - 1] + s).length < 280) acc[acc.length - 1] += s; else acc.push(s);
    return acc;
  }, []).map((s) => s.trim()).filter(Boolean);
  if (serverOff || !isServer() || parts.length < 2) { say(text); return; }
  warm(parts);
  const id = ++longSeq;
  let i = 0;
  const playNext = () => { if (id !== longSeq || i >= parts.length) return; speak(parts[i++]); getAudio().onended = playNext; };
  playNext();
}
