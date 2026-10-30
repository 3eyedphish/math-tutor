import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { fmt } from "../engine/util.js";

// ── On-screen keypad (no device keyboard, no autocorrect) ───────────────────
export function Keypad({ onKey, allowR, allowDot }) {
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", allowR ? "R" : allowDot ? "." : "", "0", "⌫"];
  const up = (e) => e.currentTarget.classList.remove("down");
  return (
    <div className="keypad">
      {/* Keys fire on touch-down, not on release: quicker, and quick taps aren't merged or dropped.
          A click with detail 0 comes from a keyboard or switch control. */}
      {keys.map((k, i) => k ? <button key={i} className={`key ${k === "⌫" ? "key-del" : ""}`} onPointerDown={(e) => { e.preventDefault(); e.currentTarget.classList.add("down"); onKey(k); }} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} onClick={(e) => { if (e.detail === 0) onKey(k); }}>{k}</button> : <span key={i} />)}
    </div>
  );
}
// Physical keyboards still work (handy on a laptop).
export function useHardwareKeys(onKey, onEnter, active) {
  useEffect(() => {
    if (!active) return;
    const h = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "")) return; // typing in the help box
      if (/^[0-9]$/.test(e.key)) onKey(e.key);
      else if (e.key === "Backspace") onKey("⌫");
      else if (e.key === "r" || e.key === "R") onKey("R");
      else if (e.key === ".") onKey(".");
      else if (e.key === "Enter") onEnter();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onKey, onEnter, active]);
}
// One keypress applied to what she has typed so far ("r" = remainder, "." = decimal point).
export const editTyped = (v, k, max = 9) =>
  k === "⌫" ? v.slice(0, -1)
  : k === "R" ? (v && !v.includes("r") && !v.includes(".") ? v + "r" : v)
  : k === "." ? (!v.includes(".") && !v.includes("r") ? (v || "0") + "." : v)
  : (v + k).slice(0, max);
export const showTyped = (s) => {
  if (!s) return "";
  if (s.includes(".")) { const [w, f] = s.split("."); return `${w ? Number(w).toLocaleString("en-US") : "0"}.${f}`; }
  const [q, r] = s.split("r");
  const q2 = q ? Number(q).toLocaleString("en-US") : "";
  return r !== undefined ? `${q2} R ${r}` : q2;
};

// ── Column arithmetic (and missing-digit puzzles) ───────────────────────────
export function Column({ column }) {
  const fmtRow = (r) => (Array.isArray(r) ? groupChars(r) : fmt(r));
  const rows = column.rows.map(fmtRow);
  const result = column.result ? groupChars(column.result) : null;
  const width = Math.max(...rows.map((r) => r.length), result ? result.length : 0) + 2;
  const pad = (s) => s.padStart(width, " ");
  const cell = (s, key) => (
    <div key={key} className="col-row">{pad(s).split("").map((c, i) => (c === "A" || c === "B" ? <span key={i} className="col-box">{c}</span> : <span key={i} className="col-ch">{c === " " ? " " : c}</span>))}</div>
  );
  return (
    <div className="column">
      {rows.map((r, i) => cell(i === rows.length - 1 ? column.op + " " + r.trimStart() : r, i))}
      <div className="col-line" />
      {result ? cell(result, "res") : <div className="col-row">&nbsp;</div>}
    </div>
  );
}
// ── Column entry: answer typed right to left, like on paper ─────────────────
// Used for +/− problems with numeric rows. Answer boxes sit under each column and
// fill from the ones place leftward. Small boxes above each column are scratch
// space for carries (addition) or regrouped digits (subtraction); they aren't graded.
export const columnEntryFits = (part) =>
  part.answerType === "number" && part.column && !part.column.puzzle && part.column.rows.every((r) => typeof r === "number");

