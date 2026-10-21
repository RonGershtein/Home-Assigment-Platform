// נתוני הדגמה בדויים (לא הנתונים האמיתיים). הנתונים האמיתיים עוברים עם scripts/import-base44.mjs
import { DEFAULT_TX_CATEGORIES } from "./catalog";
import { toDayStr } from "./format";

const id = () => crypto.randomUUID();
const ago = (days) => new Date(Date.now() - days * 86_400_000).toISOString();
const day = (offset) => toDayStr(new Date(Date.now() + offset * 86_400_000));

export function demoSeed() {
  const txCategories = DEFAULT_TX_CATEGORIES.map((c) => ({ id: id(), created_at: ago(90), ...c }));
  const cat = (name, kind = "expense") => txCategories.find((c) => c.name === name && c.kind === kind).id;

  const accounts = [
    { id: id(), name: "עו\"ש משותף", kind: "checking", institution: "לאומי", owner: "משותף", balance: 14250 },
    { id: id(), name: "קופת חיסכון", kind: "savings", institution: "מיטב", owner: "משותף", balance: 62000 },
    { id: id(), name: "פיקדון לדירה", kind: "deposit", institution: "דיסקונט", owner: "משותף", balance: 120000 },
    { id: id(), name: "קרן השתלמות", kind: "study_fund", institution: "אלטשולר", owner: "טל", balance: 48700 },
  ].map((a) => ({ ...a, created_at: ago(120), balance_updated_at: ago(3), archived: false, notes: "" }));

  const snapshots = [];
  for (const a of accounts) {
    for (let m = 5; m >= 0; m--) {
      const d = new Date();
      d.setMonth(d.getMonth() - m, 1);
      snapshots.push({ id: id(), account_id: a.id, balance: Math.round(a.balance * (0.86 + (5 - m) * 0.028)), taken_on: toDayStr(d), created_at: d.toISOString() });
    }
  }

  const tx = [];
  for (let m = 0; m < 3; m++) {
    const d = (dd) => {
      const x = new Date();
      x.setMonth(x.getMonth() - m, dd);
      return toDayStr(x);
    };
    tx.push(
      { kind: "income", amount: 14500, date: d(10), category_id: cat("משכורת", "income"), description: "משכורת", method: "transfer", recurring: true },
      { kind: "income", amount: 11800, date: d(10), category_id: cat("משכורת", "income"), description: "משכורת", method: "transfer", recurring: true },
      { kind: "expense", amount: 5200, date: d(1), category_id: cat("דיור ושכירות"), description: "שכירות", method: "standing", recurring: true },
      { kind: "expense", amount: 2350 + m * 140, date: d(8), category_id: cat("סופר ומזון"), description: "שופרסל", method: "credit", recurring: false },
      { kind: "expense", amount: 420, date: d(12), category_id: cat("חשבונות"), description: "חשמל", method: "standing", recurring: true },
      { kind: "expense", amount: 680 - m * 50, date: d(14), category_id: cat("רכב ודלק"), description: "דלק", method: "credit", recurring: false },
      { kind: "expense", amount: 310, date: d(16), category_id: cat("מסעדות ויציאות"), description: "ארוחת ערב", method: "credit", recurring: false },
      { kind: "expense", amount: 69.9, date: d(3), category_id: cat("מנויים"), description: "נטפליקס", method: "credit", recurring: true }
    );
  }

  const shopping = [
    ["חלב 3%", "dairy", false],
    ["עגבניות", "vegetables", false],
    ["פיתות", "bakery", false],
    ["חזה עוף", "meat", false],
    ["אורז", "dry", true],
    ["סבון כלים", "cleaning", true],
  ].map(([item_name, category, is_purchased], i) => ({ id: id(), item_name, category, is_purchased, created_at: ago(i) }));

  return {
    shopping_items: shopping,
    item_categories: shopping.map((s) => ({ id: id(), item_name: s.item_name, category: s.category, created_at: ago(5) })),
    tasks: [
      { title: "לתקן את הברז במקלחת", is_done: false, size: "small", due_date: day(3) },
      { title: "להזמין מנגל", is_done: false, size: "big", due_date: null },
      { title: "לסגור טיסה לחופשה", is_done: false, size: "big", due_date: day(12) },
      { title: "להחליף נורה במרפסת", is_done: true, size: "small", due_date: null },
    ].map((t, i) => ({ id: id(), notes: "", created_at: ago(i * 3), ...t })),
    vouchers: [
      { title: "שובר מתנה BuyMe", voucher_type: "cash", amount: 400, expiry_date: day(140), voucher_code: "4580-1122-9083", status: "active", store_url: "https://buyme.co.il" },
      { title: "תו קנייה - רמי לוי", voucher_type: "cash", amount: 250, expiry_date: day(18), voucher_code: null, status: "active", notes: "שובר חג" },
      { title: "פיצה", voucher_type: "gift", gift_description: "פיצה משפחתית", expiry_date: day(6), voucher_code: "PZ-77812", status: "active" },
      { title: "ספא", voucher_type: "gift", gift_description: "עיסוי זוגי", expiry_date: day(-12), voucher_code: null, status: "active" },
      { title: "קולנוע", voucher_type: "cash", amount: 90, expiry_date: day(-40), status: "used" },
    ].map((v, i) => ({ id: id(), notes: "", gift_description: null, store_url: null, created_at: ago(i * 7), ...v })),
    gifts: [
      ["משפחת כהן", 2, 1000, "דודים"],
      ["יוסי לוי", 1, 500, "חבר מהצבא - ביט"],
      ["נועה ואורי", 2, 800, "חברים מהעבודה"],
      ["משפחת אברהם", 4, 1600, ""],
      ["דנה מזרחי", 1, 400, "צ'ק"],
      ["רון ושירה", 2, 1000, "שכנים"],
    ].map(([giver_name, guest_count, amount, notes], i) => ({ id: id(), giver_name, guest_count, amount, notes, created_at: ago(i) })),
    recipes: [
      { title: "שקשוקה של שבת", link: "", description: "להוסיף פפריקה מעושנת", verdict: "loved", image_url: "" },
      { title: "פסטה ברוטב שמנת ופטריות", link: "https://www.10dakot.co.il", description: "", verdict: "ok", image_url: "" },
      { title: "עוגת גבינה פירורים", link: "", description: "חמאה במקום מרגרינה", verdict: "try", image_url: "" },
    ].map((r, i) => ({ id: id(), created_at: ago(i * 4), ...r })),
    accounts,
    account_snapshots: snapshots,
    tx_categories: txCategories,
    transactions: tx.map((t, i) => ({ id: id(), created_at: ago(i), ...t })),
  };
}
