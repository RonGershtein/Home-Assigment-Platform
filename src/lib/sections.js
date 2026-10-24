import { useEffect, useState } from "react";
import { ChefHat, Gift, Landmark, ListChecks, Receipt, Scale, ShoppingCart, Ticket } from "lucide-react";

// כל המדורים שאפשר לשים בסרגל התחתון (בית ו"עוד" קבועים). הבחירה נשמרת במכשיר.
export const SECTIONS = {
  shopping: { to: "/shopping", label: "קניות", icon: ShoppingCart, hint: "רשימת הקניות של הבית" },
  tasks: { to: "/tasks", label: "מטלות", icon: ListChecks, hint: "מה צריך לעשות ומתי" },
  money: { to: "/money", label: "כסף", icon: Landmark, hint: 'עו"ש, קופות, פיקדונות', match: ["/money", "/budget"] },
  budget: { to: "/budget", label: "תקציב", icon: Receipt, hint: "הכנסות והוצאות לפי קטגוריות" },
  nutrition: { to: "/nutrition", label: "תזונה", icon: Scale, hint: "משקל של שנינו, יומן אוכל, BMI ויעד קלוריות" },
  vouchers: { to: "/vouchers", label: "שוברים", icon: Ticket, hint: "לפי תוקף, קודים ואתרים" },
  gifts: { to: "/gifts", label: "מתנות", icon: Gift, hint: "מה קיבלנו בחתונה ומה נתנו באירועים" },
  recipes: { to: "/recipes", label: "מתכונים", icon: ChefHat, hint: "לינקים ומה אהבנו" },
};
export const SECTION_ORDER = ["shopping", "tasks", "money", "budget", "nutrition", "vouchers", "gifts", "recipes"];
export const DEFAULT_TABS = ["shopping", "tasks", "money"];

const KEY = "homesync:tabs";
const EVENT = "tabs-change";

export function loadTabs() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || "null");
    if (Array.isArray(arr) && arr.length === 3 && arr.every((k) => SECTIONS[k]) && new Set(arr).size === 3) return arr;
  } catch {}
  return DEFAULT_TABS;
}

export function saveTabs(tabs) {
  try {
    if (tabs.join() === DEFAULT_TABS.join()) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(tabs));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function useTabs() {
  const [tabs, setTabs] = useState(loadTabs);
  useEffect(() => {
    const sync = () => setTabs(loadTabs());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return [tabs, saveTabs];
}

// הסרגל בפועל: אם "תזונה" מוסתרת, במקומה נכנס המדור הראשון מברירת המחדל שעוד לא בסרגל
export function effectiveTabs(tabs, nutritionHidden) {
  if (!nutritionHidden || !tabs.includes("nutrition")) return tabs;
  const fill = DEFAULT_TABS.find((k) => !tabs.includes(k)) ?? "money";
  return tabs.map((k) => (k === "nutrition" ? fill : k));
}
