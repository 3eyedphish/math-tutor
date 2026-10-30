import { useState } from "react";
import { SKILLS } from "../engine/skills.js";
import { makePickFact } from "../engine/learner.js";
import { lessonNeed, buildLesson, recordLesson } from "../engine/lessons.js";
import Lesson from "./Lesson.jsx";
import { activeStudy } from "../engine/units.js";

// Lessons she can pick herself. Skills her results say need a look are marked and listed first.
export default function Lessons({ state, world, persist, onClose }) {
  const [lesson, setLesson] = useState(null);
  const [n, setN] = useState(0);
  const study = activeStudy(state);
  const onTest = (id) => [...new Set(study?.lessonList.filter((l) => l.skills[id]).map((l) => l.code || l.unit || study.unitName) || [])];
  const skills = SKILLS.filter((s) => state.skills[s.id].focus !== "off" || onTest(s.id).length).map((s) => {
    const open = state.mistakes.filter((m) => m.skill === s.id && m.status === "open").length;
    const need = lessonNeed(state, s.id);
    const tip = need?.reason === "pattern" || need?.reason === "struggling" || open >= 2 ? "Try this one!" : need?.reason === "new" ? "New for you" : "";
    const test = onTest(s.id);
    return { ...s, open, tip, test, rank: (test.length ? 0 : 3) + (tip === "Try this one!" ? 0 : tip ? 1 : 2) };
  }).sort((a, b) => a.rank - b.rank);

  if (lesson) {
    return <Lesson key={n} lesson={lesson} world={world}
      onDone={(results, feel) => { recordLesson(state, lesson, results, feel); persist(state); setLesson(null); }}
      onSkip={() => setLesson(null)} />;
  }
  const start = (id) => {
    const need = lessonNeed(state, id);
    setN((x) => x + 1);
    setLesson(buildLesson(state, id, world, { pickFact: makePickFact(state) }, { reason: "chosen", errorType: need?.errorType }));
  };
  return (
    <div className="card">
      <div className="row between"><h2>📚 Lessons</h2><button className="ghost small" onClick={onClose}>Done</button></div>
      <p className="sub">Pick something to learn about. Each lesson is a quick example and two to try.</p>
      <div className="lesson-grid">
        {skills.map((s) => (
          <button key={s.id} className={`lesson-pick ${s.rank === 0 ? "rec" : ""}`} onClick={() => start(s.id)}>
            <span className="world-emoji">{s.emoji}</span>
            <span>{s.name}</span>
            {s.tip && <span className="lesson-tip">{s.tip}</span>}
            {s.test.length > 0 && <span className="lesson-unit">🎒 On your test: {s.test.join(", ")}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
