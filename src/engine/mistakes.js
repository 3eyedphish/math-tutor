// Naming what kind of mistake a wrong answer was, so lessons can target it
// and grown-ups can see patterns (not just "wrong").
import { normalize } from "./util.js";

export const MISTAKES = {
  forgotCarry: { label: "Forgot to carry", kid: "It looks like a carry got lost. When a column adds up to 10 or more, carry the ten to the next column." },
  noRegroup: { label: "Didn't regroup (took small from big)", kid: "When the top digit is smaller, don't flip it around. Borrow 1 from the next place instead." },
  roundWrongWay: { label: "Rounded the wrong way", kid: "Look at the digit just to the right. 5 or more rounds up, 4 or less rounds down." },
  notRounded: { label: "Didn't round", kid: "Rounding means jumping to the nearest friendly number, like a number ending in zeros." },
  wrongPlace: { label: "Rounded to the wrong place", kid: "Check which place the question asks for: tens, hundreds or thousands." },
  areaPerimeter: { label: "Mixed up area and perimeter", kid: "Area is the squares inside (multiply). Perimeter is the fence around the edge (add all the sides)." },
  halfPerimeter: { label: "Added only two sides", kid: "A rectangle has four sides. Add all four to get the perimeter." },
  wrongOperation: { label: "Used the wrong operation", kid: "Read again: is it equal groups (multiply), putting together (add), or taking away (subtract)?" },
  skipCountSlip: { label: "Skip-counted one step off", kid: "Close! You were one group away. Count the groups carefully." },
  digitNotValue: { label: "Gave the digit, not its value", kid: "The question asks what the digit is WORTH. A 4 in the hundreds place is worth 400." },
  forgotAdjust: { label: "Forgot to fix up after using a friendly number", kid: "Rounding to a friendly number is smart. Then remember to fix up the extra you added or took." },
  adjustWrongWay: { label: "Fixed up in the wrong direction", kid: "If you took away too much, add some back. If you added too much, take some away." },
  trustedDetective: { label: "Agreed with the detective's wrong answer", kid: "Detectives can make mistakes! Always check the work yourself." },
  placeValue: { label: "Off by a place (×10 or ÷10)", kid: "Check how many digits the answer should have. Line up the places carefully." },
  digitSlip: { label: "One digit off (small slip)", kid: "So close! Just one digit is off. Check each column again." },
  digitOrder: { label: "Right digits, wrong order", kid: "All the right digits, but mixed up. Write them from the biggest place to the smallest." },
  partWrong: { label: "Missed a step in a multi-step problem", kid: "Big problems are small problems in a row. Take them one step at a time." },
  partialProducts: { label: "Multiplied digits instead of place values", kid: "Multiply each part by what it is worth: 6 × 40, not 6 × 4. Then add the parts." },
  doubledNotHalved: { label: "Doubled instead of halving", kid: "Half means split into 2 equal parts, so the answer gets smaller." },
  addedTwo: { label: "Added 2 instead of doubling", kid: "Double means two of the same number: double 8 is 8 + 8, not 8 + 2." },
  addedWrongGroup: { label: "Added the wrong group size", kid: "One more group adds the size of a group. 8 × 7 is one more 7 than 7 × 7." },
  addedOne: { label: "Added or took away 1 instead of a group", kid: "Going from 5 × 8 to 6 × 8 adds a whole group of 8, not just 1." },
  scaledBothSides: { label: "Scaled both sides when only one changed", kid: "Only one side got longer, so the area grows by that one number." },
  scaledOneSide: { label: "Scaled only one side", kid: "Both sides got longer! The area grows across AND down, so multiply twice." },
  addedNotScaled: { label: "Added instead of multiplying (same shape)", kid: "Same shape means times as big, not plus. If one side is 3 times as long, the other side is 3 times as long too." },
  readBackwards: { label: "Read the boards in the wrong order", kid: "The ones board is on the right. Read from the biggest board on the left to the ones board on the right." },
  skipped: { label: "Skipped", kid: "" },
  neededHelp: { label: "Got it right, but needed help", kid: "" },
  other: { label: "Different answer", kid: "" },
};
// Mistake types worth a targeted lesson when they repeat (small slips aren't).
export const PATTERN_TYPES = new Set(["forgotCarry", "noRegroup", "roundWrongWay", "notRounded", "wrongPlace", "areaPerimeter", "halfPerimeter", "wrongOperation", "digitNotValue", "forgotAdjust", "adjustWrongWay", "placeValue", "digitOrder", "trustedDetective", "partialProducts", "doubledNotHalved", "addedTwo", "addedWrongGroup", "scaledBothSides", "scaledOneSide", "addedNotScaled"]);

const digits = (s) => normalize(s).replace(/[^\dr]/g, "");

export function classifyError(part, given) {
  if (given === undefined || given === null || given === "" || (Array.isArray(given) && !given.length)) return "other";
  if (part.answerType === "multi" || part.answerType === "tiles" || part.answerType === "sort") return "other";
  if (part.answerType === "blanks") return "other";
  const g = digits(given), a = digits(part.answer);
  if (part.detectiveShown && g === digits(part.detectiveShown)) return "trustedDetective";
  const mis = part.misconceptions || {};
  for (const [k, v] of Object.entries(mis)) if (digits(k) === g && g !== a) return v;
  if (!/^\d+$/.test(g) || !/^\d+$/.test(a)) return "other";
  if (g === a + "0" || g + "0" === a) return "placeValue";
  if (g.length === a.length) {
    let diff = 0;
    for (let i = 0; i < g.length; i++) if (g[i] !== a[i]) diff++;
    if (diff === 1) return "digitSlip";
    if ([...g].sort().join("") === [...a].sort().join("")) return "digitOrder";
  }
  return "other";
}
