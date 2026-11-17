// Stand-alone prototype of the mission mode, for trying it before it joins the app.
// It uses a fresh learner record in memory (nothing reaches Stella's real progress)
// and shows grown-ups exactly what each answer would record.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import Mission from "./Mission.jsx";
import { freshState } from "../engine/learner.js";
import { WORLDS } from "../engine/themes.js";
import { SKILL } from "../engine/skills.js";
import { STATION, MISSIONS } from "./engine.js";
import { FocusPanel } from "./oceangames.jsx";

const PRESETS = [
  { id: "warm", label: "Warm-up", note: "Smaller numbers to get started", levels: { mental: 2, subtract: 3, estimate: 1, multiply: 3, mult2: 1 } },
  { id: "unit2", label: "Her level", note: "Grade 4 numbers: 4–5 digits, 3-digit × 1-digit", levels: { mental: 3, subtract: 5, estimate: 2, multiply: 4, mult2: 2 } },
  { id: "challenge", label: "Challenge", note: "Thousands, 6-digit subtraction, 4-digit × 1-digit", levels: { mental: 4, subtract: 7, estimate: 3, multiply: 5, mult2: 3 } },
];
const world = WORLDS.find((w) => w.id === "space");
// In this prototype Bolt answers through the page's "ask Claude" permission; in the app it would use store.ai.
let samplerP = null;
async function askClaude(system, user) {
  try {
    samplerP ||= window.claude?.use ? window.claude.use("sample") : Promise.resolve(null);
    const sample = await samplerP;
    if (!sample) return "";
    const { text } = await sample(`${system}\n\n${user}`, { modelTier: "quick" });
    return (text || "").trim();
  } catch { return ""; }
}

function Proto() {
  const [name, setName] = useState("Stella");
  const [preset, setPreset] = useState("unit2");
  const [missionId, setMissionId] = useState("cruiser");
  const [st, setSt] = useState(null);
  const [log, setLog] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [round, setRound] = useState(0);

  const start = () => {
    const s = freshState();
    const p = PRESETS.find((x) => x.id === preset);
    for (const [k, v] of Object.entries(p.levels)) s.skills[k].level = v;
    setSt(s); setRound((r) => r + 1);
  };
  return (
    <div className="ms-root">
      {!st ? (
        <div className="ms ms-setup">
          <div className="ms-panel">
            <p className="ms-eyebrow">Prototype · Math Adventure mission mode</p>
            <h1 className="ms-title">Math Missions</h1>
            <p className="ms-story">Each mission is one ship and three stations. Every station turns a school math idea into something that happens: power a reactor, balance the cargo, land on Mars.</p>
            <div className="ms-field" role="radiogroup" aria-label="Mission">Mission
              <div className="ms-missions">
                {MISSIONS.map((m) => (
                  <button key={m.id} id={`ms-mission-${m.id}`} role="radio" aria-checked={missionId === m.id} className={`ms-preset ${missionId === m.id ? "on" : ""}`} onClick={() => setMissionId(m.id)}>
                    <b>{m.title}</b><span>{m.unit}</span><span>{m.stations.map((x) => x.emoji + " " + x.title).join(" · ")}</span>
                  </button>
                ))}
              </div>
            </div>
            <label className="ms-field" htmlFor="ms-name">Commander's name
              <input id="ms-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
            </label>
            <div className="ms-field" role="radiogroup" aria-label="Number size">Number size
              <div className="ms-presets">
                {PRESETS.map((p) => (
                  <button key={p.id} id={`ms-preset-${p.id}`} role="radio" aria-checked={preset === p.id} className={`ms-preset ${preset === p.id ? "on" : ""}`} onClick={() => setPreset(p.id)}>
                    <b>{p.label}</b><span>{p.note}</span>
                  </button>
                ))}
              </div>
            </div>
            <button className="ms-go wide" onClick={start}>Open the mission 🚀</button>
            <p className="ms-fine">This copy keeps its record in memory only, so trying it doesn't change Stella's real progress. Tap "Learning record" at the bottom to see what each answer would save.</p>
          </div>
        </div>
      ) : (
        <Mission key={round} missionId={missionId} st={st} world={world} name={name.trim() || "Stella"} onRecord={(e) => setLog((l) => [...l, e])} onExit={() => setSt(null)} ask={askClaude} />
      )}
      <button className="ms-logbtn" onClick={() => setShowLog(!showLog)} aria-expanded={showLog}>👪 Learning record ({log.length})</button>
      {showLog && <LogDrawer log={log} st={st} onClose={() => setShowLog(false)} />}
    </div>
  );
}

function LogDrawer({ log, st, onClose }) {
  return (
    <div className="ms-drawer" role="dialog" aria-label="Learning record">
      <div className="row between"><h2 className="ms-h2">What the mission records</h2><button className="ms-chip" onClick={onClose}>Close</button></div>
      <p className="ms-fine">Each station's first answer is what counts, the same rule as the main game. Help from Bolt is kept separate from answers she got on her own, and misses come back later in a normal adventure.</p>
      {!log.length && <p className="ms-fine"><i>Nothing yet. Finish a station to see its entry.</i></p>}
      <ul className="ms-loglist">
        {[...log].reverse().map((e, i) => (
          <li key={i} className={e.support.key}>
            <div className="row between"><b>{STATION[e.station].emoji} {STATION[e.station].title}</b><span className={`ms-tag ${e.support.key}`}>{e.support.label}</span></div>
            <div className="ms-fine">{e.q}</div>
            <div className="ms-fine">Skill: {SKILL[e.skill].name}, level {e.level} · First answer: {String(e.given)} · Answer: {e.answer}{e.levelUp ? " · ⬆ level up" : ""}{e.levelDown ? " · ⬇ level down" : ""}{e.comesBack ? " · 🔁 comes back later" : ""}</div>
          </li>
        ))}
      </ul>
      {st && <p className="ms-fine">Levels now: {["mental", "subtract", "estimate", "multiply", "mult2"].map((k) => `${SKILL[k].name} ${st.skills[k].level}`).join(" · ")} · Open second chances: {st.mistakes.filter((m) => m.status === "open").length}</p>}
      {st && <FocusPanel st={st} />}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Proto />);
