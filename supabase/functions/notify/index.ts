// שליחת התראות push לאייפון (Web Push).
// daily    - כל בוקר: שוברים שפגים (7 ימים / מחר / היום), מטלות להיום ולמחר, ותזכורת שקילה למי שעוד לא נשקל
// evening  - כל ערב: יומן אוכל - כמה נשאר להיום, או תזכורת אם לא נרשם כלום
// shopping - כל כמה דקות: פריטים שנוספו לרשימה, רק לבן/בת הזוג השני/ה
// test     - מהאפליקציה: התראת בדיקה למכשירים של מי שלחץ
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; prefs: Record<string, boolean> };
type Msg = { title: string; body: string; url: string; tag: string };

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, "content-type": "application/json" } });

function israelDay(offset = 0) {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
}

const ils = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });

async function send(subs: Sub[], msg: Msg) {
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 60 * 60 * 12, urgency: "normal" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // המכשיר ביטל את המנוי (מחיקת האפליקציה / כיבוי התראות) - מוחקים
      if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("push failed", code, (e as Error).message);
    }
  }
  return sent;
}

// מסנן מפתחות שכבר נשלחו ורושם את החדשים
async function fresh(keys: string[]) {
  if (!keys.length) return [];
  const { data } = await db.from("notify_log").select("key").in("key", keys);
  const done = new Set((data ?? []).map((r) => r.key));
  return keys.filter((k) => !done.has(k));
}
const mark = (keys: string[]) => keys.length && db.from("notify_log").upsert(keys.map((key) => ({ key })));

async function daily(subs: Sub[]) {
  const today = israelDay(0);
  const offsets = { [israelDay(7)]: 7, [israelDay(1)]: 1, [today]: 0 } as Record<string, number>;
  let total = 0;

  const { data: vouchers } = await db
    .from("vouchers")
    .select("id,title,amount,balance,voucher_type,expiry_date")
    .eq("status", "active")
    .in("expiry_date", Object.keys(offsets));
  const vKeys = (vouchers ?? []).map((v) => `voucher:${v.id}:${offsets[v.expiry_date]}`);
  const vNew = new Set(await fresh(vKeys));
  const vDue = (vouchers ?? []).filter((v) => vNew.has(`voucher:${v.id}:${offsets[v.expiry_date]}`));
  if (vDue.length) {
    const when = (d: number) => (d === 0 ? "היום" : d === 1 ? "מחר" : "בעוד שבוע");
    const line = (v: (typeof vDue)[number]) => {
      const value = v.voucher_type === "cash" ? ils.format(Number(v.balance ?? v.amount ?? 0)) : "מתנה";
      return `${v.title.trim()} (${value}) - פג ${when(offsets[v.expiry_date])}`;
    };
    const msg: Msg =
      vDue.length === 1
        ? { title: `שובר פג ${when(offsets[vDue[0].expiry_date])}`, body: line(vDue[0]), url: "/vouchers", tag: "vouchers" }
        : { title: `${vDue.length} שוברים פגים בקרוב`, body: vDue.map(line).join("\n"), url: "/vouchers", tag: "vouchers" };
    total += await send(subs.filter((s) => s.prefs?.vouchers !== false), msg);
    await mark(vDue.map((v) => `voucher:${v.id}:${offsets[v.expiry_date]}`));
  }

  const { data: tasks } = await db.from("tasks").select("id,title,due_date").eq("is_done", false).in("due_date", [today, israelDay(1)]);
  const tKeys = (tasks ?? []).map((t) => `task:${t.id}:${t.due_date}`);
  const tNew = new Set(await fresh(tKeys));
  const tDue = (tasks ?? []).filter((t) => tNew.has(`task:${t.id}:${t.due_date}`));
  if (tDue.length) {
    const todayCount = tDue.filter((t) => t.due_date === today).length;
    const title = todayCount ? (tDue.length === 1 ? "מטלה להיום" : `${tDue.length} מטלות להיום ולמחר`) : tDue.length === 1 ? "מטלה למחר" : `${tDue.length} מטלות למחר`;
    total += await send(subs.filter((s) => s.prefs?.tasks !== false), { title, body: tDue.map((t) => t.title).join(" · "), url: "/tasks", tag: "tasks" });
    await mark(tDue.map((t) => `task:${t.id}:${t.due_date}`));
  }
  return total;
}

