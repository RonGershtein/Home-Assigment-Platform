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
    imageQuery: r.kinuy_mishari ?? null,
  };
}

// shortcut: תמונה כללית של הדגם (לא בהכרח אותה גרסה/צבע). תמונה שמעלים מחליפה אותה
export async function modelImage(query) {
  if (!query) return null;
  const u = new URL("https://en.wikipedia.org/w/api.php");
  Object.entries({ action: "query", format: "json", origin: "*", generator: "search", gsrsearch: `${query} car`, gsrlimit: "1", prop: "pageimages", piprop: "thumbnail", pithumbsize: "800" }).forEach(([k, v]) => u.searchParams.set(k, v));
  try {
    const pages = Object.values((await (await fetch(u)).json())?.query?.pages ?? {});
    return pages[0]?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

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
