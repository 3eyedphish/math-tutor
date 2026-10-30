// Profiles and progress. Works in two modes:
//  • server: the Cloudflare Worker API (behind Cloudflare Access) syncs every profile across devices.
//  • local:  no server reachable (offline, or a plain preview). Everything stays in this browser.
// Either way the browser keeps a cache, so the app works offline and syncs when it can.
import { freshState } from "./learner.js";

const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};
let mode = "local";
let me = null;

async function api(path, opts = {}) {
  try {
    const res = await fetch(`/api${path}`, { credentials: "same-origin", headers: { "content-type": "application/json" }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
    if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) return null;
    return await res.json();
  } catch { return null; }
}

export async function init() {
  const r = await api("/me");
  if (r?.email) { mode = "server"; me = r; LS.set("mt.lastMode", "server"); }
  else mode = LS.get("mt.lastMode", "local") === "server" ? "server-offline" : "local";
  return { mode, me };
}
export const getMode = () => mode;
export const isServer = () => mode === "server";

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

export async function listProfiles() {
  if (mode === "server") {
    const r = await api("/profiles");
    if (r?.profiles) { LS.set("mt.profiles", r.profiles); return r.profiles; }
  }
  return LS.get("mt.profiles", []);
}
async function hashPin(id, pin) {
  if (!pin) return "";
  const data = new TextEncoder().encode(`${id}:${pin}`);
  try { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))].map((b) => b.toString(16).padStart(2, "0")).join(""); }
  catch { return `plain:${pin}`; }
}
export async function checkPin(profile, pin) {
  if (!profile.pinHash) return true;
  return (await hashPin(profile.id, pin)) === profile.pinHash;
}
export async function createProfile({ name, avatar, pin }) {
  const id = newId();
  const profile = { id, name, avatar, pinHash: await hashPin(id, pin), createdAt: Date.now() };
  const state = { ...freshState(), name, updatedAt: Date.now() };
  LS.set("mt.profiles", [...LS.get("mt.profiles", []), profile]);
  LS.set(`mt.state.${id}`, state);
  if (mode === "server") { await api("/profiles", { method: "POST", body: profile }); await api(`/profiles/${id}/state`, { method: "PUT", body: { state } }); }
  return profile;
}
export async function updateProfile(profile, { name, avatar, pin }) {
  const p = { ...profile, name: name ?? profile.name, avatar: avatar ?? profile.avatar };
  if (pin !== undefined) p.pinHash = await hashPin(p.id, pin);
  LS.set("mt.profiles", LS.get("mt.profiles", []).map((x) => (x.id === p.id ? p : x)));
  if (mode === "server") await api(`/profiles/${p.id}`, { method: "PUT", body: p });
  return p;
}
export async function deleteProfile(id) {
  LS.set("mt.profiles", LS.get("mt.profiles", []).filter((p) => p.id !== id));
  LS.del(`mt.state.${id}`); LS.del(`mt.outbox.${id}`);
  if (mode === "server") await api(`/profiles/${id}`, { method: "DELETE" });
}

