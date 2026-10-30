// Stand-alone preview of the Thinking Lab, for trying it before it goes live.
// It uses a fresh learner record in memory, so nothing touches real progress.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import Lab from "./Lab.jsx";
import { freshState } from "../engine/learner.js";
import { WORLDS } from "../engine/themes.js";
import { STATIONS } from "./engine.js";

const PRESETS = [
  { id: 1, label: "Start at level 1", note: "Small numbers, how each tool works" },
  { id: 3, label: "Start at level 3", note: "Trades, two-colour roads, hidden labels" },
  { id: 5, label: "Start at level 5", note: "Millions, detective dots, factor strings" },
];
function Proto() {
  const [st, setSt] = useState(null);
  const [lv, setLv] = useState(1);
  const [round, setRound] = useState(0);
  const world = WORLDS[0];
  const begin = () => {
    const s = freshState();
    for (const x of STATIONS) s.skills[x.skill].level = lv;
    setSt(s); setRound((r) => r + 1);
  };
  if (!st) return (
    <div className="app"><div className="card">
      <p className="fine">Preview · Math Adventure</p>
      <h1 className="title">🧠 Thinking Lab</h1>
      <p className="sub">Three picture languages from CSMP, rebuilt for Stella: the Papy Minicomputer, arrow roads and the string game. This preview keeps progress in memory only.</p>
      <div className="row" style={{ flexWrap: "wrap" }}>{PRESETS.map((p) => <button key={p.id} className={`chipbtn ${lv === p.id ? "on" : ""}`} onClick={() => setLv(p.id)} title={p.note}>{p.label}</button>)}</div>
      <p className="fine">{PRESETS.find((p) => p.id === lv).note}. Levels still move up and down with her answers.</p>
      <button className="primary big" onClick={begin}>Open the lab</button>
    </div></div>
  );
  return <div className="app"><Lab key={round} profile={{ id: "preview", name: "Stella" }} state={st} world={world} persist={() => {}} onClose={() => setSt(null)} /></div>;
}
createRoot(document.getElementById("root")).render(<Proto />);
