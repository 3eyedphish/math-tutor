// Small helpers shared by the generators and the UI.
export const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const fmt = (n) => Number(n).toLocaleString("en-US");
export const roundTo = (n, place) => Math.round(n / place) * place;
export const digitsOf = (n) => String(n).split("").map(Number);
// A random number with exactly `d` digits.
export const nDigits = (d) => rand(10 ** (d - 1), 10 ** d - 1);
export const PLACE_NAMES = { 10: "ten", 100: "hundred", 1000: "thousand", 10000: "ten thousand" };

// Normalise what the child typed: drop commas/spaces, lower-case.
export const normalize = (s) => String(s).toLowerCase().replace(/[,\s]/g, "").replace(/remainder/, "r");

// Unique wrong answers that are positive and differ from the right one.
export function cleanWrong(answer, list, n = 3) {
  const out = [];
  for (const w of list) {
    if (w === undefined || w === null || Number.isNaN(w)) continue;
    if (typeof w === "number" && (w < 0 || !Number.isInteger(w))) continue;
    if (String(w) === String(answer) || out.some((o) => String(o) === String(w))) continue;
    out.push(w);
    if (out.length >= n) break;
  }
  return out;
}

// Column subtraction done the classic wrong way: always "smaller from larger" in each column.
export function noBorrowSubtract(a, b) {
  const A = String(a).padStart(String(Math.max(a, b)).length, "0");
  const B = String(b).padStart(A.length, "0");
  return Number(A.split("").map((d, i) => Math.abs(Number(d) - Number(B[i]))).join(""));
}
// Column addition that forgets to carry.
export function noCarryAdd(a, b) {
  const L = Math.max(String(a).length, String(b).length);
  const A = String(a).padStart(L, "0");
  const B = String(b).padStart(L, "0");
  return Number(A.split("").map((d, i) => (Number(d) + Number(B[i])) % 10).join(""));
}
// Count how many columns need regrouping.
export function borrowCount(a, b) {
  let count = 0, borrow = 0;
  const A = digitsOf(a).reverse(), B = digitsOf(b).reverse();
  for (let i = 0; i < A.length; i++) {
    const top = A[i] - borrow, bot = B[i] || 0;
    if (top < bot) { count++; borrow = 1; } else borrow = 0;
  }
  return count;
}
export function carryCount(a, b) {
  let count = 0, carry = 0;
  const A = digitsOf(a).reverse(), B = digitsOf(b).reverse();
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const s = (A[i] || 0) + (B[i] || 0) + carry;
    carry = s >= 10 ? 1 : 0;
    count += carry;
  }
  return count;
}
