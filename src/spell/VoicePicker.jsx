// Grown-ups → Settings → Voice: which voice reads words and lessons aloud on this device.
import { useEffect, useState } from "react";
import { deviceVoices, voiceChoice, setVoiceChoice, voiceName, say } from "./speech.js";
import { isServer } from "../engine/store.js";

// No letter names here: in Little learner those play from built-in recordings, not this voice.
const SAMPLE = "Hi! Can you spell the word ghost? Ghost. The ghost said boo!";

export default function VoicePicker() {
  const [list, setList] = useState(deviceVoices());
  const [choice, setChoice] = useState(voiceChoice());
  const [, bump] = useState(0);
  // The iPad fills its voice list a moment after the page opens.
  useEffect(() => { const t = setInterval(() => setList(deviceVoices()), 700); const s = setTimeout(() => clearInterval(t), 6000); return () => { clearInterval(t); clearTimeout(s); }; }, []);
  const pick = (c) => { setVoiceChoice(c); setChoice(c); bump((x) => x + 1); say(SAMPLE); };
  const hasAllison = list.some((v) => /allison/i.test(v.name));
  const enhanced = list.filter((v) => v.better);
  return (
    <div className="field">Voice on this device
      <select value={choice} onChange={(e) => pick(e.target.value)}>
        <option value="auto">Automatic (best available)</option>
        {isServer() && <option value="natural">Natural voice (online)</option>}
        {list.map((v) => <option key={v.uri || v.name} value={v.name}>{v.better ? "⭐ " : ""}{v.name} ({v.lang})</option>)}
      </select>
      <div className="row" style={{ marginTop: "0.4rem", flexWrap: "wrap" }}>
        <button className="ghost small" onClick={() => say(SAMPLE)}>🔊 Test</button>
        <span className="fine">Now using: <b>{voiceName()}</b></span>
      </div>
      <p className="fine">
        This device lists {list.length} English voice{list.length === 1 ? "" : "s"} to the app{enhanced.length ? `, ${enhanced.length} of them Enhanced/Premium (⭐)` : ", none of them Enhanced"}.
        {hasAllison ? " Allison is in the list: pick it above." : " Allison isn't in the list. iPhone and iPad often don't let web pages and home-screen apps use downloaded Enhanced voices, even when Settings shows them. The Natural voice (online) is the closest match, and Automatic uses it when no Enhanced voice is listed."}
      </p>
      <p className="fine">Little learner doesn't use this voice: every line there, with each letter's name and sound, plays from a recording built into the app, so it sounds the same on every device and works offline.</p>
    </div>
  );
}
