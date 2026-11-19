import { useMemo, useState } from "react";
import { FocusPanel } from "../mission/oceangames.jsx";
import { SKILLS, SKILL } from "../engine/skills.js";
import { APPROACHES } from "../engine/approaches.js";
import { approachScores, mastery, factKey, freshState } from "../engine/learner.js";
import { MISTAKES } from "../engine/mistakes.js";
import { LESSON_STYLE, lessonScores } from "../engine/lessons.js";
import { UNITS, UNIT, INVENTORY, unitLessons, lessonReadiness } from "../engine/units.js";
import { setCoveredThrough, DEFAULT_COVERED } from "../engine/learner.js";
import { Keypad } from "../ui/components.jsx";
import * as store from "../engine/store.js";
import { gymState, strongCount, tableStrength, FACT_COUNT, TABLES } from "../gym/engine.js";
import { MuscleMap } from "../gym/Gym.jsx";
import SpellPanel from "../spell/SpellPanel.jsx";
import { AVATARS } from "./Profiles.jsx";

// A multiplication gate keeps kids out of the grown-up area.
function Gate({ onPass, onCancel }) {
  const [q] = useState(() => [13 + Math.floor(Math.random() * 37), 6 + Math.floor(Math.random() * 4)]);
  const [v, setV] = useState("");
  const [bad, setBad] = useState(false);
  return (
    <div className="card center">
      <h2>Grown-ups only</h2>
      <p className="sub">What is {q[0]} × {q[1]}?</p>
      <div className={`typed ${bad ? "shake" : ""}`}>{v || "?"}</div>
      <Keypad onKey={(k) => { setBad(false); setV((v) => (k === "⌫" ? v.slice(0, -1) : (v + k).slice(0, 4))); }} />
      <div className="controls">
        <button className="ghost" onClick={onCancel}>Back</button>
        <button className="primary" onClick={() => (Number(v) === q[0] * q[1] ? onPass() : (setBad(true), setV("")))}>Enter</button>
      </div>
    </div>
  );
}

const pct = (x) => `${Math.round(x * 100)}%`;

