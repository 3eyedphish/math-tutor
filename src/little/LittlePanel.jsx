// Grown-ups → Little learner: progress by unit and lesson, tips for home, unlock everything.
import { SUBJECTS, ensureLittle, unitProgress, lessonRec } from "./engine.js";

export default function LittlePanel({ state, persist }) {
  const lt = ensureLittle(state);
  const recent = lt.log.slice(-12).reverse();
  const when = (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <div className="lt-panel">
      <p className="fine">Lessons are 5 short questions, all read aloud and answered by tapping. Stars come from first tries (3 = all or all but one). The next lesson opens when the one before it is finished, and each unit's first lesson opens when the unit before it is started, so he can hop between counting, shapes and letters.</p>
      <label className="field row"><input type="checkbox" checked={!!lt.unlockAll} onChange={(e) => { lt.unlockAll = e.target.checked; persist(state); }} /> Open every lesson (skip the unlocking)</label>
      {[["math", "🧮 Math"], ["abc", "🐝 Spelling: ABC letters"]].map(([s, label]) => (
        <div key={s}>
          <h3>{label}</h3>
          {SUBJECTS[s].map((u) => { const p = unitProgress(state, s, u); return (
            <div key={u.id} className="lt-punit" style={{ "--uc": u.color }}>
              <div className="row between"><b>{u.title}</b><span className="fine">{p.done}/{p.total} lessons · ⭐ {p.stars}/{p.max}</span></div>
              <div className="lt-plessons">{u.lessons.map((l) => { const r = lessonRec(state, s, l.id); return <span key={l.id} className={r.plays ? "on" : ""}>{l.emoji} {l.title} {r.plays ? `${"★".repeat(r.stars)}${"☆".repeat(3 - r.stars)} ×${r.plays}` : ""}</span>; })}</div>
              <div className="fine">💡 {u.tip}</div>
            </div>); })}
        </div>
      ))}
      <h3>Recent lessons</h3>
      {recent.length ? <table className="ptable"><tbody>{recent.map((r, k) => { const l = SUBJECTS[r.subject].flatMap((u) => u.lessons).find((x) => x.id === r.id); return <tr key={k}><td>{when(r.t)}</td><td>{l ? `${l.emoji} ${l.title}` : r.id}</td><td>{r.firstTry}/{r.total} first try</td><td>{"★".repeat(r.stars)}</td></tr>; })}</tbody></table> : <p className="fine">No lessons played yet.</p>}
    </div>
  );
}
