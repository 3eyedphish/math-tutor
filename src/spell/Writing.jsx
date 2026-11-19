// Writing with the spelling words: a sentence for each word, her own story, and a fill-in-the-blank story.
import { useEffect, useMemo, useRef, useState } from "react";
import { check, record, practiceOrder, findWords, sentenceTips, parseStory, storyFits, sentenceStory, STORY_PROMPT, ensureSpell, sayText } from "./engine.js";
import { say, sayLong, warm } from "./speech.js";
import { Particles } from "../ui/components.jsx";
import * as store from "../engine/store.js";

const KID = "You are a warm, encouraging writing coach for Stella, a gifted 7-year-old. Use short, simple sentences. Never rewrite her work for her and never spell a list word for her. Plain text, no lists, no emoji.";
const ask = (system, user, n = 160) => store.ai(system, user, n).then((t) => (t || "").trim()).catch(() => "");
const noAuto = { autoCorrect: "off", autoCapitalize: "sentences", autoComplete: "off", spellCheck: false };
const save = (state, key, item, max = 30) => { const sp = ensureSpell(state); sp[key] = [...(sp[key] || []), item].slice(-max); };

function WordStatus({ list, used, onHear }) {
  return (
    <div className="sp-chips">{list.words.map((x) => (
      <button key={x.w} className={`sp-chip ${used.includes(x.w) ? "b3" : "new"}`} onClick={() => onHear(x)} title="Hear it">
        {used.includes(x.w) ? `✓ ${x.w}` : "🔊 ?"}
      </button>))}
    </div>
  );
}
function NearMiss({ near }) {
  if (!near.length) return null;
  return <div className="sp-tip">🔍 Check the spelling of: {near.map((n, i) => <b key={i} className="sp-flag">{n.typed}</b>)}<div className="fine">Tap the 🔊 words to hear them again.</div></div>;
}

// ✍️ One sentence for each word. She hears the word, writes a sentence with it.
export function Sentences({ words, state, list, persist, onDone }) {
  const [order] = useState(() => words || practiceOrder(state, list));
  const [i, setI] = useState(0);
  const [v, setV] = useState("");
  const [stage, setStage] = useState("write"); // write | fix | done
  const [fb, setFb] = useState("");
  const [tries, setTries] = useState(0);
  const [burst, setBurst] = useState(0);
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 60); }, [i]);
  const x = order[i];
  if (!x) return (
    <div className="card center"><Particles trigger={1} big /><div className="big-emoji float">✍️</div><h1 className="title">{count} great sentences!</h1>
      <p className="sub">Grown-ups can read them in 👪 Grown-ups → Spelling.</p><button className="primary big" onClick={onDone}>Done</button></div>
  );
  const found = findWords(v, { words: [x] });
  const submit = async () => {
    if (!v.trim()) return;
    const ok = found.used.includes(x.w);
    if (tries === 0) { record(state, x.w, ok, ok ? x.w : (found.near[0]?.typed || ""), "sentence"); persist(state); }
    setTries((t) => t + 1);
    if (!ok) { setStage("fix"); setFb(found.near.length ? `Almost! Check how you spelled “${found.near[0].typed}”. Listen again.` : `I don't see the word yet. Listen again and put it in your sentence.`); say(`${x.w}.`, true); return; }
    setStage("done"); setBurst((b) => b + 1); state.stars = (state.stars || 0) + 1;
    save(state, "sentences", { t: Date.now(), w: x.w, text: v.trim() }, 60); persist(state); setCount((c) => c + 1);
    const tips = sentenceTips(v);
    setFb(tips.length ? `You spelled ${x.w} right! One tip: ${tips[0]}` : `You spelled ${x.w} right!`);
    const t = await ask(KID, `Her spelling word is "${x.w}". Her sentence: "${v.trim()}". In one or two short sentences, praise something specific, and say whether it shows what ${x.w} means. If it doesn't, give a small idea to make the meaning clearer.`);
    if (t) setFb((f) => `${f} ${t}`);
  };
  const next = () => { setI(i + 1); setV(""); setStage("write"); setFb(""); setTries(0); if (order[i + 1]) say(sayText(order[i + 1])); };
  return (
    <div className="card sp">
      <Particles trigger={burst} />
      <div className="row between"><button className="ghost small" onClick={onDone}>✕</button><span className="fine">Word {i + 1} of {order.length}</span></div>
      <p className="sp-kicker">✍️ Write your own sentence with this word</p>
      <div className="sp-audio">
        <button className="ghost" onClick={() => say(`${x.w}.`)}>🔊 Hear the word</button>
        <button className="ghost" onClick={() => say(`${x.w}.`, true)}>🐢 Slow</button>
        {x.s && <button className="ghost" onClick={() => say(x.s)}>💬 Example</button>}
      </div>
      <textarea ref={ref} className="sp-write" rows={3} value={v} disabled={stage === "done"} onChange={(e) => { setV(e.target.value); if (stage === "fix") setStage("write"); }} {...noAuto} placeholder="Type your sentence here…" />
      {fb && <div className={`sp-tip ${stage === "done" ? "good" : ""}`}>{fb}</div>}
      {stage !== "done" ? <button className="primary big" disabled={!v.trim()} onClick={submit}>Check my sentence ✓</button>
        : <><div className="sp-word small">{x.w}</div><button className="primary big" onClick={next}>Next word →</button></>}
    </div>
  );
}

