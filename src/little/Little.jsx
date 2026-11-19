// Little Learner home and lessons (ages 3–5). Two subjects: 🧮 Math and 🐝 Spelling (ABC letters).
// Every question is read aloud, every answer is a tap, and there's always a 🔊 to hear it again.
import { useEffect, useMemo, useRef, useState } from "react";
import { Particles } from "../ui/components.jsx";
import { say, warm } from "../spell/speech.js";
import { SUBJECTS, ensureLittle, makeRound, roundLines, finishLesson, isOpen, nextLesson, unitProgress, lessonRec, numWord, LETTERS, ABC, SHAPES, allLessons } from "./engine.js";

const PRAISE = ["Yes!", "Great job!", "You got it!", "Super!", "Wow, well done!", "That's right!"];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const later = (fn, ms) => setTimeout(fn, ms);

export default function Little({ profile, state, persist, onSwitch, onParent }) {
  const lt = ensureLittle(state);
  const [subject, setSubjectRaw] = useState(lt.tab === "abc" ? "abc" : "math");
  const [unitId, setUnitId] = useState(null);
  const [play, setPlay] = useState(null); // { lesson, key }
  const [done, setDone] = useState(null);
  const setSubject = (s) => { setSubjectRaw(s); setUnitId(null); lt.tab = s; persist(state); };
  const units = SUBJECTS[subject];
  useEffect(() => { warm([...PRAISE, "Let's play!", "Pick a lesson!"]); }, []);

  const start = (lesson) => { setDone(null); setPlay({ lesson, key: Date.now() }); };
  if (play) return <Play key={play.key} lesson={play.lesson} subject={subject} profile={profile} onQuit={() => setPlay(null)}
    onFinish={(firstTry, total) => { const r = finishLesson(state, subject, play.lesson.id, firstTry, total); persist(state); setDone({ ...r, lesson: play.lesson, firstTry, total }); setPlay(null); }} />;
  if (done) return <Done done={done} state={state} subject={subject} onAgain={() => start(done.lesson)} onNext={(l) => start(l)} onHome={() => { setDone(null); setUnitId(done.lesson.unit.id); }} />;

  const unit = units.find((u) => u.id === unitId);
  const next = nextLesson(state, subject);
  return (
    <div className={`card lt lt-${subject}`}>
      <div className="row between">
        <button className="ghost small" onClick={onSwitch}>{profile.avatar} {profile.name} ▾</button>
        <div className="pill">⭐ {state.stars}</div>
      </div>
      <div className="subject-tabs">
        <button className={subject === "math" ? "on" : ""} onClick={() => { setSubject("math"); say("Math!"); }}>🧮 Math</button>
        <button className={subject === "abc" ? "on" : "spell"} onClick={() => { setSubject("abc"); say("Spelling! Let's learn our letters."); }}>🐝 Spelling</button>
      </div>
      {!unit && <>
        <button className="lt-next" style={{ "--uc": next.unit.color }} onClick={() => { say(`Let's play ${next.title}!`); start(next); }}>
          <span className="lt-next-emoji">{next.emoji}</span>
          <span><b>▶ Play</b><small>{next.title}</small></span>
        </button>
        <div className="lt-units">
          {units.map((u, i) => {
            const p = unitProgress(state, subject, u);
            const open = isOpen(state, subject, u.lessons[0].id);
            return (
              <button key={u.id} className={`lt-unit ${open ? "" : "locked"}`} style={{ "--uc": u.color }} disabled={!open} onClick={() => { setUnitId(u.id); say(u.title); }}>
                <span className={`lt-unit-emoji ${subject === "abc" && i < 7 ? "letters" : ""}`}>{open ? u.emoji : "🔒"}</span>
                <b>{u.title}</b>
                <span className="lt-dots">{u.lessons.map((l) => <i key={l.id} className={lessonRec(state, subject, l.id).stars ? "on" : ""} />)}</span>
                <small>⭐ {p.stars}/{p.max}</small>
              </button>
            );
          })}
        </div>
        {lt.stickers.length > 0 && <div className="lt-stickers"><b>My stickers</b><div>{lt.stickers.slice(-40).join(" ")}</div></div>}
        <button className="ghost small parent-link" onClick={onParent}>👪 Grown-ups</button>
      </>}
      {unit && <UnitView unit={unit} state={state} subject={subject} onBack={() => setUnitId(null)} onPlay={(l) => { say(`Let's play ${l.title}!`); start({ ...l, unit }); }} />}
    </div>
  );
}

