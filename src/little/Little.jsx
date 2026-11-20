// Little Learner home and lessons (ages 3–5). Two subjects: 🧮 Math and 🐝 Spelling (ABC letters).
// Every question is read aloud, every answer is a tap, and there's always a 🔊 to hear it again.
import { useEffect, useMemo, useRef, useState } from "react";
import { Particles } from "../ui/components.jsx";
import { say, warm } from "../spell/speech.js";
import { SUBJECTS, ensureLittle, makeRound, roundLines, finishLesson, isOpen, nextLesson, unitProgress, lessonRec, numWord, LETTERS, ABC, SHAPES, allLessons } from "./engine.js";

const PRAISE = ["Yes!", "Great job!", "You got it!", "Super!", "Wow, well done!", "That's right!"];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const later = (fn, ms) => setTimeout(fn, ms);
// Buttons react when the finger lifts, even if it slid a little on the way (a plain click is
// dropped on touch screens when the finger moves, which made answers feel unresponsive).
// onClick still handles the keyboard (detail 0) so nothing fires twice.
const tp = (fn) => ({ onPointerUp: (e) => { if (e.button > 0) return; fn(e); }, onClick: (e) => { if (e.detail === 0) fn(e); } });

export default function Little({ profile, state, persist, onSwitch, onParent }) {
  const lt = ensureLittle(state);
  const [subject, setSubjectRaw] = useState(lt.tab === "abc" ? "abc" : "math");
  const [unitId, setUnitId] = useState(null);
  const [play, setPlay] = useState(null); // { lesson, key }
  const [done, setDone] = useState(null);
  const setSubject = (s) => { setSubjectRaw(s); setUnitId(null); lt.tab = s; persist(state); };
  const units = SUBJECTS[subject];
  useEffect(() => { warm([...PRAISE, "Let's play!", "Pick a lesson!"]); }, []);
  useScreenLock(!!play);

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

// Keep the screen still for small hands: no pinch-zoom, no double-tap zoom, no pull-to-refresh,
// no long-press menus, and while a lesson is open the page can't scroll or slide at all.
function useScreenLock(playing) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const before = meta?.getAttribute("content");
    meta?.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");
    document.documentElement.classList.add("lt-lock");
    const stop = (e) => e.preventDefault();
    const multi = (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); };
    // iPhone/iPad Safari ignore user-scalable=no, so pinch gestures are blocked here too.
    document.addEventListener("gesturestart", stop, { passive: false });
    document.addEventListener("gesturechange", stop, { passive: false });
    document.addEventListener("touchmove", multi, { passive: false });
    document.addEventListener("contextmenu", stop);
    window.scrollTo(0, 0);
    return () => {
      if (before) meta.setAttribute("content", before);
      document.documentElement.classList.remove("lt-lock");
      document.removeEventListener("gesturestart", stop); document.removeEventListener("gesturechange", stop);
      document.removeEventListener("touchmove", multi); document.removeEventListener("contextmenu", stop);
    };
  }, []);
  useEffect(() => {
    if (!playing) return;
    window.scrollTo(0, 0);
    document.documentElement.classList.add("lt-still");
    const still = (e) => { if (!e.target.closest?.(".lt-canvas")) e.preventDefault(); };
    document.addEventListener("touchmove", still, { passive: false });
    return () => { document.documentElement.classList.remove("lt-still"); document.removeEventListener("touchmove", still); };
  }, [playing]);
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
        <button className="ghost small" {...tp(onQuit)}>✖</button>
        <div className="lt-progress">{round.map((_, k) => <i key={k} className={k < i ? "done" : k === i ? "now" : ""} />)}</div>
        <button className="lt-hear" {...tp(() => say(q.say))} aria-label="Hear it again">🔊</button>
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
                <button key={k} className={`lt-choice ${wrong.includes(k) ? "wrong" : ""} ${(right || shown) && k === q.answer ? "right" : ""} ${(right || shown) && k !== q.answer ? "fade" : ""}`} {...tp(() => choose(c, k))}>
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
  if (v.t === "letter") return <div className={`lt-bigletter ${v.small ? "small" : ""}`} {...tp(() => say(`${cap(LETTERS[v.v].say)}.`))}>{v.v}<span>{v.v.toLowerCase()}</span></div>;
  if (v.t === "emoji") return <button className="lt-picture" {...tp(() => say(`${cap(v.word)}.`))}>{v.v}<small>🔊 {v.word}</small></button>;
  return null;
}

