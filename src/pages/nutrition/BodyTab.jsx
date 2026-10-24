import { useState } from "react";
import { Activity, Flame, Info, Ruler, Save } from "lucide-react";
import { toast } from "sonner";
import { Field, SectionTitle, Segmented } from "../../components/ui";
import { ACTIVITY, BMI_BANDS, GOALS, RATES, ageFrom, bmi, bmiBand, calorieTarget, fmt0, fmt1, fmtKg, healthyRange } from "../../lib/nutrition";

const toneBg = { good: "bg-good", warn: "bg-warn", crit: "bg-crit" };
const toneText = { good: "text-good", warn: "text-warn", crit: "text-crit" };

export default function BodyTab({ me, weights, myProfile, saveProfile }) {
  const mine = weights.rows.filter((e) => e.user_id === me).sort((a, b) => b.day.localeCompare(a.day));
  const current = mine[0] ? Number(mine[0].weight_kg) : null;

  const [p, setP] = useState(() => ({
    sex: myProfile?.sex ?? "female",
    birth_date: myProfile?.birth_date ?? "",
    height_cm: myProfile?.height_cm ?? "",
    activity: myProfile?.activity ?? "light",
    goal: myProfile?.goal ?? "maintain",
    goal_weight_kg: myProfile?.goal_weight_kg ?? "",
    weekly_rate_kg: Number(myProfile?.weekly_rate_kg ?? 0.5),
    calorie_target: myProfile?.calorie_target ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setP((s) => ({ ...s, [k]: v }));

  // תצוגה חיה: מחשבים מהטופס, לא רק ממה שנשמר
  const live = { ...p, height_cm: Number(p.height_cm) || null, goal_weight_kg: p.goal_weight_kg === "" ? null : Number(p.goal_weight_kg), calorie_target: p.calorie_target === "" ? null : Number(p.calorie_target) };
  const b = bmi(current, live.height_cm);
  const band = bmiBand(b);
  const range = healthyRange(live.height_cm);
  const plan = calorieTarget(live, current);
  const age = ageFrom(p.birth_date);

  const save = async () => {
    setSaving(true);
    try {
      await saveProfile({
        sex: p.sex || null,
        birth_date: p.birth_date || null,
        height_cm: live.height_cm,
        activity: p.activity,
        goal: p.goal,
        goal_weight_kg: live.goal_weight_kg,
        weekly_rate_kg: p.weekly_rate_kg,
        calorie_target: live.calorie_target,
      });
      toast.success("הפרופיל נשמר");
    } catch (e) {
      toast.error(e.message || "לא נשמר");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* BMI */}
      <div className="hero p-5 rise">
        <div className="flex items-center justify-between text-[13px] text-muted">
          <span className="flex items-center gap-1.5">
            <Ruler size={14} /> BMI
          </span>
          {current != null && <span>משקל נוכחי {fmtKg(current)}</span>}
        </div>
        {b == null ? (
          <p className="text-[17px] font-medium mt-2">{current == null ? "רושמים שקילה ראשונה בטאב משקל, ואת הגובה למטה" : "ממלאים גובה למטה כדי לחשב"}</p>
        ) : (
          <>
            <p className="num text-[52px] leading-[1.05] font-bold tracking-[-0.03em] mt-1">
              {fmt1(b)} <span className={`text-[18px] font-semibold tracking-normal ${toneText[band.tone]}`}>{band.label}</span>
            </p>
            <Gauge value={b} />
            {range && (
              <p className="text-[13px] text-muted mt-3">
                משקל תקין לגובה שלך: <span className="num text-fg font-medium">{fmt0(range[0])}–{fmt0(range[1])} ק״ג</span>
                {current > range[1] && <> · עד הטווח: {fmtKg(current - range[1])}</>}
              </p>
            )}
          </>
        )}
      </div>

      {/* אנרגיה */}
      {plan && !plan.manual && (
        <div className="card p-4 mt-3 rise">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[12px] text-muted">BMR</p>
              <p className="num text-[20px] font-semibold">{fmt0(plan.bmr)}</p>
              <p className="text-[11px] text-muted">במנוחה</p>
            </div>
            <div>
              <p className="text-[12px] text-muted">תחזוקה</p>
              <p className="num text-[20px] font-semibold">{fmt0(plan.tdee)}</p>
              <p className="text-[11px] text-muted">עם פעילות</p>
            </div>
            <div className="rounded-2xl bg-accent text-accent-ink py-1">
              <p className="text-[12px] opacity-80">היעד שלך</p>
              <p className="num text-[20px] font-bold">{fmt0(plan.target)}</p>
              <p className="text-[11px] opacity-80">קק״ל ליום</p>
            </div>
          </div>
          <div className="text-[13px] text-muted mt-4 pt-3 border-t space-y-1.5">
            {plan.delta !== 0 && (
              <p>
                {plan.delta < 0 ? "גירעון" : "עודף"} של <span className="num text-fg font-medium">{fmt0(Math.abs(plan.delta))} קק״ל</span> ביום ≈ {plan.rate} ק״ג בשבוע (7,700 קק״ל לק״ג).
              </p>
            )}
            {plan.floored && <p className="text-warn">היעד הוגבל ל-{fmt0(plan.floor)} קק״ל: מתחת לזה לא יורדים בלי ליווי רפואי.</p>}
            {plan.protein && (
              <p>
                חלבון: <span className="num text-fg font-medium">{plan.protein[0]}–{plan.protein[1]} גר׳</span> ביום שומר על השריר ומשביע.
              </p>
            )}
          </div>
        </div>
      )}
      {plan?.manual && (
        <div className="card p-4 mt-3 flex items-center gap-3">
          <Flame size={20} className="text-accent-text shrink-0" />
          <p className="text-[14px]">
            יעד ידני: <span className="num font-semibold">{fmt0(plan.target)} קק״ל</span> ליום. מוחקים את השדה למטה כדי לחזור לחישוב אוטומטי.
          </p>
        </div>
      )}

      {/* הפרופיל */}
      <SectionTitle>הפרופיל שלי</SectionTitle>
      <div className="card p-4 space-y-4">
        <div>
          <span className="label">מין (לנוסחת ה-BMR)</span>
          <Segmented
            value={p.sex}
            onChange={(v) => set("sex", v)}
            options={[
              { value: "female", label: "אישה" },
              { value: "male", label: "גבר" },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={age ? `תאריך לידה (${age})` : "תאריך לידה"}>
            <input type="date" className="field" value={p.birth_date} onChange={(e) => set("birth_date", e.target.value)} />
          </Field>
          <Field label="גובה (ס״מ)">
            <input className="field num" type="number" inputMode="numeric" min="100" max="250" value={p.height_cm} onChange={(e) => set("height_cm", e.target.value)} placeholder="170" />
          </Field>
        </div>
        <div>
          <span className="label">רמת פעילות</span>
          <div className="space-y-1.5">
            {ACTIVITY.map((a) => (
              <button key={a.value} type="button" onClick={() => set("activity", a.value)} className={`press w-full flex items-center gap-3 rounded-2xl px-4 py-2.5 text-start ${p.activity === a.value ? "bg-accent text-accent-ink" : "bg-raised"}`}>
                <Activity size={16} className="shrink-0 opacity-70" />
                <span className="flex-1">
                  <span className="block text-[15px] font-medium">{a.label}</span>
                  <span className="block text-[12px] opacity-75">{a.hint}</span>
                </span>
                <span className="num text-[12px] opacity-60">×{a.factor}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">המטרה</span>
          <Segmented value={p.goal} onChange={(v) => set("goal", v)} options={GOALS} />
        </div>
        {p.goal !== "maintain" && (
          <div className="grid grid-cols-2 gap-3 enter">
            <Field label="משקל יעד (ק״ג)">
              <input className="field num" type="number" inputMode="decimal" step="0.5" value={p.goal_weight_kg} onChange={(e) => set("goal_weight_kg", e.target.value)} placeholder={current ? String(Math.round(current - 5)) : "75"} />
            </Field>
            <div>
              <span className="label">קצב</span>
              <div className="grid grid-cols-4 gap-1 h-12 rounded-2xl bg-raised p-1">
                {RATES.filter((r) => p.goal === "lose" || r.value <= 0.5).map((r) => (
                  <button key={r.value} type="button" onClick={() => set("weekly_rate_kg", r.value)} className={`press rounded-xl text-[15px] font-semibold num ${p.weekly_rate_kg === r.value ? "bg-fg text-bg" : ""}`} title={r.hint}>
                    {r.value === 0.25 ? "¼" : r.value === 0.5 ? "½" : r.value === 0.75 ? "¾" : "1"}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted mt-1 px-1">ק״ג בשבוע · ½ הוא המומלץ</p>
            </div>
          </div>
        )}
        <Field label="יעד קלוריות ידני (לא חובה - עוקף את החישוב)">
          <input className="field num" type="number" inputMode="numeric" value={p.calorie_target} onChange={(e) => set("calorie_target", e.target.value)} placeholder={plan && !plan.manual ? `מחושב: ${fmt0(plan.computed)}` : "1800"} />
        </Field>
        <button type="button" className="btn btn-primary w-full" disabled={saving} onClick={save}>
          <Save size={18} /> שמירה
        </button>
      </div>

      {/* מה אומר המדע */}
      <SectionTitle>מה עובד באמת</SectionTitle>
      <div className="card p-4 text-[14px] leading-relaxed space-y-3">
        <p className="flex gap-2">
          <Info size={16} className="shrink-0 mt-1 text-muted" />
          <span>
            <b>קצב בטוח: ½–1 ק״ג בשבוע.</b> גירעון של 500–1,000 קק״ל ביום. ירידה איטית שומרת הרבה יותר שריר, ומפחיתה אבני מרה ותופעות לוואי.
          </span>
        </p>
        <p className="flex gap-2">
          <Info size={16} className="shrink-0 mt-1 text-muted" />
          <span>
            <b>חלבון בכל ארוחה.</b> 1.6–2.2 גר׳ לק״ג ביום בזמן ירידה (עמדת ISSN). משביע הכי הרבה ושורף יותר בעיכול.
          </span>
        </p>
        <p className="flex gap-2">
          <Info size={16} className="shrink-0 mt-1 text-muted" />
          <span>
            <b>שקילה כל בוקר, מסתכלים על הממוצע השבועי.</b> המשקל קופץ ±1 ק״ג מיום ליום בגלל מים ומלח. הקו הכהה בגרף הוא הממוצע, והוא מה שחשוב.
          </span>
        </p>
        <p className="flex gap-2">
          <Info size={16} className="shrink-0 mt-1 text-muted" />
          <span>
            <b>הנוסחה:</b> Mifflin-St Jeor, המדויקת ביותר למבוגרים בריאים (±10%). היעד הוא נקודת התחלה: אם אחרי 2–3 שבועות המגמה לא מתאימה, מורידים או מעלים 100–200 קק״ל.
          </span>
        </p>
        <p className="text-[12px] text-muted pt-2 border-t">
          מידע כללי ולא ייעוץ רפואי. בהריון, הנקה, מחלה כרונית או BMI מתחת ל-18.5 - מתייעצים עם רופא/ה או דיאטן/ית.
        </p>
      </div>
    </>
  );
}

// מד BMI: ארבעה מקטעים (15–40) וסמן
function Gauge({ value }) {
  const min = 15;
  const max = 40;
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const stops = [18.5, 25, 30];
  const widths = [stops[0] - min, stops[1] - stops[0], stops[2] - stops[1], max - stops[2]].map((w) => (w / (max - min)) * 100);
  return (
    <div className="mt-4" dir="ltr">
      <div className="relative h-2.5 rounded-full overflow-hidden flex gap-[2px]">
        {BMI_BANDS.map((b, i) => (
          <div key={b.label} className={`${toneBg[b.tone]} h-full opacity-70`} style={{ width: `${widths[i]}%` }} />
        ))}
      </div>
      <div className="relative h-4">
        <div className="absolute -top-[14px] w-[3px] h-5 rounded-full bg-white shadow -translate-x-1/2" style={{ left: `${pct}%`, transition: "left 400ms var(--ease-out)" }} />
      </div>
      <div className="flex text-[10px] text-muted" style={{ paddingInline: 0 }}>
        {[["18.5", widths[0]], ["25", widths[1]], ["30", widths[2]]].map(([l, w]) => (
          <span key={l} className="num text-end" style={{ width: `${w}%` }}>{l}</span>
        ))}
      </div>
    </div>
  );
}