// לכל משתמש עם מנוי: תזכורת שקילה אם אין רשומה להיום (העדפה "weight")
async function weight(subs: Sub[]) {
  const today = israelDay(0);
  const users = [...new Set(subs.filter((s) => s.prefs?.weight !== false).map((s) => s.user_id))];
  if (!users.length) return 0;
  const { data: todays } = await db.from("weight_entries").select("user_id").eq("day", today).in("user_id", users);
  const done = new Set((todays ?? []).map((r) => r.user_id));
  const { data: profiles } = await db.from("nutrition_profiles").select("user_id,daily_prompt").in("user_id", users);
  const off = new Set((profiles ?? []).filter((p) => p.daily_prompt === false).map((p) => p.user_id));
  const pending = users.filter((u) => !done.has(u) && !off.has(u));
  const keys = await fresh(pending.map((u) => `weight:${u}:${today}`));
  let total = 0;
  for (const u of pending) {
    if (!keys.includes(`weight:${u}:${today}`)) continue;
    const { data: last } = await db.from("weight_entries").select("weight_kg,day").eq("user_id", u).order("day", { ascending: false }).limit(1).maybeSingle();
    const body = last ? `בשקילה הקודמת: ${Number(last.weight_kg).toLocaleString("he-IL", { maximumFractionDigits: 1 })} ק״ג. נגיעה לרישום מהיר.` : "נגיעה לרישום מהיר. הכי מדויק בבוקר, לפני האוכל.";
    total += await send(subs.filter((s) => s.user_id === u && s.prefs?.weight !== false), { title: "כמה את/ה שוקל/ת היום? ⚖️", body, url: "/", tag: "weight" });
  }
  await mark(pending.map((u) => `weight:${u}:${today}`));
  return total;
}

// Mifflin-St Jeor + פעילות + גירעון, כמו ב-src/lib/nutrition.js
const FACTOR: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
function targetFor(p: Record<string, unknown> | null, weight: number | null): number | null {
  if (!p) return null;
  if (p.calorie_target) return Number(p.calorie_target);
  const h = Number(p.height_cm);
  const birth = p.birth_date ? new Date(String(p.birth_date)) : null;
  const age = birth ? Math.floor((Date.now() - birth.getTime()) / (365.25 * 86_400_000)) : null;
  if (!weight || !h || !age || !p.sex) return null;
  const bmr = 10 * weight + 6.25 * h - 5 * age + (p.sex === "male" ? 5 : -161);
  const tdee = bmr * (FACTOR[String(p.activity)] ?? 1.375);
  let rate = Number(p.weekly_rate_kg ?? 0.5);
  if (p.goal === "lose") rate = Math.min(rate, weight * 0.01);
  if (p.goal === "gain") rate = Math.min(rate, 0.5);
  const delta = (rate * 7700) / 7;
  let t = p.goal === "lose" ? tdee - delta : p.goal === "gain" ? tdee + delta : tdee;
  const floor = p.sex === "female" ? 1200 : 1500;
  if (t < floor) t = floor;
  return Math.round(t);
}

// סיכום ערב ליומן האוכל (העדפה "food")
async function evening(subs: Sub[]) {
  const today = israelDay(0);
  const users = [...new Set(subs.filter((s) => s.prefs?.food !== false).map((s) => s.user_id))];
  if (!users.length) return 0;
  const keys = new Set(await fresh(users.map((u) => `food:${u}:${today}`)));
  const { data: entries } = await db.from("food_entries").select("user_id,kcal").eq("day", today).in("user_id", users);
  const { data: profiles } = await db.from("nutrition_profiles").select("*").in("user_id", users);
  let total = 0;
  for (const u of users) {
    if (!keys.has(`food:${u}:${today}`)) continue;
    const mine = (entries ?? []).filter((e) => e.user_id === u);
    const profile = (profiles ?? []).find((p) => p.user_id === u) ?? null;
    // בלי פרופיל ובלי רשומות - כנראה לא משתמשים ביומן; לא מציקים.
    // daily_prompt=false = המשתמש הסתיר את התזונה באפליקציה - בלי תזכורות אוכל בכלל
    if (!mine.length && !profile) continue;
    if (profile?.daily_prompt === false) continue;
    const eaten = mine.reduce((s, e) => s + Number(e.kcal || 0), 0);
    const { data: w } = await db.from("weight_entries").select("weight_kg").eq("user_id", u).order("day", { ascending: false }).limit(1).maybeSingle();
    const target = targetFor(profile, w ? Number(w.weight_kg) : null);
    const n = (x: number) => Math.round(x).toLocaleString("he-IL");
    let msg: Msg;
    if (!mine.length) msg = { title: "מה אכלת היום? 🍽️", body: "עוד לא נרשם כלום ביומן. 20 שניות וזה בפנים.", url: "/nutrition?tab=food", tag: "food" };
    else if (target == null) msg = { title: `עד עכשיו: ${n(eaten)} קק״ל`, body: "נותר לרשום את ארוחת הערב? נגיעה ליומן.", url: "/nutrition?tab=food", tag: "food" };
    else if (eaten <= target) msg = { title: `נותרו ${n(target - eaten)} קק״ל להיום`, body: `נאכלו ${n(eaten)} מתוך ${n(target)}. ארוחת ערב קלה ואתם ביעד 💪`, url: "/nutrition?tab=food", tag: "food" };
    else msg = { title: `${n(eaten - target)} קק״ל מעל היעד היום`, body: "קורה. מה שקובע זה הממוצע השבועי - מחר יום חדש.", url: "/nutrition?tab=food", tag: "food" };
    total += await send(subs.filter((s) => s.user_id === u && s.prefs?.food !== false), msg);
  }
  await mark([...keys]);
  total += await weight(subs);
  return total;
}

