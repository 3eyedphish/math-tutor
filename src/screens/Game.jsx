import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nextItem, recordResult, recordMood, chooseSkill, makePickFact, dueReview, reviewItem } from "../engine/learner.js";
import { lessonNeed, buildLesson, recordLesson, MAX_LESSONS_PER_SESSION } from "../engine/lessons.js";
import { MISTAKES } from "../engine/mistakes.js";
import Lesson from "./Lesson.jsx";
import Help from "./Help.jsx";
import { APPROACH } from "../engine/approaches.js";
import { SKILL } from "../engine/skills.js";
import { isCorrect, answerText } from "../engine/check.js";
import { explainPrompt } from "../engine/ai.js";
import * as store from "../engine/store.js";
import { Keypad, useHardwareKeys, showTyped, editTyped, Column, ColumnEntry, columnEntryFits, DataTable, Visual, Choices, MultiSelect, Blanks, Tiles, Particles, speak } from "../ui/components.jsx";

const CHEERS = ["Awesome!", "You got it!", "Brilliant!", "Super smart!", "Nailed it!", "Wow, great thinking!", "Math star!", "Fantastic!"];
const NOT_QUITE = ["Not quite!", "Good try!", "Almost!"];
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const emptyResponse = (p) => (p.answerType === "multi" || p.answerType === "tiles" ? [] : p.answerType === "blanks" ? p.answer.map(() => "") : "");

