import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MISSION, STATION, cargoItem, balancePuzzle, balanceItem, landPuzzle, landItem, reactorPuzzle, reactorItem, waysToMake, wayText, shieldItem, gatePuzzle, gateItem, inGate, recordMission } from "./engine.js";
import { isCorrect } from "../engine/check.js";
import { fmt, roundTo } from "../engine/util.js";
import { Keypad, useHardwareKeys, ColumnEntry, speak } from "../ui/components.jsx";
import { sfx, setSound, soundOn } from "./sfx.js";
import { helpPrompt, revealsAnswer } from "../engine/ai.js";
import { ReactorGame, ShieldGame, GateGame } from "./games.jsx";
import { CargoGame, BalanceGame, LandGame } from "./marsgames.jsx";
import { OctoGame, BubbleGame, RouteGame, OceanScene, CreatureIcon, Breathe } from "./oceangames.jsx";

// Who Bolt is talking to, and how Bolt asks Claude: ask(system, user) -> text ("" if unavailable).
const BoltCtx = createContext({ ask: async () => "", name: "", world: { label: "Space Adventure" }, buddy: { name: "Bolt" }, home: "Ship" });
// The helper's face: Bolt the robot, or a drawn creature (Pip the axolotl) for the ocean.
const BuddyFace = ({ buddy, size = 30 }) => buddy.kind ? <CreatureIcon kind={buddy.kind} size={size} /> : <span className="ms-bolt" aria-hidden="true">🤖</span>;
const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const reducedMotion = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

// A mission: three stations on one ship. Each station is one math idea expressed
// as an action, and each result goes to the shared learning record.
export default function Mission({ missionId = "cruiser", st, world, name, persist, onRecord, onExit, ask }) {
  const M = MISSION[missionId], STATIONS = M.stations;
  const [view, setView] = useState("intro");
  const [done, setDone] = useState({});
  const [celebrated, setCelebrated] = useState(false);
  const [visit, setVisit] = useState(0); // fresh numbers every time a station opens
  const [calm, setCalm] = useState(reducedMotion);
  const [sound, setSnd] = useState(soundOn());
  const [breathe, setBreathe] = useState(false);
  const buddy = M.buddy || { name: "Bolt" }, home = M.home || "Ship", rank = M.rank || "Commander";
  const missionLog = useRef([]);

  const record = useCallback((station, item, outcome) => {
    const r = recordMission(st, station, item, outcome);
    persist?.(st);
    const entry = { station, skill: item.skill, level: item.level, q: item.text, answer: Array.isArray(item.answer) ? item.answer.join(", ") : item.answer, given: outcome.given, help: [...new Set(outcome.help || [])], support: r.support, levelUp: r.levelUp, levelDown: r.levelDown, comesBack: r.mistake?.status === "open", t: Date.now() };
    missionLog.current.push(entry);
    onRecord?.(entry);
    return r;
  }, [st, persist, onRecord]);

  const open = (id) => { sfx.click(); setVisit((v) => v + 1); setView(id); };
  const backToShip = (finishedId) => {
    const nd = finishedId ? { ...done, [finishedId]: true } : done;
    setDone(nd);
    if (STATIONS.every((s) => nd[s.id]) && !celebrated) { setCelebrated(true); setView("finale"); sfx.win(); return; }
    setView("map");
  };
  const toggleSound = () => { const v = !sound; setSound(v); setSnd(v); if (v) sfx.click(); };
  const next = STATIONS.find((s) => !done[s.id]);
  const unlocked = (i) => i === 0 || done[STATIONS[i - 1].id];

  const bar = (
    <div className="ms-bar">
      <button className="ms-chip" onClick={onExit} aria-label="Leave the mission">✕</button>
      <div className="ms-progress" aria-label="Mission progress">
        {STATIONS.map((s) => <span key={s.id} className={done[s.id] ? "on" : ""} title={s.title}>{s.emoji}</span>)}
      </div>
      <div className="row">
        <button className="ms-chip" onClick={() => { sfx.click(); setBreathe(true); }} title="A calm breathing break">🫧 Breathe</button>
        <button className="ms-chip" onClick={() => setCalm(!calm)} aria-pressed={calm} title="Calm mode: fewer animations">{calm ? "🌙 Calm" : "✨ Lively"}</button>
        <button className="ms-chip" onClick={toggleSound} aria-pressed={sound}>{sound ? "🔊" : "🔇"}</button>
      </div>
    </div>
  );

  return (
    <BoltCtx.Provider value={{ ask: ask || (async () => ""), name, world, buddy, home }}>
    <div className={`ms ${calm ? "calm" : ""}`}>
      {bar}
      {view === "intro" && (
        <div className="ms-panel ms-intro">
          <Scene M={M} done={{}} calm={calm} />
          <p className="ms-eyebrow">{M.unit}</p>
          <h1 className="ms-title">{M.headline}</h1>
          <p className="ms-story">{M.story(name)}</p>
          <ol className="ms-goals">{STATIONS.map((s) => <li key={s.id}><span>{s.emoji}</span> {s.title}{s.focusSkill ? <em className="ms-focustag"> · {s.focusSkill}</em> : null}</li>)}</ol>
          <button className="ms-go" onClick={() => { if (!sound) toggleSound(); setView("map"); }}>{M.go || "Start the mission 🚀"}</button>
          <p className="ms-fine">No timers. Take as long as you need.</p>
        </div>
      )}
      {view === "map" && (
        <div className="ms-panel">
          <Scene M={M} done={done} calm={calm} />
          <p className="ms-bolt-line"><BuddyFace buddy={buddy} /> {next ? `${buddy.name}: "Next job, ${rank}: ${next.title.toLowerCase()}!"` : `${buddy.name}: "${M.allDone}"`}</p>
          <div className="ms-stations">
            {STATIONS.map((s, i) => (
              <button key={s.id} className={`ms-station ${done[s.id] ? "done" : ""} ${next?.id === s.id ? "next" : ""}`} disabled={!unlocked(i)} onClick={() => open(s.id)}>
                <span className="ms-st-emoji">{unlocked(i) ? s.emoji : "🔒"}</span>
                <span className="ms-st-title">{s.title}</span>
                {s.focusSkill && <span className="ms-focustag">Focus skill: {s.focusSkill}</span>}
                <span className="ms-st-blurb">{done[s.id] ? `${M.doneLabel}  Tap to play again` : unlocked(i) ? s.blurb : `Finish "${STATIONS[i - 1].title}" first`}</span>
              </button>
            ))}
          </div>
          {celebrated && <button className="ms-link" onClick={() => setView("finale")}>Watch the ending again</button>}
        </div>
      )}
      {view === "reactor" && <ReactorGame key={visit} st={st} record={record} calm={calm} onBack={backToShip} />}
      {view === "shield" && <ShieldGame key={visit} st={st} world={world} record={record} calm={calm} onBack={backToShip} />}
      {view === "gate" && <GateGame key={visit} st={st} record={record} calm={calm} onBack={backToShip} />}
      {view === "cargo" && <CargoGame key={visit} st={st} world={world} record={record} calm={calm} onBack={backToShip} />}
      {view === "balance" && <BalanceGame key={visit} st={st} record={record} calm={calm} onBack={backToShip} />}
      {view === "land" && <LandGame key={visit} st={st} record={record} calm={calm} onBack={backToShip} />}
      {view === "octo" && <OctoGame key={visit} st={st} record={record} calm={calm} onBack={backToShip} home={home} />}
      {view === "bubbles" && <BubbleGame key={visit} st={st} record={record} calm={calm} onBack={backToShip} home={home} />}
      {view === "route" && <RouteGame key={visit} st={st} record={record} calm={calm} onBack={backToShip} home={home} />}
      {breathe && <Breathe st={st} onClose={() => { persist?.(st); setBreathe(false); }} />}
      {view === "finale" && <Finale M={M} name={name} log={missionLog.current} calm={calm} onAgain={() => { setDone({}); setCelebrated(false); missionLog.current = []; setView("map"); }} onShip={() => setView("map")} />}
    </div>
    </BoltCtx.Provider>
  );
}

