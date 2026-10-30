// Pictures for the Thinking Lab: minicomputer boards, arrow roads and strings.
import { PLACE, SQ } from "../engine/labskills.js";

export function LabVisual({ v, value, onChange, mode, placed, onRegion }) {
  if (v.kind === "mini") return <MiniBoards boards={value || v.boards} boards2={v.boards2} onTap={onChange ? (p, i) => onChange(tapBoard(value, p, i, mode)) : null} />;
  if (v.kind === "arrows") return <ArrowRoad {...v} />;
  if (v.kind === "strings") return <Strings {...v} placed={placed || v.placed} onRegion={onRegion} />;
  return null;
}
function tapBoard(bs, p, i, mode) {
  const next = bs.map((b) => [...b]);
  next[p][i] = Math.max(0, Math.min(9, next[p][i] + (mode === "remove" ? -1 : 1)));
  return next;
}

// ── Minicomputer ────────────────────────────────────────────────────────────
// Square layout on each board:  8 4
//                               2 1
const POS = { 8: [0, 0], 4: [1, 0], 2: [0, 1], 1: [1, 1] };
const CELL = 46, GAP = 16, BOARD = CELL * 2;
function MiniBoards({ boards, boards2, onTap }) {
  const nb = boards.length, W = nb * BOARD + (nb - 1) * GAP;
  return (
    <svg viewBox={`-4 -4 ${W + 8} ${BOARD + 30}`} className={`visual mini ${onTap ? "mini-live" : ""}`} style={{ maxWidth: Math.min(640, 150 * nb) }} role="img" aria-label={`Minicomputer with ${nb} boards`}>
      {boards.map((_, k) => {
        const p = nb - 1 - k; // leftmost board is the biggest place
        const x0 = k * (BOARD + GAP);
        return (
          <g key={p}>
            {SQ.map((val, i) => {
              const [cx, cy] = POS[val], x = x0 + cx * CELL, y = cy * CELL;
              const a = boards[p][i], b = boards2 ? boards2[p][i] : 0;
              return (
                <g key={val} onPointerDown={onTap ? (e) => { e.preventDefault(); onTap(p, i); } : undefined} className={onTap ? "mini-tap" : ""}>
                  <rect x={x} y={y} width={CELL} height={CELL} className={`mini-sq mini-sq${val}`} />
                  <text x={x + 4} y={y + 12} className="mini-val">{val}</text>
                  <Checkers x={x} y={y} n={a} cls={boards2 ? "mini-red" : "mini-chk"} />
                  <Checkers x={x} y={y} n={b} cls="mini-blue" offset={a} />
                </g>
              );
            })}
            <rect x={x0} y="0" width={BOARD} height={BOARD} className="mini-frame" />
            <text x={x0 + BOARD / 2} y={BOARD + 20} textAnchor="middle" className="mini-place">{nb > 4 ? `${(10 ** p).toLocaleString("en-US")}s` : PLACE[p]}</text>
          </g>
        );
      })}
    </svg>
  );
}
// Up to 4 checkers drawn in a little cluster; more than that shows a count.
const SPOTS = [[0.5, 0.58], [0.3, 0.38], [0.7, 0.38], [0.3, 0.78], [0.7, 0.78]];
function Checkers({ x, y, n, cls, offset = 0 }) {
  if (!n) return null;
  const all = n + offset;
  if (all > 4) {
    const idx = offset ? 2 : 1;
    return (<g><circle cx={x + CELL * SPOTS[idx][0]} cy={y + CELL * SPOTS[idx][1]} r="11" className={cls} /><text x={x + CELL * SPOTS[idx][0]} y={y + CELL * SPOTS[idx][1] + 4.5} textAnchor="middle" className="mini-count">{n}</text></g>);
  }
  const spots = all === 1 ? [SPOTS[0]] : SPOTS.slice(1, 1 + all);
  return <g>{spots.slice(offset, offset + n).map(([sx, sy], i) => <circle key={i} cx={x + CELL * sx} cy={y + CELL * sy} r={all === 1 ? 12 : 9} className={cls} />)}</g>;
}

