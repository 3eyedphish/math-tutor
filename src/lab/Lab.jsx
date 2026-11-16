import { useCallback, useEffect, useRef, useState } from "react";
import { STATIONS, STATION, INTRO, labPlan, labState, labItem, labDue, retryItem, emptyResponse, ready, labCorrect, givenText, labAnswerText, miniFeedback, recordLab, finishLab } from "./engine.js";
import { SKILL } from "../engine/skills.js";
import { standardBoards } from "../engine/labskills.js";
import { MISTAKES } from "../engine/mistakes.js";
import * as store from "../engine/store.js";
import { Keypad, useHardwareKeys, showTyped, editTyped, Choices, MultiSelect, Blanks, Particles, speak } from "../ui/components.jsx";
import { LabVisual } from "./visuals.jsx";
import Help from "../screens/Help.jsx";
import { describeWork } from "../engine/picture.js";

const CHEERS = ["Clever thinking!", "You cracked it!", "Sharp!", "Brainy!", "Nice detective work!"];
const NOT_QUITE = ["Not quite!", "Good try!", "Almost!"];
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const REGION_BTNS = { 1: [["in", "Inside"], ["out", "Outside"]], 2: [["a", "🔴 Red only"], ["ab", "🟣 Both"], ["b", "🔵 Blue only"], ["out", "Outside"]] };

