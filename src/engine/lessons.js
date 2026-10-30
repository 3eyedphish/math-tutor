// Mini-lessons: short, interactive explanations that appear between questions
// when her results say a skill needs teaching (new skill, a slump, or the same
// kind of mistake repeating). Like the question styles, the app learns which
// lesson style helps her most, judged by how she does on that skill afterwards.
import { SKILL, makeItem } from "./skills.js";
import { MISTAKES, PATTERN_TYPES } from "./mistakes.js";
import { betaSample } from "./learner.js";
import { rand } from "./util.js";
import { studyRanges, clampLevel } from "./units.js";

// What each lesson teaches. idea = the one thing to remember; trick = a memorable strategy.
export const LESSON_TEXT = {
  mental: { idea: "Mental math is about making numbers friendly. Break them into tens and ones, or nudge one number to a round number and fix it up after.", trick: "Make it friendly, then fix it up! 199 + 45 is 200 + 45, then take 1 away." },
  facts: { idea: "A times fact is equal groups. 6 × 4 means 6 groups of 4. You can build a hard fact from easy ones you already know.", trick: "Stuck on 7 × 8? Do 5 × 8 = 40 and 2 × 8 = 16, then 40 + 16 = 56." },
  division: { idea: "Division shares a number into equal groups. Every division fact has a times fact hiding inside it.", trick: "To find 56 ÷ 8, ask: 8 times what makes 56? Think multiplication!" },
  rounding: { idea: "Rounding finds the nearest friendly number. Look at the digit just to the right of the place you're rounding to.", trick: "5 or more, raise the score. 4 or less, let it rest." },
  estimate: { idea: "An estimate is a smart guess. Round the numbers first, then do the easy math. It tells you if an exact answer makes sense.", trick: "Round, then add or subtract. If an answer is far from your estimate, something went wrong." },
  add: { idea: "Line the numbers up by place and add from right to left: ones, then tens, then hundreds. When a column makes 10 or more, carry the ten to the next column.", trick: "Ones first! 10 ones make 1 ten, so carry it over." },
  subtract: { idea: "Subtract from right to left. If the top digit is too small, regroup: borrow 1 from the next place, which gives you 10 more in this place.", trick: "More on the floor? Go next door and get 10 more! If next door is 0, keep going until you find a neighbor who can lend." },
  missing: { idea: "A missing-digit puzzle is a normal problem with a hole in it. Work column by column and ask which digit makes that column work.", trick: "Use the opposite: check subtraction with addition, and addition with subtraction." },
  placevalue: { idea: "Each digit's place tells its value. In 4,382 the 4 is worth 4,000, the 3 is 300, the 8 is 80 and the 2 is 2. Commas split the thousands from the rest.", trick: "Read the number before the comma, say 'thousand', then read the rest." },
  tables: { idea: "Tables hold the numbers you need. Find the right row and column first, then decide whether to add, subtract or compare.", trick: "Point to each number you need before you do any math." },
  words: { idea: "Word problems are stories with math inside. Find what's being asked, find the numbers, then pick the operation that matches the story.", trick: "Equal groups means multiply. Putting together means add. Taking away or 'how many more' means subtract." },
  area: { idea: "Area is how many squares fit inside a shape: length × width. Perimeter is the distance around the edge: add all the sides.", trick: "Area = fill it in (multiply). Perimeter = fence it in (add all four sides)." },
  compare: { idea: "To compare two numbers, line them up by place. Start at the left and find the first place where the digits are different. The number with the bigger digit there is greater. Each place is worth 10 times the place to its right.", trick: "The open mouth of < or > always eats the bigger number!" },
  multiply: { idea: "To multiply a big number by a 1-digit number, break the big number into its places (like 247 = 200 + 40 + 7). Multiply each part, then add the partial products.", trick: "6 × 247 = 6 × 200 + 6 × 40 + 6 × 7 = 1,200 + 240 + 42 = 1,482" },
  mult2: { idea: "To multiply two 2-digit numbers, break both into tens and ones. Multiply every part by every part (that's four little products), then add them up.", trick: "23 × 14: 20 × 10 = 200, 20 × 4 = 80, 3 × 10 = 30, 3 × 4 = 12. Add: 200 + 80 + 30 + 12 = 322." },
  divide1: { idea: "Long division shares from the biggest place first. Divide, multiply, subtract, bring down, then repeat. Anything left that's too small to share is the remainder.", trick: "Dad, Mom, Sister, Brother: Divide, Multiply, Subtract, Bring down!" },
  operations: { idea: "'Times as many' is a multiplication story: 3 times as many as 5 is 3 × 5. Big problems are just two or three small problems in a row, so solve the first part before the next.", trick: "Ask: what's the hidden question I need to answer first?" },
  factors: { idea: "Factors are numbers that multiply to make a number: 3 × 4 = 12, so 3 and 4 are factors of 12. Multiples are what you get when you skip-count: 4, 8, 12, 16… A prime number has only 2 factors: 1 and itself.", trick: "Factors are few (they fit inside). Multiples are many (they go on forever)." },
  fracEquiv: { idea: "Equivalent fractions name the same amount. Multiply (or divide) the top and the bottom by the SAME number and the fraction keeps its size.", trick: "Whatever you do to the bottom, do to the top!" },
  fracAdd: { idea: "When fractions have the same denominator, add or subtract the tops (numerators) and keep the bottom (denominator). For mixed numbers, do the wholes and the fractions separately, then regroup if you need to.", trick: "The bottom tells the size of the pieces. The pieces don't change size, so the bottom stays the same!" },
  fracMult: { idea: "Multiplying a fraction by a whole number is repeated addition: 3 × 2/5 is 2/5 + 2/5 + 2/5 = 6/5. Multiply the whole number by the top and keep the bottom.", trick: "Top times the whole, bottom stays home." },
  linePlot: { idea: "A line plot shows data with X's above a number line. Each X is one thing that was measured. Count the X's to answer questions.", trick: "Point and count every X. Longest is farthest right, shortest is farthest left." },
  decimals: { idea: "Decimals are another way to write tenths and hundredths. 0.3 means 3 tenths (3/10). 0.25 means 25 hundredths (25/100). Money works the same way: $1.25 is 1 dollar and 25 hundredths of a dollar.", trick: "Make them the same length before comparing: 0.5 = 0.50, which is bigger than 0.45!" },
  measurement: { idea: "To change a big unit into a small unit, multiply. 1 foot = 12 inches, so 3 feet = 3 × 12 = 36 inches.", trick: "Big to small? Multiply them all!" },
  patterns: { idea: "A pattern follows a rule, like 'add 4' or 'multiply by 2'. Find the rule by looking at how each number changes into the next, then check it works every time.", trick: "For a repeating shape pattern, divide by how long the pattern is. The remainder tells you where you land." },
  angles: { idea: "Angles are measured in degrees (°). A full turn is 360°, a straight line is 180°, and a square corner (right angle) is 90°. Angles that sit side by side add up.", trick: "Acute is a-cute little angle (less than 90°). Obtuse is big (more than 90°)." },
  geometry: { idea: "Parallel lines never meet. Perpendicular lines meet at a right angle. Shapes are named by their sides and angles, and a line of symmetry folds a shape into matching halves.", trick: "The two lines in the letter H are parallel. The lines in the letter T are perpendicular." },
  doubling: { idea: "Doubling means two of the same: double 7 is 7 + 7 = 14. Halving splits a number into two equal parts. Doubling builds hard times tables from easy ones: 4s are double 2s, 8s are double 4s, and 12s are double 6s.", trick: "Big number? Double the tens, double the ones, then add: double 36 = 60 + 12 = 72." },
  factlinks: { idea: "Every times fact is linked to others. 12 × 7 is 10 × 7 plus 2 × 7. 9 × 7 is one 7 less than 10 × 7. If you know one fact, you can find its neighbours.", trick: "Split the 12! 12 × 6 = 10 × 6 + 2 × 6 = 60 + 12 = 72." },
  shapes: { idea: "A rectangle of squares is a times fact you can see: 12 by 4 is 12 × 4 squares. Stretch one side 2 times as long and the area doubles. Stretch both sides and it grows 2 × 2 = 4 times.", trick: "Same shape means MULTIPLY both sides by the same number, never add." },
  properties: { idea: "You can change the ORDER or GROUPING of numbers you add or multiply and get the same answer. You can also break a number apart to make it easier.", trick: "3 × 7 is the same as 7 × 3. And 6 × 12 = 6 × 10 + 6 × 2." },
};