const IDEAS = [
  { e: "⛵", t: "A young sailor finds a mysterious map." },
  { e: "👻", t: "A friendly ghost lives on an old ship." },
  { e: "🦃", t: "Something surprising happens on Thanksgiving." },
  { e: "🌟", t: "A girl builds a machine that talks to the stars." },
];

// 📚 Her own story, using as many list words as she can.
export function MyStory({ state, list, persist, profile, onDone }) {
  const [idea, setIdea] = useState(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [coach, setCoach] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const { used, near } = useMemo(() => findWords(text, list), [text, list]);
  const hear = (x) => say(`${x.w}.`);
  if (!idea) return (
    <div className="card sp">
      <div className="row between"><button className="ghost small" onClick={onDone}>✕</button></div>
      <h1 className="title">📚 My story</h1>
      <p className="sub">Write a story and use as many spelling words as you can. Pick an idea, or make up your own!</p>
      <div className="sp-modes">{IDEAS.map((d) => <button key={d.t} className="sp-mode" onClick={() => setIdea(d.t)}><span>{d.e}</span><small>{d.t}</small></button>)}
        <button className="sp-mode" onClick={() => setIdea("My own idea")}><span>💭</span><b>My own idea</b></button></div>
    </div>
  );
  const helpMe = async () => {
    setBusy(true);
    const left = list.words.filter((x) => !used.includes(x.w)).map((x) => x.w);
    const t = await ask(KID, `Story idea: ${idea}. Her story so far: "${text.trim() || "(nothing yet)"}". Spelling words she hasn't used yet: ${left.join(", ") || "none"}. Ask her ONE short question that helps her think of what happens next${left.length ? `, nudging toward one unused word (say it as a meaning clue, not the word itself)` : ""}. One or two sentences.`, 120);
    setCoach(t || (left.length ? "What could happen next? Tap a 🔊 word to hear one you haven't used yet, and think how it could fit." : "What happens at the end? How does everyone feel?"));
    setBusy(false);
  };
  const finish = async () => {
    setBusy(true);
    const item = { t: Date.now(), title: title.trim() || idea, idea, text: text.trim(), used };
    save(state, "stories", item, 20); state.stars = (state.stars || 0) + used.length; persist(state);
    const t = await ask(KID, `Her story "${item.title}": "${item.text}". She used these spelling words: ${used.join(", ")}. Write 2 or 3 short sentences: what you loved, and one thing she could add next time. Don't correct her spelling.`, 200);
    setDone({ ...item, note: t }); setBusy(false);
  };
  if (done) return (
    <div className="card sp">
      <Particles trigger={1} big />
      <h1 className="title center">📚 {done.title}</h1>
      <p className="sub center">You used <b>{done.used.length}</b> of {list.words.length} spelling words. +{done.used.length} ⭐</p>
      <div className="sp-story-read">{done.text}</div>
      {done.note && <div className="ai">{done.note}</div>}
      <div className="controls"><button className="ghost" onClick={() => sayLong(done.text)}>🔊 Read it to me</button><button className="primary" onClick={onDone}>Done</button></div>
    </div>
  );
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div className="card sp">
      <div className="row between"><button className="ghost small" onClick={onDone}>✕</button><span className="fine">{words} words · {used.length} of {list.words.length} spelling words</span></div>
      <p className="fine center">💭 {idea}</p>
      <input className="sp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Story title" {...noAuto} autoCapitalize="words" />
      <textarea className="sp-write tall" value={text} onChange={(e) => setText(e.target.value)} {...noAuto} placeholder="Once upon a time…" />
      <WordStatus list={list} used={used} onHear={hear} />
      <NearMiss near={near} />
      {coach && <div className="ai">{coach}</div>}
      <div className="controls">
        <button className="ghost" disabled={busy} onClick={helpMe}>💡 Help me keep going</button>
        <button className="ghost" disabled={!text.trim()} onClick={() => sayLong(text)}>🔊 Read it to me</button>
        <button className="primary" disabled={busy || words < 10} onClick={finish}>I'm finished!</button>
      </div>
    </div>
  );
}

