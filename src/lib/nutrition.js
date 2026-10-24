// חישובי תזונה: BMI, BMR (Mifflin-St Jeor), TDEE, יעד קלוריות ומגמת משקל.
// המקורות: Mifflin-St Jeor נמצאה המדויקת ביותר למבוגרים בריאים (סטייה ~10%);
// קצב ירידה בטוח 0.5–1 ק"ג בשבוע (NHS / CDC / WHO) = גירעון 500–1000 קק"ל ביום (7,700 קק"ל ≈ 1 ק"ג שומן);
// רצפה של 1,200 קק"ל לנשים / 1,500 לגברים בלי ליווי רפואי; חלבון 1.6–2.4 גר' לק"ג בגירעון (ISSN 2017).
import { parseDay, toDayStr } from "./format";

export const ACTIVITY = [
  { value: "sedentary", label: "יושבני", hint: "עבודה משרדית, בלי אימונים", factor: 1.2 },
  { value: "light", label: "קל", hint: "הליכות או 1–3 אימונים בשבוע", factor: 1.375 },
  { value: "moderate", label: "בינוני", hint: "3–5 אימונים בשבוע", factor: 1.55 },
  { value: "active", label: "פעיל", hint: "6–7 אימונים בשבוע", factor: 1.725 },
  { value: "very_active", label: "מאוד פעיל", hint: "עבודה פיזית ואימונים", factor: 1.9 },
];

export const GOALS = [
  { value: "lose", label: "לרדת" },
  { value: "maintain", label: "לשמור" },
  { value: "gain", label: "לעלות" },
];

export const RATES = [
  { value: 0.25, label: "עדין", hint: "¼ ק״ג בשבוע" },
  { value: 0.5, label: "מומלץ", hint: "½ ק״ג בשבוע" },
  { value: 0.75, label: "מהיר", hint: "¾ ק״ג בשבוע" },
  { value: 1, label: "מקסימום", hint: "1 ק״ג בשבוע" },
];

export const MEALS = [
  { value: "breakfast", label: "ארוחת בוקר", icon: "🍳", from: 5, to: 11 },
  { value: "lunch", label: "ארוחת צהריים", icon: "🥗", from: 11, to: 16 },
  { value: "dinner", label: "ארוחת ערב", icon: "🍲", from: 16, to: 22 },
  { value: "snack", label: "נשנושים", icon: "🍎", from: 22, to: 5 },
];
export const mealByHour = (h = new Date().getHours()) => (h >= 5 && h < 11 ? "breakfast" : h >= 11 && h < 16 ? "lunch" : h >= 16 && h < 22 ? "dinner" : "snack");

const KCAL_PER_KG = 7700;
const num1 = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 });
const num0 = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
export const fmtKg = (n, sign = false) => (n == null || isNaN(n) ? "—" : `${sign && n > 0 ? "+" : ""}${num1.format(n)} ק״ג`);
export const fmtKcal = (n) => (n == null || isNaN(n) ? "—" : `${num0.format(n)} קק״ל`);
export const fmt1 = (n) => (n == null || isNaN(n) ? "—" : num1.format(n));
export const fmt0 = (n) => (n == null || isNaN(n) ? "—" : num0.format(n));

export function ageFrom(birth, at = new Date()) {
  const d = parseDay(birth);
  if (!d) return null;
  let a = at.getFullYear() - d.getFullYear();
  const m = at.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < d.getDate())) a--;
  return a;
}

export const bmi = (kg, cm) => (kg > 0 && cm > 0 ? kg / (cm / 100) ** 2 : null);

// קטגוריות WHO למבוגרים
export const BMI_BANDS = [
  { to: 18.5, label: "תת-משקל", tone: "warn" },
  { to: 25, label: "תקין", tone: "good" },
  { to: 30, label: "עודף משקל", tone: "warn" },
  { to: Infinity, label: "השמנה", tone: "crit" },
];
export const bmiBand = (b) => (b == null ? null : BMI_BANDS.find((x) => b < x.to));
// טווח המשקל התקין לגובה (BMI 18.5–24.9)
export const healthyRange = (cm) => (cm > 0 ? [18.5 * (cm / 100) ** 2, 24.9 * (cm / 100) ** 2] : null);

export function bmr({ weight, height, age, sex }) {
  if (!(weight > 0 && height > 0 && age > 0) || !sex) return null;
  return 10 * weight + 6.25 * height - 5 * age + (sex === "male" ? 5 : -161);
}

export const activityFactor = (a) => ACTIVITY.find((x) => x.value === a)?.factor ?? 1.375;

/**
 * יעד קלוריות יומי מהפרופיל והמשקל הנוכחי.
 * מחזיר null אם חסרים נתונים (ואז מציעים למלא פרופיל).
 */