// ── Arrow roads ─────────────────────────────────────────────────────────────
const UX = 92, UY = 76, R = 24;
function ArrowRoad({ nodes, edges, legend }) {
  const xs = nodes.map((n) => n.x * UX), ys = nodes.map((n) => n.y * UY);
  const W = Math.max(...xs) + 2 * R + 8, H = Math.max(...ys) + 2 * R + 8;
  const top = edges.some((e) => e.curve) ? 44 : 0;
  return (
    <div className="arrows-wrap">
      <svg viewBox={`${-R - 4} ${-R - 4 - top} ${W} ${H + top}`} className="visual arrows" style={{ maxWidth: Math.min(560, W * 1.3) }} role="img" aria-label="Arrow road">
        <defs>{["red", "blue", "green"].map((c) => <marker key={c} id={`lab-ah-${c}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" className={`ar-head ar-${c}`} /></marker>)}</defs>
        {edges.map((e, i) => {
          const [x1, y1, x2, y2] = [xs[e.from], ys[e.from], xs[e.to], ys[e.to]];
          if (e.curve) {
            const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - 70;
            const a1 = Math.atan2(my - y1, mx - x1), a2 = Math.atan2(y2 - my, x2 - mx);
            return <path key={i} d={`M ${x1 + R * Math.cos(a1)} ${y1 + R * Math.sin(a1)} Q ${mx} ${my} ${x2 - R * Math.cos(a2)} ${y2 - R * Math.sin(a2)}`} className={`ar-line ar-${e.color}`} markerEnd={`url(#lab-ah-${e.color})`} />;
          }
          const a = Math.atan2(y2 - y1, x2 - x1);
          return <line key={i} x1={x1 + R * Math.cos(a)} y1={y1 + R * Math.sin(a)} x2={x2 - (R + 2) * Math.cos(a)} y2={y2 - (R + 2) * Math.sin(a)} className={`ar-line ar-${e.color}`} markerEnd={`url(#lab-ah-${e.color})`} />;
        })}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={xs[i]} cy={ys[i]} r={R} className={n.q ? "ar-dot ar-q" : "ar-dot"} />
            <text x={xs[i]} y={ys[i] + 5} textAnchor="middle" className={`ar-label ${String(n.label).length > 3 ? "ar-small" : ""}`}>{n.label}</text>
          </g>
        ))}
      </svg>
      <div className="ar-legend">{legend.map((l) => <span key={l.color} className="ar-key"><span className={`ar-swatch ar-bg-${l.color}`} /> {l.label}</span>)}</div>
    </div>
  );
}

// ── Strings ─────────────────────────────────────────────────────────────────
const SW = 360, SH = 230;
const CIRC = { 1: [{ cx: 180, cy: 122, r: 92 }], 2: [{ cx: 132, cy: 125, r: 88 }, { cx: 228, cy: 125, r: 88 }] };
const ANCHOR = { in: [180, 122], a: [92, 125], ab: [180, 125], b: [268, 125] };
const OUT_SLOTS = [[26, 32], [334, 32], [26, 210], [334, 210], [180, 222], [26, 120], [334, 120], [70, 222], [290, 222]];
const inC = (x, y, c) => (x - c.cx) ** 2 + (y - c.cy) ** 2 <= c.r ** 2;
export function regionAt(x, y, n) {
  const cs = CIRC[n];
  if (n === 1) return inC(x, y, cs[0]) ? "in" : "out";
  const a = inC(x, y, cs[0]), b = inC(x, y, cs[1]);
  return a && b ? "ab" : a ? "a" : b ? "b" : "out";
}
function layout(placed) {
  const by = {};
  for (const p of placed) (by[p.r] ||= []).push(p);
  const out = [];
  for (const [r, ps] of Object.entries(by)) {
    if (r === "out") { ps.forEach((p, i) => out.push({ ...p, x: OUT_SLOTS[i % OUT_SLOTS.length][0], y: OUT_SLOTS[i % OUT_SLOTS.length][1] })); continue; }
    const [ax, ay] = ANCHOR[r];
    const cols = r === "ab" ? 1 : 2, rows = Math.ceil(ps.length / cols);
    ps.forEach((p, i) => out.push({ ...p, x: ax + ((i % cols) - (cols - 1) / 2) * 34, y: ay + (Math.floor(i / cols) - (rows - 1) / 2) * 30 }));
  }
  return out;
}
function Strings({ preds, labels, placed = [], onRegion }) {
  const n = preds.length, cs = CIRC[n];
  const click = onRegion ? (e) => {
    const svg = e.currentTarget, pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    onRegion(regionAt(p.x, p.y, n));
  } : undefined;
  return (
    <svg viewBox={`0 -26 ${SW} ${SH + 30}`} className={`visual strings ${onRegion ? "str-live" : ""}`} onPointerDown={click} role="img" aria-label={`Strings: ${labels.join(" and ")}`}>
      <rect x="2" y="2" width={SW - 4} height={SH - 4} rx="16" className="str-box" />
      {cs.map((c, i) => <circle key={i} cx={c.cx} cy={c.cy} r={c.r} className={`str-loop ${n === 1 ? "str-a" : i ? "str-b" : "str-a"}`} />)}
      {cs.map((c, i) => <text key={`t${i}`} x={n === 1 ? c.cx : i ? SW - 8 : 8} y="-8" textAnchor={n === 1 ? "middle" : i ? "end" : "start"} className={`str-label ${i ? "str-tb" : "str-ta"}`}>{labels[i]}</text>)}
      {layout(placed).map((p) => (
        <g key={p.n} className={p.wrong ? "str-wrong" : ""}>
          <circle cx={p.x} cy={p.y} r="14" className="str-chip" />
          <text x={p.x} y={p.y + 5} textAnchor="middle" className="str-num">{p.n}</text>
        </g>
      ))}
    </svg>
  );
}
