// School units (Savvas enVision Grade 4 topics, in school order), mapped to the app's skills.
// Study mode limits practice to the lessons a grown-up picks before a test.
// levels: the difficulty range that matches what the lesson's worksheets ask.
// Units 1–3 use the lesson numbers from her school worksheets. Later units list
// what the topic covers without lesson numbers until we see those worksheets.
import { SKILL } from "./skills.js";

// Third-grade skills the beginning-of-year inventory checks.
const REVIEW = {
  id: "u0", name: "Grade 3 review", title: "Facts and skills from last year", topic: 0,
  lessons: [
    { id: "r-1", name: "Times tables and division facts", skills: { facts: [1, 5], division: [1, 3] } },
    { id: "r-2", name: "Add and subtract within 1,000", skills: { add: [1, 3], subtract: [1, 3], mental: [1, 3] } },
    { id: "r-3", name: "Round to the nearest 10 or 100", skills: { rounding: [1, 3] } },
    { id: "r-4", name: "Area and perimeter", skills: { area: [1, 4] } },
    { id: "r-5", name: "Word problems", skills: { words: [1, 3] } },
  ],
};
const L = (name, skills) => ({ name, skills }); // a lesson without a known school number

export const UNITS = [
  {
    id: "u1", name: "Unit 1", title: "Place value to one million", topic: 1,
    lessons: [
      { id: "1-1", name: "Numbers through one million", skills: { placevalue: [2, 5] } },
      { id: "1-2", name: "Place value relationships", skills: { compare: [3, 3], placevalue: [3, 5] } },
      { id: "1-3", name: "Compare whole numbers", skills: { compare: [1, 4] } },
      { id: "1-4", name: "Round whole numbers", skills: { rounding: [1, 4] } },
      { id: "1-5", name: "Construct arguments", skills: { rounding: [3, 5], compare: [2, 4] } },
    ],
  },
  {
    id: "u2", name: "Unit 2", title: "Add and subtract big numbers", topic: 2,
    lessons: [
      { id: "2-1", name: "Mental math for sums and differences", skills: { mental: [3, 5], properties: [3, 3] } },
      { id: "2-2", name: "Estimate sums and differences", skills: { estimate: [1, 4], rounding: [3, 5] } },
      { id: "2-3", name: "Add whole numbers", skills: { add: [2, 3] } },
      { id: "2-4", name: "Add greater numbers", skills: { add: [4, 6] } },
      { id: "2-5", name: "Subtract whole numbers", skills: { subtract: [2, 3] } },
      { id: "2-6", name: "Subtract greater numbers", skills: { subtract: [4, 6], missing: [1, 3] } },
      { id: "2-7", name: "Subtract across zeros", skills: { subtract: [5, 7] } },
      { id: "2-8", name: "Reasoning with tables and word problems", skills: { words: [1, 4], tables: [1, 4] } },
    ],
  },
  {
    id: "u3", name: "Unit 3", title: "Multiply by 1-digit numbers", topic: 3,
    lessons: [
      { id: "3-1", name: "Multiply by multiples of 10, 100 and 1,000", skills: { multiply: [1, 1], facts: [3, 5] } },
      { id: "3-2", name: "Estimate products", skills: { multiply: [2, 2] } },
      { id: "3-3", name: "Arrays and partial products", skills: { multiply: [3, 3] } },
      { id: "3-4", name: "Area models and partial products", skills: { multiply: [3, 4] } },
      { id: "3-5", name: "More area models and partial products", skills: { multiply: [4, 5] } },
      { id: "3-6", name: "Mental math for multiplication", skills: { mental: [4, 5], multiply: [1, 1] } },
      { id: "3-7", name: "Choose a strategy to multiply", skills: { multiply: [3, 5] } },
      { id: "3-8", name: "Model with math", skills: { multiply: [3, 4], words: [2, 4] } },
    ],
  },
  { id: "u4", name: "Unit 4", title: "Multiply by 2-digit numbers", topic: 4, lessons: [
    L("Multiply by multiples of 10", { mult2: [1, 1], mental: [4, 4] }),
    L("Estimate products", { mult2: [2, 2] }),
    L("Arrays, area models and partial products", { mult2: [3, 3] }),
    L("Multiply 2-digit by 2-digit numbers", { mult2: [3, 4] }),
    L("Word problems with multiplication", { mult2: [4, 4], words: [3, 4] }),
  ] },
  { id: "u5", name: "Unit 5", title: "Divide by 1-digit numbers", topic: 5, lessons: [
    L("Mental math: divide tens and hundreds", { divide1: [1, 1] }),
    L("Estimate quotients", { divide1: [2, 2] }),
    L("Divide with remainders", { divide1: [3, 3], division: [2, 3] }),
    L("Divide 3- and 4-digit numbers", { divide1: [4, 4] }),
    L("What the remainder means", { divide1: [5, 5] }),
  ] },
  { id: "u6", name: "Unit 6", title: "Use operations to solve problems", topic: 6, lessons: [
    L("Times as many (comparing)", { operations: [1, 2] }),
    L("Multi-step problems", { operations: [3, 3], words: [3, 4] }),
  ] },
  { id: "u7", name: "Unit 7", title: "Factors and multiples", topic: 7, lessons: [
    L("Factors and factor pairs", { factors: [1, 1] }),
    L("Prime and composite numbers", { factors: [2, 2] }),
    L("Multiples", { factors: [3, 3] }),
  ] },
  { id: "u8", name: "Unit 8", title: "Fraction equivalence and ordering", topic: 8, lessons: [
    L("Equivalent fractions", { fracEquiv: [1, 2] }),
    L("Compare fractions", { fracEquiv: [3, 3] }),
    L("Order fractions", { fracEquiv: [4, 4] }),
  ] },
  { id: "u9", name: "Unit 9", title: "Add and subtract fractions", topic: 9, lessons: [
    L("Break a fraction into a sum", { fracAdd: [1, 1] }),
    L("Add and subtract with the same denominator", { fracAdd: [1, 2] }),
    L("Add mixed numbers", { fracAdd: [3, 3] }),
    L("Subtract mixed numbers", { fracAdd: [4, 4] }),
  ] },
  { id: "u10", name: "Unit 10", title: "Multiply fractions by whole numbers", topic: 10, lessons: [
    L("Fractions as groups of unit fractions", { fracMult: [1, 1] }),
    L("Multiply a fraction by a whole number", { fracMult: [2, 3] }),
  ] },
  { id: "u11", name: "Unit 11", title: "Data and line plots", topic: 11, lessons: [
    L("Read a line plot", { linePlot: [1, 2] }),
    L("Solve problems with line plots", { linePlot: [2, 3] }),
  ] },
  { id: "u12", name: "Unit 12", title: "Decimals", topic: 12, lessons: [
    L("Fractions and decimals", { decimals: [1, 1] }),
    L("Compare decimals", { decimals: [2, 2] }),
    L("Add tenths and hundredths", { decimals: [3, 3] }),
    L("Money", { decimals: [4, 4] }),
  ] },
  { id: "u13", name: "Unit 13", title: "Measurement", topic: 13, lessons: [
    L("Change big units into small units", { measurement: [1, 2] }),
    L("Measurement word problems", { measurement: [3, 3] }),
    L("Area and perimeter", { area: [2, 4] }),
  ] },
  { id: "u14", name: "Unit 14", title: "Patterns", topic: 14, lessons: [
    L("Number patterns and rules", { patterns: [1, 2] }),
    L("Repeating shape patterns", { patterns: [3, 3] }),
  ] },
  { id: "u15", name: "Unit 15", title: "Angles", topic: 15, lessons: [
    L("Angles as parts of a circle", { angles: [1, 1] }),
    L("Kinds of angles", { angles: [2, 2] }),
    L("Add and subtract angle measures", { angles: [3, 3] }),
  ] },
  { id: "u16", name: "Unit 16", title: "Lines, angles and shapes", topic: 16, lessons: [
    L("Lines, rays and line segments", { geometry: [1, 1] }),
    L("Classify triangles", { geometry: [2, 2] }),
    L("Quadrilaterals and line symmetry", { geometry: [3, 3] }),
  ] },
].map((u) => ({ ...u, lessons: u.lessons.map((l, i) => ({ ...l, id: l.id || `${u.topic}.${i + 1}`, code: l.id || "" })) }));