export function calorieTarget(profile, weight) {
  if (!profile) return null;
  const age = ageFrom(profile.birth_date);
  const base = bmr({ weight, height: Number(profile.height_cm), age, sex: profile.sex });
  if (base == null) return profile.calorie_target ? { target: profile.calorie_target, manual: true, protein: proteinRange(profile.goal, weight) } : null;
  const tdee = base * activityFactor(profile.activity);
  const goal = profile.goal || "maintain";
  // קצב: לא יותר מ-1% ממשקל הגוף בשבוע (ולעלייה - חצי ק"ג לכל היותר)
  let rate = Number(profile.weekly_rate_kg ?? 0.5);
  if (goal === "lose" && weight) rate = Math.min(rate, weight * 0.01);
  if (goal === "gain") rate = Math.min(rate, 0.5);
  const delta = goal === "maintain" ? 0 : (rate * KCAL_PER_KG) / 7;
  let target = goal === "lose" ? tdee - delta : goal === "gain" ? tdee + delta : tdee;
  const floor = profile.sex === "female" ? 1200 : 1500;
  const floored = target < floor;
  if (floored) target = floor;
  const manual = profile.calorie_target != null && profile.calorie_target > 0;
  return {
    bmr: Math.round(base),
    tdee: Math.round(tdee),
    computed: Math.round(target),
    target: manual ? profile.calorie_target : Math.round(target),
    manual,
    delta: Math.round(goal === "lose" ? -delta : delta),
    rate,
    floor,
    floored,
    age,
    protein: proteinRange(goal, weight),
  };
}

// חלבון בגרם ליום: בגירעון 1.6–2.2 לק"ג (שמירה על מסת שריר ושובע), בשמירה 1.2–1.6
export function proteinRange(goal, weight) {
  if (!(weight > 0)) return null;
  const [lo, hi] = goal === "maintain" ? [1.2, 1.6] : [1.6, 2.2];
  return [Math.round(lo * weight), Math.round(hi * weight)];
}

/* ───── מגמת משקל ───── */

const dayMs = 86_400_000;
export const dayNum = (s) => Math.round(parseDay(s).getTime() / dayMs);

// ממוצע נע של 7 ימים לכל נקודה (מחליק תנודות של מים/מלח)
export function withAverage(entries) {
  const sorted = [...entries].sort((a, b) => a.day.localeCompare(b.day));
  return sorted.map((e, i) => {
    const t = dayNum(e.day);
    const win = sorted.slice(Math.max(0, i - 10), i + 1).filter((x) => t - dayNum(x.day) < 7);
    const avg = win.reduce((s, x) => s + Number(x.weight_kg), 0) / win.length;
    return { ...e, avg: Math.round(avg * 100) / 100 };
  });
}

// רגרסיה לינארית על 14 הימים האחרונים → ק"ג לשבוע (null אם אין מספיק נקודות)
export function weeklyTrend(entries, days = 14) {
  const sorted = [...entries].sort((a, b) => a.day.localeCompare(b.day));
  if (sorted.length < 3) return null;
  const last = dayNum(sorted[sorted.length - 1].day);
  const pts = sorted.filter((e) => last - dayNum(e.day) <= days).map((e) => [dayNum(e.day) - last, Number(e.weight_kg)]);
  if (pts.length < 3 || pts[pts.length - 1][0] - pts[0][0] < 5) return null;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  const sxy = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0);
  const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
  if (!sxx) return null;
  return (sxy / sxx) * 7;
}

// מתי נגיע ליעד בקצב הנוכחי (null אם המגמה בכיוון ההפוך או אין מגמה)
export function etaToGoal(current, goal, perWeek) {
  if (current == null || goal == null || !perWeek) return null;
  const diff = goal - current;
  if (Math.abs(diff) < 0.1) return 0;
  if (Math.sign(diff) !== Math.sign(perWeek)) return null;
  const weeks = diff / perWeek;
  if (weeks > 260) return null;
  return Math.round(weeks * 7);
}

// רצף ימים עם שקילה (כולל היום או אתמול)
export function streak(entries, today = toDayStr(new Date())) {
  const set = new Set(entries.map((e) => e.day));
  let t = dayNum(today);
  if (!set.has(today)) t--;
  let n = 0;
  for (;;) {
    const d = new Date(t * dayMs);
    const s = toDayStr(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    if (!set.has(s)) break;
    n++;
    t--;
  }
  return n;
}

export const shortDay = (s) => {
  const d = parseDay(s);
  return `${d.getDate()}.${d.getMonth() + 1}`;
};
export function relDayLabel(s, today = toDayStr(new Date())) {
  const diff = dayNum(today) - dayNum(s);
  if (diff === 0) return "היום";
  if (diff === 1) return "אתמול";
  const d = parseDay(s);
  return new Intl.DateTimeFormat("he-IL", { weekday: "short", day: "numeric", month: "short" }).format(d);
}
export function shiftDay(s, delta) {
  const d = parseDay(s);
  d.setDate(d.getDate() + delta);
  return toDayStr(d);
}
