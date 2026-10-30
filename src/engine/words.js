// Number -> English words, up to 999,999 ("twenty-one thousand three hundred seventy-nine").
const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];

function under100(n) {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)], o = n % 10;
  return o ? `${t}-${ONES[o]}` : t;
}
function under1000(n) {
  const h = Math.floor(n / 100), r = n % 100;
  const parts = [];
  if (h) parts.push(`${ONES[h]} hundred`);
  if (r) parts.push(under100(r));
  return parts.join(" ");
}
export function toWords(n) {
  if (n === 0) return "zero";
  const th = Math.floor(n / 1000), r = n % 1000;
  const parts = [];
  if (th) parts.push(`${under1000(th)} thousand`);
  if (r) parts.push(under1000(r));
  return parts.join(" ");
}
// Word tiles: "seventy-nine" stays one tile.
export const toTiles = (n) => toWords(n).split(" ");
