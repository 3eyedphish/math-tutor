import { useState } from "react";
import { Keypad } from "../ui/components.jsx";
import * as store from "../engine/store.js";

export const AVATARS = ["🦄", "🐉", "🚀", "🐬", "🦊", "🐼", "🦁", "🐸", "🦋", "🐙", "🌟", "🐧", "🐱", "🐶", "🐰", "🐨", "🦖", "🐢", "🦉", "🐝", "🦩", "🐳", "🌈", "🧜‍♀️"];

export default function Profiles({ profiles, onPick, onCreated, mode }) {
  const [adding, setAdding] = useState(profiles.length === 0);
  const [pinFor, setPinFor] = useState(null);
  const [pin, setPin] = useState("");
  const [bad, setBad] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [newPin, setNewPin] = useState("");
  const [stage, setStage] = useState("big");

  const tryPin = async (p, value) => {
    if (await store.checkPin(p, value)) onPick(p);
    else { setBad(true); setPin(""); }
  };
  if (pinFor) {
    return (
      <div className="card center">
        <div className="big-emoji">{pinFor.avatar}</div>
        <h2>Hi {pinFor.name}! Enter your secret code</h2>
        <div className={`pin-dots ${bad ? "shake" : ""}`}>{[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? "on" : ""} />)}</div>
        <Keypad onKey={(k) => {
          setBad(false);
          if (k === "⌫") return setPin(pin.slice(0, -1));
          const v = (pin + k).slice(0, 4);
          setPin(v);
          if (v.length === 4) tryPin(pinFor, v);
        }} />
        <button className="ghost" onClick={() => { setPinFor(null); setPin(""); }}>Back</button>
      </div>
    );
  }
  if (adding) {
    return (
      <div className="card">
        <h2>New player</h2>
        <label className="field">Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" maxLength={20} autoComplete="off" /></label>
        <div className="field">Pick a buddy</div>
        <div className="avatar-grid">{AVATARS.map((a) => <button key={a} className={`avatar ${a === avatar ? "chosen" : ""}`} onClick={() => setAvatar(a)}>{a}</button>)}</div>
        <div className="field">Which games?</div>
        <div className="stage-pick">
          <button className={stage === "big" ? "chosen" : ""} onClick={() => setStage("big")}><span>🧮</span><b>Big kid</b><small>Math Adventure, Math Gym, Spelling lists</small></button>
          <button className={stage === "preschool" ? "chosen" : ""} onClick={() => setStage("preschool")}><span>🧸</span><b>Little learner</b><small>Ages 3–5: counting, shapes, ABC letters. All spoken, all taps.</small></button>
        </div>
        <label className="field">Secret code (optional, 4 digits)<input value={newPin} inputMode="numeric" pattern="[0-9]*" onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Leave blank for none" /></label>
        <button className="primary" disabled={!name.trim() || (newPin && newPin.length !== 4)} onClick={async () => { const p = await store.createProfile({ name: name.trim(), avatar, pin: newPin, stage }); onCreated(p); }}>Create player</button>
        {profiles.length > 0 && <button className="ghost" onClick={() => setAdding(false)}>Cancel</button>}
      </div>
    );
  }
  return (
    <div className="card center">
      <h1 className="title">Who's playing?</h1>
      <div className="profile-grid">
        {profiles.map((p) => (
          <button key={p.id} className="profile" onClick={() => (p.pinHash ? setPinFor(p) : onPick(p))}>
            <span className="big-emoji">{p.avatar}</span><span>{p.name}</span>{p.pinHash ? <span className="lock">🔒</span> : null}
          </button>
        ))}
        <button className="profile add" onClick={() => setAdding(true)}><span className="big-emoji">➕</span><span>New player</span></button>
      </div>
      <p className="fine">{mode === "server" ? "Progress syncs to all your devices." : mode === "server-offline" ? "Offline: progress will sync when you're back online." : "Progress is saved on this device."}</p>
    </div>
  );
}
