// רשימות קבועות: קטגוריות, סוגים וסטטוסים

export const SHOP_CATEGORIES = [
  { key: "dairy", label: "חלב", icon: "🥛" },
  { key: "meat", label: "בשר", icon: "🥩" },
  { key: "bakery", label: "מאפים", icon: "🍞" },
  { key: "vegetables", label: "ירקות ופירות", icon: "🥬" },
  { key: "dry", label: "יבשים", icon: "🫘" },
  { key: "frozen", label: "קפואים", icon: "🧊" },
  { key: "drinks", label: "שתייה", icon: "🥤" },
  { key: "cleaning", label: "ניקיון", icon: "🧽" },
  { key: "other", label: "אחר", icon: "📦" },
];
export const shopCat = (k) => SHOP_CATEGORIES.find((c) => c.key === k) ?? SHOP_CATEGORIES.at(-1);

export const ACCOUNT_KINDS = [
  { key: "checking", label: "עו\"ש", icon: "🏦" },
  { key: "savings", label: "חיסכון", icon: "🐷" },
  { key: "deposit", label: "פיקדון", icon: "🔒" },
  { key: "investment", label: "השקעות", icon: "📈" },
  { key: "study_fund", label: "קרן השתלמות", icon: "🎓" },
  { key: "pension", label: "פנסיה", icon: "🧓" },
  { key: "cash", label: "מזומן", icon: "💵" },
  { key: "other", label: "אחר", icon: "💼" },
];
export const accountKind = (k) => ACCOUNT_KINDS.find((c) => c.key === k) ?? ACCOUNT_KINDS.at(-1);

// נזיל = כסף שאפשר להשתמש בו היום; ארוך טווח = פנסיה וקרן השתלמות
export const LONG_TERM_KINDS = new Set(["pension", "study_fund"]);

export const PAY_METHODS = [
  { key: "credit", label: "אשראי" },
  { key: "standing", label: "הוראת קבע" },
  { key: "transfer", label: "העברה" },
  { key: "bit", label: "ביט / פייבוקס" },
  { key: "cash", label: "מזומן" },
];

export const DEFAULT_TX_CATEGORIES = [
  { kind: "expense", name: "סופר ומזון", icon: "🛒", monthly_budget: 3000, sort: 1 },
  { kind: "expense", name: "דיור ושכירות", icon: "🏠", monthly_budget: null, sort: 2 },
  { kind: "expense", name: "חשבונות", icon: "💡", monthly_budget: 800, sort: 3 },
  { kind: "expense", name: "רכב ודלק", icon: "🚗", monthly_budget: 1200, sort: 4 },
  { kind: "expense", name: "מסעדות ויציאות", icon: "🍕", monthly_budget: 800, sort: 5 },
  { kind: "expense", name: "קניות", icon: "🛍️", monthly_budget: null, sort: 6 },
  { kind: "expense", name: "בריאות", icon: "💊", monthly_budget: null, sort: 7 },
  { kind: "expense", name: "מנויים", icon: "📺", monthly_budget: 200, sort: 8 },
  { kind: "expense", name: "מתנות ואירועים", icon: "🎁", monthly_budget: null, sort: 9 },
  { kind: "expense", name: "חופשות", icon: "✈️", monthly_budget: null, sort: 10 },
  { kind: "expense", name: "אחר", icon: "📦", monthly_budget: null, sort: 99 },
  { kind: "income", name: "משכורת", icon: "💼", monthly_budget: null, sort: 1 },
  { kind: "income", name: "מילואים", icon: "🎖️", monthly_budget: null, sort: 2 },
  { kind: "income", name: "החזרים", icon: "↩️", monthly_budget: null, sort: 3 },
  { kind: "income", name: "אחר", icon: "✨", monthly_budget: null, sort: 99 },
];

export const RECIPE_VERDICTS = [
  { key: "loved", label: "אהבנו", icon: "❤️" },
  { key: "ok", label: "בסדר", icon: "👌" },
  { key: "no", label: "לא שוב", icon: "👎" },
  { key: "try", label: "לנסות", icon: "🔖" },
];
export const verdictOf = (k) => RECIPE_VERDICTS.find((v) => v.key === k) ?? RECIPE_VERDICTS[3];
