import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, RotateCcw, Scale, Send, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";
import { isDemoMode, supabase } from "../lib/supabase";
import { table } from "../lib/db";
import { currentSubscription, disablePush, enablePush, isIOS, isStandalone, loadPrefs, pushSupported, savePrefs, sendTest } from "../lib/push";
import { useNutritionHidden } from "../lib/nutritionVisibility";
import { DEFAULT_TABS, SECTIONS, SECTION_ORDER, useTabs } from "../lib/sections";
import { SectionTitle, Switch } from "./ui";

const KINDS = [
  { key: "vouchers", label: "שוברים שפגים", hint: "שבוע לפני, יום לפני וביום עצמו" },
  { key: "tasks", label: "מטלות", hint: "ביום היעד וביום שלפניו, ב-9 בבוקר" },
  { key: "shopping", label: "קניות", hint: "כשמישהו אחר מוסיף פריטים לרשימה" },
  { key: "weight", label: "שקילה יומית", hint: "כל בוקר, אם עוד לא נרשם משקל להיום" },
  { key: "food", label: "יומן אוכל", hint: "בערב: כמה נשאר להיום, או תזכורת אם לא נרשם כלום" },
];
const DEFAULT_PREFS = { vouchers: true, tasks: true, shopping: true, weight: true, food: true };

export function NotificationSettings() {
  const [state, setState] = useState("loading"); // loading | install | unsupported | off | on | denied
  const [prefs, setPrefs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [nutritionHidden] = useNutritionHidden();
  const kinds = nutritionHidden ? KINDS.filter((k) => k.key !== "weight" && k.key !== "food") : KINDS;

  useEffect(() => {
    (async () => {
      if (isIOS() && !isStandalone()) return setState("install");
      if (!pushSupported()) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const sub = await currentSubscription();
      if (!sub) return setState("off");
      setPrefs((await loadPrefs()) ?? DEFAULT_PREFS);
      setState("on");
    })().catch(() => setState("off"));
  }, []);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e.message || "משהו השתבש");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionTitle>התראות</SectionTitle>
      <div className="card overflow-hidden">
        {state === "loading" && <div className="skeleton h-16 !rounded-none" />}

        {state === "install" && (
          <div className="p-4 space-y-3 text-[15px]">
            <p className="font-medium">כדי לקבל התראות באייפון, פותחים את האפליקציה ממסך הבית:</p>
            <p className="flex items-center gap-2 text-muted">
              <Share size={18} className="shrink-0" /> בספארי: כפתור השיתוף
            </p>
            <p className="flex items-center gap-2 text-muted">
              <SquarePlus size={18} className="shrink-0" /> "הוספה למסך הבית", ואז פותחים מהאייקון
            </p>
          </div>
        )}

        {state === "unsupported" && <p className="p-4 text-[15px] text-muted">הדפדפן הזה לא תומך בהתראות. באייפון צריך iOS 16.4 ומעלה.</p>}

        {state === "denied" && (
          <p className="p-4 text-[15px] text-muted">
            ההתראות חסומות במכשיר. מפעילים ב<span className="text-fg font-medium">הגדרות ← התראות ← הבית</span> ופותחים שוב את האפליקציה.
          </p>
        )}

        {state === "off" && (
          <div className="p-4 flex items-center gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-full bg-raised shrink-0">
              <BellOff size={19} />
            </span>
            <p className="flex-1 text-[15px]">
              <span className="block font-medium">ההתראות כבויות</span>
              <span className="block text-[13px] text-muted">{nutritionHidden ? "שוברים שפגים, מטלות וקניות" : "שוברים שפגים, מטלות, קניות, שקילה ויומן אוכל"}</span>
            </p>
            <button
              type="button"
              className="btn btn-primary h-10 px-4"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const p = await enablePush();
                  setPrefs(p ?? DEFAULT_PREFS);
                  setState("on");
                  toast.success("ההתראות הופעלו");
                })
              }
            >
              {busy ? <Loader2 size={17} className="animate-spin" /> : "הפעלה"}
            </button>
          </div>
        )}

        {state === "on" && prefs && (
          <div className="divide-y">
            {kinds.map((k) => (
              <div key={k.key} className="flex items-center gap-3 px-4 min-h-[64px]">
                <p className="flex-1 text-[15px]">
                  <span className="block font-medium">{k.label}</span>
                  <span className="block text-[13px] text-muted">{k.hint}</span>
                </p>
                <Switch
                  on={prefs[k.key] !== false}
                  label={k.label}
                  onChange={(v) => {
                    const next = { ...prefs, [k.key]: v };
                    setPrefs(next);
                    savePrefs(next).catch(() => {
                      setPrefs(prefs);
                      toast.error("לא נשמר");
                    });
                  }}
                />
              </div>
            ))}
            <div className="flex gap-2 p-3">
              <button type="button" className="btn btn-soft flex-1 h-11" disabled={busy} onClick={() => run(async () => (await sendTest(), toast.success("נשלחה התראת בדיקה")))}>
                {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} התראת בדיקה
              </button>
              <button
                type="button"
                className="btn btn-danger h-11"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await disablePush();
                    setState("off");
                  })
                }
              >
                <Bell size={17} /> כיבוי
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// השם שמופיע ליד פריטים שהוספתם ובהתראות
export function ProfileName({ user }) {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setName(data?.name ?? "");
        setSaved(data?.name ?? "");
      });
  }, [user?.id]);

  const save = async () => {
    const v = name.trim();
    if (!v || v === saved) return;
    const { error } = await supabase.from("profiles").upsert({ user_id: user.id, name: v });
    if (error) return toast.error("לא נשמר");
    setSaved(v);
    toast.success("השם עודכן");
  };

  return (
    <label className="flex items-center gap-3 px-4 min-h-[56px]">
      <span className="text-[15px] font-medium shrink-0">השם שלי</span>
      <input
        className="bare flex-1 min-w-0 bg-transparent outline-none text-end text-[16px] text-muted focus:text-fg"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        enterKeyHint="done"
        placeholder="איך יופיע ליד פריטים שהוספת"
      />
    </label>
  );
}

