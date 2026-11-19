import { WORLDS } from "../engine/themes.js";
import { activeStudy } from "../engine/units.js";

export default function Home({ profile, state, onWorld, onStart, onParent, onLessons, onGym, onLab, onMissions, onSpell, onFocus, onSwitch, resume, onResume }) {
  const world = WORLDS.find((w) => w.id === state.worldId) || WORLDS[0];
  const got = state.stickers[world.id] || 0;
  const study = activeStudy(state);
  const when = study?.date ? new Date(study.date + "T12:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "";
  return (
    <div className="card">
      <div className="row between">
        <button className="ghost small" onClick={onSwitch}>{profile.avatar} {profile.name} ▾</button>
        <div className="pill">⭐ {state.stars}</div>
      </div>
      {onSpell ? <div className="subject-tabs"><button className="on">🧮 Math</button><button className="spell" onClick={onSpell}>🐝 Spelling</button>{onFocus && <button className="focus" onClick={onFocus}>🧠 Focus</button>}</div> : <h1 className="title">Math Adventure</h1>}
      <p className="sub">Pick your world</p>
      <div className="world-grid">
        {WORLDS.map((w) => (
          <button key={w.id} className={`world ${w.id === world.id ? "chosen" : ""}`} style={{ "--wa": w.accent }} onClick={() => onWorld(w.id)}>
            <span className="world-emoji">{w.emoji}</span><span>{w.label}</span>
            <span className="world-stickers">{w.stickers.slice(0, state.stickers[w.id] || 0).join("") || " "}</span>
          </button>
        ))}
      </div>
      <div className="sticker-bar">Stickers in {world.label}: {got}/{world.stickers.length}</div>
      {study && <div className="study-banner">🎒 Studying for: <b>{study.label || `${study.unitName} test`}</b>{when ? ` · ${when}` : ""}<div className="fine">{study.unitTitle}</div></div>}
      {resume && <button className="primary big" onClick={onResume}>Keep going: question {resume.qIndex + 1} of {resume.total} {world.emoji}</button>}
      <button className={resume ? "ghost big" : "primary big"} onClick={onStart}>{resume ? "Start a new adventure" : study ? `Start study adventure ${world.emoji}` : `Start adventure ${world.emoji}`}</button>
      <div className="row home-links"><button className="ghost lessons-link" onClick={onLessons}>📚 Lessons</button><button className="ghost lessons-link" onClick={onGym}>🏋️ Math Gym</button><button className="ghost lessons-link" onClick={onLab}>🧠 Thinking Lab</button>{onMissions && <button className="ghost lessons-link" onClick={onMissions}>🚀 Missions</button>}</div>
      <button className="ghost small parent-link" onClick={onParent}>👪 Grown-ups</button>
    </div>
  );
}