export const ColumnEntry = forwardRef(function ColumnEntry({ column, onChange, disabled, wrong }, ref) {
  const add = column.op === "+";
  const rows = column.rows.map(String);
  const W = Math.max(...rows.map((r) => r.length)) + (add ? 1 : 0);
  const [cells, setCells] = useState(() => Array(W).fill(""));
  const [marks, setMarks] = useState(() => Array(W).fill(""));
  const [focus, setFocus] = useState({ row: "ans", i: W - 1 });
  const lastAns = useRef({ row: "ans", i: W - 1 });

  const emit = (c) => onChange(c.join(""));
  useImperativeHandle(ref, () => ({
    key(k) {
      if (disabled) return;
      if (focus.row === "mark") {
        const i = focus.i;
        if (k === "⌫") { setMarks((m) => m.map((v, j) => (j === i ? v.slice(0, -1) : v))); return; }
        if (!/^\d$/.test(k)) return;
        const nv = (marks[i] + k).slice(0, 2);
        setMarks((m) => m.map((v, j) => (j === i ? nv : v)));
        // A carry is one digit. A regrouped digit can be two (like 13), and two-digit ones
        // always start with 1, so only a lone "1" waits for a possible second digit.
        if (add || nv.length === 2 || nv !== "1") setFocus(lastAns.current);
        return;
      }
      let i = focus.i;
      if (k === "⌫") {
        const c = [...cells];
        if (c[i] === "" && i < W - 1) i += 1;
        c[i] = "";
        setCells(c); emit(c); setFocus({ row: "ans", i });
        lastAns.current = { row: "ans", i };
        return;
      }
      if (!/^\d$/.test(k)) return;
      const c = [...cells];
      c[i] = k;
      setCells(c); emit(c);
      const ni = Math.max(0, i - 1);
      lastAns.current = { row: "ans", i: ni };
      setFocus({ row: "ans", i: ni });
    },
  }));

  const digitAt = (r, i) => { const off = W - r.length; return i >= off ? r[i - off] : ""; };
  const group = (i) => (i > 0 && (W - i) % 3 === 0 ? " grp" : "");
  const activeCol = focus.i;
  const tap = (row, i) => { if (disabled) return; setFocus({ row, i }); if (row === "ans") lastAns.current = { row, i }; };

  return (
    <div className={`colentry ${wrong ? "shake" : ""}`} aria-label="Work the problem column by column">
      <div className="ce-row">
        <span className="ce-op" />
        {Array.from({ length: W }, (_, i) => (
          <button key={i} className={`ce-mark${group(i)}${focus.row === "mark" && focus.i === i ? " on" : ""}`} onClick={() => tap("mark", i)} aria-label={add ? "carry box" : "regroup box"}>{marks[i]}</button>
        ))}
      </div>
      {rows.map((r, ri) => (
        <div className="ce-row" key={ri}>
          <span className="ce-op">{ri === rows.length - 1 && W - r.length < 1 ? column.op : ""}</span>
          {Array.from({ length: W }, (_, i) => <span key={i} className={`ce-dig${group(i)}${i === activeCol ? " hot" : ""}`}>{ri === rows.length - 1 && i === W - r.length - 1 ? column.op : digitAt(r, i)}</span>)}
        </div>
      ))}
      <div className="ce-line" />
      <div className="ce-row">
        <span className="ce-op" />
        {cells.map((v, i) => (
          <button key={i} className={`ce-ans${group(i)}${focus.row === "ans" && focus.i === i && !disabled ? " on" : ""}`} onClick={() => tap("ans", i)} aria-label="answer digit">{v}</button>
        ))}
      </div>
      {!disabled && <div className="ce-tip">{add ? "Start with the ones ➜ fill boxes right to left. Tap a small box on top to write a carry." : "Start with the ones ➜ fill boxes right to left. Tap a small box on top to write a regrouped number."}</div>}
    </div>
  );
});

// Insert thousands commas into a char array that may contain letters.
function groupChars(chars) {
  const out = [];
  chars.forEach((c, i) => { const fromEnd = chars.length - i; out.push(c); if (fromEnd > 1 && (fromEnd - 1) % 3 === 0) out.push(","); });
  return out.join("");
}

