// A few short synth sounds (no audio files). Muted unless she turns sound on.
let ctx = null, on = false;
export const setSound = (v) => { on = v; if (v && !ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } } ctx?.resume?.(); };
export const soundOn = () => on;
function tone(freq, dur, { type = "sine", at = 0, vol = 0.12, slide = 0 } = {}) {
  if (!on || !ctx) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
export const sfx = {
  click: () => tone(660, 0.07, { type: "triangle", vol: 0.08 }),
  load: () => tone(330, 0.18, { type: "triangle", slide: 1.8 }),
  bump: () => { tone(140, 0.25, { type: "sawtooth", vol: 0.08, slide: 0.6 }); },
  power: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: "triangle", at: i * 0.09 })),
  win: () => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, { type: "square", vol: 0.05, at: i * 0.1 })),
  whoosh: () => tone(200, 0.9, { type: "sawtooth", vol: 0.05, slide: 4 }),
};
