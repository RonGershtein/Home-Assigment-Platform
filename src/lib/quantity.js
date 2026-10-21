// כמויות ברשימת הקניות: "2 חלב", "חלב x2", "עגבניות 1 ק"ג"
export const UNITS = [
  { key: null, label: "יחידות" },
  { key: "kg", label: "ק״ג", step: 0.5 },
  { key: "g", label: "גרם", step: 100 },
  { key: "l", label: "ליטר", step: 0.5 },
  { key: "pack", label: "אריזות" },
];
const unitOf = (k) => UNITS.find((u) => u.key === k) ?? UNITS[0];
export const stepOf = (unit) => unitOf(unit).step ?? 1;

const WORDS = [
  [/^(ק"ג|ק״ג|קג|קילו|קילוגרם|kg)$/i, "kg"],
  [/^(גרם|גר'?|ג'|g)$/i, "g"],
  [/^(ליטר|ל'|l)$/i, "l"],
  [/^(אריזות|אריזה|חבילות|חבילה|שקיות|מארזים|מארז)$/, "pack"],
  [/^(יח'|יח׳|יחידות|יחידה)$/, null],
];
const unitWord = (w) => {
  if (!w) return undefined;
  for (const [re, key] of WORDS) if (re.test(w)) return key;
  return undefined;
};
const num = (s) => Number(s.replace(",", "."));

export function parseQuantity(text) {
  const t = text.trim().replace(/\s+/g, " ");
  // מספר בהתחלה: "2 חלב" / "1 ק"ג עגבניות" / "x2 חלב"
  let m = t.match(/^[x×]?(\d+(?:[.,]\d+)?)[x×]?\s+(\S+)(?:\s+(.+))?$/i);
  if (m) {
    const u = unitWord(m[2]);
    const name = u !== undefined ? m[3] : [m[2], m[3]].filter(Boolean).join(" ");
    if (name && num(m[1]) > 0) return { name, quantity: num(m[1]), unit: u ?? null };
  }
  // מספר בסוף: "חלב 2" / "חלב x2" / "עגבניות 1 ק"ג"
  m = t.match(/^(.+?)\s+[x×]?(\d+(?:[.,]\d+)?)(?:\s*(\S+))?$/i);
  if (m) {
    const u = unitWord(m[3]);
    if ((m[3] === undefined || u !== undefined) && num(m[2]) > 0) return { name: m[1], quantity: num(m[2]), unit: u ?? null };
  }
  return { name: t, quantity: 1, unit: null };
}

const fmt = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 2 });
export function formatQuantity(quantity, unit) {
  const q = Number(quantity) || 1;
  if (!unit) return q === 1 ? null : `×${fmt.format(q)}`;
  return `${fmt.format(q)} ${unitOf(unit).label}`;
}