export default function Parent({ profile, state, persist, onClose, onProfileChanged, onProfileDeleted }) {
  const [ok, setOk] = useState(false);
  const [tab, setTab] = useState("study");
  const [, force] = useState(0);
  const [key, setKey] = useState(store.getLocalKey());
  const [pin, setPin] = useState("");
  const recent = state.history.slice(-60);
  const usage = useMemo(() => {
    const u = {};
    for (const h of recent) u[h.approach] = (u[h.approach] || 0) + 1;
    return u;
  }, [recent]);
  if (!ok) return <Gate onPass={() => setOk(true)} onCancel={onClose} />;

  const scores = approachScores(state, "__all__").sort((a, b) => b.mean - a.mean);
  const setFocus = (id, f) => { state.skills[id].focus = f; persist(state); force((x) => x + 1); };
  const skillAcc = (id) => { const h = state.history.filter((x) => x.skill === id && !x.review && !x.skipped).slice(-20); return h.length ? h.filter((x) => x.ok).length / h.length : null; };
  // Trend: the last 10 first-try answers compared with the 10 before them.
  const trend = (id) => {
    const h = state.history.filter((x) => x.skill === id && !x.review && !x.skipped);
    if (h.length < 12) return null;
    const rate = (a) => a.filter((x) => x.ok).length / a.length;
    const d = rate(h.slice(-10)) - rate(h.slice(-20, -10));
    return d > 0.1 ? "▲ better" : d < -0.1 ? "▼ slipping" : "● steady";
  };

  return (
    <div className="card wide">
      <div className="row between"><h2>{profile.avatar} {profile.name}: grown-up view</h2><button className="ghost small" onClick={onClose}>Done</button></div>
      <div className="tabs">{["study", "spelling", "progress", "misses", "styles", "facts", "focus", "settings"].map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{{ study: "Study mode", spelling: "Spelling", progress: "Skills", styles: "Teaching styles", misses: "Mistakes", facts: "Times tables", focus: "Focus skills", settings: "Settings" }[t]}</button>)}</div>

      {tab === "progress" && (
        <table className="ptable">
          <thead><tr><th>Skill</th><th>Level</th><th>Mastery</th><th>Last 20</th><th>Trend</th><th>Lessons</th><th>Practice</th></tr></thead>
          <tbody>{SKILLS.map((s) => { const k = state.skills[s.id], acc = skillAcc(s.id); return (
            <tr key={s.id}>
              <td>{s.emoji} {s.name}</td>
              <td>{k.level}/{s.maxLevel}</td>
              <td><div className="bar"><span style={{ width: pct(mastery(state, s.id)) }} /></div></td>
              <td>{acc === null ? "—" : pct(acc)}</td>
              <td className="fine">{trend(s.id) || "—"}</td>
              <td>{k.lessonCount || 0}</td>
              <td>{s.lab ? <span className="fine">🧠 Thinking Lab</span> : <select value={k.focus} onChange={(e) => setFocus(s.id, e.target.value)}><option value="normal">Normal</option><option value="focus">Extra</option><option value="off">Off</option></select>}</td>
            </tr>); })}</tbody>
        </table>
      )}
      {tab === "styles" && (
        <div>
          <p className="fine">The app tries different ways of teaching and keeps score. A style earns credit when she gets it right, and more credit when she gets the <i>next</i> question on that skill right (that's the learning that sticks). Her mood check-ins count too. Styles that work best show up more often, but every style still appears now and then.</p>
          <table className="ptable">
            <thead><tr><th>Style</th><th>How well it works</th><th>Evidence</th><th>Used (last 60)</th></tr></thead>
            <tbody>{scores.map((sc) => { const a = APPROACHES.find((x) => x.id === sc.id); return (
              <tr key={sc.id}><td title={a.desc}>{a.emoji} {a.name}<div className="fine">{a.desc}</div></td><td><div className="bar"><span style={{ width: pct(sc.mean) }} /></div>{pct(sc.mean)}</td><td>{sc.n < 3 ? "too early" : sc.n < 10 ? "some" : "strong"}</td><td>{usage[sc.id] || 0}</td></tr>); })}</tbody>
          </table>
          <p className="fine">Mood check-ins: {state.moods.slice(-10).map((m) => ({ happy: "😄", ok: "🙂", meh: "😕" }[m.mood])).join(" ") || "none yet"}</p>
          <LessonStyles state={state} />
        </div>
      )}
      {tab === "study" && <StudyPlan state={state} persist={(s) => { persist(s); force((x) => x + 1); }} />}
      {tab === "spelling" && <SpellPanel state={state} persist={(s) => { persist(s); force((x) => x + 1); }} />}
      {tab === "misses" && <Mistakes state={state} />}
      {tab === "focus" && <div className="ms-root ms-inline"><FocusPanel st={state} /></div>}
      {tab === "facts" && <><FactGrid facts={state.facts} /><GymPanel state={state} persist={(s) => { persist(s); force((x) => x + 1); }} /></>}
      {tab === "settings" && (
        <div className="settings">
          <label className="field">Questions per adventure
            <select value={state.sessionLength} onChange={(e) => { state.sessionLength = Number(e.target.value); persist(state); force((x) => x + 1); }}>{[8, 10, 15, 20, 25].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="field row"><input type="checkbox" checked={state.timers} onChange={(e) => { state.timers = e.target.checked; persist(state); force((x) => x + 1); }} /> Lightning-round timers</label>
          <div className="field">{profile.name}'s picture
            <div className="avatar-grid">{AVATARS.map((a) => <button key={a} className={`avatar ${a === profile.avatar ? "chosen" : ""}`} onClick={async () => onProfileChanged(await store.updateProfile(profile, { avatar: a }))}>{a}</button>)}</div></div>
          <label className="field">Change {profile.name}'s secret code (4 digits, blank = none)
            <div className="row"><input value={pin} inputMode="numeric" onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} /><button className="ghost small" disabled={pin.length !== 0 && pin.length !== 4} onClick={async () => { onProfileChanged(await store.updateProfile(profile, { pin })); setPin(""); }}>Save</button></div></label>
          {!store.isServer() && (
            <label className="field">Anthropic API key for AI hints (stays on this device)
              <div className="row"><input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" /><button className="ghost small" onClick={() => store.setLocalKey(key.trim())}>Save</button></div></label>
          )}
          {store.isServer() && <AiCheck />}
          <div className="danger">
            <button className="ghost small" onClick={() => { if (confirm(`Reset all of ${profile.name}'s progress?`)) { const f = freshState(); const keepLists = state.spell && { lists: state.spell.lists, activeId: state.spell.activeId, words: {}, log: [] }; Object.keys(state).forEach((k) => delete state[k]); Object.assign(state, f, { name: profile.name }); if (keepLists) state.spell = keepLists; persist(state); force((x) => x + 1); } }}>Reset progress</button>
            <button className="ghost small" onClick={async () => { if (confirm(`Delete the player ${profile.name}? This can't be undone.`)) { await store.deleteProfile(profile.id); onProfileDeleted(); } }}>Delete player</button>
          </div>
        </div>
      )}
    </div>
  );
}
function fmtGiven(s) { try { const v = JSON.parse(s); return Array.isArray(v) ? v.join(", ") : String(v).replace("r", " R "); } catch { return s; } }