export const LESSON_STYLES = [
  { id: "steps", name: "Step by step", emoji: "🪜", desc: "A worked example, revealed one step at a time, then two to try.", applies: () => true },
  { id: "picture", name: "Picture it", emoji: "🖼️", desc: "A worked example built around a picture: blocks, a number line, columns or a table.", applies: (ex) => !!(ex.visual || ex.column || ex.table) },
  { id: "story", name: "Story lesson", emoji: "📚", desc: "A character from her world walks through a story problem with her.", applies: (ex) => typeof ex.story === "function" },
  { id: "tryFirst", name: "Try it first", emoji: "🧗", desc: "She tries a problem first, then sees how it's done, then tries another.", applies: () => true },
  { id: "trick", name: "Big idea & trick", emoji: "💡", desc: "One memorable rule or trick, a quick example, then practice.", applies: () => true },
];
export const LESSON_STYLE = Object.fromEntries(LESSON_STYLES.map((s) => [s.id, s]));

export const MAX_LESSONS_PER_SESSION = 2;

// Does this skill need a lesson right now? Returns null or { reason, errorType }.
export function lessonNeed(st, skill) {
  const k = st.skills[skill];
  const since = k.lastLessonAt ?? -999;
  const gap = st.counter - since;
  // The same kind of mistake twice since the last lesson.
  const recentMisses = st.mistakes.filter((m) => m.skill === skill && m.counter > since).slice(-5);
  const counts = {};
  for (const m of recentMisses) if (PATTERN_TYPES.has(m.errorType)) counts[m.errorType] = (counts[m.errorType] || 0) + 1;
  const pattern = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (pattern && pattern[1] >= 2 && gap >= 3) return { reason: "pattern", errorType: pattern[0] };
  if (!k.lessonCount && k.seen < 2) return { reason: "new" };
  if (gap < 15) return null;
  if (k.justDropped) return { reason: "struggling" };
  const h = st.history.filter((x) => x.skill === skill && x.counter > since && !x.skipped && !x.review).slice(-6);
  if (h.length >= 4 && h.filter((x) => x.ok).length / h.length < 0.5) return { reason: "struggling" };
  return null;
}