// Newest copy wins (this device's cache vs. the server).
export async function loadState(id) {
  const local = LS.get(`mt.state.${id}`, null);
  let remote = null;
  if (mode === "server") remote = (await api(`/profiles/${id}/state`))?.state || null;
  let s = local;
  if (remote && (!local || (remote.updatedAt || 0) > (local.updatedAt || 0))) { s = remote; LS.del(dirtyKey(id)); }
  // This device has newer progress than the server (e.g. it was played offline): push it up.
  else if (local && mode === "server" && (!remote || (local.updatedAt || 0) > (remote.updatedAt || 0))) { LS.set(dirtyKey(id), local.updatedAt || Date.now()); pushState(id, local); }
  const base = freshState();
  s = s ? { ...base, ...s, skills: { ...base.skills, ...(s.skills || {}) } } : base;
  LS.set(`mt.state.${id}`, s);
  return s;
}
// Saves go to this device at once and to the server right after (every answer),
// and again when the app is hidden or closed. A save that doesn't reach the server
// stays marked "unsynced" and is retried until it does (also after going offline).
const pending = {};
const retryTimer = {};
const retryDelay = {};
const dirtyKey = (id) => `mt.dirty.${id}`;
async function pushState(id, state, keepalive = false) {
  clearTimeout(pending[id]); delete pending[id];
  const body = JSON.stringify({ state });
  try {
    // Browsers only allow small bodies on requests that outlive the page.
    const res = await fetch(`/api/profiles/${id}/state`, { method: "PUT", credentials: "same-origin", keepalive: keepalive && body.length < 60000, headers: { "content-type": "application/json" }, body });
    if (res.ok) {
      if ((LS.get(dirtyKey(id), 0) || 0) <= (state.updatedAt || 0)) LS.del(dirtyKey(id));
      retryDelay[id] = 0;
      return true;
    }
  } catch {}
  scheduleRetry(id);
  return false;
}
function scheduleRetry(id) {
  clearTimeout(retryTimer[id]);
  retryDelay[id] = Math.min(60000, (retryDelay[id] || 2000) * 2);
  retryTimer[id] = setTimeout(() => syncNow(id), retryDelay[id]);
}
// Push this device's copy if it has changes the server hasn't confirmed.
export async function syncNow(id) {
  if (mode === "server" && LS.get(`mt.outbox.${id}`, []).length) flush(id);
  if (!LS.get(dirtyKey(id), 0)) return true;
  if (mode === "server-offline") await init();
  if (mode !== "server") return false;
  const s = LS.get(`mt.state.${id}`, null);
  return s ? pushState(id, s) : true;
}
export const hasUnsynced = (id) => !!LS.get(dirtyKey(id), 0);
export function saveState(id, state) {
  state.updatedAt = Date.now();
  LS.set(`mt.state.${id}`, state);
  if (mode === "local") return;
  LS.set(dirtyKey(id), state.updatedAt);
  clearTimeout(pending[id]);
  pending[id] = setTimeout(() => (mode === "server" ? pushState(id, LS.get(`mt.state.${id}`, state)) : syncNow(id)), 300);
}
export function flushNow() {
  for (const k of Object.keys(localStorage)) {
    const m = k.match(/^mt\.dirty\.(.+)$/);
    if (!m || mode !== "server") continue;
    const s = LS.get(`mt.state.${m[1]}`, null);
    if (s) pushState(m[1], s, true);
  }
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushNow);
  document.addEventListener("visibilitychange", () => (document.visibilityState === "hidden" ? flushNow() : Object.keys(localStorage).forEach((k) => { const m = k.match(/^mt\.dirty\.(.+)$/); if (m) syncNow(m[1]); })));
  window.addEventListener("online", () => Object.keys(localStorage).forEach((k) => { const m = k.match(/^mt\.dirty\.(.+)$/); if (m) syncNow(m[1]); }));
}
// Completion history: every answered question is logged to the server (queued while offline).
export async function logEvent(id, ev) {
  const box = [...LS.get(`mt.outbox.${id}`, []), ev].slice(-500);
  LS.set(`mt.outbox.${id}`, box);
  if (mode === "server") flush(id);
}
let flushing = false;
export async function flush(id) {
  if (flushing) return;
  flushing = true;
  try {
    const box = LS.get(`mt.outbox.${id}`, []);
    if (box.length && (await api(`/profiles/${id}/events`, { method: "POST", body: { events: box } }))?.ok) {
      LS.set(`mt.outbox.${id}`, LS.get(`mt.outbox.${id}`, []).slice(box.length));
    }
  } finally { flushing = false; }
}
export async function sessionsSummary(id) {
  if (mode !== "server") return null;
  return (await api(`/profiles/${id}/summary`)) || null;
}

// AI goes through the Worker (the key lives in Cloudflare). In local mode a parent can enter a key on this device.
export const getLocalKey = () => LS.get("mt.apiKey", "");
export const setLocalKey = (k) => (k ? LS.set("mt.apiKey", k) : LS.del("mt.apiKey"));
export async function ai(system, user, maxTokens = 200) {
  if (mode === "server") return (await api("/ai", { method: "POST", body: { system, user, max_tokens: maxTokens } }))?.text || "";
  const { askClaude } = await import("./ai.js");
  return askClaude(getLocalKey(), system, user, maxTokens);
}
export async function aiStatus() {
  if (mode !== "server") return { hasKey: !!getLocalKey(), ok: null, local: true };
  return (await api("/ai/status")) || { hasKey: null, ok: false, status: 0 };
}