// The Thinking Lab: CSMP-style picture puzzles.
export default function Lab({ profile, state, world, persist, onClose }) {
  const [phase, setPhase] = useState("menu"); // menu | intro | rep | done
  const [kind, setKind] = useState("mix");
  const [idx, setIdx] = useState(0);
  const [item, setItem] = useState(null);
  const [resp, setResp] = useState("");
  const [activeBlank, setActiveBlank] = useState(0);
  const [sel, setSel] = useState(0); // the number being placed in the string game
  const [mode, setMode] = useState("add"); // minicomputer: add or remove checkers
  const [feedback, setFeedback] = useState(null);
  const [help, setHelp] = useState([]); // kinds of 🙋 Help used on this puzzle
  const [helpOpen, setHelpOpen] = useState(false);
  const [peek, setPeek] = useState(null); // "How it works" opened from Help, over the current puzzle
  const [intro, setIntro] = useState(null); // station whose intro is showing
  const [burst, setBurst] = useState(0);
  const queue = useRef([]);
  const sess = useRef(null);
  const t0 = useRef(0);
  const answered = useRef(false);
  const lab = labState(state);
  const shown = help.length > 0;

  const startItem = useCallback((it) => {
    setItem(it); setResp(emptyResponse(it)); setActiveBlank(0); setSel(0); setMode("add"); setFeedback(null); setHelp([]); setHelpOpen(false); setPeek(null);
    t0.current = Date.now(); answered.current = false;
    window.__mtCurrent = it; // lets automated tests read the current question
  }, []);
  const load = useCallback((i) => {
    const slot = queue.current[i];
    if (slot.retry) {
      const m = state.mistakes.find((x) => x.id === slot.retry && x.status === "open");
      if (m) return startItem(retryItem(state, m, world));
    }
    // First visit to a station: show how it works.
    if (!lab.intro[slot.station] && !slot.introDone) { slot.introDone = true; setIntro(slot.station); return setPhase("intro"); }
    startItem(labItem(state, slot.station, world));
  }, [state, world, startItem, lab]);

  const start = (k) => {
    const due = labDue(state).filter((m) => k === "mix" || STATION[k].skill === m.skill);
    queue.current = [...due.map((m) => ({ retry: m.id })), ...labPlan(k).map((station) => ({ station }))];
    sess.current = { kind: k, n: 0, clean: 0, stars: 0 };
    setKind(k); setIdx(0); setPhase("rep"); load(0);
  };
  const next = useCallback(() => {
    const n = idx + 1;
    if (n >= queue.current.length) {
      const s = sess.current;
      setFeedback(null);
      if (s.finished) return;
      s.finished = true;
      finishLab(state, { kind: s.kind, n: s.n, clean: s.clean });
      persist(state);
      return setPhase("done");
    }
    setIdx(n); load(n);
  }, [idx, load, state, persist]);

  const submit = () => {
    if (!item || feedback || answered.current || !ready(item, resp)) return;
    answered.current = true;
    const ok = labCorrect(item, resp);
    const ms = Date.now() - t0.current;
    const given = givenText(item, resp);
    const res = recordLab(state, item, { correct: ok, help, ms, given });
    const s = sess.current;
    s.n++;
    if (res.clean) { s.clean++; s.stars++; state.stars++; }
    if (!ok && res.mistake?.status === "open" && !item.reviewOf) queue.current.splice(Math.min(idx + 4, queue.current.length), 0, { retry: res.mistake.id });
    persist(state);
    store.logEvent(profile.id, { t: Date.now(), skill: item.skill, level: item.level, approach: "lab", correct: ok, firstTry: true, hint: shown, ms, q: item.text.slice(0, 300), given: String(given).slice(0, 200), answer: JSON.stringify(item.answer).slice(0, 200) });
    if (ok) {
      setBurst((b) => b + 1);
      setFeedback({ kind: "right", msg: `${item.reviewOf ? "🔁 Second chance: got it!" : shown ? "🙋 Got it with help!" : pickOne(CHEERS)}${res.clean ? "  +1 ⭐" : ""}` });
    } else {
      setFeedback({ kind: "reveal", msg: `${pickOne(NOT_QUITE)} ${item.answerType === "mini" ? miniFeedback(item, resp) : "Here's how it works."}`, mistake: res.mistake });
    }
  };
  // Right answers move on by themselves; misses wait for "Next".
  const nextRef = useRef(next);
  nextRef.current = next;
  useEffect(() => {
    if (feedback?.kind !== "right") return;
    const t = setTimeout(() => nextRef.current(), 1500);
    return () => clearTimeout(t);
  }, [feedback]);

  const typed = useRef("");
  typed.current = typeof resp === "string" ? resp : typed.current;
  const onKey = useCallback((k) => {
    if (!item || feedback || phase !== "rep" || answered.current) return;
    if (item.answerType === "number") { const v = editTyped(typed.current || "", k); typed.current = v; setResp(v); }
    if (item.answerType === "blanks") setResp((arr) => arr.map((v, i) => (i === activeBlank ? editTyped(v || "", k).slice(0, 7) : v)));
  }, [item, feedback, phase, activeBlank]);
  const onEnter = useCallback(() => { if (feedback) next(); else submit(); });
  useHardwareKeys(onKey, onEnter, phase === "rep" && !!item && !peek);
  // Any help she uses means this puzzle doesn't count as clean.
  const markHelp = (k) => setHelp((h) => [...h, k]);

  // String game: put the chosen number in a region, then move on to the next unplaced one.
  const place = (r) => {
    if (!item || item.answerType !== "sort" || feedback) return;
    const nextResp = resp.map((x, i) => (i === sel ? r : x));
    setResp(nextResp);
    const after = [...nextResp.keys()].find((i) => i > sel && !nextResp[i]) ?? nextResp.findIndex((x) => !x);
    if (after >= 0) setSel(after);
  };

  if (phase === "intro" && intro) {
    const it = INTRO[intro];
    const done = () => { lab.intro[intro] = true; persist(state); setIntro(null); if (sess.current && !sess.current.finished && queue.current[idx]) { setPhase("rep"); startItem(labItem(state, queue.current[idx].station, world)); } else setPhase("menu"); };
    return (
      <div className="card lab">
        <div className="big-emoji">{STATION[intro].emoji}</div>
        <h1 className="title">{it.title}</h1>
        <ol className="lab-intro">{it.lines.map((l, i) => <li key={i}>{l}</li>)}</ol>
        <LabVisual v={it.example} placed={it.example.placed} />
        <p className="sub center">{it.exampleNote}</p>
        <button className="primary big" onClick={done}>Got it! Let's try 🧠</button>
      </div>
    );
  }

  if (phase === "rep" && peek) {
    const it = INTRO[peek];
    return (
      <div className="card lab">
        <div className="big-emoji">{STATION[peek].emoji}</div>
        <h1 className="title">{it.title}</h1>
        <ol className="lab-intro">{it.lines.map((l, i) => <li key={i}>{l}</li>)}</ol>
        <LabVisual v={it.example} placed={it.example.placed} />
        <p className="sub center">{it.exampleNote}</p>
        <button className="primary big" onClick={() => setPeek(null)}>Back to my puzzle 🧠</button>
      </div>
    );
  }

  if (phase === "menu") {
    return (
      <div className="card lab">
        <div className="row between"><button className="ghost small" onClick={onClose}>← Home</button><div className="pill">⭐ {state.stars}</div></div>
        <h1 className="title">🧠 Thinking Lab</h1>
        <p className="sub">Picture puzzles for big thinkers: build numbers on the Minicomputer, follow arrow roads, and sort numbers with strings.</p>
        <button className="primary big" onClick={() => start("mix")}>Start today's lab 🧠</button>
        <p className="fine center">9 puzzles, 3 from each station.</p>
        <div className="gym-stations">
          {STATIONS.map((s) => (
            <div key={s.id} className="gym-station">
              <button className="lab-go" onClick={() => start(s.id)}>
                <span className="world-emoji">{s.emoji}</span><b>{s.title}</b>
                <span className="fine">{s.blurb}</span>
                <span className="badge">Level {state.skills[s.skill].level}/{SKILL[s.skill].maxLevel}</span>
              </button>
              <button className="ghost small" onClick={() => { setIntro(s.id); setPhase("intro"); sess.current = null; }}>How it works</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const s = sess.current;
    return (
      <div className="card center">
        <div className="big-emoji float">🧠</div>
        <h1 className="title">Lab complete!</h1>
        <div className="report-stats">
          <div><b>{s.clean}/{s.n}</b><span>right on your own</span></div>
          <div><b>⭐ {s.stars}</b><span>stars</span></div>
        </div>
        <button className="primary big" onClick={() => start(kind)}>Go again</button>
        <button className="ghost big" onClick={() => setPhase("menu")}>Back to the lab</button>
      </div>
    );
  }

  if (!item) return <div className="card center">Loading…</div>;
  const st = STATION[item.station];
  const done = !!feedback;
  const v = item.visual;
  const preds = v?.kind === "strings" ? v.preds : null;
  const sortPlaced = item.answerType === "sort" ? item.choices.map((c, i) => (resp[i] ? { n: Number(c), r: resp[i] } : null)).filter(Boolean) : null;
  const helpContext = `Thinking Lab, ${st.title} station. How it works: ${INTRO[item.station].lines.join(" ")}${item.reviewOf ? " She missed this one before; this is her second chance." : ""} ${describeWork(item, resp)}`.trim();
  const revealPlaced = item.answerType === "sort" && feedback?.kind === "reveal" ? item.choices.map((c, i) => ({ n: Number(c), r: item.answer[i], wrong: resp[i] !== item.answer[i] })) : null;
  return (
    <div className="game">
      <Particles trigger={burst} />
      <div className="topbar">
        <button className="ghost small" onClick={() => setPhase("menu")} aria-label="Stop">✕</button>
        <div className="path">{queue.current.map((_, i) => <span key={i} className={`stop ${i < idx ? "done" : i === idx ? "now" : ""}`} />)}</div>
        <div className="pill">⭐ {sess.current.stars}</div>
      </div>
      <div className="card question lab">
        <div className="badges">
          <span className="badge">{st.emoji} {st.title}</span>
          <span className="badge alt">Level {item.level}</span>
          {item.reviewOf && <span className="badge review">🔁 Second chance</span>}
          <button className="icon" onClick={() => speak(item.text)} aria-label="Read aloud">🔊</button>
        </div>
        <div className="qtext">{item.text}</div>

        {v && item.answerType === "mini" && (
          <>
            <LabVisual v={v} value={resp} mode={mode} onChange={done ? null : setResp} />
            {!done && <div className="row mini-tools">
              <button className={`chipbtn ${mode === "add" ? "on" : ""}`} onClick={() => setMode("add")}>➕ Add checkers</button>
              <button className={`chipbtn ${mode === "remove" ? "on" : ""}`} onClick={() => setMode("remove")}>➖ Take off</button>
              <button className="chipbtn" onClick={() => setResp(emptyResponse(item))}>Clear</button>
            </div>}
            {feedback?.kind === "reveal" && <><p className="fine center">One way to show it:</p><LabVisual v={{ kind: "mini", boards: standardBoards(Number(item.answer), v.boards.length) }} /></>}
          </>
        )}
        {v && item.answerType === "sort" && (
          <>
            <LabVisual v={v} placed={revealPlaced || sortPlaced} onRegion={done ? null : place} />
            {!done && <>
              <div className="sort-chips">{item.choices.map((c, i) => <button key={c} className={`sort-chip ${i === sel ? "on" : ""} ${resp[i] ? "placed" : ""}`} onClick={() => setSel(i)}>{c}</button>)}</div>
              <p className="fine center">Tap a number, then tap where it goes (on the picture or a button).</p>
              <div className="sort-regions">{REGION_BTNS[preds.length].map(([r, label]) => <button key={r} className="chipbtn" onClick={() => place(r)}>{label}</button>)}</div>
            </>}
          </>
        )}
        {v && item.answerType !== "mini" && item.answerType !== "sort" && <LabVisual v={v} />}

        <div className="answer-area">
          {item.answerType === "number" && <div className="typed">{showTyped(resp) || "?"}</div>}
          {item.answerType === "choice" && <Choices choices={item.choices} value={resp} onPick={setResp} disabled={done} />}
          {item.answerType === "multi" && <MultiSelect choices={item.choices} value={resp} disabled={done} onToggle={(c) => setResp(resp.includes(c) ? resp.filter((x) => x !== c) : [...resp, c])} />}
          {item.answerType === "blanks" && <Blanks template={item.template} values={resp} active={activeBlank} onFocus={setActiveBlank} />}
        </div>

        {helpOpen && !done && <Help key={`lab-${idx}`} part={item} world={world} profile={profile} context={helpContext} answerText={labAnswerText(item)} onUse={markHelp}
          onLesson={() => setPeek(item.station)} lessonLabel="Show me how it works" onClose={() => setHelpOpen(false)} />}
        {feedback && <div className={`feedback ${feedback.kind}`}>{feedback.msg}</div>}
        {feedback?.kind === "reveal" && (
          <div className="reveal">
            <div><b>Answer:</b> {labAnswerText(item)}</div>
            {feedback.mistake && MISTAKES[feedback.mistake.errorType]?.kid && <div className="watch">👀 {MISTAKES[feedback.mistake.errorType].kid}</div>}
            <ol>{(item.steps || []).map((x, i) => <li key={i}>{x}</li>)}</ol>
            {feedback.mistake?.status === "open" && !item.reviewOf && <div className="fine">🔁 This one comes back in a few puzzles.</div>}
          </div>
        )}
        <div className="controls">
          {!done && !helpOpen && <button className="help-main" onClick={() => setHelpOpen(true)}>🙋 Help</button>}
          {!done && <button className="primary" disabled={!ready(item, resp)} onClick={submit}>Check ✓</button>}
          {feedback?.kind === "reveal" && <button className="primary" onClick={next}>Next →</button>}
        </div>
        {(item.answerType === "number" || item.answerType === "blanks") && !done && <Keypad onKey={onKey} />}
      </div>
    </div>
  );
}