// The mission's picture: the ship in space, or the submarine in the reef.
function Scene({ M, done, calm, finale }) {
  if (M.scene === "ocean") return <OceanScene done={done} calm={calm} finale={finale} />;
  return <Ship scene={M.scene} done={finale ? Object.fromEntries(M.stations.map((x) => [x.id, true])) : done} calm={calm} flying={finale && M.scene !== "mars"} />;
}

// ── The ship: an original illustration whose parts light up as they are fixed ──
function Ship({ done, calm, flying, scene = "moon" }) {
  const mars = scene === "mars";
  return (
    <svg className={`ms-ship ${flying ? "flying" : ""} ${calm ? "calm" : ""}`} viewBox="0 0 400 210" role="img" aria-label={mars ? `The Comet Cruiser on a supply run. Cargo ${done.cargo ? "loaded" : "empty"}, ${done.balance ? "balanced" : "tipping"}.` : `The Comet Cruiser. Reactor ${done.reactor ? "on" : "off"}, shield ${done.shield ? "on" : "broken"}.`}>
      <g className="ms-stars">{[[30, 20], [90, 50], [150, 15], [250, 35], [330, 18], [370, 60], [60, 90], [300, 80]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 1.2 : 2} className="ms-star" />)}</g>
      <path d="M0 185 Q 100 165 200 180 T 400 175 L400 210 L0 210 Z" className={mars ? "ms-moon mars" : "ms-moon"} />
      <circle cx="70" cy="192" r="8" className="ms-crater" /><circle cx="320" cy="190" r="11" className="ms-crater" />
      {mars && <g><circle cx="345" cy="42" r="20" className="ms-planet" /><path d="M300 178 l12 -22 l12 22 Z" className="ms-base" /><rect x="318" y="160" width="36" height="18" rx="9" className="ms-base" /></g>}
      <g className="ms-craft" style={mars && !done.balance && !flying ? { transform: "rotate(-7deg)", transformOrigin: "200px 130px" } : undefined}>
        {mars && done.cargo && [158, 178, 198, 218, 238].map((x) => <rect key={x} x={x - 7} y="160" width="14" height="12" rx="2" className="ms-crate" />)}
        {(mars || done.reactor) && <path d="M150 150 Q 200 205 250 150 Z" className="ms-flame" />}
        <path d="M120 140 L95 165 L150 150 Z" className="ms-fin" /><path d="M280 140 L305 165 L250 150 Z" className="ms-fin" />
        <ellipse cx="200" cy="130" rx="95" ry="32" className="ms-hull" />
        <ellipse cx="200" cy="122" rx="70" ry="12" className="ms-hull-line" />
        <path d="M150 112 Q 200 30 250 112 Z" className={`ms-dome ${mars || done.shield ? "ok" : ""}`} />
        {!mars && !done.shield && <path d="M215 70 l10 8 l-6 4 l9 9" className="ms-crack" />}
        {!mars && done.shield && <ellipse cx="200" cy="110" rx="118" ry="78" className="ms-bubble" />}
        <circle cx="200" cy="90" r="11" className="ms-pilot" /><text x="200" y="95" textAnchor="middle" className="ms-emoji-txt">🤖</text>
        {[150, 175, 200, 225, 250].map((x, i) => <circle key={x} cx={x} cy="138" r="5" className={mars || done.reactor ? "ms-light on" : "ms-light"} style={{ animationDelay: `${i * 0.15}s` }} />)}
        {!mars && done.gate && <text x="200" y="175" textAnchor="middle" className="ms-label">READY FOR HOME</text>}
        {mars && done.land && <text x="200" y="190" textAnchor="middle" className="ms-label">DELIVERED</text>}
      </g>
    </svg>
  );
}

