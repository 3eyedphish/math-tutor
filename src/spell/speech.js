// Speech for spelling and the little learner. Uses the device's own voices (free, works offline).
// It picks the most natural English voice the device has: Allison (Enhanced) first, then any
// Enhanced / Premium / neural voice, then the plain defaults. On an iPad, better voices are
// downloaded in Settings → Accessibility → Spoken Content → Voices → English.

let voice = null;
export function scoreVoice(v) {
  const name = v.name || "";
  const lang = String(v.lang || "").replace("_", "-");
  if (!/^en(-|$)/i.test(lang)) return -1;
  const better = /enhanced|premium|neural|natural/i.test(name);
  let s = 0;
  if (/allison/i.test(name)) s += better ? 100 : 20;
  if (better) s += 50;
  if (/ava|samantha|aria|jenny|zoe|evan|nathan|google us english/i.test(name)) s += 5;
  if (/^en-US$/i.test(lang)) s += 3;
  if (/novelty|whisper|bells|bad news|good news|jester|organ|bubbles|cellos|trinoids|zarvox|boing|wobble|albert|fred|junior|ralph|kathy|superstar|grandma|grandpa|rocko|shelley|eddy|flo|reed|sandy/i.test(name)) s -= 40;
  if (v.localService) s += 1;
  return s;
}
export function bestVoice(voices) {
  return voices.map((v) => [scoreVoice(v), v]).filter(([s]) => s >= 0).sort((a, b) => b[0] - a[0])[0]?.[1] || null;
}
function pickVoice() {
  try { voice = bestVoice(speechSynthesis.getVoices()) || voice; } catch {}
}
try { pickVoice(); speechSynthesis.addEventListener?.("voiceschanged", pickVoice); } catch {}
export const voiceName = () => { if (!voice) pickVoice(); return voice ? voice.name : ""; };

let seq = 0;
function utter(text, slow) {
  const u = new SpeechSynthesisUtterance(text);
  if (!voice) pickVoice();
  if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = "en-US";
  u.rate = slow ? 0.6 : 0.9;
  return u;
}
function stop() {
  try {
    const s = window.speechSynthesis;
    if (s.speaking || s.pending) s.cancel(); // cancel() when idle can swallow the next line on iOS
    s.resume?.();
    return s;
  } catch { return null; }
}

export function say(text, slow) {
  seq++;
  if (!text) return;
  const s = stop();
  try { s?.speak(utter(text, slow)); } catch {}
}

// Kept so callers can prefetch; the device voice needs no download.
export function warm() {}

// Longer text (a whole story): speak sentence by sentence, since iOS can cut off long utterances.
export function sayLong(text) {
  const parts = String(text).match(/[^.!?]+[.!?]+["”’]?\s*|[^.!?]+$/g)?.map((p) => p.trim()).filter(Boolean) || [];
  if (parts.length < 2) { say(text); return; }
  const id = ++seq;
  const s = stop();
  if (!s) return;
  let i = 0;
  const next = () => {
    if (id !== seq || i >= parts.length) return;
    const u = utter(parts[i++]);
    u.onend = next;
    try { s.speak(u); } catch {}
  };
  next();
}
