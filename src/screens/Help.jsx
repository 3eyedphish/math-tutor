import { useEffect, useRef, useState } from "react";
import { helpPrompt, revealsAnswer } from "../engine/ai.js";
import * as store from "../engine/store.js";
import { speak } from "../ui/components.jsx";

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const NO_AI = "I can't answer questions right now. Try a hint or the first step. You can also ask a grown-up!";

// The help panel under a question. Every kind of help she uses is reported
// with onUse(kind), so a question answered after help doesn't count as clean.
// context / answerText tell the AI where she is and what the picture shows (Gym, Lab).
export default function Help({ part, world, profile, onUse, onLesson, onClose, context, picture, answerText, lessonLabel = "Teach me with a mini-lesson" }) {
  const [shown, setShown] = useState([]); // [{kind, text, asked?}]
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [typed, setTyped] = useState("");
  const [heard, setHeard] = useState("");
  const [askOpen, setAskOpen] = useState(false);
  const rec = useRef(null);
  const end = useRef(null);
  const used = (k) => shown.some((x) => x.kind === k);
  const add = (entry) => { setShown((s) => [...s, entry]); onUse(entry.kind); };
  useEffect(() => { end.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" }); }, [shown, askOpen, heard]);
  useEffect(() => () => rec.current?.abort?.(), []);

  const ask = async (question) => {
    setBusy(true);
    const p = helpPrompt(profile.name, world, part, question, { context, picture, answer: answerText });
    let t = await store.ai(p.system, p.user, 220);
    if (t && revealsAnswer(t, part)) t = part.hint || "";
    setBusy(false);
    return t;
  };
  const anotherWay = async () => {
    const t = await ask("");
    add({ kind: "anotherWay", text: t || (part.steps?.[1] ? `Try it like this: ${part.steps[0]} Then: ${part.steps[1]}` : NO_AI) });
  };
  const sendQuestion = async (q) => {
    const question = q.trim();
    if (!question) return;
    setHeard(""); setTyped(""); setAskOpen(false);
    const t = await ask(question);
    add({ kind: "asked", asked: question, text: t || NO_AI });
  };
  const listen = () => {
    if (!Recognition) return;
    try {
      const r = new Recognition();
      r.lang = "en-US"; r.interimResults = true; r.maxAlternatives = 1;
      r.onresult = (e) => setHeard(Array.from(e.results).map((x) => x[0].transcript).join(" "));
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      rec.current = r; setHeard(""); setListening(true); r.start();
    } catch { setListening(false); }
  };
  const stop = () => { rec.current?.stop(); setListening(false); };

  return (
    <div className="help-panel">
      <div className="row between"><b>🙋 Help is here!</b><button className="ghost small" onClick={onClose}>Back to my question</button></div>
      {shown.map((h, i) => (
        <div key={i} className={`help-out ${h.kind}`}>
          {h.asked && <div className="you-asked">You asked: “{h.asked}”</div>}
          <div>{{ hint: "💡 ", step: "🪜 ", anotherWay: "🔄 ", asked: "💬 " }[h.kind]}{h.text}</div>
          <button className="icon" onClick={() => speak(h.text)} aria-label="Read aloud">🔊</button>
        </div>
      ))}
      {busy && <div className="help-out thinking">Thinking…</div>}

      {askOpen && (
        <div className="ask-box">
          {Recognition && (
            <button className={`mic ${listening ? "on" : ""}`} onClick={listening ? stop : listen} aria-label={listening ? "Stop listening" : "Talk"}>
              {listening ? "⏹" : "🎤"}<span>{listening ? "I'm listening… tap when done" : "Tap and ask your question"}</span>
            </button>
          )}
          {heard && !listening && (
            <div className="heard">
              <div>I heard: <b>“{heard}”</b></div>
              <div className="controls"><button className="primary" onClick={() => sendQuestion(heard)}>Ask this ➜</button><button className="ghost" onClick={listen}>Say it again</button></div>
            </div>
          )}
          {heard && listening && <div className="heard">“{heard}”</div>}
          {!listening && !heard && (
            <div className="type-ask">
              <div className="fine">{Recognition ? "Or type it here:" : "Type your question. You can tap the 🎤 on the keyboard to talk instead."}</div>
              <div className="row"><input value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendQuestion(typed)} placeholder="What are you stuck on?" maxLength={300} /><button className="primary" disabled={!typed.trim()} onClick={() => sendQuestion(typed)}>Ask</button></div>
            </div>
          )}
        </div>
      )}

      <div className="help-options">
        {!used("hint") && part.hint && <button className="help-btn" onClick={() => add({ kind: "hint", text: part.hint })}>💡<span>Give me a hint</span></button>}
        {(used("hint") || !part.hint) && !used("step") && part.steps?.length > 1 && <button className="help-btn" onClick={() => add({ kind: "step", text: part.steps[0] })}>🪜<span>Show me the first step</span></button>}
        <button className="help-btn" disabled={busy} onClick={anotherWay}>🔄<span>Explain it another way</span></button>
        {!askOpen && <button className="help-btn" disabled={busy} onClick={() => { setAskOpen(true); if (Recognition) listen(); }}>🎤<span>Ask my own question</span></button>}
        {onLesson && <button className="help-btn" onClick={() => { onUse("lesson"); onLesson(); }}>📚<span>{lessonLabel}</span></button>}
      </div>
      <p className="fine">Using help is smart! Questions you answer with help come back later so you can try them on your own.</p>
      <div ref={end} />
    </div>
  );
}