function FactGrid({ facts }) {
  const n = Array.from({ length: 12 }, (_, i) => i + 1);
  return (
    <div>
      <p className="fine">Green = strong, red = needs practice, grey = not seen yet. Weak facts come up more often.</p>
      <table className="facts"><thead><tr><th>×</th>{n.map((b) => <th key={b}>{b}</th>)}</tr></thead>
        <tbody>{n.map((a) => <tr key={a}><th>{a}</th>{n.map((b) => { const w = facts[factKey(a, b)]; const m = w === undefined ? null : Math.max(0, Math.min(1, 1 - (w - 0.5) / 6)); return <td key={b} style={{ background: m === null ? "var(--line)" : `hsl(${m * 130},65%,55%)` }} title={`${a}×${b}=${a * b}`}>{a * b}</td>; })}</tr>)}</tbody>
      </table>
    </div>
  );
}

// Math Gym: speed goal, extra-practice tables, and how fast each table is.
function GymPanel({ state, persist }) {
  const g = gymState(state);
  const avgMs = (t) => { const v = TABLES.map((b) => g.facts[factKey(t, b)]?.last).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const toggle = (t) => { g.focusTables = g.focusTables.includes(t) ? g.focusTables.filter((x) => x !== t) : [...g.focusTables, t].sort((a, b) => a - b); persist(state); };
  return (
    <div className="gym-panel">
      <h3>🏋️ Math Gym</h3>
      <p className="fine">A fact turns strong 💪 when she answers it right, on her own, under the speed goal twice in a row. A slow right answer still counts as right, but the fact keeps coming up. Workouts so far: {g.sessions}. Strong facts: {strongCount(state)} of {FACT_COUNT}.</p>
      <MuscleMap state={state} />
      <label className="field">Speed goal per fact
        <select value={g.fastMs} onChange={(e) => { g.fastMs = Number(e.target.value); persist(state); }}>{[3000, 4000, 5000, 6000].map((ms) => <option key={ms} value={ms}>{ms / 1000} seconds</option>)}</select></label>
      <div className="field">Extra reps for these tables
        <div className="gym-tables">{TABLES.map((t) => <button key={t} className={`chipbtn ${g.focusTables.includes(t) ? "on" : ""}`} onClick={() => toggle(t)}>{t}s</button>)}</div></div>
      <table className="ptable">
        <thead><tr><th>Table</th><th>Strong</th><th>Last answer time (avg)</th></tr></thead>
        <tbody>{TABLES.map((t) => { const a = avgMs(t); return <tr key={t}><td>{t}s{g.focusTables.includes(t) ? " ⭐" : ""}</td><td>{tableStrength(state, t)}/11</td><td>{a === null ? "—" : `${(a / 1000).toFixed(1)} s`}</td></tr>; })}</tbody>
      </table>
      <p className="fine">Gym skills (Double &amp; Halve, Fact Links, Shape Lab) are on the Skills tab. They are Off for adventures by default and always on in the gym; set one to Normal to mix it into adventures too.</p>
    </div>
  );
}

const HELP_LABEL = { hint: "hint", step: "first step", anotherWay: "another way", asked: "asked a question", lesson: "mini-lesson" };
const STATUS = { open: "🔁 Coming back", fixed: "✅ Fixed on second chance", parked: "⏸ Parked (missed 3 times)" };
function Mistakes({ state }) {
  const all = state.mistakes || [];
  const count = (f) => all.filter(f).length;
  const reviewed = all.filter((m) => m.status === "fixed" || m.misses > 1);
  const bySkill = SKILLS.map((s) => {
    const ms = all.filter((m) => m.skill === s.id);
    const types = {};
    for (const m of ms) if (m.errorType !== "other") types[m.errorType] = (types[m.errorType] || 0) + 1;
    const top = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
    return { s, n: ms.length, open: ms.filter((m) => m.status === "open").length, fixed: ms.filter((m) => m.status === "fixed").length, top };
  }).filter((r) => r.n);
  const recent = all.slice(-30).reverse();
  return (
    <div>
      <p className="fine">Her first answer is the one that counts. A question she gets right only after using 🙋 Help is saved too, so she can try it on her own later. Every miss is saved with what she answered and what kind of mistake it looks like. Each miss comes back a few questions later (the same question first, then a fresh one like it). After 3 misses it's parked and a lesson takes over.</p>
      <div className="report-stats">
        <div><b>{count((m) => m.errorType !== "neededHelp" && m.errorType !== "skipped")}</b><span>misses saved</span></div>
        <div><b>{count((m) => m.errorType === "skipped")}</b><span>skipped</span></div>
        <div><b>{count((m) => m.errorType === "neededHelp")}</b><span>right with help</span></div>
        <div><b>{count((m) => m.status === "open")}</b><span>coming back</span></div>
        <div><b>{count((m) => m.status === "fixed")}</b><span>fixed later</span></div>
        <div><b>{reviewed.length ? pct(count((m) => m.status === "fixed") / reviewed.length) : "—"}</b><span>second-chance success</span></div>
      </div>
      {bySkill.length > 0 && (
        <table className="ptable">
          <thead><tr><th>Skill</th><th>Misses</th><th>Coming back</th><th>Fixed</th><th>Most common mistake</th></tr></thead>
          <tbody>{bySkill.map((r) => <tr key={r.s.id}><td>{r.s.emoji} {r.s.name}</td><td>{r.n}</td><td>{r.open}</td><td>{r.fixed}</td><td>{r.top ? `${MISTAKES[r.top[0]]?.label} (${r.top[1]})` : "—"}</td></tr>)}</tbody>
        </table>
      )}
      <h3>Recent misses</h3>
      <div className="misses">{recent.length ? recent.map((m) => (
        <div key={m.id} className="miss">
          <div className="fine">{new Date(m.t).toLocaleDateString()} · {SKILL[m.skill]?.emoji} {SKILL[m.skill]?.name} L{m.level} · {APPROACHES.find((a) => a.id === m.approach)?.name || m.approach} · {STATUS[m.status]}</div>
          <div className="qtext small">{m.q}</div>
          <div>Her answer: <b>{fmtGiven(m.given)}</b> · Correct: <b>{fmtGiven(m.answer)}</b>{m.lastGiven && m.status !== "fixed" ? <> · Second try: <b>{fmtGiven(m.lastGiven)}</b></> : null}</div>
          {m.errorType !== "other" && <div className="fine">Looks like: {MISTAKES[m.errorType]?.label}</div>}
          {m.help && <div className="fine">Help she used: {m.help.map((h) => HELP_LABEL[h] || h).join(", ")}</div>}
        </div>
      )) : <p>No misses yet.</p>}</div>
    </div>
  );
}

const REASON = { new: "new skill", pattern: "repeated mistake", struggling: "slump", chosen: "she picked it", help: "she asked for help" };
function LessonStyles({ state }) {
  const scores = lessonScores(state).sort((a, b) => b.mean - a.mean);
  const log = (state.lessonLog || []).slice(-12).reverse();
  return (
    <div>
      <h3>Lesson styles</h3>
      <p className="fine">Mini-lessons appear when a skill is new, when she slips on a skill, or when the same kind of mistake repeats (at most 2 per adventure). The app tries five lesson styles and judges each mainly by how she does on her next 3 questions of that skill.</p>
      <table className="ptable">
        <thead><tr><th>Lesson style</th><th>How well it works</th><th>Evidence</th></tr></thead>
        <tbody>{scores.map((sc) => { const ls = LESSON_STYLE[sc.id]; return <tr key={sc.id}><td>{ls.emoji} {ls.name}<div className="fine">{ls.desc}</div></td><td><div className="bar"><span style={{ width: pct(sc.mean) }} /></div>{pct(sc.mean)}</td><td>{sc.n < 1.5 ? "too early" : sc.n < 5 ? "some" : "strong"}</td></tr>; })}</tbody>
      </table>
      {log.length > 0 && (
        <table className="ptable">
          <thead><tr><th>When</th><th>Lesson</th><th>Why</th><th>Practice</th><th>Next 3</th><th>Felt</th></tr></thead>
          <tbody>{log.map((e) => <tr key={e.id}><td>{new Date(e.t).toLocaleDateString()}</td><td>{SKILL[e.skill]?.emoji} {LESSON_STYLE[e.style]?.name}</td><td>{REASON[e.reason] || e.reason}{e.errorType ? `: ${MISTAKES[e.errorType]?.label}` : ""}</td><td>{e.practice}</td><td>{e.after || "pending"}</td><td>{{ happy: "😄", ok: "🙂", meh: "😕" }[e.feel] || "—"}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

// Study mode: practice only the lessons on an upcoming test.
function StudyPlan({ state, persist }) {
  const st = state.study || { on: false, unit: "u2", lessons: [], label: "", date: "" };
  const covered = state.coveredThrough ?? DEFAULT_COVERED;
  const through = st.through ?? covered;
  const unit = UNIT[st.unit] || UNITS[1];
  const lessons = unitLessons(unit.id, through);
  const chosen = st.lessons?.length ? st.lessons : lessons.map((l) => l.id);
  const save = (patch) => { state.study = { ...st, ...patch }; persist(state); };
  const toggle = (id) => { const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]; save({ lessons: next.length === lessons.length ? [] : next }); };
  const setCovered = (n) => { setCoveredThrough(state, n); persist(state); };
  const later = SKILLS.filter((s) => s.topic > covered);
  return (
    <div className="settings">
      <label className="field">Her class has finished through
        <select value={covered} onChange={(e) => setCovered(Number(e.target.value))}>{UNITS.map((u) => <option key={u.id} value={u.topic}>{u.name}: {u.title}</option>)}</select></label>
      <p className="fine">Everyday adventures use skills from these units plus last year's review. {later.length ? `Skills from later units stay off until you move this forward: ${later.map((s) => s.name).join(", ")}.` : "Every unit is on."} You can still turn single skills on or off in the Skills tab.</p>
      <hr />
      <p className="fine">Before a test, pick the unit and lessons it covers. While study mode is on, every adventure, second chance and suggested lesson comes only from those lessons, at the difficulty the worksheets use. For the beginning- or end-of-year inventory exam, pick <b>Inventory</b>: it mixes last year's review with every unit through the one you choose.</p>
      <label className="field row"><input type="checkbox" checked={!!st.on} onChange={(e) => save({ on: e.target.checked })} /> <b>Study mode is {st.on ? "ON" : "off"}</b></label>
      <label className="field">Unit
        <select value={unit.id} onChange={(e) => save({ unit: e.target.value, lessons: [] })}>
          <option value={INVENTORY.id}>📋 Inventory exam: a mix of everything so far</option>
          {UNITS.map((u) => <option key={u.id} value={u.id}>{u.name}: {u.title}{u.topic > covered ? " (not reached yet)" : ""}</option>)}
        </select></label>
      {unit.id === INVENTORY.id && <label className="field">Include units through
        <select value={through} onChange={(e) => save({ through: Number(e.target.value), lessons: [] })}>{UNITS.map((u) => <option key={u.id} value={u.topic}>{u.name}: {u.title}</option>)}</select></label>}
      <label className="field">What's coming up (shown to her)
        <input value={st.label || ""} placeholder={`${unit.name} test`} maxLength={40} onChange={(e) => save({ label: e.target.value })} /></label>
      <label className="field">Test date (optional)
        <input type="date" value={st.date || ""} onChange={(e) => save({ date: e.target.value })} /></label>
      <table className="ptable">
        <thead><tr><th></th><th>Lesson</th><th>Practises</th><th>Last 10</th><th>Readiness</th></tr></thead>
        <tbody>{lessons.map((l) => { const r = lessonReadiness(state, l); return (
          <tr key={l.id}>
            <td><input type="checkbox" checked={chosen.includes(l.id)} onChange={() => toggle(l.id)} aria-label={`Include ${l.name}`} /></td>
            <td>{l.code && <b>{l.code} </b>}{l.unit && unit.id === INVENTORY.id ? <span className="fine">{l.unit}: </span> : null}{l.name}</td>
            <td className="fine">{Object.keys(l.skills).map((k) => `${SKILL[k].emoji} ${SKILL[k].name}`).join(", ")}</td>
            <td>{r.acc === null ? "—" : pct(r.acc)}</td>
            <td className="fine">{r.label}</td>
          </tr>); })}</tbody>
      </table>
    </div>
  );
}

function AiCheck() {
  const [r, setR] = useState(null);
  const check = async () => { setR({ busy: true }); setR(await store.aiStatus()); };
  const msg = !r ? "" : r.busy ? "Checking…" : r.ok ? "✅ The Claude key works. Help answers and voice questions are on." : r.hasKey === false ? "⚠️ No Claude key found. Add ANTHROPIC_API_KEY as a secret on the mathtutor Worker in Cloudflare." : `⚠️ The key is set but Claude said no (code ${r.status}). Check the key in the Claude Console, then paste it again as the ANTHROPIC_API_KEY secret.`;
  return (
    <div className="field">
      <p className="fine">AI help uses the key stored in Cloudflare. Nothing is stored on this device.</p>
      <button className="ghost small" onClick={check}>Check the AI helper</button> <span className="fine">{msg}</span>
    </div>
  );
}
