const ils = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });
const ils2 = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 });

export const money = (n) => (n == null || isNaN(n) ? "—" : (Math.abs(n % 1) > 0.001 ? ils2 : ils).format(n));
export const fmtNum = (n) => num.format(n ?? 0);

export function compactMoney(n) {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `₪${num.format(n / 1_000_000)}M`;
  if (a >= 10_000) return `₪${num.format(n / 1000)}K`;
  return ils.format(Math.round(n));
}

// "2026-10-21" -> Date מקומי (בלי קפיצת אזור זמן)
export function parseDay(s) {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayStr() {
  const d = new Date();
  return toDayStr(d);
}

export function toDayStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fmtDate(s) {
  const d = parseDay(s);
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function daysUntil(s) {
  const d = parseDay(s);
  if (!d) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86_400_000);
}

export function relDays(n) {
  if (n == null) return "";
  if (n === 0) return "היום";
  if (n === 1) return "מחר";
  if (n === -1) return "אתמול";
  if (n < 0) return `לפני ${-n} ימים`;
  if (n < 60) return `עוד ${n} ימים`;
  if (n < 730) return `עוד ${Math.round(n / 30)} חודשים`;
  return `עוד ${num.format(n / 365)} שנים`;
}

export const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
export function shiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "לילה טוב";
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  if (h < 21) return "ערב טוב";
  return "לילה טוב";
}

export const toNumber = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(/[,₪\s]/g, ""));
  return isNaN(n) ? null : n;
};
