// Grown-ups → Spelling: enter or replace the weekly list, and see how each word is going.
import { useState } from "react";
import { activeList, ensureSpell, parseList, listToText, saveList, wordRec, BOX_DAYS } from "./engine.js";
import * as store from "../engine/store.js";

// Next Friday (or today, if it is Friday) as yyyy-mm-dd.
function nextFriday() {
  const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function SpellPanel({ state, persist }) {
  const sp = ensureSpell(state);
  const list = activeList(state);
  const [edit, setEdit] = useState(null); // {id|null, title, testDate, text}
  const [busy, setBusy] = useState("");
  const [, force] = useState(0);
  const save = () => {
    const words = parseList(edit.text);
    if (!words.length) return setBusy("Add at least one word.");
    saveList(state, { id: edit.id, title: edit.title.trim(), testDate: edit.testDate, words });
    persist(state); setEdit(null); setBusy(""); force((x) => x + 1);
  };
  // Ask Claude for kid-friendly sentences and tips for any word that lacks them.
  const fill = async () => {
    const words = parseList(edit.text);
    const need = words.filter((x) => !x.s || !x.tip);
    if (!need.length) return setBusy("Every word already has a sentence and a tip.");
    setBusy("Writing sentences…");
    const t = await store.ai(
      "You help a 7-year-old (gifted, 2nd–4th grade reading level) practise spelling. For each word, write one short, vivid example sentence that uses the exact word, and one short tip about the tricky part of its spelling (silent letters, word parts, suffix rules). Reply with JSON only: an array of {\"w\":word,\"s\":sentence,\"tip\":tip}.",
      need.map((x) => x.w).join("\n"), 1200);
    try {
      const arr = JSON.parse(String(t).slice(String(t).indexOf("["), String(t).lastIndexOf("]") + 1));
      const by = Object.fromEntries(arr.map((a) => [String(a.w).toLowerCase(), a]));
      const merged = words.map((x) => { const a = by[x.w.toLowerCase()]; return a ? { w: x.w, s: x.s || a.s || "", tip: x.tip || a.tip || "" } : x; });
      setEdit({ ...edit, text: listToText({ words: merged }) }); setBusy("Added. Check them, then Save.");
    } catch { setBusy("The AI helper didn't answer. You can type sentences yourself, or save without them."); }
  };

  if (edit) return (
    <div className="settings sp-edit sp-serif">
      <label className="field">List name<input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Unit 5" /></label>
      <label className="field">Test date<input type="date" value={edit.testDate} onChange={(e) => setEdit({ ...edit, testDate: e.target.value })} /></label>
      <label className="field">Words, one per line. Optional: <code>word | example sentence | tip</code>
        <textarea value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={"ghost | The ghost floated through the wall. | silent h after the g\nmerchant\ncompanies"} /></label>
      <p className="fine">{parseList(edit.text).length} words. Type capitals where the test needs them (Thanksgiving). Words without a sentence are just said on their own.</p>
      <div className="row">
        <button className="ghost small" onClick={fill}>✨ Write missing sentences &amp; tips</button>
        <button className="ghost small" onClick={() => { setEdit(null); setBusy(""); }}>Cancel</button>
        <button className="primary" onClick={save}>{edit.id ? "Save changes" : "Save as this week's list"}</button>
      </div>
      {busy && <p className="fine">{busy}</p>}
    </div>
  );

  const now = Date.now();
  const tests = sp.log.filter((l) => l.mode === "test" && list.words.some((x) => x.w === l.w));
  return (
    <div className="settings sp-serif">
      <div className="row between">
        <div><b>{list.title}</b>{list.testDate ? ` · test ${new Date(list.testDate + "T12:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}` : ""} · {list.words.length} words</div>
      </div>
      <div className="row">
        <button className="primary" onClick={() => setEdit({ id: null, title: "", testDate: nextFriday(), text: "" })}>➕ New week's list</button>
        <button className="ghost small" onClick={() => setEdit({ id: list.id, title: list.title, testDate: list.testDate || "", text: listToText(list) })}>Edit this list</button>
        {sp.lists.length > 1 && <select value={sp.activeId} onChange={(e) => { sp.activeId = e.target.value; persist(state); force((x) => x + 1); }}>{sp.lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>}
      </div>
      <table className="ptable">
        <thead><tr><th>Word</th><th>Right / missed</th><th>Strength</th><th>Her last misspellings</th></tr></thead>
        <tbody>{list.words.map((x) => { const r = wordRec(state, x.w); return (
          <tr key={x.w}><td><b>{x.w}</b></td><td>{r.seen ? `${r.right} / ${r.wrong}` : "—"}</td>
            <td>{!r.seen ? "not tried" : r.box === 0 ? "🔴 needs practice" : r.box === 1 ? "🟡 learning" : "🟢 strong"}{r.seen && r.due > now ? "" : r.seen ? " · due" : ""}</td>
            <td>{(r.misses || []).slice(-3).join(", ")}</td></tr>); })}</tbody>
      </table>
      {tests.length > 0 && <p className="fine">Practice tests on this list: {Math.round(tests.length / list.words.length)} · last answers right: {tests.slice(-list.words.length).filter((l) => l.ok).length}/{Math.min(tests.length, list.words.length)}</p>}
      {(sp.stories || []).length > 0 && <><h3>Her stories</h3>{[...sp.stories].reverse().slice(0, 5).map((st) => (
        <details key={st.t} className="field"><summary><b>{st.title}</b> · {new Date(st.t).toLocaleDateString()} · {st.used.length} spelling words</summary><p style={{ whiteSpace: "pre-wrap" }}>{st.text}</p></details>))}</>}
      {(sp.sentences || []).length > 0 && <><h3>Her sentences</h3><ul>{[...sp.sentences].reverse().slice(0, 15).map((x) => <li key={x.t}><b>{x.w}</b>: {x.text}</li>)}</ul></>}
      <p className="fine">A word gets stronger each time she spells it right on the first try and comes back after {BOX_DAYS.slice(1).join(", ")} days. A miss sends it back to the start. Missed words also return a few words later in the same round.</p>
    </div>
  );
}