// The inventory exam (start and end of the year) mixes every topic so far.
export const INVENTORY = { id: "inv", name: "Inventory", title: "A mix of everything so far", topic: 99 };
const REVIEW_UNIT = { ...REVIEW, lessons: REVIEW.lessons.map((l) => ({ ...l, code: "" })) };
export const inventoryLessons = (through) => [REVIEW_UNIT, ...UNITS.filter((u) => u.topic <= through)].flatMap((u) => u.lessons.map((l) => ({ ...l, unit: u.name })));
export const TOPIC_NAME = Object.fromEntries(UNITS.map((u) => [u.topic, u.title]));
export const UNIT = Object.fromEntries([...UNITS, INVENTORY].map((u) => [u.id, u]));
// The lessons a unit choice offers. Inventory: every lesson through `through`.
export const unitLessons = (unitId, through) => (unitId === "inv" ? inventoryLessons(through) : UNIT[unitId]?.lessons || []);

// The active study plan, if any: { unit, lessons: [ids], label, date, through }.
export function activeStudy(st) {
  const s = st.study;
  if (!s?.on || !UNIT[s.unit]) return null;
  const through = s.through ?? st.coveredThrough ?? 2;
  const lessons = unitLessons(s.unit, through).filter((l) => !s.lessons?.length || s.lessons.includes(l.id));
  const u = UNIT[s.unit];
  const title = s.unit === "inv" ? `Everything through ${UNITS.find((x) => x.topic === through)?.name || "Unit " + through}` : u.title;
  return lessons.length ? { ...s, lessonList: lessons, unitName: u.name, unitTitle: title } : null;
}
// skill -> [minLevel, maxLevel] covering every chosen lesson.
export function studyRanges(st) {
  const study = activeStudy(st);
  if (!study) return null;
  const r = {};
  for (const l of study.lessonList) for (const [sk, [lo, hi]] of Object.entries(l.skills)) {
    if (!SKILL[sk]) continue;
    r[sk] = r[sk] ? [Math.min(r[sk][0], lo), Math.max(r[sk][1], hi)] : [lo, hi];
  }
  return r;
}
export const clampLevel = (lv, range, max) => Math.min(max, range ? Math.max(range[0], Math.min(range[1], lv)) : lv);

// How ready she looks for one lesson: her last 10 answers on its skills.
export function lessonReadiness(st, lesson) {
  const ids = Object.keys(lesson.skills);
  const h = st.history.filter((x) => ids.includes(x.skill) && !x.review && !x.skipped && x.level >= Math.min(...ids.map((s) => lesson.skills[s][0]))).slice(-10);
  if (h.length < 4) return { n: h.length, acc: null, label: "Not enough practice yet" };
  const acc = h.filter((x) => x.ok).length / h.length;
  return { n: h.length, acc, label: acc >= 0.8 ? "Ready ✓" : acc >= 0.6 ? "Getting there" : "Needs practice" };
}