const stat = (st, skill, id) => {
  const g = st.lessonBandit.global[id] || { a: 0, b: 0 };
  const s = st.lessonBandit.bySkill[skill]?.[id] || { a: 0, b: 0 };
  return { a: 1 + s.a + 0.5 * (g.a - s.a), b: 1 + s.b + 0.5 * (g.b - s.b) };
};
export function lessonScores(st) {
  return LESSON_STYLES.map((ls) => {
    const g = st.lessonBandit.global[ls.id] || { a: 0, b: 0 };
    return { id: ls.id, mean: (1 + g.a) / (2 + g.a + g.b), n: g.a + g.b };
  });
}
function chooseStyle(st, skill, example) {
  const options = LESSON_STYLES.filter((ls) => ls.applies(example));
  if (Math.random() < 0.15) return options[rand(0, options.length - 1)].id;
  const lastStyle = st.lessonLog.at(-1)?.style;
  let best = options[0].id, bestScore = -1;
  for (const ls of options) {
    const { a, b } = stat(st, skill, ls.id);
    let score = betaSample(a, b);
    if (ls.id === lastStyle) score *= 0.85;
    if (score > bestScore) { bestScore = score; best = ls.id; }
  }
  return best;
}

// Lesson examples and practice must be single questions (no multi-step parts).
function simpleItem(skill, level, theme, genCtx, avoidText) {
  for (let lv = level; lv >= 1; lv--) {
    for (let i = 0; i < 20; i++) {
      const it = makeItem(skill, lv, theme, genCtx);
      if (it.answerType !== "parts" && it.text !== avoidText && (it.steps?.length || 0) >= 1) return it;
    }
  }
  return makeItem(skill, 1, theme, genCtx);
}

