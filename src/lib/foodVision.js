// זיהוי מאכל מתמונה - כולו במכשיר, בלי שרת ובלי LLM.
// MobileCLIP S0 (Apple) דרך Transformers.js: מודל התמונה (fp16, ~23MB, נשמר במטמון הדפדפן אחרי הפעם הראשונה;
// הגרסה q8 של 12MB נותנת תוצאות אקראיות ב-wasm ולכן לא בשימוש)
// מחשב וקטור לתמונה, ומשווים אותו לווקטורי הטקסט של כל מאכל במאגר שלנו (src/lib/foodEmbeddings.json,
// נוצרים מראש ב-scripts/build-food-embeddings.mjs). כך המודל "מכיר" שקשוקה, סביח וג'חנון בלי אימון.
import embeddings from "./foodEmbeddings.json";

let loading = null;
const listeners = new Set();
let progress = { status: "idle", pct: 0 }; // idle | downloading | ready | error

export const onVisionProgress = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const setProgress = (p) => {
  progress = { ...progress, ...p };
  listeners.forEach((f) => f(progress));
};
export const visionProgress = () => progress;

// הווקטורים נפרשים מ-int8 פעם אחת
let labelVecs = null;
function labels() {
  if (labelVecs) return labelVecs;
  const raw = Uint8Array.from(atob(embeddings.data), (c) => c.charCodeAt(0));
  const int8 = new Int8Array(raw.buffer);
  const { dim, keys, scales } = embeddings;
  labelVecs = keys.map((key, i) => {
    const v = new Float32Array(dim);
    for (let j = 0; j < dim; j++) v[j] = int8[i * dim + j] * scales[i];
    return { key, v };
  });
  return labelVecs;
}

async function load() {
  if (loading) return loading;
  loading = (async () => {
    setProgress({ status: "downloading", pct: 0 });
    const tf = await import("@huggingface/transformers");
    tf.env.allowLocalModels = false;
    const files = new Map();
    const progress_callback = (e) => {
      if (e.status === "progress" && e.file) {
        files.set(e.file, e.progress || 0);
        setProgress({ pct: Math.round([...files.values()].reduce((s, x) => s + x, 0) / files.size) });
      }
    };
    const [processor, model] = await Promise.all([
      tf.AutoProcessor.from_pretrained(embeddings.model, { progress_callback }),
      tf.CLIPVisionModelWithProjection.from_pretrained(embeddings.model, { dtype: "fp16", device: "wasm", progress_callback }),
    ]);
    setProgress({ status: "ready", pct: 100 });
    return { tf, processor, model };
  })().catch((e) => {
    loading = null;
    setProgress({ status: "error", pct: 0, error: e?.message });
    throw e;
  });
  return loading;
}

export const warmVision = () => load().catch(() => {});

/** מחזיר [{ key, score }] ממוין - top-k מאכלים מהמאגר שהכי מתאימים לתמונה (score = הסתברות 0..1) */
export async function recognizeFood(fileOrBlob, k = 5) {
  const { tf, processor, model } = await load();
  const image = await tf.RawImage.fromBlob(fileOrBlob);
  const inputs = await processor(image);
  const { image_embeds } = await model(inputs);
  const v = image_embeds.data;
  let n = 0;
  for (let j = 0; j < v.length; j++) n += v[j] * v[j];
  n = Math.sqrt(n) || 1;
  const scored = labels().map(({ key, v: l }) => {
    let s = 0;
    for (let j = 0; j < l.length; j++) s += l[j] * v[j];
    return { key, sim: s / n };
  });
  // softmax בטמפרטורה 100 (כמו CLIP) - נותן הסתברויות שאפשר להציג
  const max = Math.max(...scored.map((x) => x.sim));
  const ex = scored.map((x) => Math.exp((x.sim - max) * 100));
  const sum = ex.reduce((a, b) => a + b, 0);
  return scored
    .map((x, i) => ({ key: x.key, score: ex[i] / sum }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// תמונה מהמצלמה יכולה להיות 12MP; מקטינים לפני הזיהוי (המודל עובד על 256px) - חוסך זיכרון וזמן באייפון
export async function shrinkImage(file, max = 512) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return new Promise((res) => canvas.toBlob((b) => res(b || file), "image/jpeg", 0.9));
}