// ── Bolt, the in-world helper: a hint, a picture, or her own question (typed or spoken) ──
export function Bolt({ hint, visual, used, onUse, part }) {
  const { ask, name, world, buddy } = useContext(BoltCtx);
  const [show, setShow] = useState(null);
  const [askOpen, setAskOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [listening, setListening] = useState(false);
  const [micFailed, setMicFailed] = useState(!Recognition);
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState([]);
  const rec = useRef(null);
  useEffect(() => () => rec.current?.abort?.(), []);
  const pick = (k) => { setShow(k); onUse(k); sfx.click(); };
  const listen = () => {
    try {
      const r = new Recognition();
      r.lang = "en-US"; r.interimResults = true; r.maxAlternatives = 1;
      r.onresult = (e) => setTyped(Array.from(e.results).map((x) => x[0].transcript).join(" "));
      r.onend = () => setListening(false);
      r.onerror = () => { setListening(false); setMicFailed(true); };
      rec.current = r; setListening(true); r.start();
    } catch { setListening(false); setMicFailed(true); }
  };
  const send = async () => {
    const q = typed.trim();
    if (!q || busy) return;
    rec.current?.stop?.(); setListening(false);
    onUse("asked"); setBusy(true); setTyped("");
    const p = helpPrompt(name, world, part, q);
    let t = await ask(p.system, p.user);
    if (t && revealsAnswer(t, part)) t = "";
    t = t || `${buddy.name} says: ${hint}`;
    setBusy(false); setAnswers((a) => [...a, { q, t }]); speak(t);
  };
  return (
    <div className="ms-boltbox">
      <div className="row ms-bolt-row">
        <BuddyFace buddy={buddy} />
        <span className="ms-bolt-name">Ask {buddy.name}</span>
        <button className={`ms-chip ${show === "hint" ? "on" : ""}`} onClick={() => pick("hint")}>💡 Hint</button>
        {visual && <button className={`ms-chip ${show === "visual" ? "on" : ""}`} onClick={() => pick("visual")}>👀 Show me</button>}
        <button className={`ms-chip ${askOpen ? "on" : ""}`} onClick={() => { sfx.click(); setAskOpen(true); if (!micFailed && !listening) listen(); }}>🎤 Ask a question</button>
      </div>
      {(show === "hint" || used.includes("hint")) && <p className="ms-hint">{hint}</p>}
      {(show === "visual" || used.includes("visual")) && visual && <div className="ms-visual">{visual}</div>}
      {answers.map((a, i) => (
        <div key={i} className="ms-answer">
          <div className="ms-fine">You asked: “{a.q}”</div>
          <p className="ms-hint">💬 {a.t} <button className="ms-say" onClick={() => speak(a.t)} aria-label="Read aloud">🔊</button></p>
        </div>
      ))}
      {busy && <p className="ms-fine">{buddy.name} is thinking…</p>}
      {askOpen && (
        <div className="ms-ask">
          {!micFailed && (
            <button className={`ms-mic ${listening ? "on" : ""}`} onClick={listening ? () => { rec.current?.stop(); setListening(false); } : listen}>
              {listening ? "⏹ I'm listening… tap when done" : "🎤 Tap and ask out loud"}
            </button>
          )}
          <label className="ms-fine" htmlFor="ms-ask-input">{micFailed ? "Type your question, or tap the 🎤 on the keyboard and say it:" : "Or type it:"}</label>
          <div className="row">
            <input id="ms-ask-input" className="ms-ask-input" value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); send(); } }} placeholder="What do I do first?" autoComplete="off" />
            <button className="ms-go small" onClick={send} disabled={!typed.trim() || busy}>Ask</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function StationHead({ id, story, onBack }) {
  const s = STATION[id];
  const { home } = useContext(BoltCtx);
  return (
    <div className="ms-head">
      <button className="ms-chip" onClick={() => onBack(null)}>← {home}</button>
      <h2 className="ms-h2">{s.emoji} {s.title}</h2>
      <p className="ms-story">{story} <button className="ms-say" onClick={() => speak(story)} aria-label="Read aloud">🔊</button></p>
    </div>
  );
}
export const Record = ({ r }) => { const { buddy } = useContext(BoltCtx); return r ? <div className={`ms-rec ${r.key}`}>{r.key === "independent" ? "⭐ On your own!" : r.key === "helped" ? `🤝 Solved with ${buddy.name}'s help` : "🔁 This kind of problem will come back later"}</div> : null; };

// ── Station 1: the reactor. Tap energy cells into the reactor to make an exact total ──
function Reactor({ st, record, calm, onBack }) {
  const [pz] = useState(() => reactorPuzzle(st.skills.mental.level));
  const item = useMemo(() => reactorItem(pz), [pz]);
  const [inside, setInside] = useState([]);
  const [msg, setMsg] = useState(null);
  const [first, setFirst] = useState(null);
  const [solved, setSolved] = useState(false);
  const [found, setFound] = useState([]);
  const [bonus, setBonus] = useState(false);
  const [help, setHelp] = useState([]);
  const [bounce, setBounce] = useState(-1);
  const t0 = useRef(Date.now());
  const sum = inside.reduce((s, i) => s + pz.cells[i], 0);
  const busy = solved && !bonus;
  const totalWays = useMemo(() => waysToMake(pz.cells, pz.target).length, [pz]);

  const count = (correct, given) => {
    if (first) return;
    const r = record("reactor", item, { correct, help, ms: Date.now() - t0.current, given, part: { answerType: "number", answer: String(pz.target) } });
    setFirst(r.support);
  };
  const tap = (i) => {
    if (busy) return;
    if (inside.includes(i)) { sfx.click(); setInside(inside.filter((x) => x !== i)); setMsg(null); return; }
    const v = pz.cells[i], ns = sum + v;
    if (ns > pz.target) {
      sfx.bump(); setBounce(i); setTimeout(() => setBounce(-1), 600);
      setMsg({ kind: "bad", text: `Overload! ${fmt(sum)} + ${fmt(v)} = ${fmt(ns)}. That's ${fmt(ns - pz.target)} too much, so the cell bounced out.` });
      if (!bonus) count(false, String(ns));
      return;
    }
    const ni = [...inside, i];
    setInside(ni);
    if (ns < pz.target) { sfx.load(); setMsg(null); return; }
    const mask = ni.reduce((m, k) => m | (1 << k), 0);
    if (bonus) {
      if (found.includes(mask)) { sfx.bump(); setMsg({ kind: "bad", text: "That's the same way as before. Try different cells!" }); return; }
      sfx.win(); setFound([...found, mask]); setBonus(false);
      setMsg({ kind: "good", text: `Another way! ${wayText(pz.cells, mask)} = ${fmt(pz.target)}. Bonus ⭐` });
      return;
    }
    sfx.power(); setSolved(true); setFound([mask]);
    setMsg({ kind: "good", text: `Reactor powered! ${wayText(pz.cells, mask)} = ${fmt(pz.target)}` });
    count(true, wayText(pz.cells, mask));
  };
  const anotherWay = () => { sfx.click(); setInside([]); setBonus(true); setMsg({ kind: "info", text: `Bolt: "Can you power it a different way? Use other cells to make ${fmt(pz.target)}."` }); };
  const pct = Math.min(100, (sum / pz.target) * 100);
  const showGap = help.includes("visual");

  return (
    <div className="ms-panel">
      <StationHead id="reactor" onBack={onBack} story={`The reactor needs exactly ${fmt(pz.target)} energy units. Tap energy cells to load them. Too much and the reactor overloads!`} />
      <div className={`ms-reactor ${solved && !bonus ? "full" : ""}`}>
        <div className="ms-meter" role="meter" aria-valuemin={0} aria-valuemax={pz.target} aria-valuenow={sum} aria-label="Reactor energy">
          <div className="ms-meter-fill" style={{ width: `${pct}%` }} />
          {showGap && sum < pz.target && <div className="ms-meter-gap" style={{ left: `${pct}%`, width: `${100 - pct}%` }}><span>needs {fmt(pz.target - sum)} more</span></div>}
          {Array.from({ length: 9 }, (_, k) => <i key={k} style={{ left: `${(k + 1) * 10}%` }} />)}
        </div>
        <div className="ms-meter-scale"><span>0</span><span>{fmt(pz.target / 2)}</span><span>{fmt(pz.target)}</span></div>
        <div className="ms-eq">{inside.length > 1 ? `${inside.map((i) => fmt(pz.cells[i])).join(" + ")} = ${fmt(sum)}` : inside.length ? fmt(sum) : "Reactor empty"} <span className="ms-eq-goal">of {fmt(pz.target)}</span></div>
      </div>
      <div className="ms-cells">
        {pz.cells.map((c, i) => (
          <button key={i} className={`ms-cell ${inside.includes(i) ? "in" : ""} ${bounce === i ? "bounce" : ""}`} onClick={() => tap(i)} disabled={busy} aria-pressed={inside.includes(i)}>
            <span className="ms-cell-bolt">⚡</span>{fmt(c)}
          </button>
        ))}
      </div>
      {msg && <div className={`ms-msg ${msg.kind}`} role="status">{msg.text}</div>}
      {!first && <Bolt used={help} onUse={(k) => setHelp((h) => [...new Set([...h, k])])}
        part={{ text: `The reactor needs exactly ${fmt(pz.target)} energy units. Energy cells: ${pz.cells.map(fmt).join(", ")}. Pick cells that add up to exactly ${fmt(pz.target)}.`, answer: pz.cells.filter((_, i) => (waysToMake(pz.cells, pz.target)[0] >> i) & 1).map(String), steps: waysToMake(pz.cells, pz.target).map((m) => `${wayText(pz.cells, m)} = ${fmt(pz.target)}`) }}
        hint={`Look for cells that make ${fmt(pz.target)} together. Load one cell, then ask yourself: how much more do I need to reach ${fmt(pz.target)}? Is there a cell that size?`}
        visual={<p>The striped part of the meter now shows how much more the reactor needs.</p>} />}
      <Record r={first} />
      {solved && (
        <div className="ms-actions">
          {!bonus && found.length < totalWays && <button className="ms-ghost" onClick={anotherWay}>⚡ Power it another way</button>}
          {!bonus && found.length > 1 && <span className="ms-fine">You found {found.length} ways!</span>}
          <button className="ms-go" onClick={() => onBack("reactor")}>Back to the ship ➜</button>
        </div>
      )}
    </div>
  );
}

// ── Station 2: the shield. Find the missing part (part + ? = whole) by subtracting ──
export function countUp(from, to) {
  const marks = [from];
  let cur = from;
  for (const step of [100, 1000, 10000, 100000]) {
    const n = Math.ceil(cur / step) * step;
    if (n > cur && n <= to) { marks.push(n); cur = n; }
  }
  const f = Math.floor(to / 1000) * 1000;
  if (f > cur) { marks.push(f); cur = f; }
  if (to > cur) marks.push(to);
  return marks;
}
function Shield({ st, world, record, calm, onBack }) {
  const [item] = useState(() => shieldItem(st.skills.subtract.level, world));
  const { whole, part } = item;
  const answer = whole - part;
  const [resp, setResp] = useState("");
  const [tries, setTries] = useState(0);
  const [phase, setPhase] = useState("work"); // work | fixed | revealed
  const [first, setFirst] = useState(null);
  const [help, setHelp] = useState([]);
  const [msg, setMsg] = useState(null);
  const colRef = useRef(null);
  const t0 = useRef(Date.now());

  const check = () => {
    if (phase !== "work" || !resp.trim()) return;
    const ok = isCorrect(item, resp);
    if (!first) { const r = record("shield", item, { correct: ok, help, ms: Date.now() - t0.current, given: resp }); setFirst(r.support); }
    if (ok) { sfx.power(); setPhase("fixed"); setMsg({ kind: "good", text: `Patched! ${fmt(part)} + ${fmt(answer)} = ${fmt(whole)}. The shield is whole again.` }); return; }
    sfx.bump();
    const n = tries + 1;
    setTries(n); setResp("");
    if (n >= 2) { setPhase("revealed"); setMsg({ kind: "info", text: `Bolt cut the patch for you: it's ${fmt(answer)} units. Here's how.` }); return; }
    setMsg({ kind: "bad", text: `That patch is the wrong size, so it fell off. Bolt drew the count-up below. Try again!` });
  };
  const onKey = useCallback((k) => colRef.current?.key(k), []);
  useHardwareKeys(onKey, check, phase === "work");
  const marks = countUp(part, whole);
  const showCount = help.includes("visual") || (phase === "work" && tries > 0) || phase === "revealed";
  const pct = (part / whole) * 100;

  return (
    <div className="ms-panel">
      <StationHead id="shield" onBack={onBack} story={`The shield needs ${fmt(whole)} units of force field to close. Right now it has ${fmt(part)}. How many units will patch the hole?`} />
      <div className="ms-shieldbar" aria-label={`Shield: ${fmt(part)} of ${fmt(whole)}`}>
        <div className="ms-sb-have" style={{ width: `${pct}%` }}><span>{fmt(part)}</span></div>
        <div className={`ms-sb-gap ${phase !== "work" ? "patched" : ""}`} style={{ width: `${100 - pct}%` }}><span>{phase !== "work" ? fmt(answer) : "?"}</span></div>
      </div>
      <div className="ms-sb-scale"><span>0</span><span>{fmt(whole)}</span></div>
      <div className="ms-eq big">{fmt(part)} + <b className="ms-q">{phase !== "work" ? fmt(answer) : "?"}</b> = {fmt(whole)}</div>
      {phase === "work" && (
        <>
          <p className="ms-fine center">Missing part = whole − the part you have. Work it out below.</p>
          <ColumnEntry key={tries} ref={colRef} column={item.column} onChange={setResp} disabled={phase !== "work"} />
          <div className="ms-actions center"><button className="ms-go" onClick={check}>Fire the patch ✓</button></div>
          <Keypad onKey={onKey} />
        </>
      )}
      {msg && <div className={`ms-msg ${msg.kind}`} role="status">{msg.text}</div>}
      {showCount && (
        <div className="ms-visual">
          <p className="ms-fine">Bolt counts up from {fmt(part)} to {fmt(whole)} in friendly jumps:</p>
          <div className="ms-jumps">{marks.map((m, i) => <span key={i} className="ms-jump">{i > 0 && <em>+{fmt(m - marks[i - 1])}</em>}<b>{fmt(m)}</b></span>)}</div>
          {phase === "work" && <p className="ms-fine">Add up the jumps. Does your patch match?</p>}
        </div>
      )}
      {phase === "work" && !first && <Bolt used={help} onUse={(k) => setHelp((h) => [...new Set([...h, k])])} hint={item.hint} visual={null}
        part={{ text: `The shield needs ${fmt(whole)} units. It has ${fmt(part)}. ${fmt(part)} + ? = ${fmt(whole)}. She can subtract ${fmt(whole)} − ${fmt(part)} in columns.`, answer: item.answer, steps: item.steps }} />}
      {phase === "revealed" && <ol className="ms-steps">{item.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
      <Record r={first} />
      {phase !== "work" && <div className="ms-actions"><button className="ms-go" onClick={() => onBack("shield")}>Back to the ship ➜</button></div>}
    </div>
  );
}

// ── Station 3: the star gate. Use a relationship to choose, then fly ──
function Gate({ st, record, calm, onBack }) {
  const [pz] = useState(() => gatePuzzle(st.skills.estimate.level));
  const item = useMemo(() => gateItem(pz), [pz]);
  const [tried, setTried] = useState([]);
  const [flying, setFlying] = useState(null);
  const [phase, setPhase] = useState("choose"); // choose | flying | bumped | through
  const [first, setFirst] = useState(null);
  const [help, setHelp] = useState([]);
  const [msg, setMsg] = useState(null);
  const t0 = useRef(Date.now());
  const firstRef = useRef(false);

  const choose = (c) => {
    if (phase === "flying" || phase === "through" || tried.includes(c)) return;
    sfx.load(); setFlying(c); setPhase("flying"); setMsg(null);
    setTimeout(() => {
      const ok = inGate(pz, c), total = pz.charge + c;
      if (!firstRef.current) { firstRef.current = true; const r = record("gate", item, { correct: ok, help, ms: Date.now() - t0.current, given: `+${fmt(c)}`, part: { answerType: "number", answer: String(pz.good) } }); setFirst(r.support); }
      if (ok) { sfx.whoosh(); setPhase("through"); setMsg({ kind: "good", text: `${fmt(pz.charge)} + ${fmt(c)} = ${fmt(total)}. That's more than ${fmt(pz.lo)} and less than ${fmt(pz.hi)}. Through the gate!` }); return; }
      sfx.bump(); setTried((t) => [...t, c]); setPhase("bumped");
      const why = total === pz.lo ? `exactly ${fmt(pz.lo)}, right on the edge. The gate needs MORE than ${fmt(pz.lo)}.`
        : total === pz.hi ? `exactly ${fmt(pz.hi)}, right on the edge. The gate needs LESS than ${fmt(pz.hi)}.`
        : total < pz.lo ? `less than ${fmt(pz.lo)}, so the ship stopped short.` : `more than ${fmt(pz.hi)}, so the ship overshot.`;
      setMsg({ kind: "bad", text: `Bump! ${fmt(pz.charge)} + ${fmt(c)} = ${fmt(total)}. That's ${why} Pick another cell.` });
    }, calm ? 350 : 1300);
  };
  const lo = Math.min(pz.charge, pz.lo) - (pz.hi - pz.lo), hi = pz.hi + (pz.hi - pz.lo);
  const x = (n) => 4 + ((n - lo) / (hi - lo)) * 92;

  return (
    <div className="ms-panel">
      <StationHead id="gate" onBack={onBack} story={`The ship has ${fmt(pz.charge)} charge. The star gate opens only for a charge MORE than ${fmt(pz.lo)} and LESS than ${fmt(pz.hi)}. Which fuel cell gets you through?`} />
      <div className={`ms-space ${phase}`}>
        <div className="ms-gate"><span className="ms-gate-lbl">more than<br /><b>{fmt(pz.lo)}</b></span><div className="ms-ring" /><span className="ms-gate-lbl">less than<br /><b>{fmt(pz.hi)}</b></span></div>
        <div className="ms-rocket" aria-hidden="true">🚀</div>
        <div className="ms-charge">Charge: <b>{fmt(pz.charge)}</b>{flying && (phase === "flying" || phase === "through") ? ` + ${fmt(flying)}` : ""}</div>
      </div>
      <div className="ms-cells three">
        {pz.cells.map((c) => (
          <button key={c} className={`ms-cell fuel ${tried.includes(c) ? "used" : ""} ${flying === c && phase !== "bumped" ? "in" : ""}`} disabled={tried.includes(c) || phase === "through" || phase === "flying"} onClick={() => choose(c)}>
            <span className="ms-cell-bolt">🔋</span>+{fmt(c)}
          </button>
        ))}
      </div>
      {msg && <div className={`ms-msg ${msg.kind}`} role="status">{msg.text}</div>}
      {!first && <Bolt used={help} onUse={(k) => setHelp((h) => [...new Set([...h, k])])}
        part={{ text: `The ship has ${fmt(pz.charge)} charge. A gate opens only if the charge is more than ${fmt(pz.lo)} and less than ${fmt(pz.hi)}. Fuel cells: ${pz.cells.map((c) => "+" + fmt(c)).join(", ")}. Which one cell gets the ship through?`, answer: [String(pz.good), String(pz.charge + pz.good)], steps: pz.cells.map((c) => `${fmt(pz.charge)} + ${fmt(c)} = ${fmt(pz.charge + c)}`) }}
        hint={`Round each fuel cell to the nearest ${fmt(pz.round)} and add it to ${fmt(pz.charge)}. Which one lands between ${fmt(pz.lo)} and ${fmt(pz.hi)}? Landing exactly on ${fmt(pz.lo)} or ${fmt(pz.hi)} bumps the edge.`}
        visual={(
          <svg viewBox="0 0 100 26" className="ms-nl" role="img" aria-label={`Number line: the ship at ${fmt(pz.charge)}, the gate from ${fmt(pz.lo)} to ${fmt(pz.hi)}`}>
            <line x1="2" y1="12" x2="98" y2="12" className="ms-nl-line" />
            <rect x={x(pz.lo)} y="6" width={x(pz.hi) - x(pz.lo)} height="12" className="ms-nl-gate" />
            <circle cx={x(pz.charge)} cy="12" r="1.8" className="ms-nl-ship" />
            <text x={x(pz.charge)} y="24" textAnchor="middle" className="ms-nl-txt">🚀 {fmt(pz.charge)}</text>
            <text x={x(pz.lo)} y="4.5" textAnchor="middle" className="ms-nl-txt">{fmt(pz.lo)}</text>
            <text x={x(pz.hi)} y="4.5" textAnchor="middle" className="ms-nl-txt">{fmt(pz.hi)}</text>
          </svg>
        )} />}
      <Record r={first} />
      {phase === "through" && <div className="ms-actions"><button className="ms-go" onClick={() => onBack("gate")}>Back to the ship ➜</button></div>}
    </div>
  );
}

// ── The payoff: the fixed ship flies home ──
function Finale({ M, name, log, calm, onAgain, onShip }) {
  const own = log.filter((e) => e.support.key === "independent").length;
  const helped = log.filter((e) => e.support.key === "helped").length;
  const back = log.filter((e) => e.support.key === "missed").length;
  return (
    <div className="ms-panel ms-finale">
      <Scene M={M} done={{}} calm={calm} finale />
      <h1 className="ms-title">Mission complete!</h1>
      <p className="ms-story">{M.finale(name)}</p>
      <div className="ms-tally">
        <div><b>{own}</b><span>on your own</span></div>
        <div><b>{helped}</b><span>with {(M.buddy || { name: "Bolt" }).name}'s help</span></div>
        <div><b>{back}</b><span>coming back to practice</span></div>
      </div>
      <div className="ms-actions center">
        <button className="ms-ghost" onClick={onShip}>Back to the {(M.home || "Ship").toLowerCase()}</button>
        <button className="ms-go" onClick={onAgain}>Play again with new numbers 🚀</button>
      </div>
    </div>
  );
}

// ══ Mission 2 stations ═══════════════════════════════════════════════════════
const addHelp = (setHelp) => (k) => setHelp((h) => [...new Set([...h, k])]);

// ── Load the cargo bay: an area model. Each section is rows × one place-value part ──
function Cargo({ st, world, record, calm, onBack }) {
  const [item] = useState(() => cargoItem(st.skills.multiply.level, world));
  const { rows, n, parts } = item;
  const nBox = parts.length + 1;
  const [vals, setVals] = useState(() => Array(nBox).fill(""));
  const [locked, setLocked] = useState(() => Array(nBox).fill(false));
  const [active, setActive] = useState(0);
  const [tries, setTries] = useState(0);
  const [phase, setPhase] = useState("work"); // work | loaded | revealed
  const [first, setFirst] = useState(null);
  const [help, setHelp] = useState([]);
  const [msg, setMsg] = useState(null);
  const [shake, setShake] = useState([]);
  const t0 = useRef(Date.now());
  const ans = item.answer.map(Number);

  const nextOpen = (from, lk = locked) => { for (let k = 1; k <= nBox; k++) { const j = (from + k) % nBox; if (!lk[j]) return j; } return from; };
  const onKey = useCallback((k) => {
    if (phase !== "work" || locked[active]) return;
    setVals((v) => v.map((x, i) => (i !== active ? x : k === "⌫" ? x.slice(0, -1) : /\d/.test(k) ? (x + k).slice(0, 7) : x)));
  }, [phase, locked, active]);
  const check = () => {
    if (phase !== "work") return;
    if (vals.some((v, i) => !locked[i] && !v)) { setMsg({ kind: "info", text: "Fill every box first. Tap a box to choose it." }); return; }
    const ok = vals.map((v, i) => Number(v) === ans[i]);
    if (!first) { const r = record("cargo", item, { correct: ok.every(Boolean), help, ms: Date.now() - t0.current, given: vals.map((v) => v || "?").join(", ") }); setFirst(r.support); }
    const lk = ok.map((o, i) => o || locked[i]);
    setLocked(lk);
    if (lk.every(Boolean)) { sfx.power(); setPhase("loaded"); setMsg({ kind: "good", text: `Cargo loaded! ${rows} × ${fmt(n)} = ${fmt(ans[nBox - 1])} crates.` }); return; }
    sfx.bump(); setShake(ok.map((o) => !o)); setTimeout(() => setShake([]), 600);
    const nt = tries + 1; setTries(nt);
    setVals((v) => v.map((x, i) => (lk[i] ? x : "")));
    if (nt >= 2) { setPhase("revealed"); setLocked(Array(nBox).fill(true)); setVals(ans.map(String)); setMsg({ kind: "info", text: "Bolt finished loading. Here's how each section works." }); return; }
    setActive(nextOpen(-1, lk));
    setMsg({ kind: "bad", text: `The sections with a ✓ are loaded. The empty ones fell off the forklift. Try those again!` });
  };
  useHardwareKeys(onKey, check, phase === "work");
  const grow = parts.map((p) => String(p).length); // bigger places get wider sections, small ones stay tappable
  const placeName = (p) => { const z = String(p).length - 1; return ["ones", "tens", "hundreds", "thousands"][z]; };

  return (
    <div className="ms-panel">
      <StationHead id="cargo" onBack={onBack} story={`The hold has ${rows} rows. Each row holds ${fmt(n)} crates. Split the hold into sections, fill each one, then add them up to load all the crates.`} />
      <div className="ms-eq big">{rows} × {fmt(n)} = {phase !== "work" ? fmt(ans[nBox - 1]) : "?"}</div>
      <div className="ms-hold" role="group" aria-label={`Area model: ${rows} rows by ${parts.map(fmt).join(" + ")}`}>
        <div className="ms-hold-rows"><b>{rows}</b><span>rows</span></div>
        {parts.map((p, i) => (
          <div key={i} className={`ms-sec ${locked[i] ? "ok" : ""} ${active === i && phase === "work" && !locked[i] ? "on" : ""} ${shake[i] ? "shake" : ""}`} style={{ flexGrow: grow[i] }}>
            <div className="ms-sec-top">{fmt(p)}</div>
            <button className="ms-sec-body" onClick={() => !locked[i] && phase === "work" && setActive(i)} disabled={locked[i] || phase !== "work"} aria-label={`${rows} times ${fmt(p)}`}>
              {locked[i] && <span className="ms-crates" aria-hidden="true">{"📦".repeat(Math.min(rows, 6))}</span>}
              <span className="ms-sec-q">{rows} × {fmt(p)}</span>
              <span className="ms-box">{vals[i] ? fmt(vals[i]) : " "}{locked[i] && " ✓"}</span>
            </button>
          </div>
        ))}
      </div>
      <button className={`ms-total ${locked[nBox - 1] ? "ok" : ""} ${active === nBox - 1 && phase === "work" && !locked[nBox - 1] ? "on" : ""} ${shake[nBox - 1] ? "shake" : ""}`} onClick={() => !locked[nBox - 1] && phase === "work" && setActive(nBox - 1)} disabled={locked[nBox - 1] || phase !== "work"}>
        <span>Total crates: add the sections</span><span className="ms-box">{vals[nBox - 1] ? fmt(vals[nBox - 1]) : " "}{locked[nBox - 1] && " ✓"}</span>
      </button>
      {phase === "work" && (<>
        <div className="ms-actions center"><button className="ms-go" onClick={check}>Load the crates ✓</button></div>
        <Keypad onKey={onKey} />
      </>)}
      {msg && <div className={`ms-msg ${msg.kind}`} role="status">{msg.text}</div>}
      {phase === "work" && !first && <Bolt used={help} onUse={addHelp(setHelp)} hint={item.hint}
        part={{ text: `${rows} × ${fmt(n)} using partial products: ${parts.map((p) => `${rows} × ${fmt(p)}`).join(", ")}, then the total.`, answer: item.answer, steps: item.steps }}
        visual={<ul className="ms-pv">{parts.map((p, i) => <li key={i}>{rows} × {fmt(p)} is {rows} × {String(p)[0]} {placeName(p)}</li>)}</ul>} />}
      {phase === "revealed" && <ol className="ms-steps">{item.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>}
      <Record r={first} />
      {phase !== "work" && <div className="ms-actions"><button className="ms-go" onClick={() => onBack("cargo")}>Back to the ship ➜</button></div>}
    </div>
  );
}

// ── Balance the ship: pick loads that weigh the same as the other side ──
function Balance({ st, record, calm, onBack }) {
  const [pz] = useState(() => balancePuzzle(st.skills.mental.level));
  const item = useMemo(() => balanceItem(pz), [pz]);
  const [on, setOn] = useState(null); // load index on the right pan
  const [tried, setTried] = useState([]);
  const [found, setFound] = useState([]);
  const [first, setFirst] = useState(null);
  const [help, setHelp] = useState([]);
  const [msg, setMsg] = useState(null);
  const [bonus, setBonus] = useState(false);
  const t0 = useRef(Date.now());
  const balanced = found.length > 0;
  const right = on === null ? 0 : pz.loads[on].c * pz.loads[on].m;
  const tilt = on === null ? -10 : right === pz.target ? 0 : right < pz.target ? -10 : 10;

  const place = (i) => {
    const l = pz.loads[i], w = l.c * l.m;
    if (tried.includes(i) || found.includes(i) || (balanced && !bonus)) return;
    sfx.load(); setOn(i);
    if (!first) { const r = record("balance", item, { correct: l.ok, help, ms: Date.now() - t0.current, given: `${l.c} × ${fmt(l.m)}`, part: { answerType: "number", answer: String(pz.target) } }); setFirst(r.support); }
    if (l.ok) {
      setTimeout(() => sfx.power(), 300);
      setFound((f) => [...f, i]); setBonus(false);
      setMsg({ kind: "good", text: bonus ? `Another match! ${l.c} × ${fmt(l.m)} = ${fmt(w)} too. Bonus ⭐` : `Balanced! ${l.c} × ${fmt(l.m)} = ${fmt(w)}, and ${pz.a} × ${fmt(pz.m)} = ${fmt(pz.target)}.` });
      return;
    }
    setTimeout(() => sfx.bump(), 300);
    setTried((t) => [...t, i]);
    setMsg({ kind: "bad", text: `${w < pz.target ? "Too light" : "Too heavy"}! ${l.c} × ${fmt(l.m)} = ${fmt(w)}, but the left side is ${pz.a} × ${fmt(pz.m)}. Try another load.` });
    setTimeout(() => setOn((o) => (o === i ? null : o)), calm ? 300 : 1400);
  };
  const zeros = String(pz.m).length - 1;
  const unit = ["", "tens", "hundreds", "thousands"][zeros];
  return (
    <div className="ms-panel">
      <StationHead id="balance" onBack={onBack} story={`The left cargo pod has ${pz.a} crates of ${fmt(pz.m)} kg. Put a load on the right pod that weighs exactly the same, or the ship will tip over.`} />
      <svg className="ms-scale" viewBox="0 0 320 150" role="img" aria-label={on === null ? "The ship tips to the left" : tilt === 0 ? "The ship is balanced" : `The ship tips ${tilt < 0 ? "left" : "right"}`}>
        <path d="M160 140 L145 110 L175 110 Z" className="ms-pivot" />
        <g className="ms-beam" style={{ transform: `rotate(${tilt}deg)`, transformOrigin: "160px 108px" }}>
          <rect x="30" y="104" width="260" height="8" rx="4" className="ms-beam-bar" />
          <rect x="28" y="70" width="90" height="34" rx="8" className="ms-pod" /><text x="73" y="93" textAnchor="middle" className="ms-pod-txt">{pz.a} × {fmt(pz.m)}</text>
          <rect x="202" y="70" width="90" height="34" rx="8" className={`ms-pod ${on === null ? "empty" : ""}`} /><text x="247" y="93" textAnchor="middle" className="ms-pod-txt">{on === null ? "?" : `${pz.loads[on].c} × ${fmt(pz.loads[on].m)}`}</text>
        </g>
        {tilt === 0 && <text x="160" y="30" textAnchor="middle" className="ms-label">BALANCED</text>}
      </svg>
      <div className="ms-cells two">
        {pz.loads.map((l, i) => (
          <button key={i} className={`ms-cell ${found.includes(i) ? "in" : ""} ${tried.includes(i) ? "used" : ""}`} disabled={tried.includes(i) || found.includes(i) || (balanced && !bonus)} onClick={() => place(i)}>
            <span className="ms-cell-bolt">📦</span>{l.c} × {fmt(l.m)}
          </button>
        ))}
      </div>
      {msg && <div className={`ms-msg ${msg.kind}`} role="status">{msg.text}</div>}
      {!first && <Bolt used={help} onUse={addHelp(setHelp)}
        hint={`Work out the left side first: ${pz.a} × ${fmt(pz.m)} is ${pz.a} × ${String(pz.m)[0]} ${unit}. Then check each load the same way.`}
        part={{ text: `The left side is ${pz.a} × ${fmt(pz.m)}. Which loads weigh the same? Loads: ${pz.loads.map((l) => `${l.c} × ${fmt(l.m)}`).join(", ")}.`, answer: pz.loads.filter((l) => l.ok).map((l) => `${l.c} × ${l.m}`), steps: pz.loads.map((l) => `${l.c} × ${fmt(l.m)} = ${fmt(l.c * l.m)}`) }}
        visual={<p>{pz.a} × {fmt(pz.m)} = {pz.a} × {String(pz.m)[0]} {unit} = {pz.a * Number(String(pz.m)[0])} {unit}. Count the zeros: each load needs the same number of {unit === "tens" ? "tens" : unit} in total.</p>} />}
      <Record r={first} />
      {balanced && !bonus && (
        <div className="ms-actions">
          {found.length < pz.loads.filter((l) => l.ok).length && <button className="ms-ghost" onClick={() => { sfx.click(); setBonus(true); setOn(null); setMsg({ kind: "info", text: `Bolt: "One more load also balances. Can you find it?"` }); }}>⚖️ Find the other match</button>}
          <button className="ms-go" onClick={() => onBack("balance")}>Back to the ship ➜</button>
        </div>
      )}
    </div>
  );
}

// ── Land the cargo: estimate each load and decide if the lander can carry it ──
function Land({ st, record, calm, onBack }) {
  const [pz] = useState(() => landPuzzle(st.skills.estimate.level));
  const item = useMemo(() => landItem(pz), [pz]);
  const [verdict, setVerdict] = useState(() => pz.loads.map(() => null)); // "fits" | "heavy" once sorted right
  const [firstPick, setFirstPick] = useState(() => pz.loads.map(() => null));
  const [wrongAt, setWrongAt] = useState(-1);
  const [first, setFirst] = useState(null);
  const [help, setHelp] = useState([]);
  const [msg, setMsg] = useState(null);
  const t0 = useRef(Date.now());
  const done = verdict.every(Boolean);
  const placeWord = pz.place === 100 ? "hundred" : "ten";

  const decide = (i, says) => {
    if (verdict[i]) return;
    const l = pz.loads[i], right = (says === "fits") === l.fits;
    const fp = firstPick[i] ? firstPick[i] : says;
    const nfp = firstPick.map((x, j) => (j === i ? fp : x));
    setFirstPick(nfp);
    if (!first) {
      const anyWrong = nfp.some((x, j) => x && (x === "fits") !== pz.loads[j].fits);
      if (anyWrong || nfp.every(Boolean)) {
        const r = record("land", item, { correct: !anyWrong, help, ms: Date.now() - t0.current, given: nfp.map((x, j) => `${pz.loads[j].c} × ${fmt(pz.loads[j].w)}: ${x || "?"}`).join("; "), part: { answerType: "number", answer: String(pz.limit) } });
        setFirst(r.support);
      }
    }
    const est = l.c * roundTo(l.w, pz.place);
    if (right) {
      sfx[l.fits ? "load" : "click"]();
      const nv = verdict.map((x, j) => (j === i ? (l.fits ? "fits" : "heavy") : x));
      setVerdict(nv); setWrongAt(-1);
      if (nv.every(Boolean)) { sfx.whoosh(); setMsg({ kind: "good", text: `Every load sorted! The lander carried the light ones down to Mars Base.` }); }
      else setMsg({ kind: "good", text: `${l.fits ? "Loaded" : "Set aside"}: ${l.c} × ${fmt(l.w)} is about ${l.c} × ${fmt(roundTo(l.w, pz.place))} = ${fmt(est)}.` });
      return;
    }
    sfx.bump(); setWrongAt(i); setTimeout(() => setWrongAt(-1), 600);
    setMsg({ kind: "bad", text: `Bolt checks: ${l.c} × ${fmt(l.w)} is about ${l.c} × ${fmt(roundTo(l.w, pz.place))} = ${fmt(est)}. That's ${est < pz.limit ? "less" : "more"} than ${fmt(pz.limit)}, so it ${l.fits ? "fits" : "is too heavy"}. Try that load again!` });
  };
  return (
    <div className="ms-panel">
      <StationHead id="land" onBack={onBack} story={`The lander can carry less than ${fmt(pz.limit)} kg on each trip. Estimate each load. Does it fit, or is it too heavy?`} />
      <div className={`ms-lander ${done ? "down" : ""}`}>
        <span className="ms-lander-ship" aria-hidden="true">🛸</span>
        <div className="ms-lander-limit">Lander limit<br /><b>{fmt(pz.limit)} kg</b></div>
        <div className="ms-lander-hold">{verdict.map((v, i) => v === "fits" ? <span key={i} className="ms-crate-chip">📦 {pz.loads[i].c} × {fmt(pz.loads[i].w)}</span> : null)}</div>
      </div>
      <div className="ms-loads">
        {pz.loads.map((l, i) => (
          <div key={i} className={`ms-load ${verdict[i] || ""} ${wrongAt === i ? "shake" : ""}`}>
            <div className="ms-load-q"><span aria-hidden="true">📦</span> {l.c} crates × {fmt(l.w)} kg</div>
            {verdict[i] ? <div className="ms-load-v">{verdict[i] === "fits" ? "✓ Fits" : "✗ Too heavy"}</div> : (
              <div className="row">
                <button className="ms-chip yes" onClick={() => decide(i, "fits")}>✓ Fits</button>
                <button className="ms-chip no" onClick={() => decide(i, "heavy")}>✗ Too heavy</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {msg && <div className={`ms-msg ${msg.kind}`} role="status">{msg.text}</div>}
      {!first && <Bolt used={help} onUse={addHelp(setHelp)}
        hint={`Round each crate's weight to the nearest ${placeWord}, then multiply by the number of crates. Compare that with ${fmt(pz.limit)}.`}
        part={{ text: `The lander carries less than ${fmt(pz.limit)} kg. Loads: ${pz.loads.map((l) => `${l.c} crates of ${fmt(l.w)} kg`).join(", ")}. Which loads fit?`, answer: pz.loads.map((l) => String(l.total)), steps: pz.loads.map((l) => `${l.c} × ${fmt(l.w)} ≈ ${l.c} × ${fmt(roundTo(l.w, pz.place))} = ${fmt(l.c * roundTo(l.w, pz.place))} → ${l.fits ? "fits" : "too heavy"}`) }}
        visual={<ul className="ms-pv">{pz.loads.map((l, i) => <li key={i}>{l.c} × {fmt(l.w)} is about {l.c} × {fmt(roundTo(l.w, pz.place))}</li>)}</ul>} />}
      <Record r={first} />
      {done && <div className="ms-actions"><button className="ms-go" onClick={() => onBack("land")}>Back to the ship ➜</button></div>}
    </div>
  );
}
