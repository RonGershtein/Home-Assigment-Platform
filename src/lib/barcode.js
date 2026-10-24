// סריקת ברקוד + חיפוש המוצר ב-Open Food Facts (מאגר פתוח וחינמי, כולל הרבה מוצרים ישראליים).
// הסריקה עם ZXing בדפדפן (באייפון אין BarcodeDetector), דרך המצלמה החיה או מתמונה.

const OFF = "https://world.openfoodfacts.org/api/v2/product/";
const FIELDS = "product_name,product_name_he,product_name_en,brands,quantity,serving_size,serving_quantity,nutriments,image_small_url,image_front_small_url";

const cacheKey = (code) => `off:${code}`;

/** מחזיר { code, name, brand, image, per100: {kcal, protein}, serving: {grams, kcal, protein} | null } או null אם לא נמצא */
export async function lookupBarcode(code) {
  code = String(code).replace(/\D/g, "");
  if (!code) return null;
  try {
    const hit = localStorage.getItem(cacheKey(code));
    if (hit) return JSON.parse(hit);
  } catch {}
  const res = await fetch(`${OFF}${code}.json?fields=${FIELDS}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("אין חיבור למאגר המוצרים");
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  const n = p.nutriments || {};
  const kcal100 = num(n["energy-kcal_100g"]) ?? (num(n["energy_100g"]) != null ? num(n["energy_100g"]) / 4.184 : null);
  if (kcal100 == null) return null;
  const grams = num(p.serving_quantity);
  const product = {
    code,
    name: (p.product_name_he || p.product_name || p.product_name_en || "מוצר").trim(),
    brand: (p.brands || "").split(",")[0].trim(),
    quantity: p.quantity || "",
    image: p.image_front_small_url || p.image_small_url || null,
    per100: { kcal: Math.round(kcal100), protein: num(n.proteins_100g), carbs: num(n.carbohydrates_100g), fat: num(n.fat_100g) },
    serving: grams ? { grams, label: `מנה (${grams} גר׳)`, kcal: Math.round((kcal100 * grams) / 100), protein: n.proteins_100g != null ? round1((num(n.proteins_100g) * grams) / 100) : null } : null,
  };
  try {
    localStorage.setItem(cacheKey(code), JSON.stringify(product));
  } catch {}
  return product;
}

const num = (v) => (v == null || v === "" || isNaN(Number(v)) ? null : Number(v));
const round1 = (v) => Math.round(v * 10) / 10;

/** ערכים לכמות נתונה בגרם */
export function forGrams(product, grams) {
  return { kcal: Math.round((product.per100.kcal * grams) / 100), protein: product.per100.protein != null ? round1((product.per100.protein * grams) / 100) : null };
}

let zxing = null;
async function lib() {
  if (!zxing) {
    const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    zxing = { BrowserMultiFormatReader, hints };
  }
  return zxing;
}

/**
 * סריקה חיה מהמצלמה לתוך <video>. מחזיר פונקציית עצירה. onResult נקרא פעם אחת עם הקוד.
 */
export async function startScanner(videoEl, onResult, onError) {
  const { BrowserMultiFormatReader, hints } = await lib();
  const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
  let done = false;
  let controls = null;
  try {
    controls = await reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } }, videoEl, (result) => {
      if (result && !done) {
        done = true;
        controls?.stop();
        onResult(result.getText());
      }
    });
  } catch (e) {
    onError?.(e?.name === "NotAllowedError" ? new Error("אין הרשאה למצלמה. מאשרים בהגדרות ← ספארי ← מצלמה") : e);
    return () => {};
  }
  return () => {
    done = true;
    controls?.stop();
  };
}

/** פענוח ברקוד מתמונה (צילום מהגלריה / כשהסריקה החיה לא זמינה) */
export async function decodeImage(file) {
  const { BrowserMultiFormatReader, hints } = await lib();
  const reader = new BrowserMultiFormatReader(hints);
  const url = URL.createObjectURL(file);
  try {
    const r = await reader.decodeFromImageUrl(url);
    return r.getText();
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
