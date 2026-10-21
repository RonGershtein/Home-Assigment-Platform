// התראות push: הרשמה, ביטול והעדפות. באייפון עובד רק מאפליקציה שהוספה למסך הבית (iOS 16.4+)
import { supabase } from "./supabase";

const VAPID_PUBLIC = "BLWBxTaPRn6aNg1rGXSFWQYJPWz43y6dXmSqkh5uSGCdsC0kqs7_60ZA5slbftT8kfRqlgTPEOcHJa2rzIG-ygQ";

export const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

function keyBytes(b64) {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function loadPrefs() {
  const sub = await currentSubscription();
  if (!sub || !supabase) return null;
  const { data } = await supabase.from("push_subscriptions").select("prefs").eq("endpoint", sub.endpoint).maybeSingle();
  return data?.prefs ?? null;
}

export async function enablePush() {
  if (!pushSupported()) throw new Error("הדפדפן הזה לא תומך בהתראות");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("ההתראות חסומות. אפשר להפעיל בהגדרות ← התראות ← הבית");
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }));
  const j = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: "endpoint" });
  if (error) throw error;
  return loadPrefs();
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export async function savePrefs(prefs) {
  const sub = await currentSubscription();
  if (!sub) return;
  const { error } = await supabase.from("push_subscriptions").update({ prefs }).eq("endpoint", sub.endpoint);
  if (error) throw error;
}

export async function sendTest() {
  const { data, error } = await supabase.functions.invoke("notify", { body: { kind: "test" } });
  if (error) throw error;
  if (!data?.sent) throw new Error("לא נמצא מכשיר רשום. נסו לכבות ולהפעיל שוב");
  return data.sent;
}