export function buildLesson(st, skill, theme, genCtx, need) {
  const level = clampLevel(st.skills[skill].level, studyRanges(st)?.[skill], SKILL[skill].maxLevel);
  const example = simpleItem(skill, level, theme, genCtx);
  const style = need.style && LESSON_STYLE[need.style]?.applies(example) ? need.style : chooseStyle(st, skill, example);
  const practiceLevel = Math.max(1, level - (need.reason === "struggling" ? 1 : 0));
  const practice = [simpleItem(skill, practiceLevel, theme, genCtx, example.text), simpleItem(skill, practiceLevel, theme, genCtx, example.text)];
  const text = LESSON_TEXT[skill];
  return {
    skill, style, reason: need.reason, errorType: need.errorType,
    title: SKILL[skill].name, emoji: SKILL[skill].emoji,
    idea: text.idea, trick: text.trick,
    watchOut: need.errorType ? MISTAKES[need.errorType]?.kid : "",
    example: style === "story" ? { ...example, text: example.story(theme), column: undefined } : example,
    practice,
  };
}

function credit(st, skill, id, reward, weight) {
  const g = (st.lessonBandit.global[id] ||= { a: 0, b: 0 });
  const s = ((st.lessonBandit.bySkill[skill] ||= {})[id] ||= { a: 0, b: 0 });
  for (const t of [g, s]) { t.a += weight * reward; t.b += weight * (1 - reward); }
}
// practice: [true/false, ...]; feel: 'happy' | 'ok' | 'meh' | null
export function recordLesson(st, lesson, practice, feel) {
  const k = st.skills[lesson.skill];
  k.lessonCount = (k.lessonCount || 0) + 1;
  k.lastLessonAt = st.counter;
  k.justDropped = false;
  const ok = practice.filter(Boolean).length;
  credit(st, lesson.skill, lesson.style, ok / Math.max(1, practice.length), 0.3);
  if (feel) credit(st, lesson.skill, lesson.style, { happy: 1, ok: 0.6, meh: 0.1 }[feel], 0.2);
  // The real test: how she does on the next 3 questions of this skill.
  st.pendingLesson[lesson.skill] = { style: lesson.style, n: 0, ok: 0, logId: Date.now() };
  st.lessonLog = [...st.lessonLog, { id: st.pendingLesson[lesson.skill].logId, t: Date.now(), skill: lesson.skill, style: lesson.style, reason: lesson.reason, errorType: lesson.errorType || null, practice: `${ok}/${practice.length}`, feel: feel || null, after: null }].slice(-100);
}
// Called from recordResult for every regular answer.
export function creditLessonTransfer(st, skill, success) {
  const p = st.pendingLesson[skill];
  if (!p) return;
  p.n++; p.ok += success;
  if (p.n >= 3) {
    credit(st, skill, p.style, p.ok / p.n, 1.0);
    const entry = st.lessonLog.find((e) => e.id === p.logId);
    if (entry) entry.after = `${p.ok}/${p.n}`;
    delete st.pendingLesson[skill];
  }
}