export default function Game({ profile, state, world, persist, onDone, onQuit, resume }) {
  const run0 = resume && state.run ? state.run : null;
  const total = run0?.total || state.sessionLength;
  const [qIndex, setQIndex] = useState(0);
  const [item, setItem] = useState(null);
  const [partIdx, setPartIdx] = useState(0);
  const [resp, setResp] = useState("");
  const [activeBlank, setActiveBlank] = useState(0);
  const [tries, setTries] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpLesson, setHelpLesson] = useState(null);
  const [feedback, setFeedback] = useState(null); // {kind:'right'|'reveal'|'partRight'|'partReveal', msg}
  const [aiText, setAiText] = useState("");
  const [burst, setBurst] = useState(0);
  const [mood, setMood] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [toast, setToast] = useState("");
  const [lesson, setLesson] = useState(null);
  const colRef = useRef(null);
  const session = useRef({ stars: 0, correct: 0, levelUps: [], stickers: [], skills: [], approaches: [], partsOk: [], hintUsed: false, help: [], start: 0, lessons: 0, lessonsDone: [], miss: null, afterLesson: null, reviews: 0, fixed: 0 });

  const isBoss = qIndex === total - 1;
  const parts = item ? (item.answerType === "parts" ? item.parts : [item]) : [];
  const part = parts[partIdx];

  const startItem = useCallback((it) => {
    const s = session.current;
    s.skills.push(it.skill); s.approaches.push(it.approach);
    s.partsOk = []; s.hintUsed = false; s.help = []; s.start = Date.now(); s.miss = null;
    setItem(it); setPartIdx(0); setTries(0); setHelpOpen(false); setFeedback(null); setAiText("");
    const first = it.answerType === "parts" ? it.parts[0] : it;
    setResp(emptyResponse(first)); setActiveBlank(0);
    setTimeLeft(it.timer && state.timers ? it.timer : null);
  }, [state]);

  // What comes next: a missed question's second chance, a mini-lesson if her
  // results call for one, or a new question.
  const loadNext = useCallback((index) => {
    const s = session.current;
    const boss = index === total - 1;
    if (boss) return startItem(nextItem(state, world, s.skills, s.approaches, true));
    const due = dueReview(state, s.skills);
    if (due && Math.random() < 0.75) { s.reviews++; return startItem(reviewItem(state, due, world)); }
    const skill = chooseSkill(state, s.skills);
    const need = s.lessons < MAX_LESSONS_PER_SESSION ? lessonNeed(state, skill) : null;
    if (need) {
      s.lessons++; s.afterLesson = skill;
      setItem(null);
      return setLesson(buildLesson(state, skill, world, { pickFact: makePickFact(state) }, need));
    }
    startItem(nextItem(state, world, s.skills, s.approaches, false, skill));
  }, [state, world, total, startItem]);
  const finishLesson = (results, feel) => {
    const s = session.current;
    if (results) { recordLesson(state, lesson, results, feel); s.lessonsDone.push(lesson.skill); }
    else { state.skills[lesson.skill].lastLessonAt = state.counter; state.skills[lesson.skill].justDropped = false; }
    persist(state);
    setLesson(null);
    startItem(nextItem(state, world, s.skills, s.approaches, false, s.afterLesson));
  };

  // Pick up an adventure she left part-way, or start fresh.
  useEffect(() => {
    if (run0) {
      Object.assign(session.current, run0.session, { start: Date.now(), miss: null });
      setQIndex(run0.qIndex);
      if (run0.answered || !run0.item) { const n = run0.qIndex + 1; if (n >= total) return finish(); setQIndex(n); loadNext(n); }
      else { session.current.skills.pop(); session.current.approaches.pop(); startItem(run0.item); }
      return;
    }
    state.run = null;
    loadNext(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the adventure saved so leaving and coming back continues where she was.
  useEffect(() => {
    if (!item) return;
    const { miss, ...sess } = session.current;
    state.run = { qIndex, total, item: JSON.parse(JSON.stringify(item)), answered: false, session: JSON.parse(JSON.stringify(sess)), worldId: world.id, t: Date.now() };
    persist(state);
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps
  const finish = () => { state.run = null; persist(state); onDone(session.current); };

  // Friendly countdown for lightning rounds (running out just removes the bonus star).
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || feedback) return;
    const t = setTimeout(() => setTimeLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, feedback]);

  const finishItem = (allCorrect, skipped = false) => {
    const s = session.current;
    const firstTry = s.partsOk.every((x) => x.firstTry);
    const ms = Date.now() - s.start;
    const outcome = { correct: allCorrect, firstTry, hintUsed: s.hintUsed, help: [...new Set(s.help)], ms, given: skipped ? '"(skipped)"' : JSON.stringify(resp), givenRaw: resp, miss: skipped ? null : s.miss, skipped };
    const ev = recordResult(state, item, outcome);
    if (state.run) { state.run.answered = true; const { miss, ...sess } = s; state.run.session = JSON.parse(JSON.stringify(sess)); }
    let gained = 0;
    if (allCorrect && firstTry && !s.hintUsed) gained = isBoss ? 3 : 1 + (item.timer && timeLeft > 0 ? 1 : 0);
    else if (allCorrect) gained = isBoss ? 1 : 0;
    if (allCorrect) s.correct++;
    if (item.reviewOf && allCorrect && !s.hintUsed) s.fixed++;
    if (ev.levelUp) s.levelUps.push(item.skill);
    const before = Math.floor(s.stars / 5);
    s.stars += gained; state.stars += gained;
    if (Math.floor(s.stars / 5) > before && (state.stickers[world.id] || 0) < world.stickers.length) {
      state.stickers[world.id] = (state.stickers[world.id] || 0) + 1;
      const st = world.stickers[state.stickers[world.id] - 1];
      s.stickers.push(st);
      setToast(`New sticker! ${st}`); setTimeout(() => setToast(""), 2500);
    }
    persist(state);
    store.logEvent(profile.id, { t: Date.now(), skill: item.skill, level: item.level, approach: item.approach, correct: allCorrect, firstTry, hint: s.hintUsed, ms, q: item.text.slice(0, 300), given: outcome.given.slice(0, 200), answer: JSON.stringify(item.answer ?? item.parts?.map((p) => p.answer)).slice(0, 200) });
    if (ev.levelUp) { setToast(`${SKILL[item.skill].emoji} Level up in ${SKILL[item.skill].name}!`); setTimeout(() => setToast(""), 2500); }
    return { gained, ev };
  };

  const submit = () => {
    if (!part || feedback?.kind === "right" || feedback?.kind === "reveal") return;
    if (part.answerType === "number" && !resp) return;
    if (part.answerType === "choice" && !resp) return;
    const ok = isCorrect(part, resp);
    const s = session.current;
    if (ok) {
      s.partsOk[partIdx] = { firstTry: tries === 0 };
      setBurst((b) => b + 1);
      if (partIdx < parts.length - 1) { setFeedback({ kind: "partRight", msg: "✓ Right! On to the next step." }); return; }
      const allOk = s.partsOk.every((x) => x && !x.wrong);
      const { gained, ev } = finishItem(allOk);
      if (allOk) setFeedback({ kind: "right", msg: `${item.reviewOf ? "🔁 Second chance: nailed it! " : pickOne(CHEERS)}${gained ? `  +${gained} ⭐` : ""}` });
      else setFeedback({ kind: "right", msg: "You finished the last step! Nice persistence.", mistake: ev.mistake });
      if (Math.random() < 0.3) store.ai(`You are a playful math tutor for ${profile.name}, a gifted kid. One short sentence of celebration themed on ${world.label}. No markdown.`, `She solved: ${part.text.replace(/\n/g, " ")}`, 60).then((t) => t && setAiText(t));
    } else {
      // Her first answer counts. Show how it works, then move on; the question comes back later.
      s.partsOk[partIdx] = { firstTry: false, wrong: true };
      if (!s.miss) s.miss = { part, given: resp };
      setTries((t) => t + 1);
      if (partIdx < parts.length - 1) { setFeedback({ kind: "partReveal", msg: `${pickOne(NOT_QUITE)} Here's how this step works.` }); return; }
      const { ev } = finishItem(false);
      setFeedback({ kind: "reveal", msg: `${pickOne(NOT_QUITE)} Here's how it works.`, mistake: ev.mistake });
    }
  };
  // Skipping counts as a miss (it comes back later), without a lesson or level change.
  const skip = () => {
    if (!item || feedback?.kind === "right" || feedback?.kind === "reveal") return;
    finishItem(false, true);
    setToast("⏭ Skipped. It will come back later."); setTimeout(() => setToast(""), 2200);
    next();
  };
  const nextPart = () => {
    const np = parts[partIdx + 1];
    setPartIdx(partIdx + 1); setTries(0); setHelpOpen(false); setFeedback(null); setResp(emptyResponse(np)); setActiveBlank(0);
  };
  const next = () => {
    if (qIndex + 1 >= total) return finish();
    if ((qIndex + 1) % 6 === 0) return setMood(true);
    setQIndex(qIndex + 1); loadNext(qIndex + 1);
  };
  const answerMood = (m) => { recordMood(state, m); persist(state); setMood(false); setQIndex(qIndex + 1); loadNext(qIndex + 1); };

  const onKey = useCallback((k) => {
    if (!part || feedback) return;
    const edit = (v) => editTyped(v, k);
    if (part.answerType === "number" && columnEntryFits(part)) { colRef.current?.key(k); return; }
    if (part.answerType === "number") setResp((v) => edit(v || ""));
    if (part.answerType === "blanks") setResp((arr) => arr.map((v, i) => (i === activeBlank ? edit(v || "").slice(0, 7) : v)));
  }, [part, feedback, activeBlank]);
  const onEnter = useCallback(() => {
    if (feedback?.kind === "right" || feedback?.kind === "reveal") next();
    else if (feedback?.kind === "partRight" || feedback?.kind === "partReveal") nextPart();
    else submit();
  });
  useHardwareKeys(onKey, onEnter, !!part && !mood && !lesson && !helpLesson);

  // Any help she asks for marks this question as helped (no clean first-try credit).
  const markHelp = (kind) => { const s = session.current; s.hintUsed = true; s.help.push(kind); };
  const openHelpLesson = () => {
    setHelpLesson(buildLesson(state, item.skill, world, { pickFact: makePickFact(state) }, { reason: "help" }));
  };

  const explainAgain = async () => {
    setAiText("Thinking…");
    const p = explainPrompt(profile.name, world, part, JSON.stringify(resp), item.approach);
    const t = await store.ai(p.system, p.user, 220);
    setAiText(t || "Look at the steps above one at a time. Which step feels tricky? Ask a grown-up to do that step with you.");
  };

  const progress = useMemo(() => Array.from({ length: total }, (_, i) => i), [total]);
  if (mood) {
    return (
      <div className="card center">
        <h2>How is it going, {profile.name}?</h2>
        <div className="mood-row">
          <button className="mood" onClick={() => answerMood("happy")}>😄<span>Fun!</span></button>
          <button className="mood" onClick={() => answerMood("ok")}>🙂<span>Okay</span></button>
          <button className="mood" onClick={() => answerMood("meh")}>😕<span>Hard / boring</span></button>
        </div>
      </div>
    );
  }
  if (helpLesson) return <Lesson key={`help-${qIndex}`} lesson={helpLesson} world={world} onDone={(r, f) => { recordLesson(state, helpLesson, r, f); persist(state); setHelpLesson(null); }} onSkip={() => setHelpLesson(null)} />;
  if (lesson) return <Lesson key={`${qIndex}-${lesson.skill}`} lesson={lesson} world={world} onDone={finishLesson} onSkip={() => finishLesson(null)} />;
  if (!item || !part) return <div className="card center">Loading…</div>;
  window.__mtCurrent = part; // lets automated tests read the current question
  const ap = APPROACH[item.approach];
  const done = feedback && ["right", "reveal", "partRight", "partReveal"].includes(feedback.kind);
  const needsKeypad = part.answerType === "number" || part.answerType === "blanks";

  return (
    <div className="game">
      <Particles trigger={burst} big={isBoss && feedback?.kind === "right"} />
      {toast && <div className="toast">{toast}</div>}
      <div className="topbar">
        <button className="ghost small" onClick={onQuit} aria-label="Quit">✕</button>
        <div className="path">{progress.map((i) => <span key={i} className={`stop ${i < qIndex ? "done" : i === qIndex ? "now" : ""}`}>{i === total - 1 ? "👑" : ""}</span>)}</div>
        <div className="pill">⭐ {session.current.stars}</div>
      </div>
      <div className="card question">
        <div className="badges">
          <span className="badge">{SKILL[item.skill].emoji} {SKILL[item.skill].name}</span>
          <span className="badge alt">{ap.emoji} {ap.name}</span>
          {isBoss && <span className="badge boss">👑 Boss challenge</span>}
          {item.reviewOf && <span className="badge review">🔁 Second chance</span>}
          {timeLeft !== null && <span className={`badge timer ${timeLeft <= 3 ? "low" : ""}`}>⏱ {timeLeft > 0 ? timeLeft : "Take your time"}</span>}
          <button className="icon" onClick={() => speak(part.text)} aria-label="Read aloud">🔊</button>
        </div>
        {item.example && partIdx === 0 && (
          <div className="example"><div className="example-title">Watch how:</div><div className="qtext small">{item.example.text}</div><ol>{item.example.steps.map((s, i) => <li key={i}>{s}</li>)}</ol><div className="example-title">Your turn!</div></div>
        )}
        {item.table && <DataTable table={item.table} />}
        {parts.length > 1 && <div className="steps-bar">{parts.map((_, i) => <span key={i} className={i < partIdx ? "done" : i === partIdx ? "now" : ""}>{i + 1}</span>)}</div>}
        <div className="qtext">{part.text}</div>
        {part.column && part.answerType !== "choice" && !columnEntryFits(part) && <Column column={part.column} />}
        {item.showVisual && item.visual && <Visual v={item.visual} />}

        <div className="answer-area">
          {columnEntryFits(part) && <ColumnEntry key={`${qIndex}-${partIdx}-${tries}`} ref={colRef} column={part.column} disabled={done} onChange={setResp} />}
          {part.answerType === "number" && !columnEntryFits(part) && <div className="typed">{showTyped(resp) || "?"}</div>}
          {part.answerType === "choice" && <Choices choices={part.choices} value={resp} onPick={setResp} disabled={done} />}
          {part.answerType === "multi" && <MultiSelect choices={part.choices} shapes={part.shapes} value={resp} disabled={done} onToggle={(c) => setResp(resp.includes(c) ? resp.filter((x) => x !== c) : [...resp, c])} />}
          {part.answerType === "blanks" && <Blanks template={part.template} values={resp} active={activeBlank} onFocus={setActiveBlank} joiner={part.joiner} />}
          {part.answerType === "tiles" && <Tiles tiles={part.tiles} value={resp} disabled={done} onChange={setResp} />}
        </div>

        {helpOpen && !done && <Help key={`${qIndex}-${partIdx}`} part={part} world={world} profile={profile} onUse={markHelp} onLesson={openHelpLesson} onClose={() => setHelpOpen(false)} />}
        {feedback && <div className={`feedback ${feedback.kind}`}>{feedback.msg}</div>}
        {(feedback?.kind === "reveal" || feedback?.kind === "partReveal") && (
          <div className="reveal">
            <div><b>Answer:</b> {answerText(part)}</div>
            {feedback.mistake && MISTAKES[feedback.mistake.errorType]?.kid && <div className="watch">👀 {MISTAKES[feedback.mistake.errorType].kid}</div>}
            <ol>{(part.steps || []).map((s, i) => <li key={i}>{s}</li>)}</ol>
            {feedback.kind === "reveal" && feedback.mistake?.status === "open" && <div className="fine">🔁 This one will come back later for a second chance.</div>}
            <button className="ghost small" onClick={explainAgain}>🤔 Explain it another way</button>
          </div>
        )}
        {aiText && <div className="ai">{aiText}</div>}

        <div className="controls">
          {!done && !helpOpen && <button className="help-main" onClick={() => setHelpOpen(true)}>🙋 Help</button>}
          {!done && <button className="ghost skip" onClick={skip}>⏭ Skip</button>}
          {!done && <button className="primary" onClick={submit}>Check ✓</button>}
          {(feedback?.kind === "partRight" || feedback?.kind === "partReveal") && <button className="primary" onClick={nextPart}>Next step →</button>}
          {(feedback?.kind === "right" || feedback?.kind === "reveal") && <button className="primary" onClick={next}>{qIndex + 1 >= total ? "Finish 🏁" : "Next →"}</button>}
        </div>
        {needsKeypad && !done && <Keypad onKey={onKey} allowR={!!part.allowR} allowDot={!!part.allowDot} />}
      </div>
    </div>
  );
}
