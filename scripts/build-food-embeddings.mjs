// יוצר את src/lib/foodEmbeddings.json: הטבעת טקסט (MobileCLIP S0) לכל מאכל במאגר, בדחיסת int8.
// בדפדפן נטען רק מודל התמונה (12MB), והתמונה מושווית לווקטורים האלה - זיהוי בלי שרת ובלי LLM.
// מריצים אחרי כל שינוי ב-src/lib/foods.js או scripts/food-labels.mjs:  node scripts/build-food-embeddings.mjs
import { AutoTokenizer, CLIPTextModelWithProjection } from "@huggingface/transformers";
import { writeFileSync } from "node:fs";
import { LABELS } from "./food-labels.mjs";
import { FOODS } from "../src/lib/foods.js";

const MODEL = "Xenova/mobileclip_s0";
const TEMPLATES = ["a photo of {}.", "a photo of {}, a type of food.", "a close-up photo of {} on a plate."];

const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
const textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: "fp32" });
const norm = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };

const keys = [];
const vectors = [];
for (const f of FOODS) {
  if (!LABELS[f.key]) throw new Error(`missing English label for ${f.key}`);
  const texts = TEMPLATES.map((t) => t.replace("{}", LABELS[f.key]));
  const { text_embeds } = await textModel(tokenizer(texts, { padding: "max_length", truncation: true }));
  const dim = text_embeds.dims[1];
  const avg = new Array(dim).fill(0);
  for (let i = 0; i < texts.length; i++) {
    const v = norm(Array.from(text_embeds.data.slice(i * dim, (i + 1) * dim)));
    for (let j = 0; j < dim; j++) avg[j] += v[j] / texts.length;
  }
  keys.push(f.key);
  vectors.push(norm(avg));
}
// int8: ערך/scale, scale אחד לכל וקטור
const dim = vectors[0].length;
const scales = [];
const bytes = new Int8Array(keys.length * dim);
vectors.forEach((v, i) => {
  const s = Math.max(...v.map(Math.abs)) / 127;
  scales.push(s);
  for (let j = 0; j < dim; j++) bytes[i * dim + j] = Math.round(v[j] / s);
});
const out = { model: MODEL, dim, keys, scales: scales.map((s) => +s.toExponential(5)), data: Buffer.from(bytes.buffer).toString("base64") };
writeFileSync(new URL("../src/lib/foodEmbeddings.json", import.meta.url), JSON.stringify(out));
console.log(`wrote ${keys.length} embeddings x ${dim} → src/lib/foodEmbeddings.json (${Math.round(JSON.stringify(out).length / 1024)} KB)`);