// 🧩 A story with blanks. She works out which word fits, can hear it, and types it.
export function FillStory({ state, list, persist, onDone }) {
  const [story, setStory] = useState(() => (storyFits(list.story, list) ? list.story : null));
  const [vals, setVals] = useState({});
  const [result, setResult] = useState(null); // {idx: ok}
  const [firstDone, setFirstDone] = useState(false);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (story) return;
    let live = true;
    (async () => {
      const p = STORY_PROMPT(list.words.map((x) => x.w));
      const t = await ask(p.system, p.user, 400);
      const s = storyFits(t, list) ? t : sentenceStory(list);
      if (!live) return;
      list.story = s; persist(state); setStory(s);
    })();
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const segs = useMemo(() => (story ? parseStory(story) : []), [story]);
  if (!story) return <div className="card center sp"><div className="big-emoji float">🧩</div><p className="sub">Writing a story with your words…</p></div>;
  const blanks = segs.map((s, i) => (s.blank ? i : -1)).filter((i) => i >= 0);
  const filled = blanks.every((i) => (vals[i] || "").trim());
  const allRight = result && blanks.every((i) => result[i]);
  const checkAll = () => {
    const r = {};
    for (const i of blanks) {
      const res = check(segs[i].blank, vals[i] || "");
      r[i] = res.ok;
      if (!firstDone) record(state, segs[i].blank, res.ok, res.typed, "story");
    }
    const right = blanks.filter((i) => r[i]).length;
    if (!firstDone) { state.stars = (state.stars || 0) + right; persist(state); setFirstDone(true); }
    setResult(r);
    if (blanks.every((i) => r[i])) { setBurst((b) => b + 1); say("You filled in the whole story!"); }
  };
  const readAll = () => sayLong(segs.map((s) => s.text ?? s.blank).join(""));
  return (
    <div className="card sp">
      <Particles trigger={burst} big />
      <div className="row between"><button className="ghost small" onClick={onDone}>✕</button><span className="fine">{blanks.filter((i) => (vals[i] || "").trim()).length} of {blanks.length} filled</span></div>
      <h1 className="title center">🧩 Fill in the story</h1>
      <p className="fine center">Which spelling word fits each blank? Tap 🔊 next to a blank to hear its word.</p>
      <div className="sp-story">
        {segs.map((s, i) => s.text !== undefined ? <span key={i}>{s.text}</span> : (
          <span key={i} className={`sp-blank ${result ? (result[i] ? "right" : "wrong") : ""}`}>
            <input value={vals[i] || ""} disabled={!!result?.[i]} style={{ width: `${Math.max(6, s.blank.length + 2)}ch` }}
              onChange={(e) => { setVals({ ...vals, [i]: e.target.value }); if (result && !result[i]) setResult({ ...result, [i]: undefined }); }}
              autoCorrect="off" autoCapitalize="none" autoComplete="off" spellCheck={false} aria-label="Blank" />
            <button type="button" className="sp-hear" onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} onClick={() => say(`${s.blank}.`)} aria-label="Hear this word">🔊</button>
          </span>))}
      </div>
      {result && !allRight && <div className="sp-tip">The red blanks need another look. Tap 🔊 to hear the word, fix it, and check again.</div>}
      {allRight ? <div className="controls"><button className="ghost" onClick={readAll}>🔊 Read the story</button><button className="primary" onClick={onDone}>Done</button></div>
        : <div className="controls"><button className="ghost" onClick={readAll}>🔊 Read it with the words</button><button className="primary" disabled={!filled} onClick={checkAll}>Check my story ✓</button></div>}
    </div>
  );
}
