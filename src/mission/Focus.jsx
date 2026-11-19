// The Focus tab: the three focus-skill games from Deep Sea Rescue, one tap away, plus a breathing break.
import { useEffect, useState } from "react";
import Mission from "./Mission.jsx";
import { MISSION } from "./engine.js";
import { ensureFocus } from "./focus.js";
import { Breathe, CreatureIcon, OceanScene } from "./oceangames.jsx";
import { ai } from "../engine/store.js";

const M = MISSION.ocean;
// A line about her own best so far, for each game.
function best(f, id) {
  if (id === "octo") return f.memory.n ? `Your best: remembering ${f.spanBest} orders` : "New! Try it";
  if (id === "bubbles") return f.bubbles.rounds ? `${f.bubbles.rounds} patrol${f.bubbles.rounds > 1 ? "s" : ""} done` : "New! Try it";
  if (id === "route") return f.plans.n ? `${f.plans.n} route${f.plans.n > 1 ? "s" : ""} planned` : "New! Try it";
  return "";
}

export default function Focus({ profile, state, world, persist, onClose }) {
  const [play, setPlay] = useState(null); // station id | "mission"
  const [round, setRound] = useState(0);
  const [breathe, setBreathe] = useState(false);
  useEffect(() => { const b = document.body.style.background; document.body.style.background = "#0b1030"; return () => { document.body.style.background = b; }; }, []);
  const ask = (system, user) => ai(system, user, 220).then((t) => t || "").catch(() => "");
  const f = ensureFocus(state);
  const go = (id) => { setRound((r) => r + 1); setPlay(id); };
  if (play) return (
    <div className="ms-root">
      <Mission key={round} missionId="ocean" st={state} world={world} name={profile.name} persist={persist} ask={ask}
        startView={play === "mission" ? undefined : play} free={play !== "mission"} onExit={() => setPlay(null)} />
    </div>
  );
  return (
    <div className="ms-root">
      <div className="ms">
        <div className="ms-bar"><button className="ms-chip" onClick={onClose} aria-label="Back home">✕</button></div>
        <div className="ms-panel ms-intro">
          <OceanScene done={{}} calm />
          <p className="ms-eyebrow">🧠 Focus Lab</p>
          <h1 className="ms-title">Train your brain, {profile.name}!</h1>
          <p className="ms-bolt-line"><CreatureIcon kind="axolotl" size={30} /> Pip: "Each game grows one focus power. Pick one!"</p>
          <div className="ms-stations">
            {M.stations.map((s) => (
              <button key={s.id} className="ms-station next" onClick={() => go(s.id)}>
                <span className="ms-st-emoji">{s.emoji}</span>
                <span className="ms-st-title">{s.focusSkill}</span>
                <span className="ms-focustag">{s.title}</span>
                <span className="ms-st-blurb">{s.blurb}</span>
                <span className="ms-fine">{best(f, s.id)}</span>
              </button>
            ))}
            <button className="ms-station" onClick={() => setBreathe(true)}>
              <span className="ms-st-emoji">🫧</span>
              <span className="ms-st-title">Calm down</span>
              <span className="ms-focustag">Bubble breathing</span>
              <span className="ms-st-blurb">Breathe in as the bubble grows, out as it shrinks.</span>
              <span className="ms-fine">{f.breaths ? `${f.breaths} breathing break${f.breaths > 1 ? "s" : ""}` : "Try it any time"}</span>
            </button>
          </div>
          <button className="ms-link" onClick={() => go("mission")}>🌊 Play the whole Deep Sea Rescue story</button>
          <p className="ms-fine">No timers. Take as long as you need.</p>
        </div>
      </div>
      {breathe && <Breathe st={state} onClose={() => { persist(state); setBreathe(false); }} />}
    </div>
  );
}
