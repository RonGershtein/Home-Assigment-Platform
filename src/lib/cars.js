// רכבים: פרטי רישוי לפי מספר רכב (מאגר משרד התחבורה ב-data.gov.il, פתוח וללא מפתח) ותמונה מוויקיפדיה לפי הדגם
const REGISTRY = "https://data.gov.il/api/3/action/datastore_search?resource_id=053cea08-09bc-40ec-8f7a-156f0677aff3";

export const plateDigits = (s) => String(s ?? "").replace(/\D/g, "");

// 8 ספרות: 123-45-678, 7 ספרות: 12-345-67
export function fmtPlate(s) {
  const d = plateDigits(s);
  if (d.length === 8) return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
  if (d.length === 7) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  return d;
}

// "קיה ד. קוריאה" -> "קיה": שם היצרן בלי ארץ הייצור
const makeName = (s) => (s || "").split(" ")[0].replace(/['׳]/g, "'") || null;

export async function lookupPlate(plate) {
  const n = plateDigits(plate);
  if (n.length < 5) return null;
  const res = await fetch(`${REGISTRY}&filters=${encodeURIComponent(JSON.stringify({ mispar_rechev: Number(n) }))}&limit=1`);
  if (!res.ok) throw new Error("registry");
  const r = (await res.json())?.result?.records?.[0];
  if (!r) return null;
  return {
    make: makeName(r.tozeret_nm),
    model: [r.kinuy_mishari, r.ramat_gimur].filter(Boolean).join(" ") || r.degem_nm || null,
    year: r.shnat_yitzur ?? null,
    color: r.tzeva_rechev ?? null,
    fuel: r.sug_delek_nm ?? null,
    test_until: r.tokef_dt?.slice(0, 10) ?? null,
    last_test: r.mivchan_acharon_dt?.slice(0, 10) ?? null,
  };
}

// צבע הרכב מהרישוי (טקסט חופשי בעברית) -> צבע לציור. הסדר חשוב: "שנהב לבן" לפני "לבן", "כסף" לפני "אפור"
const COLORS = [
  ["שנהב", "#ece4d2"], ["פנינה", "#efece4"], ["לבן", "#f4f4f2"], ["שחור", "#1c1d20"], ["כסף", "#b9bcc1"], ["אפור כהה", "#4a4d52"],
  ["אפור", "#80848b"], ["תכלת", "#8fc3e8"], ["טורקיז", "#2aa7a5"], ["כחול כהה", "#1f2f5c"], ["כחול", "#2c5fb3"], ["אדום", "#b8202a"],
  ["בורדו", "#6d1a2a"], ["ירוק", "#2f6b3e"], ["צהוב", "#e8c12a"], ["כתום", "#e0702a"], ["זהב", "#c8a75a"], ["בז", "#cdb994"],
  ["חום", "#6b4a33"], ["סגול", "#5b3b8c"], ["ברונזה", "#8c6a43"],
];
export const carColor = (name) => COLORS.find(([k]) => name?.includes(k))?.[1] ?? "#9aa0a6";

export const SERVICE_KINDS = {
  service: { label: "טיפול תקופתי", emoji: "🔧" },
  test: { label: "טסט", emoji: "📋" },
  tires: { label: "צמיגים", emoji: "🛞" },
  brakes: { label: "בלמים", emoji: "🛑" },
  battery: { label: "מצבר", emoji: "🔋" },
  repair: { label: "תיקון", emoji: "🛠️" },
  other: { label: "אחר", emoji: "📝" },
};

// ok / soon (עד 30 יום) / expired / unknown
export function testState(days) {
  if (days == null) return "unknown";
  if (days < 0) return "expired";
  if (days <= 30) return "soon";
  return "ok";
}
