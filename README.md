# Math Adventure (v2)

An adaptive math game for Stella, built as an iPad home-screen app (PWA) hosted at **https://mathtutor.friedmann.vip**.

- 13 skills covering her Savvas enVision Topic 1–2 work: mental math, rounding and estimating, addition and subtraction with regrouping (including across zeros), missing digits, place value and written number names, data tables, word problems, times tables, division, area and perimeter, and properties.
- Eight teaching styles (direct, story, see it, pick one, math detective, worked example, estimate first, lightning round). The app tracks which ones lead to correct answers *on the next question of the same skill*, and gradually favors those for each skill while still trying others now and then.
- Difficulty adjusts per skill to keep her at about 80% correct.
- All math is computed in code. Claude is used only for celebrations, "explain it another way", and the end-of-adventure note.
- Login: Cloudflare Access emails a one-time code to approved family addresses, then a "Who's playing?" screen picks the profile (optional 4-digit code per player). Progress syncs across devices through a Cloudflare D1 database.

## One-time setup (about 15 minutes)

You need Node.js 20+ on your PC.

```
cd math-tutor-v2
npm install
npx wrangler login
```

The D1 database `mathtutor` already exists in your Cloudflare account and its tables are created. (If you ever need to recreate them: `npm run db:init`.)

### 1. Protect the site with Cloudflare Access (email code)

In the Cloudflare dashboard, open **Zero Trust**:

