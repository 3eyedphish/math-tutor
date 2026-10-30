import { useEffect, useRef, useState } from "react";
import { WORLDS } from "./engine/themes.js";
import { SKILL } from "./engine/skills.js";
import * as store from "./engine/store.js";
import Profiles from "./screens/Profiles.jsx";
import Home from "./screens/Home.jsx";
import Game from "./screens/Game.jsx";
import Parent from "./screens/Parent.jsx";
import Lessons from "./screens/Lessons.jsx";
import Gym from "./gym/Gym.jsx";
import Lab from "./lab/Lab.jsx";
import { upgradeState } from "./engine/learner.js";

// An adventure left part-way (within the last 3 days) can be continued.
const canResume = (st) => (st?.run && st.run.item && Date.now() - (st.run.t || 0) < 3 * 86400000 ? st.run : null);

export default function App() {
  const [screen, setScreen] = useState("boot");
  const [mode, setMode] = useState("local");
  const [profiles, setProfiles] = useState([]);
  const [profile, setProfile] = useState(null);
  const [state, setState] = useState(null);
  const [report, setReport] = useState(null);
  const [gameKey, setGameKey] = useState(0);
  const [resuming, setResuming] = useState(false);
  const [, bump] = useState(0);
  const lastProfile = useRef(null);

  useEffect(() => {
    (async () => {
      const r = await store.init();
      setMode(r.mode);
      setProfiles(await store.listProfiles());
      setScreen("profiles");
    })();
  }, []);
  // Keep the open world's colours on the page.
  const world = WORLDS.find((w) => w.id === state?.worldId) || WORLDS[0];
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", world.accent);
    root.style.setProperty("--bg1", world.bg1);
    root.style.setProperty("--bg2", world.bg2);
    root.dataset.theme = world.dark ? "dark" : "light";
  }, [world]);
  // Coming back to the app on a menu screen: pick up progress saved on another device.
  useEffect(() => {
    const f = async () => {
      if (document.visibilityState !== "visible" || !profile || !state || screen === "game") return;
      const s = await store.loadState(profile.id);
      if ((s.updatedAt || 0) > (state.updatedAt || 0)) setState(upgradeState(s));
    };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [profile, state, screen]);
  // Sync any queued history when the app comes back online or to the front.
  useEffect(() => {
    const f = () => profile && store.flush(profile.id);
    window.addEventListener("online", f);
    document.addEventListener("visibilitychange", f);
    return () => { window.removeEventListener("online", f); document.removeEventListener("visibilitychange", f); };
  }, [profile]);

  const persist = (s) => { store.saveState(profile.id, s); bump((x) => x + 1); };
  const openProfile = async (p) => {
    setProfile(p); lastProfile.current = p;
    const s = upgradeState(await store.loadState(p.id));
    setState(s);
    setScreen("home");
  };

  if (screen === "boot") return <div className="app"><div className="card center">Loading…</div></div>;
  return (
    <div className="app">
      {screen === "profiles" && <Profiles profiles={profiles} mode={mode} onPick={openProfile} onCreated={async (p) => { setProfiles(await store.listProfiles()); openProfile(p); }} />}
      {screen === "home" && <Home profile={profile} state={state} onWorld={(id) => { state.worldId = id; persist(state); }} onStart={() => { setResuming(false); setGameKey((k) => k + 1); setScreen("game"); }} resume={canResume(state)} onResume={() => { setResuming(true); setGameKey((k) => k + 1); setScreen("game"); }} onParent={() => setScreen("parent")} onLessons={() => setScreen("lessons")} onGym={() => setScreen("gym")} onLab={() => setScreen("lab")} onSwitch={async () => { setProfiles(await store.listProfiles()); setScreen("profiles"); }} />}
      {screen === "game" && <Game key={gameKey} resume={resuming} profile={profile} state={state} world={world} persist={persist} onQuit={() => setScreen("home")} onDone={(r) => { setReport(r); setScreen("report"); }} />}
      {screen === "lessons" && <Lessons state={state} world={world} persist={persist} onClose={() => setScreen("home")} />}
      {screen === "gym" && <Gym profile={profile} state={state} world={world} persist={persist} onClose={() => setScreen("home")} />}
      {screen === "lab" && <Lab profile={profile} state={state} world={world} persist={persist} onClose={() => setScreen("home")} />}
      {screen === "report" && <Report profile={profile} world={world} report={report} onHome={() => setScreen("home")} />}
      {screen === "parent" && <Parent profile={profile} state={state} persist={persist} onClose={() => setScreen("home")} onProfileChanged={(p) => setProfile(p)} onProfileDeleted={async () => { setProfiles(await store.listProfiles()); setProfile(null); setScreen("profiles"); }} />}
    </div>
  );
}

function Report({ profile, world, report, onHome }) {
  const [note, setNote] = useState("");
  const total = report.skills.length;
  useEffect(() => {
    const ups = report.levelUps.map((s) => SKILL[s].name).join(", ");
    store.ai(`You write a 2-sentence, upbeat end-of-adventure message for ${profile.name}, a gifted kid, themed on ${world.label}. Plain text.`, `She answered ${report.correct} of ${total} questions and earned ${report.stars} stars.${ups ? ` She levelled up in: ${ups}.` : ""}`, 120).then((t) => t && setNote(t));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="card center">
      <div className="big-emoji float">{world.emoji}</div>
      <h1 className="title">Adventure complete!</h1>
      <div className="report-stats">
        <div><b>{report.correct}/{total}</b><span>correct</span></div>
        <div><b>⭐ {report.stars}</b><span>stars</span></div>
        <div><b>{report.stickers.join("") || "—"}</b><span>new stickers</span></div>
      </div>
      {report.levelUps.length > 0 && <p className="sub">Level up: {[...new Set(report.levelUps)].map((s) => `${SKILL[s].emoji} ${SKILL[s].name}`).join(" · ")}</p>}
      {note && <div className="ai">{note}</div>}
      <button className="primary big" onClick={onHome}>Back to {world.label}</button>
    </div>
  );
}