// הסרגל התחתון: בוחרים אילו שלושה מדורים יושבים בין "בית" ל"עוד"
export function TabBarSettings() {
  const [tabs, setTabs] = useTabs();
  const [nutritionHidden] = useNutritionHidden();
  const options = SECTION_ORDER.filter((k) => !(k === "nutrition" && nutritionHidden));
  const pick = (slot, key) => {
    const next = [...tabs];
    const dup = next.indexOf(key);
    if (dup >= 0 && dup !== slot) next[dup] = next[slot]; // כבר במקום אחר: מחליפים ביניהם
    next[slot] = key;
    setTabs(next);
  };
  const isDefault = tabs.join() === DEFAULT_TABS.join();
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[15px]">
          <span className="block font-medium">הסרגל התחתון</span>
          <span className="block text-[13px] text-muted">בית ו״עוד״ קבועים. את שלושת האמצעיים בוחרים כאן</span>
        </p>
        {!isDefault && (
          <button type="button" className="press flex items-center gap-1 text-[13px] text-accent-text font-medium h-8 shrink-0" onClick={() => setTabs(DEFAULT_TABS)}>
            <RotateCcw size={14} /> ברירת מחדל
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {tabs.map((key, slot) => {
          const Icon = SECTIONS[key].icon;
          return (
            <label key={slot} className="relative">
              <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-[12px] font-medium">
                <Icon size={18} />
                {SECTIONS[key].label}
              </span>
              <select className="field h-16 w-full appearance-none bg-raised" style={{ color: "transparent", WebkitTextFillColor: "transparent" }} value={key} onChange={(e) => pick(slot, e.target.value)} aria-label={`מקום ${slot + 1} בסרגל`}>
                {options.map((k) => (
                  <option key={k} value={k} className="text-fg">
                    {SECTIONS[k].label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// הצגה/הסתרה של תזונה ומשקל בכל האפליקציה. הסתרה גם מכבה את שאלת המשקל היומית ואת תזכורות השקילה והאוכל
export function NutritionVisibility({ user }) {
  const [hidden, setHidden] = useNutritionHidden();
  const [busy, setBusy] = useState(false);
  const toggle = async (show) => {
    setBusy(true);
    setHidden(!show);
    try {
      await table("nutrition_profiles").upsert({ user_id: user?.id ?? "demo", daily_prompt: show }, "user_id");
      if (!isDemoMode && pushSupported() && (await currentSubscription())) {
        const p = (await loadPrefs()) ?? {};
        await savePrefs({ ...p, weight: show, food: show });
      }
      toast.success(show ? "תזונה ומשקל חזרו לאפליקציה" : "תזונה ומשקל הוסתרו, בלי שאלת משקל ובלי תזכורות");
    } catch (e) {
      toast.error(e.message || "לא נשמר");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-3 px-4 min-h-[64px]">
      <span className="grid place-items-center w-10 h-10 rounded-full bg-raised shrink-0">
        <Scale size={19} />
      </span>
      <p className="flex-1 text-[15px]">
        <span className="block font-medium">תזונה ומשקל</span>
        <span className="block text-[13px] text-muted">{hidden ? "מוסתר: בלי שאלת המשקל בבית ובלי תזכורות. הנתונים נשמרים" : "מוצג באפליקציה, עם שאלת המשקל היומית"}</span>
      </p>
      <Switch on={!hidden} onChange={toggle} label="להציג תזונה ומשקל" disabled={busy} />
    </div>
  );
}
