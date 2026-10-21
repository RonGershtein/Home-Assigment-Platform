// גישה לנתונים: כל הקומפוננטות עוברות דרך כאן ולא פונות ל-Supabase ישירות
import { supabase, isDemoMode } from "./supabase";
import { localTable, onLocalChange } from "./localBackend";

function check({ data, error }) {
  if (error) throw error;
  return data;
}

function remoteTable(name) {
  return {
    async list() {
      // Supabase מחזיר עד 1000 שורות לבקשה - מדפדפים
      const out = [];
      for (let from = 0; ; from += 1000) {
        const page = check(await supabase.from(name).select("*").order("created_at", { ascending: false }).range(from, from + 999));
        out.push(...page);
        if (page.length < 1000) return out;
      }
    },
    async create(values) {
      const rows = check(await supabase.from(name).insert(values).select());
      return Array.isArray(values) ? rows : rows[0];
    },
    async update(id, patch) {
      return check(await supabase.from(name).update(patch).eq("id", id).select().single());
    },
    async remove(ids) {
      const arr = Array.isArray(ids) ? ids : [ids];
      check(await supabase.from(name).delete().in("id", arr));
    },
    async upsert(values, key) {
      check(await supabase.from(name).upsert(values, { onConflict: key }));
    },
  };
}

export const table = (name) => (isDemoMode ? localTable(name) : remoteTable(name));

// עדכונים חיים: כשבן/בת הזוג משנים משהו, המסך מתרענן
export function subscribe(name, fn) {
  if (isDemoMode) return onLocalChange((n) => (n === name || n === "*") && fn());
  const channel = supabase
    .channel(`rt-${name}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: name }, () => fn())
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function errorMessage(err) {
  const code = err?.code;
  if (code === "42501") return "אין הרשאה לפעולה הזו";
  if (code === "23505") return "הרשומה כבר קיימת";
  if (err?.message?.includes("Failed to fetch")) return "אין חיבור לאינטרנט";
  return err?.message || "משהו השתבש";
}