// Things to count. Tapping one gives it a number and says the number out loud.
function Objects({ v }) {
  const [order, setOrder] = useState([]); // keys in the order he counted them
  const items = v.groups.flatMap((g, gi) => Array.from({ length: g.n }, (_, k) => ({ key: `${gi}-${k}`, gi, k, gone: g.gone && k >= g.n - g.gone })));
  // He counts the one he taps, in any order. A tap that misses lands on the nearest thing not counted yet.
  const tap = (e) => {
    if (!v.countable) return;
    const key = pickAt(e, (k) => !order.includes(k));
    if (!key) return;
    const n = order.length + 1; setOrder([...order, key]); say(`${cap(numWord(n))}.`);
  };
  const os = useObjSize(Math.max(...v.groups.map((g) => g.n)), v.groups.length);
  return (
    <div className="lt-objects" style={{ "--os": `${os}px` }} {...tp(tap)} role={v.countable ? "button" : undefined}>
      {v.groups.map((g, gi) => (
        <div key={gi} className="lt-objgroup-wrap">
          {gi > 0 && v.op && <span className="lt-op">{v.op}</span>}
          <div className={`lt-objgroup ${g.isNew ? "new" : ""}`} style={{ "--cols": cols(g.n) }}>
            {items.filter((x) => x.gi === gi).map((x) => {
              const at = order.indexOf(x.key);
              return <span key={x.key} data-k={x.gone ? undefined : x.key} className={`lt-obj ${x.gone ? "gone" : ""} ${at >= 0 ? "counted" : ""}`}>{g.e}{at >= 0 && <i>{at + 1}</i>}</span>;
            })}
          </div>
        </div>
      ))}
      {v.countable && <div className="lt-count-hint">{order.length ? <button className="lt-mini" {...tp((e) => { e.stopPropagation(); setOrder([]); })}>↺ count again</button> : <span>👆 Tap to count</span>}</div>}
    </div>
  );
}
// The thing the tap landed on (if it qualifies), else the nearest one that qualifies.
function pickAt(e, ok) {
  const hit = e.target.closest?.("[data-k]");
  if (hit && ok(hit.dataset.k)) return hit.dataset.k;
  if (hit) return null; // tapped one that's already done: do nothing
  let best = null, bd = Infinity;
  for (const el of e.currentTarget.querySelectorAll("[data-k]")) {
    if (!ok(el.dataset.k)) continue;
    const r = el.getBoundingClientRect(), d = (r.left + r.width / 2 - e.clientX) ** 2 + (r.top + r.height / 2 - e.clientY) ** 2;
    if (d < bd) { bd = d; best = el.dataset.k; }
  }
  return best;
}
// Objects per row: small groups in one row, 4 as 2×2, up to 6 in rows of 3, then rows of 5 (like a ten-frame).
const cols = (n) => (n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : 5);
// How big each thing can be on this screen: as big as fits, up to 130px.
function useObjSize(n, groups = 1) {
  const [[w, h], setWH] = useState(() => (typeof window !== "undefined" ? [window.innerWidth, window.innerHeight] : [700, 900]));
  useEffect(() => { const f = () => setWH([window.innerWidth, window.innerHeight]); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  // screen − app gutter − card padding − group padding
  const avail = Math.min(w, 720) - 32 - 30 - 28, c = cols(n);
  const rows = Math.ceil(n / c) * groups;
  // Leave room for the answers below the picture (matters when the screen is turned sideways).
  const byH = Math.floor((h * 0.36 - rows * 10 - groups * 40) / rows);
  return Math.max(36, Math.min(130, byH, Math.floor((avail - (c - 1) * 10) / c)));
}

// Tap exactly n things, then ✔.
function TapSet({ q, shown, onCheck }) {
  const [on, setOn] = useState([]); // the ones he picked, in order
  const total = q.view.total;
  // Tap any one to pick it, tap it again to put it back. A tap that misses picks the nearest free one.
  const tap = (e) => {
    if (shown) return;
    const hit = e.target.closest?.("[data-k]");
    if (hit && on.includes(hit.dataset.k)) { const nx = on.filter((k) => k !== hit.dataset.k); setOn(nx); say(nx.length ? `${cap(numWord(nx.length))}.` : "Zero."); return; }
    const key = pickAt(e, (k) => !on.includes(k));
    if (!key) return;
    setOn([...on, key]); say(`${cap(numWord(on.length + 1))}.`);
  };
  const less = () => { if (!on.length) return; const nx = on.slice(0, -1); setOn(nx); say(nx.length ? `${cap(numWord(nx.length))}.` : "Zero."); };
  const os = useObjSize(total);
  return (
    <>
      <div className="lt-objects" style={{ "--os": `${os}px` }} {...tp(tap)} role="button"><div className="lt-objgroup" style={{ "--cols": cols(total) }}>
        {Array.from({ length: total }, (_, k) => { const key = String(k), at = on.indexOf(key); return <span key={k} data-k={key} className={`lt-obj ${at >= 0 || (shown && !on.length && k < q.n) ? "picked" : ""}`}>{q.view.e}{at >= 0 && <i>{at + 1}</i>}</span>; })}
      </div></div>
      <div className="lt-tapset-row">
        <button className="lt-less" disabled={!on.length || shown} {...tp(less)} aria-label="One less">➖</button>
        <div className="lt-bignum small">{on.length}</div>
        <button className="lt-check" disabled={!on.length || shown} {...tp(() => onCheck(on.length))} aria-label="Check">✔</button>
      </div>
    </>
  );
}

function Flash({ n }) {
  const [hide, setHide] = useState(false);
  useEffect(() => { const t = later(() => setHide(true), 1800); return () => clearTimeout(t); }, [n]);
  return <div className="lt-flash">{hide ? <button className="lt-mini" {...tp(() => { setHide(false); later(() => setHide(true), 1500); })}>👀 Look again</button> : <Dots n={n} />}</div>;
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
  // A tap anywhere on the shape lights up the next side.
  const next = () => { const k = pts.findIndex((_, i) => !hit.includes(i)); if (k < 0) return; setHit([...hit, k]); say(`${cap(numWord(hit.length + 1))}.`); };
  return (
    <svg className="lt-shape big" viewBox="-4 -4 108 108" {...tp(next)}>
      <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={v.color} opacity="0.35" />
      {pts.map((p, k) => { const q = pts[(k + 1) % pts.length]; const at = hit.indexOf(k); return (
        <g key={k} style={{ cursor: "pointer" }}>
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
      <button className="lt-bigletter" {...tp(() => say(`${cap(x.say)}. ${cap(x.say)} says ${x.snd}.`))}>{q.letter}<span>{q.letter.toLowerCase()}</span></button>
      <div className="lt-meet-pics">{x.words.map(([w, e]) => <button key={w} className="lt-picture" {...tp(() => say(`${cap(w)}.`))}>{e}<small>{w}</small></button>)}</div>
      <button className="lt-check" {...tp(onNext)}>➡</button>
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
      <div className="lt-choices t-letter">{q.tiles.map((t) => <button key={t.i} className={`lt-choice ${used.includes(t.i) ? "fade" : ""} ${bad === t.i ? "wrong" : ""}`} {...tp(() => tap(t))}><span className="lt-letter">{t.v}</span></button>)}</div>
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
    const size = Math.min(560, (c.parentElement?.clientWidth || 340) - 8, Math.round(window.innerHeight * 0.55));
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
    const r2 = (brush * 1.4) ** 2;
    let n = 0;
    s.samples.forEach(([x, y], k) => { if (!s.covered[k] && (x - p[0]) ** 2 + (y - p[1]) ** 2 < r2) s.covered[k] = 1; n += s.covered[k]; });
    const f = s.samples.length ? n / s.samples.length : 1;
    setPct(f);
    if (f >= 0.72 && !s.done) { s.done = true; s.drawing = false; later(onDone, 300); }
  };
  return (
    <div className="lt-trace">
      <canvas ref={ref} className="lt-canvas"
        onPointerDown={(e) => { e.preventDefault(); ref.current.setPointerCapture?.(e.pointerId); st.current.drawing = true; st.current.last = null; paint(pos(e)); }}
        onPointerMove={(e) => { if (st.current.drawing && !st.current.done) paint(pos(e)); }}
        onPointerUp={() => { st.current.drawing = false; st.current.last = null; }}
        onPointerCancel={() => { st.current.drawing = false; }} />
      <div className="lt-trace-bar"><div style={{ width: `${Math.min(100, (pct / 0.72) * 100)}%` }} /></div>
      <div className="row center-row"><button className="lt-mini" {...tp(draw)}>↺ start over</button>{pct > 0.45 && !st.current.done && <button className="lt-mini" {...tp(() => { st.current.done = true; onDone(); })}>✔ done</button>}</div>
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
