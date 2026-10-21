// מעביר את הנתונים האמיתיים מ-Base44 (data/base44-export/*.json) ל-Supabase.
// הרצה: npm run import:base44   (צריך VITE_SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY ב-.env)
// אפשר להריץ שוב בבטחה: רשומות שכבר הועברו (לפי base44_id) לא משוכפלות.
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  (existsSync(".env") ? readFileSync(".env", "utf8") : "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("חסר VITE_SUPABASE_URL או SUPABASE_SERVICE_ROLE_KEY ב-.env");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const DIR = "data/base44-export";
const DRY = process.argv.includes("--dry");

const load = (name) => JSON.parse(readFileSync(`${DIR}/ent_${name}.json`, "utf8")).filter((r) => !r.is_sample);
const ts = (r) => ({ created_at: r.created_date ? r.created_date + "Z" : undefined, updated_at: r.updated_date ? r.updated_date + "Z" : undefined });
const num = (v) => (v == null || v === "" ? null : Number(v));

const MAP = [
  ["ShoppingItem", "shopping_items", (r) => ({ item_name: r.item_name, category: r.category || "other", is_purchased: !!r.is_purchased })],
  ["ItemCategoryMemory", "item_categories", (r) => ({ item_name: r.item_name, category: r.category || "other" })],
  ["Task", "tasks", (r) => ({ title: r.title, is_done: !!r.is_done, size: r.size === "big" ? "big" : "small", due_date: r.due_date || null, notes: r.notes || "" })],
  [
    "Voucher",
    "vouchers",
    (r) => ({
      title: r.title,
      voucher_type: r.voucher_type === "gift" ? "gift" : "cash",
      amount: num(r.amount),
      gift_description: r.gift_description || null,
      expiry_date: r.expiry_date || null,
      voucher_code: r.voucher_code || null,
      store_url: r.store_url || null,
      status: r.status === "used" ? "used" : "active",
      notes: r.notes || "",
    }),
  ],
  ["Gift", "gifts", (r) => ({ giver_name: r.giver_name, guest_count: Math.round(num(r.guest_count) || 0), amount: num(r.amount) || 0, notes: r.notes || "" })],
  ["Recipe", "recipes", (r) => ({ title: r.title, link: r.link || "", description: r.description || "", image_url: r.image_url || "", verdict: "try" })],
];

for (const [entity, tableName, map] of MAP) {
  const src = load(entity);
  // זיכרון קטגוריות: ייחודי לפי שם פריט - האחרון מנצח
  let rows = src.map((r) => ({ ...map(r), ...ts(r) }));
  if (tableName === "item_categories") rows = [...new Map(rows.map((r) => [r.item_name, r])).values()];

  const { count } = await db.from(tableName).select("*", { count: "exact", head: true });
  if (count > 0 && tableName !== "item_categories") {
    console.log(`⏭  ${tableName}: כבר יש ${count} שורות - מדלג (מחקו אותן כדי לייבא מחדש)`);
    continue;
  }
  if (DRY) {
    console.log(`🔎 ${tableName}: ${rows.length} שורות (dry run)`);
    continue;
  }
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const q = tableName === "item_categories" ? db.from(tableName).upsert(chunk, { onConflict: "item_name" }) : db.from(tableName).insert(chunk);
    const { error } = await q;
    if (error) {
      console.error(`❌ ${tableName}:`, error.message);
      process.exit(1);
    }
  }
  console.log(`✅ ${tableName}: ${rows.length} שורות`);
}
console.log("סיום.");
