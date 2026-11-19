// Spelling engine: list parsing, checking, letter diff, spaced repetition.
import assert from "node:assert/strict";
import { SEED_LIST, ensureSpell, activeList, parseList, listToText, saveList, check, diffLetters, record, practiceOrder, requeue, wordRec, listProgress } from "../src/spell/engine.js";

const st = {};
ensureSpell(st);
assert.equal(activeList(st).id, "2026-u4");
assert.deepEqual(SEED_LIST.words.map((x) => x.w), ["Thanksgiving", "knowledge", "colonialism", "fasten", "hustle", "ghost", "navigation", "monarchy", "companies", "merchant", "conquistador", "astrolabe"]);
for (const x of SEED_LIST.words) { assert.ok(x.s.toLowerCase().includes(x.w.toLowerCase()), `sentence uses ${x.w}`); assert.ok(x.tip); }

// Parsing: one per line, pipes, commas, numbering, duplicates.
const p = parseList("1. ghost | The ghost said boo. | silent h\nmerchant, companies\n\n  Ghost\n2) fasten");
assert.deepEqual(p.map((x) => x.w), ["ghost", "merchant", "companies", "fasten"]);
assert.equal(p[0].s, "The ghost said boo.");
assert.equal(p[0].tip, "silent h");
assert.deepEqual(parseList(listToText(SEED_LIST)), SEED_LIST.words);

// Checking: case-insensitive with a capital reminder; trims spaces.
assert.equal(check("Thanksgiving", "thanksgiving").ok, true);
assert.match(check("Thanksgiving", "thanksgiving").capNote, /capital T/);
assert.equal(check("ghost", " ghost ").ok, true);
assert.equal(check("ghost", "gost").ok, false);
const d = diffLetters("ghost", "gost");
assert.deepEqual(d.map((x) => x.kind), ["ok", "miss", "ok", "ok", "ok"]);
assert.deepEqual(diffLetters("knowledge", "nolege").filter((x) => x.kind === "miss").map((x) => x.ch).join(""), "kwd");

// Spaced repetition: right moves up, a miss resets and is practised first.
const t0 = Date.UTC(2026, 10, 19);
record(st, "ghost", true, "ghost", "practice", t0);
record(st, "ghost", true, "ghost", "practice", t0);
assert.equal(wordRec(st, "ghost").box, 2);
record(st, "merchant", false, "merchent", "practice", t0);
assert.equal(wordRec(st, "merchant").box, 0);
assert.deepEqual(wordRec(st, "merchant").misses, ["merchent"]);
const order = practiceOrder(st, activeList(st), t0 + 1000, () => 0.5);
assert.equal(order[order.length - 1].w, "ghost", "strong, not-due word goes last");
assert.notEqual(order.findIndex((x) => x.w === "merchant"), -1);
assert.ok(order.findIndex((x) => x.w === "merchant") < order.findIndex((x) => x.w === "ghost"));
assert.equal(listProgress(st, activeList(st)).known, 1);

// Requeue: a miss comes back 3 words later, marked as a retry.
const q = requeue([{ w: "a" }, { w: "b" }, { w: "c" }, { w: "d" }], { w: "x" });
assert.deepEqual(q.map((x) => x.w), ["a", "b", "c", "x", "d"]);
assert.equal(q[3].again, true);
assert.deepEqual(requeue([{ w: "a" }], { w: "x" }).map((x) => x.w), ["a", "x"]);

// New week's list becomes active; old progress per word is kept.
saveList(st, { title: "Unit 5", testDate: "2026-11-27", words: parseList("ghost\nharbor") });
assert.equal(activeList(st).title, "Unit 5");
assert.equal(wordRec(st, "ghost").box, 2);
assert.equal(st.spell.lists.length, 2);

// Writing: finding list words in her writing, near misses, sentence tips, blank stories.
import { findWords, sentenceTips, parseStory, storyFits, sentenceStory } from "../src/spell/engine.js";
const u4 = SEED_LIST;
const f = findWords("On Thanksgiving the merchent hustled to the ships of two companys. A ghost!", u4);
assert.deepEqual(f.used, ["Thanksgiving", "hustle", "ghost"]);
assert.deepEqual(f.near.map((n) => n.word), ["merchant", "companies"]);
assert.deepEqual(findWords("I like ham and the cat sat.", u4), { used: [], near: [] });
assert.equal(sentenceTips("The ghost floated away.").length, 0);
assert.equal(sentenceTips("the ghost").length, 3);
assert.ok(storyFits(u4.story, u4));
const segs = parseStory("A [[ghost]] and a [[merchant]].");
assert.deepEqual(segs, [{ text: "A " }, { blank: "ghost" }, { text: " and a " }, { blank: "merchant" }, { text: "." }]);
assert.ok(storyFits(sentenceStory(u4), u4));
assert.ok(!storyFits("No blanks here.", u4));
console.log("spell tests passed");
