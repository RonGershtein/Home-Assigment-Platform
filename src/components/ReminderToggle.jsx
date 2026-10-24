import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { currentSubscription, enablePush, isIOS, isStandalone, loadPrefs, pushSupported, savePrefs } from "../lib/push";
import { isDemoMode } from "../lib/supabase";
import { Switch } from "./ui";

// מתג להתראת push אחת (למשל תזכורת שקילה): מפעיל את ההתראות במכשיר אם צריך ושומר את ההעדפה
export default function ReminderToggle({ prefKey, label, hint, icon = <Bell size={19} /> }) {
  const [state, setState] = useState("loading"); // loading | install | unsupported | denied | ready
  const [prefs, setPrefs] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isDemoMode) return setState("unsupported");
    (async () => {
      if (isIOS() && !isStandalone()) return setState("install");
      if (!pushSupported()) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const sub = await currentSubscription();
      setPrefs(sub ? ((await loadPrefs()) ?? {}) : null);
      setState("ready");
    })().catch(() => setState("ready"));
  }, []);

  const on = !!prefs && prefs[prefKey] !== false;
  const toggle = async (v) => {
    setBusy(true);
    try {
      let p = prefs;
      if (!p) {
        p = (await enablePush()) ?? {};
        toast.success("ההתראות הופעלו");
      }
      const next = { ...p, [prefKey]: v };
      setPrefs(next);
      await savePrefs(next);
    } catch (e) {
      toast.error(e.message || "לא נשמר");
    } finally {
      setBusy(false);
    }
  };

  const disabledHint =
    state === "install" ? "באייפון: שיתוף ← הוספה למסך הבית, ואז מהאייקון" : state === "unsupported" ? (isDemoMode ? "לא זמין במצב הדגמה" : "הדפדפן לא תומך בהתראות") : state === "denied" ? "ההתראות חסומות בהגדרות המכשיר" : null;

  return (
    <div className="flex items-center gap-3 px-4 min-h-[64px]">
      <span className="grid place-items-center w-10 h-10 rounded-full bg-raised shrink-0">{icon}</span>
      <p className="flex-1 text-[15px]">
        <span className="block font-medium">{label}</span>
        <span className="block text-[13px] text-muted">{disabledHint ?? hint}</span>
      </p>
      {state === "loading" ? <div className="skeleton w-[52px] h-8 !rounded-full" /> : <Switch on={on} onChange={toggle} label={label} disabled={busy || state !== "ready"} />}
    </div>
  );
}
