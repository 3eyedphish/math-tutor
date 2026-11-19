// Cloudflare Worker: serves the app (static assets) and a small API.
// Cloudflare Access sits in front of the whole hostname; this Worker also verifies the
// Access JWT on every API call, so the API is never reachable without a signed-in family member.
import { jwtVerify, createRemoteJWKSet } from "jose";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
let JWKS;

async function identify(request, env) {
  if (env.DEV_EMAIL) return env.DEV_EMAIL; // local `wrangler dev` only; never set in production
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token || !env.TEAM_DOMAIN || !env.POLICY_AUD) return null;
  JWKS ||= createRemoteJWKSet(new URL(`${env.TEAM_DOMAIN}/cdn-cgi/access/certs`));
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: env.TEAM_DOMAIN, audience: env.POLICY_AUD });
    return payload.email || null;
  } catch { return null; }
}

const validId = (s) => typeof s === "string" && /^[A-Za-z0-9-]{8,64}$/.test(s);
const clip = (s, n) => (s == null ? null : String(s).slice(0, n));

async function api(request, env, url) {
  const email = await identify(request, env);
  if (!email) return json({ error: "not signed in" }, 401);
  const db = env.DB;
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const method = request.method;
  const body = method === "POST" || method === "PUT" ? await request.json().catch(() => ({})) : {};

  if (parts[0] === "me") return json({ email });

  if (parts[0] === "profiles" && parts.length === 1) {
    if (method === "GET") {
      const { results } = await db.prepare("SELECT id, name, avatar, pin_hash AS pinHash, created_at AS createdAt FROM profiles WHERE deleted = 0 ORDER BY created_at").all();
      return json({ profiles: results });
    }
    if (method === "POST") {
      if (!validId(body.id) || !body.name) return json({ error: "bad profile" }, 400);
      await db.prepare("INSERT OR IGNORE INTO profiles (id, name, avatar, pin_hash, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(body.id, clip(body.name, 40), clip(body.avatar || "🙂", 8), clip(body.pinHash || "", 80), email, Date.now()).run();
      return json({ ok: true });
    }
  }
  const id = parts[1];
  if (parts[0] === "profiles" && validId(id)) {
    const exists = await db.prepare("SELECT 1 FROM profiles WHERE id = ? AND deleted = 0").bind(id).first();
    if (!exists) return json({ error: "no such profile" }, 404);
    if (parts.length === 2 && method === "PUT") {
      await db.prepare("UPDATE profiles SET name = ?, avatar = ?, pin_hash = ? WHERE id = ?").bind(clip(body.name, 40), clip(body.avatar, 8), clip(body.pinHash || "", 80), id).run();
      return json({ ok: true });
    }
    if (parts.length === 2 && method === "DELETE") {
      await db.prepare("UPDATE profiles SET deleted = 1 WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }
    if (parts[2] === "state" && method === "GET") {
      const row = await db.prepare("SELECT state FROM progress WHERE profile_id = ?").bind(id).first();
      return json({ state: row ? JSON.parse(row.state) : null });
    }
    if (parts[2] === "state" && method === "PUT") {
      const state = body.state;
      const text = JSON.stringify(state || {});
      if (text.length > 400000) return json({ error: "state too large" }, 413);
      const updated = Number(state?.updatedAt) || Date.now();
      // Keep whichever copy is newer.
      await db.prepare("INSERT INTO progress (profile_id, state, updated_at) VALUES (?, ?, ?) ON CONFLICT(profile_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at WHERE excluded.updated_at >= progress.updated_at")
        .bind(id, text, updated).run();
      return json({ ok: true });
    }
    if (parts[2] === "events" && method === "POST") {
      const events = Array.isArray(body.events) ? body.events.slice(0, 500) : [];
      if (events.length) {
        const stmt = db.prepare("INSERT OR IGNORE INTO events (profile_id, t, skill, level, approach, correct, first_try, hint, ms, question, given, answer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        await db.batch(events.map((e) => stmt.bind(id, Number(e.t) || Date.now(), clip(e.skill, 30), Number(e.level) || 0, clip(e.approach, 30), e.correct ? 1 : 0, e.firstTry ? 1 : 0, e.hint ? 1 : 0, Math.min(Number(e.ms) || 0, 3600000), clip(e.q, 300), clip(e.given, 200), clip(e.answer, 200))));
      }
      return json({ ok: true, stored: events.length });
    }
    if (parts[2] === "events" && method === "GET") {
      const limit = Math.min(Number(url.searchParams.get("limit")) || 200, 1000);
      const { results } = await db.prepare("SELECT * FROM events WHERE profile_id = ? ORDER BY t DESC LIMIT ?").bind(id, limit).all();
      return json({ events: results });
    }
    if (parts[2] === "summary" && method === "GET") {
      const { results } = await db.prepare("SELECT date(t / 1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS questions, SUM(correct) AS correct, SUM(first_try * correct) AS firstTry FROM events WHERE profile_id = ? GROUP BY day ORDER BY day DESC LIMIT 60").bind(id).all();
      return json({ days: results });
    }
  }

  // Lets the Grown-ups screen check that the Claude key is set and accepted.
  if (parts[0] === "ai" && parts[1] === "status" && method === "GET") {
    if (!env.ANTHROPIC_API_KEY) return json({ hasKey: false, ok: false });
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: env.AI_MODEL || "claude-haiku-5-5", max_tokens: 5, messages: [{ role: "user", content: "Say ok." }] }),
    }).catch(() => null);
    return json({ hasKey: true, ok: !!res?.ok, status: res?.status || 0, model: env.AI_MODEL || "claude-haiku-5-5" });
  }
  if (parts[0] === "ai" && method === "POST") {
    if (!env.ANTHROPIC_API_KEY) return json({ text: "" });
    const day = new Date().toISOString().slice(0, 10);
    const used = await db.prepare("INSERT INTO ai_usage (day, calls) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET calls = calls + 1 RETURNING calls").bind(day).first();
    if ((used?.calls || 0) > Number(env.AI_DAILY_LIMIT || 300)) return json({ text: "" });
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: env.AI_MODEL || "claude-haiku-5-5", max_tokens: Math.min(Number(body.max_tokens) || 200, 400), system: clip(body.system, 2000), messages: [{ role: "user", content: clip(body.user, 4000) }] }),
    });
    if (!res.ok) return json({ text: "" });
    const d = await res.json();
    return json({ text: d.content?.[0]?.text?.trim() || "" });
  }
  // Natural-sounding speech for the spelling words (Workers AI, Deepgram Aura). Each text is cached,
  // so a week's list costs a few cents at most; capped per day like the Claude calls.
  if (parts[0] === "tts" && method === "POST") {
    const text = String(body.text || "").trim().slice(0, 600);
    if (!text || !env.AI) return json({ error: "no tts" }, 503);
    const voice = ["asteria", "luna", "athena", "hera", "stella", "orion", "arcas"].includes(body.voice) ? body.voice : "asteria";
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(voice + "|" + text)))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const key = new Request(`https://${url.hostname}/__tts/${hash}`);
    const cache = typeof caches !== "undefined" ? caches.default : null;
    const hit = cache ? await cache.match(key).catch(() => null) : null;
    if (hit) return hit;
    const day = "tts-" + new Date().toISOString().slice(0, 10);
    const used = await db.prepare("INSERT INTO ai_usage (day, calls) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET calls = calls + 1 RETURNING calls").bind(day).first();
    if ((used?.calls || 0) > Number(env.TTS_DAILY_LIMIT || 1500)) return json({ error: "limit" }, 429);
    try {
      const res = await env.AI.run("@cf/deepgram/aura-1", { text, speaker: voice, encoding: "mp3" }, { returnRawResponse: true });
      if (!res.ok) return json({ error: "tts failed" }, 502);
      const out = new Response(await res.arrayBuffer(), { headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=2592000" } });
      if (cache) await cache.put(key, out.clone()).catch(() => {});
      return out;
    } catch { return json({ error: "tts failed" }, 502); }
  }
  return json({ error: "not found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return api(request, env, url);
    return env.ASSETS.fetch(request);
  },
};