export function DataTable({ table }) {
  return (
    <div className="table-wrap">
      <div className="table-title">{table.title}</div>
      <table className="data">
        <thead><tr>{table.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

// ── Visuals ─────────────────────────────────────────────────────────────────
export function Visual({ v }) {
  if (v.kind === "numberline") return <NumberLine {...v} />;
  if (v.kind === "array") return <ArrayDots {...v} />;
  if (v.kind === "rect") return <Rect {...v} />;
  if (v.kind === "placevalue") return <PlaceValue {...v} />;
  if (v.kind === "fracbar") return <FracBar {...v} />;
  if (v.kind === "lineplot") return <LinePlot {...v} />;
  if (v.kind === "angle") return <Angle {...v} />;
  if (v.kind === "areaSplit") return <AreaSplit {...v} />;
  if (v.kind === "scale") return <Scale {...v} />;
  if (v.kind === "ratio") return <Ratio {...v} />;
  return null;
}
// A grid of squares cut into coloured blocks at the split columns (12 = 10 + 2).
function AreaSplit({ rows, cols, splits = [] }) {
  const s = Math.min(22, 300 / cols), W = cols * s, H = rows * s;
  const edges = [0, ...splits, cols];
  return (
    <svg viewBox={`-24 -22 ${W + 34} ${H + 30}`} className="visual" style={{ maxHeight: 240 }} role="img" aria-label={`${rows} rows of ${cols}${splits.length ? `, split into ${edges.slice(1).map((e, i) => e - edges[i]).join(" and ")}` : ""}`}>
      {edges.slice(1).map((e, i) => <rect key={i} x={edges[i] * s} y="0" width={(e - edges[i]) * s} height={H} className={i % 2 ? "as-b" : "as-a"} />)}
      {Array.from({ length: cols - 1 }, (_, i) => <line key={`v${i}`} x1={(i + 1) * s} y1="0" x2={(i + 1) * s} y2={H} className="rect-grid" />)}
      {Array.from({ length: rows - 1 }, (_, i) => <line key={`h${i}`} x1="0" y1={(i + 1) * s} x2={W} y2={(i + 1) * s} className="rect-grid" />)}
      {splits.map((c) => <line key={c} x1={c * s} y1="-4" x2={c * s} y2={H + 4} className="as-cut" />)}
      {edges.slice(1).map((e, i) => <text key={i} x={((e + edges[i]) / 2) * s} y="-7" textAnchor="middle" className="rect-label">{e - edges[i]}</text>)}
      <text x="-8" y={H / 2 + 5} textAnchor="end" className="rect-label">{rows}</text>
    </svg>
  );
}
// A small rectangle (with its squares) beside a stretched or scaled copy.
function Scale({ w, h, kw = 1, kh = 1, hideBig }) {
  const BW = w * kw, BH = h * kh;
  const s = Math.min(24, 300 / (w + BW + 2), 200 / Math.max(h, BH));
  const gap = 2 * s + 34, top = 22, bx = w * s + gap;
  return (
    <svg viewBox={`-6 0 ${bx + BW * s + 40} ${top + Math.max(h, BH) * s + 10}`} className="visual" style={{ maxHeight: 260 }} role="img" aria-label={`A ${w} by ${h} rectangle and a ${BW} by ${hideBig === "h" ? "unknown" : BH} rectangle`}>
      <rect x="0" y={top} width={w * s} height={h * s} className="rect-shape" />
      {Array.from({ length: w - 1 }, (_, i) => <line key={`v${i}`} x1={(i + 1) * s} y1={top} x2={(i + 1) * s} y2={top + h * s} className="rect-grid" />)}
      {Array.from({ length: h - 1 }, (_, i) => <line key={`h${i}`} x1="0" y1={top + (i + 1) * s} x2={w * s} y2={top + (i + 1) * s} className="rect-grid" />)}
      <text x={(w * s) / 2} y={top - 6} textAnchor="middle" className="sc-label">{w}</text>
      <text x={w * s + 4} y={top + (h * s) / 2 + 5} className="sc-label">{h}</text>
      <text x={w * s + gap / 2 + 8} y={top + (h * s) / 2 + 5} textAnchor="middle" className="sc-arrow">→</text>
      <rect x={bx} y={top} width={BW * s} height={BH * s} className="sc-big" />
      <text x={bx + (BW * s) / 2} y={top - 6} textAnchor="middle" className="sc-label">{BW}</text>
      <text x={bx + BW * s + 4} y={top + (BH * s) / 2 + 5} className={hideBig === "h" ? "sc-label sc-q" : "sc-label"}>{hideBig === "h" ? "?" : BH}</text>
    </svg>
  );
}
// One group of a repeating pattern: a blue tiles and b gold tiles.
function Ratio({ a, b }) {
  const s = 30, n = a + b, W = n * s + (s / 2);
  return (
    <svg viewBox={`-6 -6 ${W + 12} ${s + 34}`} className="visual" style={{ maxHeight: 110 }} role="img" aria-label={`One group: ${a} blue and ${b} gold tiles`}>
      <rect x="-4" y="-4" width={W + 8} height={s + 8} rx="8" className="rt-box" />
      {Array.from({ length: n }, (_, i) => <rect key={i} x={i * s + (i >= a ? s / 2 : 0) + 2} y="2" width={s - 4} height={s - 4} rx="5" className={i < a ? "rt-blue" : "rt-gold"} />)}
      <text x={W / 2} y={s + 24} textAnchor="middle" className="rect-label">1 group: {a} blue, {b} gold</text>
    </svg>
  );
}
// A bar cut into d equal parts with n shaded.
function FracBar({ n, d, label = true }) {
  const W = 300, w = W / d;
  return (
    <svg viewBox={`0 0 ${W + 10} 56`} className="visual" style={{ maxHeight: 90 }} role="img" aria-label={`${n} of ${d} equal parts shaded`}>
      {Array.from({ length: d }, (_, i) => <rect key={i} x={5 + i * w} y="5" width={w} height="34" className={i < n ? "fb-on" : "fb-off"} />)}
      {label && <text x={W / 2 + 5} y="53" textAnchor="middle" className="nl-text">{n}/{d}</text>}
    </svg>
  );
}
// X marks stacked over each label on a number line.
function LinePlot({ title, points }) {
  const W = 320, step = (W - 40) / Math.max(1, points.length - 1), top = Math.max(...points.map((p) => p.n), 1), H = 40 + top * 18 + 40;
  const x = (i) => 20 + i * step, base = H - 36;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="visual" style={{ maxHeight: 260 }} role="img" aria-label={`Line plot: ${points.map((p) => `${p.n} at ${p.label}`).join(", ")}`}>
      <text x={W / 2} y="16" textAnchor="middle" className="lp-title">{title}</text>
      <line x1="10" y1={base} x2={W - 10} y2={base} className="nl-line" />
      {points.map((p, i) => (
        <g key={i}>
          <line x1={x(i)} y1={base - 6} x2={x(i)} y2={base + 6} className="nl-line" />
          <text x={x(i)} y={base + 24} textAnchor="middle" className="nl-text">{p.label}</text>
          {Array.from({ length: p.n }, (_, j) => <text key={j} x={x(i)} y={base - 10 - j * 18} textAnchor="middle" className="lp-x">✕</text>)}
        </g>
      ))}
    </svg>
  );
}
// An angle opening counter-clockwise from a flat ray; split draws the ray between two parts.
function Angle({ deg, split }) {
  const cx = 150, cy = 120, R = 100;
  const pt = (a, r = R) => [cx + r * Math.cos((a * Math.PI) / 180), cy - r * Math.sin((a * Math.PI) / 180)];
  const arc = (a0, a1, r) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r); return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${x1} ${y1}`; };
  const [ex, ey] = pt(deg), lab = (a0, a1, r) => pt((a0 + a1) / 2, r);
  const big = deg > 180;
  return (
    <svg viewBox={`0 ${big ? 0 : 0} 300 ${big ? 240 : 140}`} className="visual" style={{ maxHeight: 200 }} role="img" aria-label={`An angle of ${deg} degrees`}>
      <line x1={cx} y1={cy} x2={cx + R} y2={cy} className="ang-ray" />
      <line x1={cx} y1={cy} x2={ex} y2={ey} className="ang-ray" />
      {deg === 90 && !split ? <path d={`M ${cx + 16} ${cy} L ${cx + 16} ${cy - 16} L ${cx} ${cy - 16}`} className="ang-arc" />
        : !split && <path d={arc(0, deg, 30)} className="ang-arc" />}
      {split ? (<>
        <line x1={cx} y1={cy} x2={pt(split)[0]} y2={pt(split)[1]} className="ang-ray ang-split" />
        <path d={arc(0, split, 30)} className="ang-arc" /><path d={arc(split, deg, 44)} className="ang-arc ang-arc2" />
        <text x={lab(0, split, 62)[0]} y={lab(0, split, 62)[1] + 5} textAnchor="middle" className="nl-text">{split}°</text>
      </>) : null}
      <circle cx={cx} cy={cy} r="4" className="nl-dot" />
    </svg>
  );
}
function NumberLine({ lo, hi, value }) {
  const W = 320, x = (n) => 20 + ((n - lo) / (hi - lo)) * (W - 40);
  const mid = (lo + hi) / 2;
  return (
    <svg viewBox={`0 0 ${W} 80`} className="visual" role="img" aria-label={`Number line from ${lo} to ${hi}`}>
      <line x1="20" y1="40" x2={W - 20} y2="40" className="nl-line" />
      {[lo, mid, hi].map((n, i) => (
        <g key={i}><line x1={x(n)} y1="32" x2={x(n)} y2="48" className="nl-line" /><text x={x(n)} y="68" textAnchor="middle" className={i === 1 ? "nl-mid" : "nl-text"}>{fmt(n)}</text></g>
      ))}
      <circle cx={x(value)} cy="40" r="7" className="nl-dot" />
      <text x={x(value)} y="22" textAnchor="middle" className="nl-val">{fmt(value)}</text>
    </svg>
  );
}
function ArrayDots({ rows, cols }) {
  const r = Math.min(rows, 12), c = Math.min(cols, 12), s = 18;
  return (
    <svg viewBox={`0 0 ${c * s + 10} ${r * s + 10}`} className="visual" style={{ maxHeight: 200 }} role="img" aria-label={`${rows} rows of ${cols}`}>
      {Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => <circle key={`${i}-${j}`} cx={5 + j * s + s / 2} cy={5 + i * s + s / 2} r={s * 0.32} className={j % 5 === 4 ? "dot dot-alt" : "dot"} />))}
    </svg>
  );
}
export function Rect({ w, h, grid, unit, small }) {
  const s = small ? 9 : 22, W = w * s, H = h * s;
  return (
    <svg viewBox={`-30 -24 ${W + 60} ${H + 40}`} className={small ? "visual-small" : "visual"} style={{ maxHeight: small ? 70 : 220 }} role="img" aria-label={`${w} by ${h} rectangle`}>
      <rect x="0" y="0" width={W} height={H} className="rect-shape" />
      {grid && Array.from({ length: w - 1 }, (_, i) => <line key={`v${i}`} x1={(i + 1) * s} y1="0" x2={(i + 1) * s} y2={H} className="rect-grid" />)}
      {grid && Array.from({ length: h - 1 }, (_, i) => <line key={`h${i}`} x1="0" y1={(i + 1) * s} x2={W} y2={(i + 1) * s} className="rect-grid" />)}
      <text x={W / 2} y="-8" textAnchor="middle" className="rect-label">{w} {unit}</text>
      <text x={W + 6} y={H / 2 + 5} className="rect-label">{h} {unit}</text>
    </svg>
  );
}
function PlaceValue({ nums, op }) {
  const len = Math.max(...nums.map((n) => String(n).length));
  const names = ["Ones", "Tens", "Hundreds", "Thousands", "Ten Th."].slice(0, len).reverse();
  return (
    <table className="pv">
      <thead><tr><th></th>{names.map((n) => <th key={n}>{n}</th>)}</tr></thead>
      <tbody>{nums.map((n, i) => (
        <tr key={i}><td className="pv-op">{i === nums.length - 1 ? op : ""}</td>{String(n).padStart(len, " ").split("").map((d, j) => <td key={j}>{d.trim()}</td>)}</tr>
      ))}</tbody>
    </table>
  );
}

// ── Answer widgets ──────────────────────────────────────────────────────────
export function Choices({ choices, value, onPick, disabled }) {
  return (
    <div className="choices">
      {choices.map((c) => <button key={c} disabled={disabled} className={`choice ${value === c ? "chosen" : ""}`} onClick={() => onPick(c)}>{c}</button>)}
    </div>
  );
}
export function MultiSelect({ choices, value, onToggle, disabled, shapes }) {
  return (
    <div className="choices">
      {choices.map((c, i) => (
        <button key={c} disabled={disabled} className={`choice multi ${value.includes(c) ? "chosen" : ""}`} onClick={() => onToggle(c)}>
          <span className="check">{value.includes(c) ? "☑" : "☐"}</span>
          {shapes ? <Rect w={shapes[i][0]} h={shapes[i][1]} unit="cm" small /> : null}
          <span>{c}</span>
        </button>
      ))}
    </div>
  );
}
export function Blanks({ template, values, active, onFocus, joiner }) {
  return (
    <div className="blanks">
      {template.map((t, i) => {
        const bi = template.slice(0, i).filter((x) => x.label).length;
        const sep = joiner && i > 0 ? <span className="blank-join"> {joiner} </span> : null;
        if (t.fixed) return <span key={i}>{sep}<span className="blank-fixed">{t.fixed}</span></span>;
        const box = (
          <button className={`blank ${active === bi ? "blank-active" : ""}`} onClick={() => onFocus(bi)}>
            {t.label !== "?" && !t.pre && <span className="blank-label">{t.label}</span>}{values[bi] ? showTyped(values[bi]) : " "}
          </button>
        );
        return joiner ? <span key={i}>{sep}{box}</span> : <div key={i} className="blank-line">{t.pre}{box}{t.post}</div>;
      })}
    </div>
  );
}
export function Tiles({ tiles, value, onChange, disabled }) {
  const used = [...value];
  const remaining = [...tiles];
  for (const w of used) { const i = remaining.indexOf(w); if (i >= 0) remaining.splice(i, 1); }
  return (
    <div>
      <div className="tile-built">{value.length ? value.map((w, i) => <button key={i} disabled={disabled} className="tile tile-on" onClick={() => onChange(value.filter((_, j) => j !== i))}>{w}</button>) : <span className="tile-placeholder">Tap the words in order…</span>}</div>
      <div className="tile-bank">{remaining.map((w, i) => <button key={i} disabled={disabled} className="tile" onClick={() => onChange([...value, w])}>{w}</button>)}</div>
    </div>
  );
}

export function Particles({ trigger, big }) {
  const [pts, setPts] = useState([]);
  useEffect(() => {
    if (!trigger) return;
    const emojis = big ? ["🏆", "⭐", "🌟", "🎉", "🎊", "✨", "👑"] : ["⭐", "✨", "🌟", "💫", "🎉"];
    setPts(Array.from({ length: big ? 26 : 14 }, (_, i) => ({ id: `${trigger}-${i}`, x: (Math.random() - 0.5) * 260, y: -(Math.random() * 180 + 40), e: emojis[i % emojis.length], d: 600 + Math.random() * 700 })));
    const t = setTimeout(() => setPts([]), 1600);
    return () => clearTimeout(t);
  }, [trigger, big]);
  return <div className="particles">{pts.map((p) => <span key={p.id} style={{ "--px": `${p.x}px`, "--py": `${p.y}px`, animationDuration: `${p.d}ms` }}>{p.e}</span>)}</div>;
}

export function speak(text) {
  try {
    const t = text.replace(/×/g, " times ").replace(/÷/g, " divided by ").replace(/−/g, " minus ").replace(/=\s*\?/g, " equals what ").replace(/=/g, " equals ");
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.rate = 0.92;
    speechSynthesis.speak(u);
  } catch {}
}
