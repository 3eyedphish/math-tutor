import { useCallback, useEffect, useRef, useState } from "react";
import { STATIONS, STATION, workoutPlan, gymItem, gymDue, retryItem, recordGym, finishGym, gymState, fluency, strongCount, FACT_COUNT, tableStrength, TABLES } from "./engine.js";
import { lessonNeed, buildLesson, recordLesson, LESSON_TEXT } from "../engine/lessons.js";
import { makePickFact, factKey } from "../engine/learner.js";
import { SKILL } from "../engine/skills.js";
import { isCorrect, answerText } from "../engine/check.js";
import { MISTAKES } from "../engine/mistakes.js";
import * as store from "../engine/store.js";
import Lesson from "../screens/Lesson.jsx";
import Help from "../screens/Help.jsx";
import { describePicture } from "../engine/picture.js";
import { Keypad, useHardwareKeys, showTyped, editTyped, Visual, Choices, MultiSelect, Blanks, Particles, speak } from "../ui/components.jsx";

const CHEERS = ["Strong!", "Nice rep!", "You got it!", "Boom!", "Smooth!", "Math muscles!"];
const NOT_QUITE = ["Not quite!", "Good try!", "Almost!"];
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const emptyResponse = (p) => (p.answerType === "multi" ? [] : p.answerType === "blanks" ? p.answer.map(() => "") : "");
const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;