1. **Settings → Authentication → Login methods**: make sure **One-time PIN** is enabled.
2. **Access → Applications → Add an application → Self-hosted**.
   - Application name: Math Adventure
   - Domain: `mathtutor.friedmann.vip`
   - Session duration: **1 month** (so Stella isn't asked for a code often)
3. Add a policy: Action **Allow**, Include **Emails**, and list each family email address.
4. Save. Then open the application's **Overview** and copy the **Application Audience (AUD) Tag**.
5. Your team domain is shown in Zero Trust **Settings** (team name and domain), in the form `https://<team-name>.cloudflareaccess.com`.

Put both values into `wrangler.jsonc`:

```
"TEAM_DOMAIN": "https://<team-name>.cloudflareaccess.com",
"POLICY_AUD": "<the AUD tag>",
```

The Worker checks Access's signed token on every `/api` call, so even if Access were misconfigured, no data is returned without a valid login.

### 2. Store the Claude API key as a secret

Use the **new** key you created after rotating the one that was in the old App.js:

```
npx wrangler secret put ANTHROPIC_API_KEY
```

It is stored only in Cloudflare, never in the app. `AI_DAILY_LIMIT` in `wrangler.jsonc` caps Claude calls per day (300 by default). Without a key the game still works; it just uses built-in messages.

### 3. Deploy

**Normally you do nothing: merging a pull request into `main` publishes the site.** The `mathtutor` Worker is connected to this GitHub repo with Cloudflare Workers Builds (Worker → Settings → Builds). On every push to `main` Cloudflare runs:

- Build command: `npm test && npm run build` (a failing test stops the deploy, and the live site stays as it was)
- Deploy command: `npx wrangler deploy`

The build result shows as a check on the commit in GitHub and under the Worker's **Deployments** tab. The `ANTHROPIC_API_KEY` secret stays in Cloudflare and is kept across deploys. Pull requests also run the tests in GitHub Actions (`.github/workflows/test.yml`).

To roll back, open the Worker's **Deployments** tab in Cloudflare and pick an earlier version, or revert the PR on GitHub.

Deploying by hand still works if you ever need it:

```
npm run deploy
```

This builds the app and publishes it, and attaches `mathtutor.friedmann.vip` to the Worker.

## On the iPad

1. Open **https://mathtutor.friedmann.vip** in Safari, enter the family email, and type the code that arrives.
2. Tap **Share → Add to Home Screen**.
3. Open it from the home screen. iPadOS keeps home-screen apps' logins separately from Safari, so you will enter the email code once more the first time it opens there.
4. Create Stella's player. Grown-ups get to settings with **👪 Grown-ups** on the home screen (a quick multiplication question keeps her out).

## How she learns

- **First answer counts.** A wrong answer shows the right answer, the steps and a tip about the kind of mistake, then moves on. The question comes back a few questions later (the same one first, then a fresh one like it). **⏭ Skip** works the same way.
- **🙋 Help** on every question: a hint, the first step, "explain it another way", **ask my own question** (by voice, or typed) and a mini-lesson. Answers are short and written for a young reader, and never give the answer away. Questions answered with help come back later so she can try them alone.
- **Mini-lessons** appear when a skill is new, when she slips on a skill, or when the same kind of mistake repeats (at most 2 per adventure). Five lesson styles; the app learns which one helps her most. She can also pick lessons herself with **📚 Lessons**.
- **Leaving mid-adventure** is fine: the home screen offers "Keep going". Progress saves after every answer and retries until the server has it.

## 🏋️ Math Gym

A separate mode (home screen → **🏋️ Math Gym**) for making fact relationships automatic. "Today's workout" is about 5 minutes: a warm-up on facts she knows, then fact sprints with the other three stations mixed in. Each station can also be played on its own.

- **⚡ Fact Sprint**: times tables 2–12, checked as soon as she has typed enough digits. Weak facts (from the heat map) and the extra-practice tables (12s by default) come up most. A fact turns **strong 💪** after two right answers in a row, on her own, under the speed goal (4 seconds by default). Slow right answers count as right but the fact keeps coming back. Every fact has a strategy built from an easier one (12 × 7 = 10 × 7 + 2 × 7, 8s are double 4s, 9s are 10s minus one group, and so on), shown with 💡 Show me or after a miss.
- **🔗 Fact Links**: split 12 into 10 + 2 (and 11, 9), one more or one less group, fact families and division, and facts × 10 or × 100.
- **✌️ Double & Halve**: doubles and halves up to 3 digits, doubling chains that build the 4s, 8s, 6s and 12s, and "halve one, double the other".
- **🟦 Shape Lab**: area models split at 10 (or in half), stretching one side, scaling both sides (area grows k × k), same-shape rectangles, and ratio tile patterns. It names additive thinking ("same shape, so add the difference") as its own mistake.

Misses come back a few reps later in the same workout, then again in later workouts until fixed. The muscle map on the gym screen shows every fact from 2 × 2 to 12 × 12. Gym results use the same learning record as adventures (mistakes, heat map, history), but sprints don't move the adventure's Times Tables level. The three gym skills are **Off** for adventures by default (Grown-ups → Skills to mix them in). Grown-ups → Times tables has the speed goal, the extra-practice tables, and how many facts in each table are strong.

## Grown-ups screen

- **Her class has finished through**: the enVision Grade 4 unit her class has reached (Units 1–16, in school order). Skills from later units stay off until you move it forward.
- **Study mode**: pick any unit (1–16) and the lessons a test covers. While it's on, everything she practises comes from those lessons, and each lesson shows a readiness score. **Inventory** mixes last year's review with every unit through the one you pick, for the beginning- and end-of-year inventory exams. Units 1–3 use the school's lesson numbers; later units list what the topic covers.
- **Mistakes**: every miss, skip and help-assisted answer, what kind of mistake it looks like, and whether she fixed it on the second chance.

- **Skills**: level, mastery, recent accuracy, and a focus setting (Normal / Extra practice / Off) per skill. Set "Extra" on whatever her class is working on.
- **Teaching styles**: which approaches are working for her, with how much evidence each has.
- **Times-table heat map**.
- **Settings**: questions per adventure, timers on/off, player code, reset, delete, and **Check the AI helper** (confirms the Claude key works).

## Development

```
npm test                      # checks 378,000 generated questions, plus lessons, mistakes, reviews and the Math Gym
npm run build                 # writes dist/
npx wrangler dev --var DEV_EMAIL:you@example.com   # local server with a local database
```

Opening `dist/index.html` without the server runs in local mode: progress stays in that browser and a parent can enter an API key on the Grown-ups screen.

## Files

- `src/engine/` skills, teaching styles, adaptive learner, answer checking
- `src/screens/` profiles, home, game, grown-ups
- `src/gym/` Math Gym (workouts, speed record, muscle map); gym skills are in `src/engine/gymskills.js`
- `worker/` Cloudflare Worker API and database schema
- `public/` page template, manifest, service worker, icons
