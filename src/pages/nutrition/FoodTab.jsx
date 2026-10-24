import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, Flame, Pencil, Plus, Sparkles, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import Sheet from "../../components/Sheet";
import ReminderToggle from "../../components/ReminderToggle";
import { DeleteButton, Field, SectionTitle, Segmented, Skeletons } from "../../components/ui";
import AddFood, { foodIcon } from "./AddFood";
import { todayStr } from "../../lib/format";

import { MEALS, calorieTarget, fmt0, fmtKcal, mealByHour, relDayLabel, shiftDay, shortDay, streak } from "../../lib/nutrition";

export default function FoodTab({ me, myName, nameOf, foods, weights, myProfile, goBody }) {
  const today = todayStr();
  const [day, setDay] = useState(today);
  const [who, setWho] = useState(me);
  const [adding, setAdding] = useState(null); // meal key
  const [editing, setEditing] = useState(null);

  const people = useMemo(() => [me, ...new Set(foods.rows.filter((e) => e.user_id !== me).map((e) => e.user_id))], [foods.rows, me]);
  const viewingMe = who === me;
  const rows = useMemo(() => foods.rows.filter((e) => e.user_id === who), [foods.rows, who]);
  const dayRows = useMemo(() => rows.filter((e) => e.day === day).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")), [rows, day]);

  const myWeights = useMemo(() => weights.rows.filter((e) => e.user_id === me).sort((a, b) => b.day.localeCompare(a.day)), [weights.rows, me]);
  const current = myWeights[0] ? Number(myWeights[0].weight_kg) : null;
  const plan = viewingMe ? calorieTarget(myProfile, current) : null;
  const target = plan?.target ?? null;

  const eaten = dayRows.reduce((s, e) => s + Number(e.kcal || 0), 0);
  const protein = dayRows.reduce((s, e) => s + Number(e.protein_g || 0), 0);
  const left = target != null ? target - eaten : null;
  const share = target ? Math.min(1, eaten / target) : 0;
  const over = left != null && left < 0;

  // 7 ימים אחרונים לגרף, וממוצע של ימים שבהם נרשם משהו
  const week = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = shiftDay(day, -i);
      const kcal = rows.filter((e) => e.day === d).reduce((s, e) => s + Number(e.kcal || 0), 0);
      out.push({ day: d, label: i === 0 ? (d === today ? "היום" : shortDay(d)) : shortDay(d), kcal });
    }
    return out;
  }, [rows, day, today]);
  const logged = week.filter((w) => w.kcal > 0);
  const weekAvg = logged.length ? logged.reduce((s, w) => s + w.kcal, 0) / logged.length : null;
  const foodStreak = streak(rows.map((e) => ({ day: e.day })), today);

  const add = async (values) => {
    try {
      await foods.create({ user_id: me, day, ...values });
      toast.success(`נוסף: ${values.name}`);
      setAdding(null);
    } catch {}
  };
  const save = async (id, patch) => {
    try {
      await foods.update(id, patch);
      setEditing(null);
    } catch {}
  };

  if (foods.loading) return <Skeletons n={3} h={120} />;

  return (
    <>
      {people.length > 1 && <Segmented value={who} onChange={setWho} className="mb-3" options={people.map((u) => ({ value: u, label: u === me ? myName : nameOf(u) }))} />}

      {/* ניווט בין ימים */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" className="icon-btn bg-card" onClick={() => setDay(shiftDay(day, -1))} aria-label="יום קודם">
          <ChevronRight size={20} />
        </button>
        <button type="button" className="press text-[16px] font-semibold h-10 px-4 rounded-full bg-card" onClick={() => setDay(today)}>
          {relDayLabel(day, today)}
        </button>
        <button type="button" className="icon-btn bg-card disabled:opacity-30" onClick={() => setDay(shiftDay(day, 1))} disabled={day >= today} aria-label="יום הבא">
          <ChevronLeft size={20} />
        </button>
      </div>

      {/* ההירו: טבעת הקלוריות */}
      <div className="hero p-5 rise">
        <div className="flex items-center gap-5">
          <Ring share={share} over={over} size={132}>
            {target != null ? (
              <>
                <span className={`num text-[30px] font-bold leading-none tracking-[-0.03em] ${over ? "text-crit" : ""}`}>{fmt0(Math.abs(left))}</span>
                <span className="text-[12px] text-muted mt-1">{over ? "מעל היעד" : "נותרו"}</span>
              </>
            ) : (
              <>
                <span className="num text-[30px] font-bold leading-none tracking-[-0.03em]">{fmt0(eaten)}</span>
                <span className="text-[12px] text-muted mt-1">קק״ל היום</span>
              </>
            )}
          </Ring>
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <p className="text-[12px] text-muted">נאכלו</p>
              <p className="num text-[22px] font-semibold leading-tight">
                {fmt0(eaten)} {target != null && <span className="text-[13px] text-muted font-normal">/ {fmt0(target)}</span>}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-muted">חלבון</p>
              <p className="num text-[22px] font-semibold leading-tight">
                {fmt0(protein)} <span className="text-[13px] text-muted font-normal">{plan?.protein ? `/ ${plan.protein[0]}–${plan.protein[1]} גר׳` : "גר׳"}</span>
              </p>
              {plan?.protein && (
                <div className="h-1.5 rounded-full bg-raised mt-1.5 overflow-hidden">
                  <div className="bar h-full rounded-full bg-good" style={{ width: `${Math.min(100, (protein / plan.protein[0]) * 100)}%` }} />
                </div>
              )}
            </div>
            {viewingMe && foodStreak > 1 && (
              <p className="text-[12px] text-muted flex items-center gap-1">
                <Flame size={13} className="text-warn" /> {foodStreak} ימים ברצף של רישום
              </p>
            )}
          </div>
        </div>
        {viewingMe && target == null && (
          <button type="button" className="btn btn-primary w-full mt-4 h-11" onClick={goBody}>
            <Sparkles size={17} /> חישוב יעד קלוריות אישי
          </button>
        )}
        {viewingMe && plan && !plan.manual && plan.delta !== 0 && (
          <p className="text-[12px] text-muted mt-4 pt-3 border-t">
            יעד {fmt0(target)} קק״ל = תחזוקה {fmt0(plan.tdee)} {plan.delta < 0 ? "פחות" : "ועוד"} {fmt0(Math.abs(plan.delta))} ליום ({plan.delta < 0 ? "ירידה" : "עלייה"} של כ-{plan.rate} ק״ג בשבוע)
          </p>
        )}
      </div>

      {/* ארוחות */}
      {MEALS.map((m) => {
        const items = dayRows.filter((e) => e.meal === m.value);
        const sum = items.reduce((s, e) => s + Number(e.kcal || 0), 0);
        return (
          <div key={m.value}>
            <SectionTitle right={sum > 0 ? <span className="num text-[13px] text-muted">{fmtKcal(sum)}</span> : null}>
              {m.icon} {m.label}
            </SectionTitle>
            <div className="card overflow-hidden">
              {items.length > 0 && (
                <ul className="divide-y">
                  {items.map((e) => (
                    <li key={e.id}>
                      <button type="button" className={`${viewingMe ? "press" : ""} w-full flex items-center gap-3 px-4 min-h-[56px] text-start`} onClick={() => viewingMe && setEditing(e)} disabled={!viewingMe}>
                        <span className="text-[22px] leading-none w-7 text-center">{foodIcon(e.food_key)}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-medium truncate">{e.name}</span>
                          <span className="block text-[13px] text-muted truncate">
                            {Number(e.qty) !== 1 ? `×${Number(e.qty)} ` : ""}
                            {e.unit || ""}
                            {e.protein_g ? ` · ${fmt0(e.protein_g)} גר׳ חלבון` : ""}
                          </span>
                        </span>
                        <span className="num text-[15px] font-semibold">{fmt0(e.kcal)}</span>
                        {viewingMe && <Pencil size={14} className="text-muted" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {viewingMe && (
                <button type="button" className={`press w-full flex items-center gap-3 px-4 h-12 text-accent-text font-medium text-[15px] ${items.length ? "border-t" : ""}`} onClick={() => setAdding(m.value)}>
                  <Plus size={18} /> הוספה
                </button>
              )}
              {!viewingMe && items.length === 0 && <p className="px-4 py-3 text-[14px] text-muted">לא נרשם</p>}
            </div>
          </div>
        );
      })}

      {/* השבוע */}
      <SectionTitle right={weekAvg != null ? <span className="num text-[13px] text-muted">ממוצע {fmt0(weekAvg)} קק״ל</span> : null}>7 הימים האחרונים</SectionTitle>
      <div className="card p-4">
        {logged.length === 0 ? (
          <p className="text-[14px] text-muted text-center py-4">הגרף יתמלא ככל שתרשמו ארוחות</p>
        ) : (
          <div className="h-[140px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--chart-tick)", fontSize: 11 }} />
                <YAxis hide domain={[0, (max) => Math.max(max, target != null ? target * 1.12 : 0)]} />
                <Tooltip
                  cursor={{ fill: "var(--chart-grid)" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--line))", borderRadius: 14, fontFamily: "Rubik", direction: "rtl" }}
                  labelStyle={{ color: "hsl(var(--muted))" }}
                  formatter={(v) => [fmtKcal(v), "נאכלו"]}
                />
                {target != null && <ReferenceLine y={target} stroke="var(--chart-tick)" strokeDasharray="4 4" />}
                <Bar dataKey="kcal" radius={[8, 8, 8, 8]} isAnimationActive={false}>
                  {week.map((w) => (
                    <Cell key={w.day} fill={w.kcal === 0 ? "var(--chart-grid)" : target != null && w.kcal > target * 1.05 ? "hsl(var(--crit))" : "hsl(var(--accent))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {target != null && weekAvg != null && (
          <p className="text-[13px] text-muted mt-3 pt-3 border-t">
            {weekAvg <= target ? `השבוע בממוצע ${fmt0(target - weekAvg)} קק״ל מתחת ליעד. ממשיכים ככה 💪` : `השבוע בממוצע ${fmt0(weekAvg - target)} קק״ל מעל היעד. יום אחד לא קובע - הממוצע השבועי כן.`}
          </p>
        )}
      </div>

      {viewingMe && (
        <>
          <SectionTitle>תזכורות</SectionTitle>
          <div className="card overflow-hidden">
            <ReminderToggle prefKey="food" label="סיכום ערב ליומן האוכל" hint="כמה נשאר להיום, או תזכורת אם לא נרשם כלום" icon={<UtensilsCrossed size={19} />} />
          </div>
        </>
      )}

      <Sheet open={!!adding} onClose={() => setAdding(null)} title="מה אכלת?">
        {adding && <AddFood key={adding} meal={adding} recentRows={rows} onAdd={add} />}
      </Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="עריכה">
        {editing && (
          <EditFood
            key={editing.id}
            entry={editing}
            onSave={(patch) => save(editing.id, patch)}
            onDelete={async () => {
              await foods.remove(editing.id);
              setEditing(null);
            }}
          />
        )}
      </Sheet>
    </>
  );
}

// טבעת התקדמות (SVG, transform בלבד)
function Ring({ share, over, size, children }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--raised))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "hsl(var(--crit))" : "hsl(var(--accent))"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - share)}
          style={{ transition: "stroke-dashoffset 600ms var(--ease-out), stroke 300ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function EditFood({ entry, onSave, onDelete }) {
  const perUnit = Number(entry.kcal) / (Number(entry.qty) || 1);
  const protUnit = Number(entry.protein_g || 0) / (Number(entry.qty) || 1);
  const [qty, setQty] = useState(Number(entry.qty) || 1);
  const [meal, setMeal] = useState(entry.meal);
  const [kcal, setKcal] = useState(String(entry.kcal));
  const canScale = !!entry.food_key;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(canScale ? { meal, qty, kcal: Math.round(perUnit * qty), protein_g: protUnit ? Math.round(protUnit * qty * 10) / 10 : null } : { meal, kcal: Math.round(Number(kcal) || 0) });
      }}
    >
      <p className="text-[17px] font-semibold">
        {foodIcon(entry.food_key)} {entry.name}
      </p>
      <div>
        <span className="label">ארוחה</span>
        <Segmented value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m.value, label: m.icon }))} />
      </div>
      {canScale ? (
        <div>
          <span className="label">כמות ({entry.unit || "מנה"})</span>
          <div className="flex items-center gap-2" dir="ltr">
            {[0.5, 1, 1.5, 2, 3].map((n) => (
              <button key={n} type="button" onClick={() => setQty(n)} className={`press num h-10 flex-1 rounded-full text-[14px] font-medium ${qty === n ? "bg-fg text-bg" : "bg-raised"}`}>
                ×{n}
              </button>
            ))}
          </div>
          <p className="num text-[14px] text-muted mt-2 px-1">{fmt0(perUnit * qty)} קק״ל</p>
        </div>
      ) : (
        <Field label="קלוריות">
          <input className="field num" type="number" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} />
        </Field>
      )}
      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn btn-primary flex-1">
          שמירה
        </button>
        <DeleteButton onConfirm={onDelete} label="" />
      </div>
    </form>
  );
}