function UnitView({ unit, state, subject, onBack, onPlay }) {
  return (
    <div className="lt-unitview" style={{ "--uc": unit.color }}>
      <div className="row between"><button className="ghost small" onClick={onBack}>⬅ Back</button><h2 className="lt-unit-title">{unit.title}</h2><span /></div>
      <div className="lt-path">
        {unit.lessons.map((l, i) => {
          const r = lessonRec(state, subject, l.id), open = isOpen(state, subject, l.id);
          return (
            <button key={l.id} className={`lt-stop ${open ? "" : "locked"} ${r.stars ? "done" : ""}`} disabled={!open} onClick={() => onPlay(l)} style={{ "--i": i }}>
              <span className="lt-stop-emoji">{open ? l.emoji : "🔒"}</span>
              <b>{l.title}</b>
              <span className="lt-stars">{[1, 2, 3].map((k) => <i key={k} className={k <= r.stars ? "on" : ""}>★</i>)}</span>
            </button>
          );
        })}
      </div>
      <p className="fine lt-tip">👪 For grown-ups: {unit.tip}</p>
    </div>
  );
}

// ── Playing a lesson ────────────────────────────────────────────────────────
function Play({ lesson, subject, profile, onQuit, onFinish }) {
  const round = useMemo(() => makeRound(lesson, { name: profile.name }), [lesson, profile.name]);
  const [i, setI] = useState(0);
  const [tries, setTries] = useState(0);
  const [wrong, setWrong] = useState([]);
  const [shown, setShown] = useState(false); // the answer is being shown after two misses
  const [right, setRight] = useState(false);
  const [boom, setBoom] = useState(0);
  const first = useRef(0);
  const busy = useRef(false);
  const q = round[i];
  useEffect(() => { warm(roundLines(round)); }, [round]);
  // Read each question aloud (the first one was started by the tap that opened the lesson on iPad).
  useEffect(() => { const t = later(() => say(q.say), i === 0 ? 350 : 150); return () => clearTimeout(t); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = (ok) => {
    if (ok) first.current += 1;
    later(() => {
      busy.current = false;
      if (i + 1 >= round.length) { onFinish(first.current, round.length); return; }
      setI(i + 1); setTries(0); setWrong([]); setShown(false); setRight(false);
    }, ok ? 1500 : 2600);
  };
  const good = (extra) => { busy.current = true; setRight(true); setBoom((b) => b + 1); say(`${extra ? extra + " " : ""}${PRAISE[Math.floor(Math.random() * PRAISE.length)]}`); advance(tries === 0); };
  const miss = (extra) => {
    const t = tries + 1; setTries(t);
    if (t >= 2) { busy.current = true; setShown(true); say(`${extra ? extra + " " : ""}${q.reveal}`); advance(false); }
    else say(`${extra ? extra + " " : ""}Not quite. ${q.hint}`);
  };
  const choose = (c, k) => {
    if (busy.current || right || shown || wrong.includes(k)) return;
    const word = c.word ? cap(c.word) + "." : "";
    if (k === q.answer) good(word);
    else { setWrong((w) => [...w, k]); miss(word); }
  };

  return (
    <div className="card lt lt-play" style={{ "--uc": lesson.unit.color }}>
      <div className="row between">
        <button className="ghost small" onClick={onQuit}>✖</button>
        <div className="lt-progress">{round.map((_, k) => <i key={k} className={k < i ? "done" : k === i ? "now" : ""} />)}</div>
        <button className="lt-hear" onClick={() => say(q.say)} aria-label="Hear it again">🔊</button>
      </div>
      <Particles trigger={boom} />
      <div className="lt-q">
        {q.kind === "meet" ? <Meet q={q} onNext={() => { say(PRAISE[0]); advance(true); }} />
          : q.kind === "trace" ? <Trace key={i} glyph={q.glyph} onDone={() => { setBoom((b) => b + 1); say(`Beautiful ${LETTERS[q.letter].say}!`); advance(true); }} />
          : q.kind === "name" ? <NameSpell key={i} q={q} onDone={(clean) => { setBoom((b) => b + 1); say(`You spelled ${profile.name}!`); advance(clean); }} />
          : q.kind === "show" ? <TapSet key={i} q={q} shown={shown} onCheck={(n) => (n === q.n ? good() : miss(`That's ${numWord(n)}.`))} />
          : <>
            <View v={q.view} key={i} />
            <div className={`lt-choices n${q.choices.length} t-${q.choices[0].t}`}>
              {q.choices.map((c, k) => (
                <button key={k} className={`lt-choice ${wrong.includes(k) ? "wrong" : ""} ${(right || shown) && k === q.answer ? "right" : ""} ${(right || shown) && k !== q.answer ? "fade" : ""}`} onClick={() => choose(c, k)}>
                  <Choice c={c} />
                </button>
              ))}
            </div>
          </>}
      </div>
    </div>
  );
}

function Choice({ c }) {
  if (c.t === "num") return <span className="lt-num">{c.v}{c.dots && <Dots n={c.v} small />}</span>;
  if (c.t === "dots") return <Dots n={c.v} />;
  if (c.t === "group") return <span className="lt-group">{Array.from({ length: c.n }, (_, k) => <span key={k}>{c.e}</span>)}</span>;
  if (c.t === "shape") return <Shape v={c.v} color={c.color} />;
  if (c.t === "letter") return <span className="lt-letter">{c.v}</span>;
  return <span className="lt-emoji" style={{ fontSize: c.scale ? `${3.2 * c.scale}rem` : undefined }}>{c.v}</span>;
}

function View({ v }) {
  if (!v) return null;
  if (v.t === "objects") return <Objects v={v} />;
  if (v.t === "numeral") return <div className="lt-bignum">{v.v}</div>;
  if (v.t === "track") return <div className="lt-track">{Array.from({ length: v.to - v.from + 1 }, (_, k) => v.from + k).map((n) => <span key={n} className={n === v.missing ? "miss" : ""}>{n === v.missing ? "?" : n}</span>)}</div>;
  if (v.t === "abc") return <div className="lt-track abc">{ABC.slice(v.from, v.at + 1).map((L, k) => <span key={L} className={v.from + k === v.at ? "miss" : ""}>{v.from + k === v.at ? "?" : L}</span>)}</div>;
  if (v.t === "pattern") return <div className="lt-pattern">{v.seq.map((e, k) => <span key={k}>{e}</span>)}<span className="miss">?</span></div>;
  if (v.t === "flash") return <Flash n={v.n} />;
  if (v.t === "shape") return <SideCounter v={v} />;
  if (v.t === "letter") return <div className={`lt-bigletter ${v.small ? "small" : ""}`} onClick={() => say(`${cap(LETTERS[v.v].say)}.`)}>{v.v}<span>{v.v.toLowerCase()}</span></div>;
  if (v.t === "emoji") return <button className="lt-picture" onClick={() => say(`${cap(v.word)}.`)}>{v.v}<small>🔊 {v.word}</small></button>;
  return null;
}

// Things to count. Tapping one gives it a number and says the number out loud.
function Objects({ v }) {
  const [order, setOrder] = useState([]); // keys in the order they were counted
  const tap = (key) => { if (!v.countable || order.includes(key)) return; const n = order.length + 1; setOrder([...order, key]); say(`${cap(numWord(n))}.`); };
  return (
    <div className="lt-objects">
      {v.groups.map((g, gi) => (
        <div key={gi} className="lt-objgroup-wrap">
          {gi > 0 && v.op && <span className="lt-op">{v.op}</span>}
          <div className={`lt-objgroup ${g.isNew ? "new" : ""}`}>
            {Array.from({ length: g.n }, (_, k) => {
              const key = `${gi}-${k}`, goneOne = g.gone && k >= g.n - g.gone, at = order.indexOf(key);
              return <button key={key} className={`lt-obj ${goneOne ? "gone" : ""} ${at >= 0 ? "counted" : ""}`} onClick={() => !goneOne && tap(key)}>{g.e}{at >= 0 && <i>{at + 1}</i>}</button>;
            })}
          </div>
        </div>
      ))}
      {v.countable && order.length > 0 && <button className="lt-mini" onClick={() => setOrder([])}>↺ count again</button>}
    </div>
  );
}

// Tap exactly n things, then ✔.
function TapSet({ q, shown, onCheck }) {
  const [on, setOn] = useState([]);
  const toggle = (k) => {
    const nx = on.includes(k) ? on.filter((x) => x !== k) : [...on, k];
    setOn(nx); if (nx.length) say(`${cap(numWord(nx.length))}.`);
  };
  return (
    <>
      <div className="lt-objects"><div className="lt-objgroup big">
        {Array.from({ length: q.view.total }, (_, k) => <button key={k} className={`lt-obj ${on.includes(k) || (shown && k < q.n) ? "picked" : ""}`} onClick={() => toggle(k)}>{q.view.e}{on.includes(k) && <i>{on.indexOf(k) + 1}</i>}</button>)}
      </div></div>
      <div className="lt-bignum small">{on.length}</div>
      <button className="lt-check" disabled={!on.length || shown} onClick={() => onCheck(on.length)}>✔</button>
    </>
  );
}

function Flash({ n }) {
  const [hide, setHide] = useState(false);
  useEffect(() => { const t = later(() => setHide(true), 1800); return () => clearTimeout(t); }, [n]);
  return <div className="lt-flash">{hide ? <button className="lt-mini" onClick={() => { setHide(false); later(() => setHide(true), 1500); }}>👀 Look again</button> : <Dots n={n} />}</div>;
}

// Dots like dice for 1–6, ten-frame rows above that.
export function Dots({ n, small }) {
  const DICE = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  if (n <= 6 && n > 0) return <span className={`lt-dice ${small ? "small" : ""}`}>{Array.from({ length: 9 }, (_, k) => <i key={k} className={DICE[n].includes(k) ? "on" : ""} />)}</span>;
  return <span className={`lt-frame ${small ? "small" : ""}`}>{Array.from({ length: n > 10 ? 20 : 10 }, (_, k) => <i key={k} className={k < n ? "on" : ""} />)}</span>;
}

const SHAPE_SVG = {
  circle: <circle cx="50" cy="50" r="40" />,
  square: <rect x="14" y="14" width="72" height="72" rx="3" />,
  triangle: <polygon points="50,10 92,86 8,86" />,
  rectangle: <rect x="5" y="25" width="90" height="50" rx="3" />,
  star: <polygon points="50,6 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38" />,
  heart: <path d="M50 88 C20 66 6 50 6 32 C6 18 18 8 31 8 C40 8 46 13 50 20 C54 13 60 8 69 8 C82 8 94 18 94 32 C94 50 80 66 50 88 Z" />,
  oval: <ellipse cx="50" cy="50" rx="30" ry="44" />,
  diamond: <polygon points="50,4 86,50 50,96 14,50" />,
};
export function Shape({ v, color }) { return <svg className="lt-shape" viewBox="0 0 100 100" fill={color} aria-label={SHAPES[v].name}>{SHAPE_SVG[v]}</svg>; }
const SIDES = { triangle: [[50, 10], [92, 86], [8, 86]], square: [[14, 14], [86, 14], [86, 86], [14, 86]], rectangle: [[5, 25], [95, 25], [95, 75], [5, 75]] };
function SideCounter({ v }) {
  const [hit, setHit] = useState([]);
  const pts = SIDES[v.v];
  const tap = (k) => { if (hit.includes(k)) return; setHit([...hit, k]); say(`${cap(numWord(hit.length + 1))}.`); };
  return (
    <svg className="lt-shape big" viewBox="-4 -4 108 108">
      <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={v.color} opacity="0.35" />
      {pts.map((p, k) => { const q = pts[(k + 1) % pts.length]; const at = hit.indexOf(k); return (
        <g key={k} onClick={() => tap(k)} style={{ cursor: "pointer" }}>
          <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="transparent" strokeWidth="18" />
          <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={at >= 0 ? "#ffb300" : v.color} strokeWidth={at >= 0 ? 7 : 5} strokeLinecap="round" />
          {at >= 0 && <text x={(p[0] + q[0]) / 2} y={(p[1] + q[1]) / 2 + 4} textAnchor="middle" fontSize="13" fontWeight="900" fill="#333" stroke="#fff" strokeWidth="3" paintOrder="stroke">{at + 1}</text>}
        </g>); })}
    </svg>
  );
}

// Meet a letter: big and little, its sound, and pictures to tap.
function Meet({ q, onNext }) {
  const x = LETTERS[q.letter];
  return (
    <div className="lt-meet">
      <button className="lt-bigletter" onClick={() => say(`${cap(x.say)}. ${cap(x.say)} says ${x.snd}.`)}>{q.letter}<span>{q.letter.toLowerCase()}</span></button>
      <div className="lt-meet-pics">{x.words.map(([w, e]) => <button key={w} className="lt-picture" onClick={() => say(`${cap(w)}.`)}>{e}<small>{w}</small></button>)}</div>
      <button className="lt-check" onClick={onNext}>➡</button>
    </div>
  );
}

// Spell your name: tap the letters in order.
function NameSpell({ q, onDone }) {
  const [got, setGot] = useState(0);
  const [used, setUsed] = useState([]);
  const [bad, setBad] = useState(null);
  const slips = useRef(0);
  const tap = (t) => {
    if (used.includes(t.i) || got >= q.letters.length) return;
    if (t.v === q.letters[got]) {
      const g = got + 1; setGot(g); setUsed([...used, t.i]); setBad(null); say(`${cap(LETTERS[t.v].say)}.`);
      if (g >= q.letters.length) later(() => onDone(slips.current === 0), 400);
    } else { slips.current += 1; setBad(t.i); say(`Look for ${LETTERS[q.letters[got]].say}.`); }
  };
  return (
    <div className="lt-name">
      <div className="lt-slots">{q.letters.map((L, k) => <span key={k} className={k < got ? "on" : k === got ? "now" : ""}>{k < got ? L : ""}</span>)}</div>
      <div className="lt-choices t-letter">{q.tiles.map((t) => <button key={t.i} className={`lt-choice ${used.includes(t.i) ? "fade" : ""} ${bad === t.i ? "wrong" : ""}`} onClick={() => tap(t)}><span className="lt-letter">{t.v}</span></button>)}</div>
    </div>
  );
}

// Trace a letter with a finger. Done when most of the letter is coloured in.
function Trace({ glyph, onDone }) {
  const ref = useRef(null);
  const st = useRef({ samples: [], covered: null, drawing: false, last: null, done: false, size: 300 });
  const [pct, setPct] = useState(0);
  const draw = () => {
    const c = ref.current; if (!c) return;
    const size = Math.min(340, (c.parentElement?.clientWidth || 340) - 8);
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr; c.height = size * dpr; c.style.width = c.style.height = `${size}px`;
    const ctx = c.getContext("2d"); ctx.scale(dpr, dpr);
    const font = `900 ${size * 0.78}px ui-rounded, "Arial Rounded MT Bold", "Nunito", Arial, sans-serif`;
    // Which points belong to the letter (to measure how much has been traced).
    const off = document.createElement("canvas"); off.width = off.height = size;
    const o = off.getContext("2d"); o.font = font; o.textAlign = "center"; o.textBaseline = "middle"; o.fillText(glyph, size / 2, size * 0.54);
    const data = o.getImageData(0, 0, size, size).data, samples = [], step = Math.max(5, Math.round(size / 55));
    for (let y = 0; y < size; y += step) for (let x = 0; x < size; x += step) if (data[(y * size + x) * 4 + 3] > 128) samples.push([x, y]);
    st.current = { samples, covered: new Uint8Array(samples.length), drawing: false, last: null, done: false, size };
    ctx.fillStyle = "#e8e4f3"; ctx.font = font; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(glyph, size / 2, size * 0.54);
    ctx.strokeStyle = "#c9c2e0"; ctx.lineWidth = 3; ctx.setLineDash([8, 8]); ctx.strokeText(glyph, size / 2, size * 0.54); ctx.setLineDash([]);
    setPct(0);
  };
  useEffect(draw, [glyph]); // eslint-disable-line react-hooks/exhaustive-deps
  const pos = (e) => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const paint = (p) => {
    const s = st.current, ctx = ref.current.getContext("2d"), brush = s.size * 0.075;
    ctx.strokeStyle = getComputedStyle(ref.current).getPropertyValue("--uc").trim() || "#e53935"; ctx.lineWidth = brush * 1.6; ctx.lineCap = ctx.lineJoin = "round";
    ctx.beginPath(); const a = s.last || p; ctx.moveTo(a[0], a[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
    s.last = p;
    const r2 = (brush * 1.15) ** 2;
    let n = 0;
    s.samples.forEach(([x, y], k) => { if (!s.covered[k] && (x - p[0]) ** 2 + (y - p[1]) ** 2 < r2) s.covered[k] = 1; n += s.covered[k]; });
    const f = s.samples.length ? n / s.samples.length : 1;
    setPct(f);
    if (f >= 0.8 && !s.done) { s.done = true; s.drawing = false; later(onDone, 300); }
  };
  return (
    <div className="lt-trace">
      <canvas ref={ref} className="lt-canvas"
        onPointerDown={(e) => { e.preventDefault(); ref.current.setPointerCapture?.(e.pointerId); st.current.drawing = true; st.current.last = null; paint(pos(e)); }}
        onPointerMove={(e) => { if (st.current.drawing && !st.current.done) paint(pos(e)); }}
        onPointerUp={() => { st.current.drawing = false; st.current.last = null; }}
        onPointerCancel={() => { st.current.drawing = false; }} />
      <div className="lt-trace-bar"><div style={{ width: `${Math.min(100, (pct / 0.8) * 100)}%` }} /></div>
      <div className="row center-row"><button className="lt-mini" onClick={draw}>↺ start over</button>{pct > 0.55 && !st.current.done && <button className="lt-mini" onClick={() => { st.current.done = true; onDone(); }}>✔ done</button>}</div>
    </div>
  );
}

function Done({ done, state, subject, onAgain, onNext, onHome }) {
  const list = allLessons(subject);
  const idx = list.findIndex((l) => l.id === done.lesson.id);
  const nxt = list[idx + 1] && isOpen(state, subject, list[idx + 1].id) ? list[idx + 1] : null;
  const [boom, setBoom] = useState(0);
  useEffect(() => { setBoom(1); say(done.stars === 3 ? "Amazing! Three stars!" : done.stars === 2 ? "Great work! Two stars!" : "You did it! One star!"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="card lt center" style={{ "--uc": done.lesson.unit.color }}>
      <Particles trigger={boom} big />
      <div className="lt-done-stars">{[1, 2, 3].map((k) => <span key={k} className={k <= done.stars ? "on" : ""}>★</span>)}</div>
      <h1 className="title">{done.lesson.title}</h1>
      {done.sticker && <div className="lt-sticker-won"><span className="float">{done.sticker}</span><small>New sticker!</small></div>}
      {nxt && <button className="primary big" onClick={() => { say(`Let's play ${nxt.title}!`); onNext({ ...nxt }); }}>▶ Next: {nxt.emoji} {nxt.title}</button>}
      <div className="row center-row">
        <button className="ghost big-ghost" onClick={() => { say("Again!"); onAgain(); }}>🔁 Again</button>
        <button className="ghost big-ghost" onClick={onHome}>🏠 Home</button>
      </div>
    </div>
  );
}