async function shopping(subs: Sub[]) {
  // מחכים 2 דקות אחרי ההוספה כדי לאגד כמה פריטים להתראה אחת
  const { data: items } = await db
    .from("shopping_items")
    .select("id,item_name,created_by,created_at")
    .eq("is_purchased", false)
    .not("created_by", "is", null)
    .gte("created_at", new Date(Date.now() - 30 * 60_000).toISOString())
    .lte("created_at", new Date(Date.now() - 2 * 60_000).toISOString());
  const keys = await fresh((items ?? []).map((i) => `shop:${i.id}`));
  const pending = (items ?? []).filter((i) => keys.includes(`shop:${i.id}`));
  if (!pending.length) return 0;

  const { data: profiles } = await db.from("profiles").select("user_id,name");
  const names = new Map((profiles ?? []).map((p) => [p.user_id, p.name]));
  const byUser = new Map<string, typeof pending>();
  for (const i of pending) byUser.set(i.created_by, [...(byUser.get(i.created_by) ?? []), i]);

  let total = 0;
  for (const [user, list] of byUser) {
    const shown = list.slice(0, 6).map((i) => i.item_name).join(", ") + (list.length > 6 ? ` ועוד ${list.length - 6}` : "");
    const msg: Msg = {
      title: list.length === 1 ? "פריט חדש ברשימת הקניות" : `נוספו ${list.length} פריטים לקניות`,
      body: `${names.get(user) ?? "בבית"}: ${shown}`,
      url: "/shopping",
      tag: "shopping",
    };
    total += await send(subs.filter((s) => s.user_id !== user && s.prefs?.shopping !== false), msg);
  }
  await mark(pending.map((i) => `shop:${i.id}`));
  return total;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { data: cfg, error } = await db.rpc("push_config");
    if (error || !cfg) return json({ error: "config" }, 500);
    webpush.setVapidDetails("mailto:ron195220@gmail.com", cfg.vapid_public, cfg.vapid_private);

    const body = await req.json().catch(() => ({}));
    const fromCron = req.headers.get("x-cron-secret") === cfg.cron_secret;

    if (body.kind === "test") {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
      const { data: who } = await db.auth.getUser(token);
      if (!who?.user) return json({ error: "unauthorized" }, 401);
      const { data: subs } = await db.from("push_subscriptions").select("*").eq("user_id", who.user.id);
      const sent = await send((subs ?? []) as Sub[], { title: "ההתראות עובדות", body: "כאן יופיעו שוברים שפגים, מטלות, פריטים חדשים בקניות, תזכורת שקילה וסיכום יומן האוכל.", url: "/more", tag: "test" });
      return json({ sent });
    }

    if (!fromCron) return json({ error: "forbidden" }, 403);
    const { data: subs } = await db.from("push_subscriptions").select("*");
    if (!subs?.length) return json({ sent: 0, reason: "no subscriptions" });
    const sent = body.kind === "shopping" ? await shopping(subs as Sub[]) : body.kind === "evening" ? await evening(subs as Sub[]) : await daily(subs as Sub[]);
    return json({ kind: body.kind ?? "daily", sent });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

