import { useCallback, useMemo, useRef, useState } from "react";
import { isCorrect, answerText } from "../engine/check.js";
import { LESSON_STYLE } from "../engine/lessons.js";
import { Keypad, useHardwareKeys, showTyped, editTyped, Column, ColumnEntry, columnEntryFits, DataTable, Visual, Choices, MultiSelect, Blanks, Tiles, Particles, speak } from "../ui/components.jsx";

const REASONS = {
  new: "Something new! Let's learn it together before you try.",
  pattern: "Let's look closely at a tricky spot.",
  struggling: "Let's slow down and look at how this works.",
  chosen: "Great choice! Let's learn.",
  help: "Let's learn how this works. Then you can go back to your question.",
};
const emptyResponse = (p) => (p.answerType === "multi" || p.answerType === "tiles" ? [] : p.answerType === "blanks" ? p.answer.map(() => "") : "");

// The order of cards depends on the lesson style.
function plan(style) {
  if (style === "tryFirst") return ["tryIntro", "practice0", "idea", "practice1", "wrap"];
  if (style === "trick") return ["trick", "exampleAll", "practice0", "practice1", "wrap"];
  return ["intro", "example", "practice0", "practice1", "wrap"];
}

export default function Lesson({ lesson, world, onDone, onSkip }) {
  const cards = useMemo(() => plan(lesson.style), [lesson.style]);
  const [i, setI] = useState(0);
  const [results, setResults] = useState([]);
  const [burst, setBurst] = useState(0);
  const card = cards[i];
  const next = () => setI((x) => Math.min(x + 1, cards.length - 1));
  const st = LESSON_STYLE[lesson.style];

  return (
    <div className="game">
      <Particles trigger={burst} />
      <div className="topbar">
        <button className="ghost small" onClick={onSkip} aria-label="Skip lesson">Skip</button>
        <div className="path">{cards.map((_, k) => <span key={k} className={`stop ${k < i ? "done" : k === i ? "now" : ""}`} />)}</div>
        <div className="pill">📚 Lesson</div>
      </div>
      <div className="card question lesson">
        <div className="badges">
          <span className="badge">{lesson.emoji} {lesson.title}</span>
          <span className="badge alt">{st.emoji} {st.name}</span>
        </div>

        {card === "intro" && (
          <div className="lesson-card">
            <div className="lesson-kicker">Mini-lesson</div>
            <h2 className="lesson-title">{lesson.emoji} {lesson.title}</h2>
            <p className="sub">{REASONS[lesson.reason] || REASONS.chosen}</p>
            <div className="idea">{lesson.idea}<button className="icon" onClick={() => speak(lesson.idea)} aria-label="Read aloud">🔊</button></div>
            {lesson.watchOut && <div className="watch">👀 {lesson.watchOut}</div>}
            <div className="controls"><button className="primary" onClick={next}>{lesson.style === "story" ? `Meet ${world.hero} ➜` : "Show me an example ➜"}</button></div>
          </div>
        )}
        {card === "trick" && (
          <div className="lesson-card">
            <div className="lesson-kicker">Big idea</div>
            <h2 className="lesson-title">{lesson.emoji} {lesson.title}</h2>
            <div className="trick">💡 {lesson.trick}<button className="icon" onClick={() => speak(lesson.trick)} aria-label="Read aloud">🔊</button></div>
            <p>{lesson.idea}</p>
            {lesson.watchOut && <div className="watch">👀 {lesson.watchOut}</div>}
            <div className="controls"><button className="primary" onClick={next}>See it work ➜</button></div>
          </div>
        )}
        {card === "tryIntro" && (
          <div className="lesson-card">
            <div className="lesson-kicker">Mini-lesson</div>
            <h2 className="lesson-title">{lesson.emoji} {lesson.title}</h2>
            <p className="sub">Give this one a try first. It's fine if it feels tricky: right after, you'll see exactly how it works.</p>
            <div className="controls"><button className="primary" onClick={next}>I'm ready ➜</button></div>
          </div>
        )}
        {card === "idea" && (
          <div className="lesson-card">
            <div className="lesson-kicker">Here's how it works</div>
            <div className="idea">{lesson.idea}<button className="icon" onClick={() => speak(lesson.idea)} aria-label="Read aloud">🔊</button></div>
            <div className="trick small">💡 {lesson.trick}</div>
            {lesson.watchOut && <div className="watch">👀 {lesson.watchOut}</div>}
            <div className="controls"><button className="primary" onClick={next}>Try another ➜</button></div>
          </div>
        )}
        {(card === "example" || card === "exampleAll") && <Example lesson={lesson} world={world} all={card === "exampleAll"} onNext={next} />}
        {(card === "practice0" || card === "practice1") && (
          <Practice
            key={card}
            item={lesson.practice[card === "practice0" ? 0 : 1]}
            label={`Your turn ${card === "practice0" ? 1 : 2} of 2`}
            showHint={!(lesson.style === "tryFirst" && card === "practice0")}
            onResult={(ok) => { setResults((r) => [...r, ok]); if (ok) setBurst((b) => b + 1); }}
            onNext={next}
          />
        )}
        {card === "wrap" && (
          <div className="lesson-card center">
            <div className="big-emoji">🌟</div>
            <h2 className="lesson-title">You learned it!</h2>
            <div className="trick">💡 {lesson.trick}</div>
            <p className="sub">Practice: {results.filter(Boolean).length} of {results.length} right. Did this lesson help?</p>
            <div className="mood-row">
              <button className="mood" onClick={() => onDone(results, "happy")}>😄<span>Yes!</span></button>
              <button className="mood" onClick={() => onDone(results, "ok")}>🙂<span>A bit</span></button>
              <button className="mood" onClick={() => onDone(results, "meh")}>😕<span>Not really</span></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// A worked example. Steps appear one at a time (or all at once for the trick style).
function Example({ lesson, world, all, onNext }) {
  const ex = lesson.example;
  const steps = ex.steps || [];
  const [shown, setShown] = useState(all ? steps.length : 0);
  const story = lesson.style === "story";
  const picture = lesson.style === "picture";
  const done = shown >= steps.length;
  return (
    <div className="lesson-card">
      <div className="lesson-kicker">{story ? `${world.hero} shows you how` : "Watch how"}</div>
      {ex.table && <DataTable table={ex.table} />}
      <div className="qtext">{ex.text}</div>
      {ex.column && <Column column={ex.column} />}
      {ex.visual && (picture || !ex.column) && <Visual v={ex.visual} />}
      <ol className="lesson-steps">
        {steps.slice(0, shown).map((s, k) => <li key={k} className="pop-in">{story ? <><b>{world.hero}:</b> {s}</> : s}</li>)}
      </ol>
      {done && <div className="answer-line">Answer: <b>{answerText(ex)}</b></div>}
      <div className="controls">
        {!done && <button className="primary" onClick={() => setShown((x) => x + 1)}>{shown === 0 ? "Show the first step" : "Next step"} ▸</button>}
        {done && <button className="primary" onClick={onNext}>Your turn ➜</button>}
      </div>
    </div>
  );
}

// A practice question inside a lesson: hint shown up front, one try, then the worked steps.
function Practice({ item, label, showHint, onResult, onNext }) {
  const [resp, setResp] = useState(emptyResponse(item));
  const [active, setActive] = useState(0);
  const [result, setResult] = useState(null);
  const colRef = useRef(null);
  const col = columnEntryFits(item);
  const onKey = useCallback((k) => {
    if (result !== null) return;
    if (col) { colRef.current?.key(k); return; }
    const edit = (v) => editTyped(v, k);
    if (item.answerType === "number") setResp((v) => edit(v || ""));
    if (item.answerType === "blanks") setResp((arr) => arr.map((v, j) => (j === active ? edit(v || "").slice(0, 7) : v)));
  }, [item, result, active, col]);
  const check = () => {
    if (result !== null) return onNext();
    if ((item.answerType === "number" || item.answerType === "choice") && !resp) return;
    const ok = isCorrect(item, resp);
    setResult(ok); onResult(ok);
  };
  useHardwareKeys(onKey, check, true);
  const done = result !== null;
  window.__mtLessonPractice = item; // lets automated tests read the practice question
  const needsKeypad = item.answerType === "number" || item.answerType === "blanks";
  return (
    <div className="lesson-card">
      <div className="lesson-kicker">{label}</div>
      {item.table && <DataTable table={item.table} />}
      <div className="qtext">{item.text}</div>
      {item.column && !col && <Column column={item.column} />}
      {item.visual && !item.column && <Visual v={item.visual} />}
      {showHint && !done && item.hint && <div className="hint">💡 {item.hint}</div>}
      <div className="answer-area">
        {col && <ColumnEntry ref={colRef} column={item.column} disabled={done} onChange={setResp} />}
        {item.answerType === "number" && !col && <div className="typed">{showTyped(resp) || "?"}</div>}
        {item.answerType === "choice" && <Choices choices={item.choices} value={resp} onPick={setResp} disabled={done} />}
        {item.answerType === "multi" && <MultiSelect choices={item.choices} shapes={item.shapes} value={resp} disabled={done} onToggle={(c) => setResp(resp.includes(c) ? resp.filter((x) => x !== c) : [...resp, c])} />}
        {item.answerType === "blanks" && <Blanks template={item.template} values={resp} active={active} onFocus={setActive} joiner={item.joiner} />}
        {item.answerType === "tiles" && <Tiles tiles={item.tiles} value={resp} disabled={done} onChange={setResp} />}
      </div>
      {done && <div className={`feedback ${result ? "right" : "reveal"}`}>{result ? "✓ Yes! You've got it." : "Not this time. Here's how it works:"}</div>}
      {done && (
        <div className="reveal">
          {!result && <div><b>Answer:</b> {answerText(item)}</div>}
          <ol>{(item.steps || []).map((s, k) => <li key={k}>{s}</li>)}</ol>
        </div>
      )}
      <div className="controls">
        {!done && <button className="primary" onClick={check}>Check ✓</button>}
        {done && <button className="primary" onClick={onNext}>Next ➜</button>}
      </div>
      {needsKeypad && !done && <Keypad onKey={onKey} allowR={!!item.allowR} allowDot={!!item.allowDot} />}
    </div>
  );
}
