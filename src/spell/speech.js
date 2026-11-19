// Speech: a clear US voice, a little slow for spelling. "slow" stretches it further.
let voice = null;
function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices();
    const en = vs.filter((v) => /^en[-_]US/i.test(v.lang));
    voice = en.find((v) => /samantha|ava|allison|google us english|aria|jenny/i.test(v.name)) || en.find((v) => v.localService) || en[0] || vs.find((v) => /^en/i.test(v.lang)) || null;
  } catch {}
}
try { pickVoice(); speechSynthesis.addEventListener?.("voiceschanged", pickVoice); } catch {}
export function say(text, slow) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = "en-US";
    u.rate = slow ? 0.6 : 0.85;
    speechSynthesis.speak(u);
  } catch {}
}
