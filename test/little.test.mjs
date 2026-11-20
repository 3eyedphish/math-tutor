// Little Learner (preschool) engine: every lesson builds full rounds with one right answer,
// distractors never sound like the target letter, progress/unlocking works.
import assert from "node:assert/strict";
import * as E from "../src/little/engine.js";

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

assert.equal(E.ABC.length, 26);
for (const L of E.ABC) { const x = E.LETTERS[L]; assert.ok(x.say && x.snd && x.words.length >= 2, L); if (!x.end) for (const [w] of x.words) assert.equal(w[0].toUpperCase(), L, `${w} starts with ${L}`); }

for (const subject of ["math", "abc"]) {
  for (const l of E.allLessons(subject)) {
    for (let k = 0; k < 40; k++) {
      const r = E.makeRound(l, { name: "Leo" }, rnd);
      assert.equal(r.length, l.len, `${l.id} round length`);
      for (const q of r) {
        assert.ok(q.say, `${l.id} spoken prompt`);
        if (!q.choices) continue;
        assert.ok(q.answer >= 0 && q.answer < q.choices.length, `${l.id} has an answer: ${q.say}`);
        const keys = q.choices.map((c) => JSON.stringify([c.v, c.n, c.scale, c.word]));
        assert.equal(new Set(keys).size, keys.length, `${l.id} distinct choices`);
        assert.ok(q.hint && q.reveal, `${l.id} hint + reveal`);
        if (q.kind === "sound") for (const c of q.choices) if (c !== q.choices[q.answer]) {
          const L = E.ABC.find((x) => E.LETTERS[x].words.some(([w]) => w === c.word));
          assert.ok(!["C", "K", "Q"].includes(L) || !["C", "K", "Q"].includes(q.letter), `${l.id} no sound-alike distractor (${q.letter}/${L})`);
        }
        if (q.kind === "count") assert.equal(q.choices[q.answer].v, q.view.groups[0].n);
        if (q.kind === "add") assert.equal(q.choices[q.answer].v, q.view.groups[0].n + q.view.groups[1].n);
      }
    }
  }
}
assert.equal(E.allLessons("math").length, 30);
assert.equal(E.allLessons("abc").length, 48);

// Name spelling uses the child's own letters.
const nm = E.makeRound(E.findLesson("abc", "a8-1"), { name: "Leo" }, rnd);
assert.deepEqual(nm[0].letters, ["L", "E", "O"]);

// Stars and unlocking.
assert.equal(E.starsFor(5, 5), 3); assert.equal(E.starsFor(4, 5), 3); assert.equal(E.starsFor(3, 5), 2); assert.equal(E.starsFor(1, 5), 1);
const st = { stars: 0 };
E.setStage(st, "preschool");
assert.ok(E.isLittle(st));
assert.ok(E.isOpen(st, "math", "m1-1"));
assert.ok(!E.isOpen(st, "math", "m1-2"));
assert.ok(!E.isOpen(st, "math", "m2-1"));
assert.equal(E.nextLesson(st, "math").id, "m1-1");
const r = E.finishLesson(st, "math", "m1-1", 4, 5, 1000, rnd);
assert.equal(r.stars, 3); assert.ok(r.sticker); assert.equal(st.stars, 3);
assert.ok(E.isOpen(st, "math", "m1-2"));
assert.ok(E.isOpen(st, "math", "m2-1"), "next unit's first lesson opens once this unit is started");
assert.ok(!E.isOpen(st, "math", "m2-2"));
assert.equal(E.nextLesson(st, "math").id, "m1-2");
E.finishLesson(st, "math", "m1-1", 1, 5, 2000, rnd);
assert.equal(E.lessonRec(st, "math", "m1-1").stars, 3, "best stars kept");
assert.equal(E.lessonRec(st, "math", "m1-1").plays, 2);
st.little.unlockAll = true;
assert.ok(E.isOpen(st, "abc", "a8-6"));
E.setStage(st, "big"); assert.ok(!E.isLittle(st));
console.log("little learner tests passed");
