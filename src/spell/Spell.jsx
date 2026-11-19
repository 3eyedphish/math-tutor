// Spelling practice: hear the word, type it. Learn (look-say-cover-write-check), Practice
// (missed words come back), and a Practice test like Friday's.
import { useEffect, useRef, useState } from "react";
import { activeList, check, record, practiceOrder, shuffle, requeue, listProgress, wordRec, sayText, ensureSpell } from "./engine.js";
import { Particles } from "../ui/components.jsx";

import { say, warm } from "./speech.js";
import { Sentences, MyStory, FillStory } from "./Writing.jsx";
export { say };
const sayWord = (x, slow) => say(slow ? `${x.w}.` : sayText(x), slow);

export default function Spell({ profile, state, persist, onClose }) {
  ensureSpell(state);
  const list = activeList(state);
  const [mode, setMode] = useState(null); // null | learn | practice | test
  const [only, setOnly] = useState(null);
  const [round, setRound] = useState(0);
  // Fetch the natural voice for this week's words ahead of time, so every 🔊 plays at once.
  useEffect(() => { if (list) warm(["Yes!", "You got it this time!", ...list.words.flatMap((x) => [`${x.w}.`, sayText(x), x.s])]); }, [list?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (m, words) => { setOnly(words || null); setRound((r) => r + 1); setMode(m); };
  if (!list || !list.words.length) return (
    <div className="card center"><h1 className="title">Spelling</h1><p className="sub">No words yet. A grown-up can add this week's list in 👪 Grown-ups → Spelling.</p><button className="primary big" onClick={onClose}>Back</button></div>
  );
  const words = only ? only.map((w) => list.words.find((x) => x.w === w)).filter(Boolean) : list.words;
  if (mode === "learn") return <Learn key={round} words={words} onDone={() => setMode(null)} />;
  if (mode === "practice") return <Practice key={round} state={state} list={list} words={words} persist={persist} onDone={() => setMode(null)} />;
  if (mode === "sentence") return <Sentences key={round} words={words} state={state} list={list} persist={persist} onDone={() => setMode(null)} />;
  if (mode === "story") return <MyStory key={round} state={state} list={list} profile={profile} persist={persist} onDone={() => setMode(null)} />;
  if (mode === "fill") return <FillStory key={round} state={state} list={list} persist={persist} onDone={() => setMode(null)} />;
  if (mode === "test") return <Test key={round} state={state} words={list.words} persist={persist} onDone={() => setMode(null)} onPractice={(missed) => go("practice", missed)} />;

  const prog = listProgress(state, list);
  const when = list.testDate ? new Date(list.testDate + "T12:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : "";
  return (
    <div className="card sp">
      <div className="row between"><button className="ghost small" onClick={onClose}>🧮 Math</button><div className="pill">⭐ {state.stars}</div></div>
      <h1 className="title">🐝 Spelling</h1>
      <p className="sub">{list.title}{when ? ` · test ${when}` : ""} · {list.words.length} words</p>
      <div className="sp-progress"><div style={{ width: `${(prog.known / prog.total) * 100}%` }} /></div>
      <p className="fine center">{prog.known} of {prog.total} words strong{prog.tried < prog.total ? ` · ${prog.total - prog.tried} not tried yet` : ""}</p>
      <div className="sp-modes">
        <button className="sp-mode" onClick={() => { say(sayText(list.words[0])); go("learn"); }}><span>📖</span><b>Learn the words</b><small>Look, say, cover, write, check</small></button>
        <button className="sp-mode" onClick={() => { const o = practiceOrder(state, list); say(sayText(o[0])); go("practice", o.map((x) => x.w)); }}><span>✏️</span><b>Practice</b><small>Hear it, spell it. Misses come back.</small></button>
        <button className="sp-mode" onClick={() => go("test")}><span>📝</span><b>Practice test</b><small>Just like Friday</small></button>
      </div>
      <p className="sp-group">Write with your words</p>
      <div className="sp-modes">
        <button className="sp-mode" onClick={() => { const o = practiceOrder(state, list); say(sayText(o[0])); go("sentence", o.map((x) => x.w)); }}><span>✍️</span><b>Write a sentence</b><small>Your own sentence for each word</small></button>
        <button className="sp-mode" onClick={() => go("fill")}><span>🧩</span><b>Fill in the story</b><small>Which word fits each blank?</small></button>
        <button className="sp-mode" onClick={() => go("story")}><span>📚</span><b>My story</b><small>Write a story with your words</small></button>
      </div>
      <WordChips state={state} list={list} />
    </div>
  );
}

function WordChips({ state, list }) {
  return (
    <div className="sp-chips">{list.words.map((x) => { const r = wordRec(state, x.w); return (
      <button key={x.w} className={`sp-chip b${Math.min(r.box, 3)} ${r.seen ? "" : "new"}`} onClick={() => sayWord(x)} title="Hear it">
        {r.seen ? x.w : "🔊 ?"}
      </button>); })}
    </div>
  );
}

// A text box that keeps iPad autocorrect and spell-check out of the way.
function SpellInput({ value, onChange, onEnter, disabled, inputRef }) {
  return <input ref={inputRef} className="sp-input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }}
    autoCorrect="off" autoCapitalize="none" autoComplete="off" spellCheck={false} inputMode="text" enterKeyHint="done" aria-label="Type the word" />;
}
function useFocus(dep) { const r = useRef(null); useEffect(() => { setTimeout(() => r.current?.focus(), 60); }, [dep]); return r; }

function Diff({ word, diff }) {
  return <div className="sp-diff">{(diff || word.split("").map((ch) => ({ ch, kind: "ok" }))).map((d, i) => <span key={i} className={`sp-${d.kind}`}>{d.ch}</span>)}</div>;
}
function AudioRow({ x }) {
  return (
    <div className="sp-audio">
      <button className="ghost" onClick={() => sayWord(x)}>🔊 Hear it</button>
      <button className="ghost" onClick={() => say(`${x.w}.`, true)}>🐢 Slow</button>
      {x.s && <button className="ghost" onClick={() => say(x.s)}>💬 Sentence</button>}
    </div>
  );
}
const Steps = ({ i, n }) => <div className="sp-steps">{Array.from({ length: n }, (_, k) => <span key={k} className={k < i ? "done" : k === i ? "now" : ""} />)}</div>;

// Look, say, cover, write, check.
function Learn({ words, onDone }) {
  const [i, setI] = useState(0);
  const [stage, setStage] = useState("look"); // look | write | right | wrong
  const [v, setV] = useState("");
  const [res, setRes] = useState(null);
  const ref = useFocus(`${i}${stage}`);
  const x = words[i];
  if (!x) return <div className="card center"><div className="big-emoji float">🌟</div><h1 className="title">You looked at every word!</h1><p className="sub">Next, try Practice. You will only hear the words.</p><button className="primary big" onClick={onDone}>Done</button></div>;
  const next = () => { setI(i + 1); setStage("look"); setV(""); setRes(null); if (words[i + 1]) sayWord(words[i + 1]); };
  const submit = () => { if (!v.trim()) return; const r = check(x.w, v); setRes(r); setStage(r.ok ? "right" : "wrong"); if (r.ok) say("Yes!"); };
  return (
    <div className="card sp">
      <div className="row between"><button className="ghost small" onClick={onDone}>✕</button><span className="fine">Word {i + 1} of {words.length}</span></div>
      <Steps i={i} n={words.length} />
      {stage === "look" && <>
        <p className="sp-kicker">👀 Look and say it</p>
        <div className="sp-word">{x.w}</div>
        {x.tip && <div className="sp-tip">💡 {x.tip}</div>}
        {x.s && <p className="sub center">“{x.s}”</p>}
        <AudioRow x={x} />
        <button className="primary big" onClick={() => setStage("write")}>🙈 Cover it, then write it</button>
      </>}
      {stage !== "look" && <>
        <p className="sp-kicker">✍️ Write it from memory</p>
        <AudioRow x={x} />
        <SpellInput inputRef={ref} value={v} onChange={setV} onEnter={stage === "write" ? submit : stage === "right" ? next : () => {}} disabled={stage === "right"} />
        {stage === "write" && <div className="controls"><button className="ghost" onClick={() => { setStage("look"); setV(""); }}>Peek again</button><button className="primary" onClick={submit}>Check ✓</button></div>}
        {stage === "right" && <><div className="feedback right">✅ Exactly right! {res?.capNote}</div><button className="primary big" onClick={next}>Next word →</button></>}
        {stage === "wrong" && <><div className="feedback retry">Almost! Here it is. The <span className="sp-miss-key">pink letters</span> are the tricky part.</div><Diff word={x.w} diff={res.diff} />
          <button className="primary big" onClick={() => { setStage("look"); setV(""); }}>Look again and try once more</button></>}
      </>}
    </div>
  );
}

// Practice: audio only. First try counts. A miss shows the word, she types it while looking, and it comes back later.
function Practice({ state, list, words, persist, onDone }) {
  const [queue, setQueue] = useState(() => words);
  const [stage, setStage] = useState("ask"); // ask | right | wrong | copy
  const [v, setV] = useState("");
  const [res, setRes] = useState(null);
  const [tally, setTally] = useState({ first: 0, firstRight: 0, missed: [] });
  const [burst, setBurst] = useState(0);
  const ref = useFocus(`${queue.length}${stage}`);
  const x = queue[0];
  if (!x) {
    const missed = [...new Set(tally.missed)];
    return (
      <div className="card center">
        <Particles trigger={1} big={missed.length === 0} />
        <div className="big-emoji float">{missed.length ? "🐝" : "🏆"}</div>
        <h1 className="title">{missed.length ? "Round done!" : "Perfect round!"}</h1>
        <p className="sub">{tally.firstRight} of {tally.first} right on the first try.</p>
        {missed.length > 0 && <><p className="fine">Keep practicing:</p><div className="sp-chips">{missed.map((w) => <span key={w} className="sp-chip b0">{w}</span>)}</div></>}
        <button className="primary big" onClick={onDone}>Done</button>
      </div>
    );
  }
  const advance = (q) => { setQueue(q); setStage("ask"); setV(""); setRes(null); if (q[0]) sayWord(q[0]); };
  const submit = () => {
    if (!v.trim()) return;
    const r = check(x.w, v); setRes(r);
    if (!x.again) {
      record(state, x.w, r.ok, r.typed, "practice");
      if (r.ok) state.stars = (state.stars || 0) + 1;
      persist(state);
      setTally((t) => ({ first: t.first + 1, firstRight: t.firstRight + (r.ok ? 1 : 0), missed: r.ok ? t.missed : [...t.missed, x.w] }));
    }
    if (r.ok) { setStage("right"); setBurst((b) => b + 1); say(x.again ? "You got it this time!" : "Yes!"); }
    else { setStage("wrong"); setTally((t) => ({ ...t, missed: [...t.missed, x.w] })); }
  };
  const doneCount = Math.max(0, words.length - queue.filter((q) => !q.again).length);
  return (
    <div className="card sp">
      <Particles trigger={burst} />
      <div className="row between"><button className="ghost small" onClick={onDone}>✕</button><span className="fine">{doneCount} of {words.length}{x.again ? " · 🔁 one to fix" : ""}</span></div>
      <Steps i={doneCount} n={words.length} />
      <p className="sp-kicker">{x.again ? "🔁 This one came back. Try it again!" : "👂 Listen, then spell it"}</p>
      <AudioRow x={x} />
      {stage !== "copy" && <SpellInput inputRef={ref} value={v} onChange={setV} onEnter={stage === "ask" ? submit : stage === "right" ? () => advance(queue.slice(1)) : () => {}} disabled={stage !== "ask"} />}
      {stage === "ask" && <button className="primary big" onClick={submit}>Check ✓</button>}
      {stage === "right" && <><div className="feedback right">✅ {x.w}! {res?.capNote}</div><button className="primary big" onClick={() => advance(queue.slice(1))}>Next →</button></>}
      {stage === "wrong" && <>
        <div className="feedback retry">Not quite. You wrote <b>{res.typed}</b>. Here is the word:</div>
        <Diff word={x.w} diff={res.diff} />
        {x.tip && <div className="sp-tip">💡 {x.tip}</div>}
        <button className="primary big" onClick={() => { setStage("copy"); setV(""); }}>Type it while you look</button>
      </>}
      {stage === "copy" && <Copy x={x} onDone={() => advance(requeue(queue.slice(1), x))} />}
    </div>
  );
}
function Copy({ x, onDone }) {
  const [v, setV] = useState("");
  const ref = useFocus(x.w);
  const ok = v.trim().toLowerCase() === x.w.toLowerCase();
  return (<>
    <div className="sp-word small">{x.w}</div>
    <SpellInput inputRef={ref} value={v} onChange={setV} onEnter={() => ok && onDone()} />
    <button className="primary big" disabled={!ok} onClick={onDone}>{ok ? "Got it. It will come back soon! →" : "Copy it exactly"}</button>
  </>);
}

// Practice test: every word once, in a new order, no feedback until the end.
function Test({ state, words, persist, onDone, onPractice }) {
  const [order] = useState(() => shuffle(words));
  const [i, setI] = useState(-1);
  const [v, setV] = useState("");
  const [answers, setAnswers] = useState([]);
  const ref = useFocus(i);
  if (i < 0) return (
    <div className="card center sp">
      <div className="big-emoji">📝</div><h1 className="title">Practice test</h1>
      <p className="sub">{words.length} words. You will hear each word, a sentence, and the word again. No hints until the end. You can press 🔊 to hear it again.</p>
      <div className="controls"><button className="ghost" onClick={onDone}>Back</button><button className="primary big" onClick={() => { setI(0); sayWord(order[0]); }}>Start the test</button></div>
    </div>
  );
  if (i >= order.length) {
    const right = answers.filter((a) => a.ok).length;
    const missed = answers.filter((a) => !a.ok).map((a) => a.w);
    return (
      <div className="card sp">
        <Particles trigger={1} big={right === order.length} />
        <h1 className="title center">{right} / {order.length}</h1>
        <p className="sub center">{right === order.length ? "Every word right! You are ready. 🏆" : right >= order.length * 0.8 ? "Great work! Fix the few below and you are ready." : "Good practice. Let's work on the ones below."}</p>
        <table className="ptable sp-results"><tbody>{answers.map((a) => (
          <tr key={a.w}><td>{a.ok ? "✅" : "❌"}</td><td><b>{a.w}</b></td><td>{a.ok ? (a.capNote ? "capital letter!" : "") : <s>{a.typed || "—"}</s>}</td></tr>))}</tbody></table>
        <div className="controls">
          <button className="ghost" onClick={onDone}>Done</button>
          {missed.length > 0 && <button className="primary" onClick={() => { const first = words.find((x) => x.w === missed[0]); say(sayText(first)); onPractice(missed); }}>Practice my {missed.length} missed</button>}
        </div>
      </div>
    );
  }
  const x = order[i];
  const submit = () => {
    const r = check(x.w, v);
    record(state, x.w, r.ok, r.typed, "test");
    if (r.ok) state.stars = (state.stars || 0) + 1;
    persist(state);
    setAnswers((a) => [...a, { w: x.w, ok: r.ok, typed: r.typed, capNote: r.capNote }]);
    setV(""); setI(i + 1);
    if (order[i + 1]) sayWord(order[i + 1]);
  };
  return (
    <div className="card sp">
      <div className="row between"><button className="ghost small" onClick={onDone}>✕</button><span className="fine">Word {i + 1} of {order.length}</span></div>
      <Steps i={i} n={order.length} />
      <p className="sp-kicker">👂 Number {i + 1}</p>
      <AudioRow x={x} />
      <SpellInput inputRef={ref} value={v} onChange={setV} onEnter={() => v.trim() && submit()} />
      <button className="primary big" disabled={!v.trim()} onClick={submit}>{i + 1 < order.length ? "Next word →" : "Finish test"}</button>
    </div>
  );
}