// The Math Gym: quick workouts that make fact relationships automatic.
export default function Gym({ profile, state, world, persist, onClose }) {
  const [phase, setPhase] = useState("menu"); // menu | lesson | rep | done
  const [kind, setKind] = useState("workout");
  const [idx, setIdx] = useState(0);
  const [item, setItem] = useState(null);
  const [resp, setResp] = useState("");
  const [activeBlank, setActiveBlank] = useState(0);
  const [feedback, setFeedback] = useState(null); // { kind: 'right'|'reveal', msg, ms, mistake }
  const [help, setHelp] = useState([]); // kinds of 🙋 Help used on this rep
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpLesson, setHelpLesson] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [burst, setBurst] = useState(0);
  const [, bump] = useState(0);
  const queue = useRef([]);
  const sess = useRef(null);
  const t0 = useRef(0);
  const answered = useRef(false);
  const g = gymState(state);
  const shown = help.length > 0;

  const startItem = useCallback((it) => {
    setItem(it); setResp(emptyResponse(it)); setActiveBlank(0); setFeedback(null); setHelp([]); setHelpOpen(false);
    t0.current = Date.now(); answered.current = false;
    window.__mtCurrent = it; // lets automated tests read the current question
  }, []);
  // Build the rep for slot i (a second chance, or a new rep from the station), or a lesson first.
  const load = useCallback((i) => {
    const s = sess.current, slot = queue.current[i];
    if (slot.retry) {
      const m = state.mistakes.find((x) => x.id === slot.retry && x.status === "open");
      if (m) return startItem(retryItem(state, m, world));
    }
    const station = slot.station || "sprint";
    const skill = STATION[station]?.skill;
    if (skill && skill !== "facts" && s.lessons < 1 && lessonNeed(state, skill)?.reason === "new") {
      s.lessons++;
      setLesson(buildLesson(state, skill, world, { pickFact: makePickFact(state) }, { reason: "new" }));
      return setPhase("lesson");
    }
    const it = gymItem(state, station, world, s.keys);
    if (it.fact) s.keys.push(factKey(...it.fact));
    startItem(it);
  }, [state, world, startItem]);

  const start = (k) => {
    const due = gymDue(state).filter((m) => k === "workout" || STATION[k].skill === m.skill);
    queue.current = [...due.map((m) => ({ retry: m.id })), ...workoutPlan(k).map((station) => ({ station }))];
    sess.current = { kind: k, reps: 0, clean: 0, fast: 0, stars: 0, strong: [], keys: [], lessons: 0, times: [] };
    setKind(k); setIdx(0); setPhase("rep"); load(0);
  };
  const next = useCallback(() => {
    const n = idx + 1;
    if (n >= queue.current.length) {
      const s = sess.current;
      setFeedback(null);
      if (s.finished) return;
      s.finished = true;
      finishGym(state, { kind: s.kind, reps: s.reps, clean: s.clean, fast: s.fast });
      persist(state);
      return setPhase("done");
    }
    setIdx(n); load(n);
  }, [idx, load, state, persist]);

  const submit = (value = typeof resp === "string" ? typed.current : resp) => {
    if (!item || feedback || answered.current) return;
    if (item.answerType === "number" && !value) return;
    if (item.answerType === "blanks" && value.some((v) => !v)) return;
    answered.current = true;
    const ok = isCorrect(item, value);
    const ms = Date.now() - t0.current;
    const res = recordGym(state, item, { correct: ok, help, ms, given: value });
    const s = sess.current;
    s.reps++;
    if (res.clean) s.clean++;
    if (res.fast) s.fast++;
    if (res.clean && item.fact) s.times.push(ms);
    const sprint = item.station === "sprint" || item.station === "warm";
    const gained = res.clean && (!sprint || res.fast) ? 1 : 0;
    s.stars += gained; state.stars += gained;
    if (res.becameStrong) s.strong.push(`${item.fact[0]} × ${item.fact[1]} = ${item.fact[0] * item.fact[1]}`);
    // A miss comes back a few reps later in this workout (and again another day if needed).
    if (!ok && res.mistake?.status === "open" && !item.reviewOf) queue.current.splice(Math.min(idx + 4, queue.current.length), 0, { retry: res.mistake.id });
    persist(state);
    store.logEvent(profile.id, { t: Date.now(), skill: item.skill, level: item.level, approach: "gym", correct: ok, firstTry: true, hint: shown, ms, q: item.text.slice(0, 300), given: JSON.stringify(value).slice(0, 200), answer: JSON.stringify(item.answer).slice(0, 200) });
    if (ok) {
      setBurst((b) => b + 1);
      const msg = item.reviewOf ? "🔁 Second chance: got it!" : shown ? "🙋 Got it with help! It comes back so you can try it on your own." : res.fast ? "⚡ Lightning!" : pickOne(CHEERS);
      setFeedback({ kind: "right", msg: `${msg}${gained ? "  +1 ⭐" : ""}`, ms: item.fact ? ms : null, strong: res.becameStrong });
    } else {
      setFeedback({ kind: "reveal", msg: `${pickOne(NOT_QUITE)} Here's how it works.`, mistake: res.mistake });
    }
  };
  // Right answers move on by themselves so the reps keep flowing.
  const nextRef = useRef(next);
  nextRef.current = next;
  useEffect(() => {
    if (feedback?.kind !== "right") return;
    const t = setTimeout(() => nextRef.current(), feedback.strong ? 1600 : 1000);
    return () => clearTimeout(t);
  }, [feedback]);

  // What she has typed lives in a ref too, so fast taps that land before React re-renders
  // each add their digit instead of overwriting the last one.
  const typed = useRef("");
  typed.current = typeof resp === "string" ? resp : typed.current;
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const onKey = useCallback((k) => {
    if (!item || feedback || phase !== "rep" || answered.current) return;
    if (item.answerType === "number") {
      const v = editTyped(typed.current || "", k);
      typed.current = v;
      setResp(v);
      // Sprints check as soon as she has typed as many digits as the answer has.
      if (item.station === "sprint" && k !== "⌫" && v.length === String(item.answer).length) setTimeout(() => submitRef.current(v), 30);
    }
    if (item.answerType === "blanks") setResp((arr) => arr.map((v, i) => (i === activeBlank ? editTyped(v || "", k).slice(0, 7) : v)));
  }, [item, feedback, phase, activeBlank]); // eslint-disable-line react-hooks/exhaustive-deps
  const onEnter = useCallback(() => { if (feedback) next(); else submit(); });
  useHardwareKeys(onKey, onEnter, phase === "rep" && !!item && !helpLesson);

  // Any help she uses means this rep doesn't count as clean, fast, or toward a strong fact.
  const markHelp = (k) => setHelp((h) => [...h, k]);
  if (helpLesson) {
    const back = () => { setHelpLesson(null); t0.current = Date.now(); };
    return <Lesson key={`gym-help-${idx}`} lesson={helpLesson} world={world} onDone={(r, f) => { recordLesson(state, helpLesson, r, f); persist(state); back(); }} onSkip={back} />;
  }

  if (phase === "lesson" && lesson) {
    return <Lesson key={`gym-${idx}`} lesson={lesson} world={world}
      onDone={(r, f) => { recordLesson(state, lesson, r, f); persist(state); setLesson(null); setPhase("rep"); const it = gymItem(state, queue.current[idx].station, world, sess.current.keys); startItem(it); }}
      onSkip={() => { state.skills[lesson.skill].lastLessonAt = state.counter; persist(state); setLesson(null); setPhase("rep"); startItem(gymItem(state, queue.current[idx].station, world, sess.current.keys)); }} />;
  }

  if (phase === "menu") {
    const strong = strongCount(state);
    return (
      <div className="card gym">
        <div className="row between"><button className="ghost small" onClick={onClose}>← Home</button><div className="pill">⭐ {state.stars}</div></div>
        <h1 className="title">🏋️ Math Gym</h1>
        <p className="sub">Short workouts that make math facts automatic. Fast and right makes a fact strong. 💪</p>
        <div className="gym-strong"><b>{strong}</b> of {FACT_COUNT} facts are strong{g.focusTables.map((t) => <span key={t} className="gym-focus">{t}s: {tableStrength(state, t)}/11</span>)}</div>
        <MuscleMap state={state} />
        <button className="primary big" onClick={() => start("workout")}>Start today's workout 🏋️</button>
        <p className="fine center">About 5 minutes: a warm-up, fact sprints, and a bit of every station.</p>
        <div className="gym-stations">
          {STATIONS.map((s) => (
            <button key={s.id} className="gym-station" onClick={() => start(s.id)}>
              <span className="world-emoji">{s.emoji}</span><b>{s.title}</b>
              <span className="fine">{s.blurb}</span>
              {s.skill !== "facts" && <span className="badge">Level {state.skills[s.skill].level}/{SKILL[s.skill].maxLevel}</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const s = sess.current;
    const avg = s.times.length ? s.times.reduce((a, b) => a + b, 0) / s.times.length : null;
    return (
      <div className="card center">
        <div className="big-emoji float">🏆</div>
        <h1 className="title">Workout done!</h1>
        <div className="report-stats">
          <div><b>{s.clean}/{s.reps}</b><span>right on your own</span></div>
          <div><b>⚡ {s.fast}</b><span>lightning facts</span></div>
          <div><b>⭐ {s.stars}</b><span>stars</span></div>
        </div>
        {avg !== null && <p className="sub">Average fact time: {secs(avg)} (goal: under {secs(g.fastMs)})</p>}
        {s.strong.length > 0 && <div className="gym-newstrong"><b>New strong facts 💪</b><div>{s.strong.join(" · ")}</div></div>}
        <p className="sub">{strongCount(state)} of {FACT_COUNT} facts are strong now.</p>
        <button className="primary big" onClick={() => start(kind)}>Go again</button>
        <button className="ghost big" onClick={() => setPhase("menu")}>Back to the gym</button>
      </div>
    );
  }

  if (!item) return <div className="card center">Loading…</div>;
  const st = STATION[item.station] || STATION.sprint;
  const done = !!feedback;
  const sprint = item.station === "sprint";
  const showPic = item.visual && (item.showVisual || shown || helpOpen || feedback?.kind === "reveal");
  const helpContext = `Math Gym, ${st.title} station (${st.blurb})${item.fact ? " This is a times-table speed drill: help her build the fact from an easier fact she knows, not just count." : ""}${item.reviewOf ? " She missed this one before; this is her second chance." : ""}`;
  return (
    <div className="game">
      <Particles trigger={burst} big={!!feedback?.strong} />
      <div className="topbar">
        <button className="ghost small" onClick={() => setPhase("menu")} aria-label="Stop">✕</button>
        <div className="path">{queue.current.map((_, i) => <span key={i} className={`stop ${i < idx ? "done" : i === idx ? "now" : ""}`} />)}</div>
        <div className="pill">⭐ {sess.current.stars}</div>
      </div>
      <div className="card question">
        <div className="badges">
          <span className="badge">{st.emoji} {st.title}</span>
          {item.reviewOf && <span className="badge review">🔁 Second chance</span>}
          {item.fact && fluency(state, ...item.fact) === "strong" && <span className="badge">💪 Strong fact</span>}
          <button className="icon" onClick={() => speak(item.text)} aria-label="Read aloud">🔊</button>
        </div>
        {sprint && state.timers && !done && !shown && !helpOpen && <div className="speedbar" key={`sb-${idx}`}><span style={{ animationDuration: `${g.fastMs}ms` }} /></div>}
        <div className={`qtext ${sprint ? "gym-big" : ""}`}>{item.text}</div>
        {showPic && <Visual v={item.visual} />}

        <div className="answer-area">
          {item.answerType === "number" && <div className="typed">{showTyped(resp) || "?"}</div>}
          {item.answerType === "choice" && <Choices choices={item.choices} value={resp} onPick={setResp} disabled={done} />}
          {item.answerType === "multi" && <MultiSelect choices={item.choices} value={resp} disabled={done} onToggle={(c) => setResp(resp.includes(c) ? resp.filter((x) => x !== c) : [...resp, c])} />}
          {item.answerType === "blanks" && <Blanks template={item.template} values={resp} active={activeBlank} onFocus={setActiveBlank} />}
        </div>

        {helpOpen && !done && <Help key={`gym-${idx}`} part={item} world={world} profile={profile} context={helpContext} picture={describePicture(item.visual)} onUse={markHelp}
          onLesson={LESSON_TEXT[item.skill] ? () => setHelpLesson(buildLesson(state, item.skill, world, { pickFact: makePickFact(state) }, { reason: "help" })) : null} onClose={() => setHelpOpen(false)} />}
        {feedback && <div className={`feedback ${feedback.kind}`}>{feedback.msg}{feedback.ms ? <span className="gym-time"> {secs(feedback.ms)}</span> : null}{feedback.strong ? <div>💪 New strong fact!</div> : null}</div>}
        {feedback?.kind === "reveal" && (
          <div className="reveal">
            <div><b>Answer:</b> {answerText(item)}</div>
            {feedback.mistake && MISTAKES[feedback.mistake.errorType]?.kid && <div className="watch">👀 {MISTAKES[feedback.mistake.errorType].kid}</div>}
            <ol>{(item.steps || []).map((x, i) => <li key={i}>{x}</li>)}</ol>
            {feedback.mistake?.status === "open" && !item.reviewOf && <div className="fine">🔁 This one comes back in a few reps.</div>}
          </div>
        )}
        <div className="controls">
          {!done && !helpOpen && <button className="help-main" onClick={() => setHelpOpen(true)}>🙋 Help</button>}
          {!done && <button className="primary" onClick={() => submit()}>Check ✓</button>}
          {feedback?.kind === "reveal" && <button className="primary" onClick={next}>Next →</button>}
        </div>
        {(item.answerType === "number" || item.answerType === "blanks") && !done && <Keypad onKey={onKey} />}
      </div>
    </div>
  );
}

// Every fact from 2 × 2 to 12 × 12: strong, learning, or not tried yet. Focus tables are outlined.
export function MuscleMap({ state }) {
  const focus = gymState(state).focusTables;
  return (
    <table className="muscle" aria-label="Times tables: strong facts">
      <thead><tr><th>×</th>{TABLES.map((b) => <th key={b} className={focus.includes(b) ? "mm-focus" : ""}>{b}</th>)}</tr></thead>
      <tbody>{TABLES.map((a) => (
        <tr key={a}><th className={focus.includes(a) ? "mm-focus" : ""}>{a}</th>{TABLES.map((b) => {
          const f = fluency(state, a, b);
          return <td key={b} className={`mm-${f}${focus.includes(a) || focus.includes(b) ? " mm-f" : ""}`} title={`${a} × ${b} = ${a * b}`}>{f === "strong" ? "💪" : a * b}</td>;
        })}</tr>
      ))}</tbody>
    </table>
  );
}
