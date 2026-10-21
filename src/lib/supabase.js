import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);
// מצב הדגמה רק כש-Supabase לא מוגדר - כך פריסה אמיתית לא נופלת בטעות לנתונים מקומיים
export const isDemoMode = !isSupabaseConfigured && import.meta.env.VITE_DEMO_MODE === "true";

export const supabase = isSupabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
