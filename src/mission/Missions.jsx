// The app's way into mission mode: pick a mission, play it, come back home.
import { useEffect, useState } from "react";
import Mission from "./Mission.jsx";
import { MISSIONS } from "./engine.js";
import { ai } from "../engine/store.js";

export default function Missions({ profile, state, world, persist, onClose }) {
  const [missionId, setMissionId] = useState(null);
  const [round, setRound] = useState(0);
  // The app's pink page background would show below a long station, so go dark while here.
  useEffect(() => { const b = document.body.style.background; document.body.style.background = "#0b1030"; return () => { document.body.style.background = b; }; }, []);
  const ask = (system, user) => ai(system, user, 220).then((t) => t || "").catch(() => "");
  return (
    <div className="ms-root">
      {missionId ? (
        <Mission key={round} missionId={missionId} st={state} world={world} name={profile.name} persist={persist} ask={ask} onExit={() => setMissionId(null)} />
      ) : (
        <div className="ms">
          <div className="ms-bar"><button className="ms-chip" onClick={onClose} aria-label="Back home">✕</button></div>
          <div className="ms-panel ms-intro">
            <p className="ms-eyebrow">Missions</p>
            <h1 className="ms-title">Pick a mission, {profile.name}!</h1>
            <div className="ms-stations">
              {MISSIONS.map((m) => (
                <button key={m.id} className="ms-station next" onClick={() => { setRound((r) => r + 1); setMissionId(m.id); }}>
                  <span className="ms-st-emoji">{m.stations.map((s) => s.emoji).join(" ")}</span>
                  <span className="ms-st-title">{m.title}</span>
                  <span className="ms-st-blurb">{m.unit}</span>
                  {m.focus && <span className="ms-focustag">Also practises: {m.stations.map((s) => s.focusSkill).join(", ").toLowerCase()}</span>}
                </button>
              ))}
            </div>
            <p className="ms-fine">No timers. Take as long as you need.</p>
          </div>
        </div>
      )}
    </div>
  );
}
