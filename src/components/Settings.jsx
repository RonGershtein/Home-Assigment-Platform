import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Send, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { currentSubscription, disablePush, enablePush, isIOS, isStandalone, loadPrefs, pushSupported, savePrefs, sendTest } from "../lib/push";
import { SectionTitle, Switch } from "./ui";

const KINDS = [
  { key: "vouchers", label: "שוברים שפגים", hint: "שבוע לפני, יום לפני וביום עצמו" },
  { key: "tasks", label: "מטלות", hint: "ביום היעד וביום שלפניו, ב-9 בבוקר" },
  { key: "shopping", label: "קניות", hint: "כשמישהו אחר מוסיף פריטים לרשימה" },
];

export function NotificationSettings() {
  const [state, setState] = useState("loading"); // loading | install | unsupported | off | on | denied
  const [prefs, setPrefs] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (isIOS() && !isStandalone()) return setState("install");
      if (!pushSupported()) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const sub = await currentSubscription();
      if (!sub) return setState("off");
      setPrefs((await loadPrefs()) ?? { vouchers: true, tasks: true, shopping: true });
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
              <span className="block text-[13px] text-muted">שוברים שפגים, מטלות, ופריטים חדשים בקניות</span>
            </p>
            <button
              type="button"
              className="btn btn-primary h-10 px-4"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const p = await enablePush();
                  setPrefs(p ?? { vouchers: true, tasks: true, shopping: true });
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
            {KINDS.map((k) => (
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
