import { useEffect, useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Scale, Flame, Target, Users, Eye, HousePlus, Pencil, Flag, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import Sheet from "../../components/Sheet";
import WeightInput from "../../components/WeightInput";
import ReminderToggle from "../../components/ReminderToggle";
import { DeleteButton, Empty, Field, SectionTitle, Segmented, Skeletons, Switch } from "../../components/ui";
import { fmtDate, parseDay, toDayStr, todayStr } from "../../lib/format";
import { bmi, bmiBand, etaToGoal, fmt1, fmtKg, relDayLabel, shortDay, streak, weeklyTrend, withAverage, dayNum } from "../../lib/nutrition";
import { isDemoMode } from "../../lib/supabase";

const RANGES = [
  { value: 7, label: "שבוע" },
  { value: 30, label: "חודש" },
  { value: 90, label: "3 חודשים" },
  { value: 365, label: "שנה" },
  { value: 0, label: "הכל" },
];
const PARTNER_COLOR = "hsl(205 85% 62%)";

export default function WeightTab({ me, myName, nameOf, weights, myProfile, profiles, saveProfile }) {
  const [range, setRange] = useState(30);
  const [who, setWho] = useState("me");
  const [editing, setEditing] = useState(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const today = todayStr();

  const mine = useMemo(() => weights.rows.filter((e) => e.user_id === me).sort((a, b) => a.day.localeCompare(b.day)), [weights.rows, me]);
  const others = useMemo(() => weights.rows.filter((e) => e.user_id !== me), [weights.rows, me]);
  const partners = useMemo(() => [...new Set(others.map((e) => e.user_id))], [others]);
  const hasPartner = partners.length > 0;

  const latest = mine[mine.length - 1] ?? null;
  const prev = mine[mine.length - 2] ?? null;
  const todayEntry = mine.find((e) => e.day === today) ?? null;
  const current = latest ? Number(latest.weight_kg) : null;
  const trend = weeklyTrend(mine);
  const goal = myProfile?.goal_weight_kg != null ? Number(myProfile.goal_weight_kg) : null;
  const eta = etaToGoal(current, goal, trend);
  const goalDate = myProfile?.goal_date || null;
  const start = mine[0] ? Number(mine[0].weight_kg) : null;
  // התקדמות ליעד: מהשקילה הראשונה ועד היעד (0..1), null כשאין ממה לחשב
  const progress = goal != null && current != null && start != null && Math.abs(start - goal) >= 0.1 ? Math.min(1, Math.max(0, (start - current) / (start - goal))) : null;
  const b = bmi(current, Number(myProfile?.height_cm));
  const band = bmiBand(b);
  const days = streak(mine, today);
  // יעד של כל אחד (לתצוגת "שנינו")
  const goalOf = (u) => {
    const g = profiles?.rows?.find((p) => p.user_id === u)?.goal_weight_kg;
    return g != null ? Number(g) : null;
  };

  // אבני דרך: 25/50/75/100% מהדרך ליעד. חוגגים פעם אחת לכל אבן דרך (נזכר במכשיר)
  useEffect(() => {
    if (goal == null || progress == null) return;
    const key = `goal-milestone:${goal}`;
    const m = progress >= 1 ? 100 : progress >= 0.75 ? 75 : progress >= 0.5 ? 50 : progress >= 0.25 ? 25 : 0;
    let seen = null;
    try {
      seen = localStorage.getItem(key);
    } catch {}
    if (seen != null && m <= Number(seen)) return;
    try {
      localStorage.setItem(key, String(m));
    } catch {}
    if (seen == null && m < 100) return; // יעד חדש: רק זוכרים איפה התחלנו
    if (m === 100) toast.success("הגעת ליעד! 🎉", { duration: 5000 });
    else if (m > 0) toast.success(`עברת ${m}% מהדרך ליעד 💪`);
  }, [goal, progress]);

  // נתוני הגרף: שלי (עם ממוצע נע) או של כולם (שורה לכל אדם)
  const chart = useMemo(() => {
    const from = range ? dayNum(today) - range : -Infinity;
    if (who === "me") {
      return withAverage(mine)
        .filter((e) => dayNum(e.day) >= from)
        .map((e) => ({ day: e.day, label: shortDay(e.day), w: Number(e.weight_kg), avg: e.avg }));
    }
    const byDay = new Map();
    for (const e of weights.rows) {
      if (dayNum(e.day) < from) continue;
      const row = byDay.get(e.day) ?? { day: e.day, label: shortDay(e.day) };
      row[e.user_id] = Number(e.weight_kg);
      byDay.set(e.day, row);
    }
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [mine, weights.rows, range, who, today]);

  // תחזית: ממשיכים את קו הממוצע בקצב המגמה עד שפוגשים את היעד (או עד מחצית התקופה המוצגת)
  const projection = useMemo(() => {
    if (who !== "me" || goal == null || trend == null || chart.length < 2) return [];
    const last = chart[chart.length - 1];
    const from = last.avg ?? last.w;
    const perDay = trend / 7;
    const gap = goal - from;
    if (Math.abs(gap) < 0.1 || Math.sign(gap) !== Math.sign(perDay)) return [];
    const need = Math.ceil(gap / perDay);
    const cap = range ? Math.max(7, Math.ceil(range / 2)) : 90;
    const n = Math.min(need, cap);
    const pts = [{ ...last, proj: from }];
    for (let i = 1; i <= n; i++) {
      const d = parseDay(last.day);
      d.setDate(d.getDate() + i);
      const day = toDayStr(d);
      const v = i === need ? goal : from + perDay * i;
      pts.push({ day, label: shortDay(day), proj: Math.round(v * 100) / 100, future: true });
    }
    return pts;
  }, [chart, who, goal, trend, range]);
  const data = projection.length ? [...chart.slice(0, -1), ...projection] : chart;

  const inRange = chart.map((r) => (who === "me" ? r.w : Math.max(...[me, ...partners].map((u) => r[u] ?? -Infinity)))).filter((v) => isFinite(v));
  const allVals = data.flatMap((r) => (who === "me" ? [r.w, r.avg, r.proj] : [me, ...partners].map((u) => r[u]))).filter((v) => v != null && isFinite(v));
  const goalVals = who === "me" ? [goal] : [me, ...partners].map(goalOf);
  const yMin = allVals.length ? Math.floor(Math.min(...allVals, ...goalVals.filter((g) => g != null)) - 1) : 0;
  const yMax = allVals.length ? Math.ceil(Math.max(...allVals, ...goalVals.filter((g) => g != null)) + 1) : 100;
  const first = who === "me" && chart.length ? chart[0].w : null;
  const sinceStart = first != null && current != null ? current - first : null;

  const save = async ({ id, day, weight_kg, note }) => {
    const w = Math.round(Number(weight_kg) * 10) / 10;
    if (!(w > 20 && w < 400)) return toast.error("משקל לא תקין");
    const existing = mine.find((e) => e.day === day);
    try {
      if (id || existing) await weights.update(id || existing.id, { weight_kg: w, note: note ?? existing?.note ?? "" });
      else await weights.create({ user_id: me, day, weight_kg: w, note: note ?? "" });
      toast.success(id || existing ? "המשקל עודכן" : "נרשם ✓");
      setEditing(null);
    } catch {}
  };

  // יעד משקל: נשמר בפרופיל, וכיוון המטרה (לרדת/לעלות) נגזר מהמשקל הנוכחי
  // עמודת goal_date נוספה בשלב 4 (supabase/schema-4-goal-date.sql). אם עוד לא קיימת - שומרים בלעדיה
  const saveWithDate = async (patch) => {
    try {
      await saveProfile(patch);
    } catch (e) {
      if (!("goal_date" in patch) || !/goal_date/.test(e?.message || "")) throw e;
      const { goal_date, ...rest } = patch;
      await saveProfile(rest);
      if (goal_date) toast.error("תאריך היעד לא נשמר: צריך להריץ את supabase/schema-4-goal-date.sql", { duration: 6000 });
    }
  };
  const saveGoal = async (value, date) => {
    const w = Math.round(Number(value) * 10) / 10;
    if (!(w > 20 && w < 400)) return toast.error("משקל יעד לא תקין");
    const patch = { goal_weight_kg: w, goal_date: date || null };
    if (current != null && Math.abs(w - current) >= 0.5) patch.goal = w < current ? "lose" : "gain";
    try {
      await saveWithDate(patch);
      toast.success(goal == null ? "היעד נקבע 🎯" : "היעד עודכן");
      setGoalOpen(false);
    } catch (e) {
      toast.error(e.message || "לא נשמר");
    }
  };
  const removeGoal = async () => {
    try {
      await saveWithDate({ goal_weight_kg: null, goal_date: null });
      toast.success("היעד הוסר");
      setGoalOpen(false);
    } catch (e) {
      toast.error(e.message || "לא נשמר");
    }
  };

  const history = useMemo(
    () =>
      [...weights.rows]
        .filter((e) => who === "me" ? e.user_id === me : true)
        .sort((a, b) => b.day.localeCompare(a.day) || (b.created_at || "").localeCompare(a.created_at || ""))
        .map((e, i, arr) => {
          const p = arr.slice(i + 1).find((x) => x.user_id === e.user_id);
          return { ...e, delta: p ? Number(e.weight_kg) - Number(p.weight_kg) : null };
        }),
    [weights.rows, who, me]
  );

  if (weights.loading) return <Skeletons n={3} h={120} />;

  return (
    <>
      {hasPartner && (
        <Segmented
          value={who}
          onChange={setWho}
          className="mb-3"
          options={[
            { value: "me", label: myName },
            { value: "all", label: "שנינו" },
          ]}
        />
      )}

      {/* ההירו: המספר של היום, המגמה והגרף */}
      <div className="hero p-5 rise">
        <div className="flex items-center justify-between text-[13px] text-muted">
          <span className="flex items-center gap-1.5">
            <Scale size={14} /> {who === "me" ? "המשקל שלי" : "המשקל של שנינו"}
          </span>
          {latest && <span>{relDayLabel(latest.day, today)}</span>}
        </div>
        {current == null ? (
          <p className="text-[22px] font-semibold mt-2 leading-snug">עוד אין שקילות. רושמים את הראשונה למטה 👇</p>
        ) : (
          <>
            <p className="num text-[56px] leading-[1.05] font-bold tracking-[-0.03em] mt-1">
              {fmt1(current)} <span className="text-[20px] font-medium text-muted tracking-normal">ק״ג</span>
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[14px]">
              {prev && <Delta v={current - Number(prev.weight_kg)} label="מהשקילה הקודמת" goal={myProfile?.goal} />}
              {trend != null && <Delta v={trend} label="בשבוע" goal={myProfile?.goal} prefix="מגמה" />}
            </div>
          </>
        )}

        {chart.length >= 2 ? (
          <div className="h-[170px] -mx-2 mt-4" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--chart-tick)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={28} />
                <YAxis domain={[yMin, yMax]} width={34} tickLine={false} axisLine={false} tick={{ fill: "var(--chart-tick)", fontSize: 11 }} tickCount={4} />
                <Tooltip
                  cursor={{ stroke: "var(--chart-grid)" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--line))", borderRadius: 14, fontFamily: "Rubik", direction: "rtl", color: "hsl(var(--fg))" }}
                  labelStyle={{ color: "hsl(var(--muted))" }}
                  itemStyle={{ color: "hsl(var(--fg))" }}
                  labelFormatter={(_, p) => (p?.[0]?.payload?.day ? fmtDate(p[0].payload.day) : "")}
                  formatter={(v, name) => [fmtKg(v), name === "w" ? "משקל" : name === "avg" ? "ממוצע 7 ימים" : name === "proj" ? "תחזית" : nameOf(name)]}
                />
                {who === "me"
                  ? goal != null && (
                      <ReferenceLine y={goal} stroke="hsl(var(--good))" strokeWidth={1.5} strokeDasharray="5 4" ifOverflow="extendDomain" label={{ value: `יעד ${fmt1(goal)}`, position: "insideTopRight", fill: "hsl(var(--good))", fontSize: 11, fontWeight: 600 }} />
                    )
                  : [me, ...partners].map((u, i) => {
                      const g = goalOf(u);
                      const color = i === 0 ? "hsl(var(--accent))" : PARTNER_COLOR;
                      return g != null && <ReferenceLine key={`goal-${u}`} y={g} stroke={color} strokeOpacity={0.8} strokeDasharray="5 4" ifOverflow="extendDomain" label={{ value: `יעד ${nameOf(u)} ${fmt1(g)}`, position: i === 0 ? "insideTopRight" : "insideTopLeft", fill: color, fontSize: 11, fontWeight: 600 }} />;
                    })}
                {who === "me" ? (
                  <>
                    <Area type="monotone" dataKey="w" stroke="hsl(var(--accent))" strokeWidth={1.5} strokeOpacity={0.55} fill="url(#wfill)" dot={{ r: 2.5, fill: "hsl(var(--accent))", strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="avg" stroke="hsl(var(--fg))" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    {projection.length > 0 && <Line type="monotone" dataKey="proj" stroke="hsl(var(--fg))" strokeOpacity={0.45} strokeWidth={2} strokeDasharray="3 5" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />}
                  </>
                ) : (
                  [me, ...partners].map((u, i) => (
                    <Line key={u} type="monotone" dataKey={u} name={u} connectNulls stroke={i === 0 ? "hsl(var(--accent))" : PARTNER_COLOR} strokeWidth={2.5} dot={{ r: 2.5, strokeWidth: 0, fill: i === 0 ? "hsl(var(--accent))" : PARTNER_COLOR }} isAnimationActive={false} />
                  ))
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          current != null && <p className="text-[13px] text-muted mt-4">הגרף יופיע אחרי שתי שקילות בתקופה הזו</p>
        )}

        <div className="flex gap-1.5 mt-3 flex-wrap">
          {RANGES.map((r) => (
            <button key={r.value} type="button" onClick={() => setRange(r.value)} className={`press h-8 px-3 rounded-full text-[13px] font-medium transition-colors ${range === r.value ? "bg-accent text-accent-ink" : "bg-raised text-muted"}`}>
              {r.label}
            </button>
          ))}
        </div>

        {who === "all" && (
          <div className="flex gap-4 mt-3 text-[13px]">
            {[me, ...partners].map((u, i) => (
              <span key={u} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: i === 0 ? "hsl(var(--accent))" : PARTNER_COLOR }} /> {nameOf(u)}
              </span>
            ))}
          </div>
        )}

        {who === "me" && current != null && (
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t">
            <Stat label="ממוצע 7 ימים" value={fmt1(withAverage(mine).at(-1)?.avg)} unit="ק״ג" />
            <Stat label="מאז ההתחלה" value={fmtKg(sinceStart, true)} sub={projection.length ? "הקו המקווקו: תחזית" : null} />
            {b != null ? <Stat label="BMI" value={fmt1(b)} sub={band?.label} tone={band?.tone} /> : <Stat label="רצף" value={days} unit={days === 1 ? "יום" : "ימים"} />}
          </div>
        )}
      </div>

      {/* יעד אישי: קביעה, עריכה והסרה */}
      {who === "me" && (
        <GoalCard goal={goal} goalDate={goalDate} current={current} progress={progress} eta={eta} trend={trend} today={today} onOpen={() => setGoalOpen(true)} />
      )}

      {/* רישום מהיר של היום */}
      {who === "me" && (
        <QuickWeigh key={todayEntry?.id ?? "new"} todayEntry={todayEntry} last={current} onSave={(w) => save({ day: today, weight_kg: w })} onEdit={() => setEditing(todayEntry)} />
      )}

      {who === "me" && (
        <>
          <SectionTitle>תזכורות ושיתוף</SectionTitle>
          <div className="card divide-y overflow-hidden">
            <ReminderToggle prefKey="weight" label="תזכורת שקילה כל בוקר" hint="התראה אם עוד לא נרשם משקל להיום" />
            <ToggleRow icon={<HousePlus size={19} />} label="שאלת המשקל במסך הבית" hint="כל יום, עד שרושמים" on={myProfile?.daily_prompt !== false} onChange={(v) => saveProfile({ daily_prompt: v })} />
            <ToggleRow
              icon={myProfile?.share === false ? <Eye size={19} /> : <Users size={19} />}
              label="לשתף עם הבית"
              hint={myProfile?.share === false ? "רק את/ה רואה את המשקל והאוכל שלך" : "בן/בת הזוג רואים את המשקל והאוכל שלך"}
              on={myProfile?.share !== false}
              onChange={(v) => saveProfile({ share: v })}
            />
          </div>
        </>
      )}

      <SectionTitle right={history.length ? <span className="text-[13px] text-muted num">{history.length} שקילות</span> : null}>היסטוריה</SectionTitle>
      {history.length === 0 ? (
        <Empty icon={<Scale size={26} />} title="עוד אין שקילות" text="הכי טוב לשקול כל בוקר, אחרי השירותים ולפני האוכל - ככה הגרף הכי אמין" />
      ) : (
        <ul className="card divide-y overflow-hidden stagger">
          {history.slice(0, 60).map((e) => {
            const own = e.user_id === me;
            return (
              <li key={e.id}>
                <button type="button" className={`${own ? "press" : ""} w-full flex items-center gap-3 px-4 min-h-[60px] text-start`} onClick={() => own && setEditing(e)} disabled={!own}>
                  <span className={`grid place-items-center w-9 h-9 rounded-full text-[12px] font-bold shrink-0 ${own ? "bg-accent text-accent-ink" : "text-white"}`} style={own ? undefined : { background: PARTNER_COLOR }}>
                    {nameOf(e.user_id).slice(0, 1)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-medium">{relDayLabel(e.day, today)}</span>
                    <span className="block text-[13px] text-muted truncate">
                      {nameOf(e.user_id)}
                      {e.note ? ` · ${e.note}` : ""}
                    </span>
                  </span>
                  {e.delta != null && Math.abs(e.delta) >= 0.05 && <Delta v={e.delta} goal={own ? myProfile?.goal : undefined} compact />}
                  <span className="num text-[17px] font-semibold">{fmt1(Number(e.weight_kg))}</span>
                  {own && <Pencil size={14} className="text-muted" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={goalOpen} onClose={() => setGoalOpen(false)} title={goal == null ? "יעד משקל" : "עריכת היעד"}>
        {goalOpen && <GoalForm key={goal ?? "new"} goal={goal} goalDate={goalDate} current={current} today={today} onSave={saveGoal} onRemove={removeGoal} />}
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "עריכת שקילה" : "שקילה"}>
        {editing && (
          <EditForm
            key={editing.id || "new"}
            entry={editing}
            onSave={save}
            onDelete={async () => {
              await weights.remove(editing.id);
              setEditing(null);
            }}
          />
        )}
      </Sheet>
    </>
  );
}

// כרטיס היעד: בלי יעד - כפתור להגדרה; עם יעד - כמה נשאר, התקדמות ותחזית. נגיעה פותחת עריכה
function GoalCard({ goal, goalDate, current, progress, eta, trend, today, onOpen }) {
  if (goal == null)
    return (
      <button type="button" onClick={onOpen} className="press card mt-3 w-full flex items-center gap-3 p-4 text-start border-2 border-dashed border-line bg-transparent">
        <span className="grid place-items-center w-10 h-10 rounded-full bg-accent/15 text-accent-text shrink-0">
          <Flag size={19} />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-medium">הגדרת יעד משקל</span>
          <span className="block text-[13px] text-muted">היעד יופיע כקו על הגרף, ותראו כמה נשאר</span>
        </span>
        <ChevronLeft size={18} className="text-muted" />
      </button>
    );
  const left = current != null ? goal - current : null;
  const reached = left != null && Math.abs(left) < 0.1;
  // תאריך יעד: הקצב הנדרש מול הקצב בפועל
  const pace = (() => {
    if (!goalDate || reached || left == null) return null;
    const daysLeft = dayNum(goalDate) - dayNum(today);
    if (daysLeft <= 0) return { text: `התאריך (${fmtDate(goalDate)}) עבר. אפשר לבחור חדש`, tone: "text-warn" };
    const need = Math.abs(left) / (daysLeft / 7);
    const actual = trend != null && Math.sign(trend) === Math.sign(left) ? Math.abs(trend) : 0;
    const behind = trend != null && actual < need * 0.85;
    return {
      text: `עד ${fmtDate(goalDate)}: צריך ${fmt1(need)} ק״ג בשבוע${trend != null ? ` · עכשיו ${fmt1(actual)}` : ""}`,
      tone: behind ? "text-warn" : trend != null ? "text-good" : "text-muted",
    };
  })();
  return (
    <button type="button" onClick={onOpen} className="press card mt-3 w-full p-4 text-start rise">
      <span className="flex items-center gap-3">
        <span className={`grid place-items-center w-10 h-10 rounded-full shrink-0 ${reached ? "bg-good/15 text-good" : "bg-accent/15 text-accent-text"}`}>
          <Flag size={19} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-medium">
            יעד: <span className="num">{fmtKg(goal)}</span>
          </span>
          <span className="block text-[13px] text-muted truncate">
            {left == null ? "רושמים שקילה כדי לראות כמה נשאר" : reached ? "הגעת ליעד! 🎉" : `עוד ${fmtKg(Math.abs(left))} ${left < 0 ? "לרדת" : "לעלות"}${eta ? ` · בקצב הזה: ${etaLabel(eta)}` : ""}`}
          </span>
        </span>
        <Pencil size={16} className="text-muted shrink-0" />
      </span>
      {pace && <span className={`block text-[12px] mt-1.5 ps-[52px] ${pace.tone}`}>{pace.text}</span>}
      {progress != null && (
        <span className="relative block mt-3 h-2 rounded-full bg-raised overflow-hidden" dir="ltr" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span className={`block h-full rounded-full ${reached ? "bg-good" : "bg-accent"}`} style={{ width: `${Math.max(4, progress * 100)}%`, transition: "width 500ms var(--ease-out)" }} />
          {[25, 50, 75].map((m) => (
            <span key={m} className="absolute top-0 bottom-0 w-px bg-card/80" style={{ left: `${m}%` }} aria-hidden="true" />
          ))}
        </span>
      )}
    </button>
  );
}

function GoalForm({ goal, goalDate, current, today, onSave, onRemove }) {
  const [w, setW] = useState(() => (goal ?? (current != null ? Math.round(current - 5) : 70)).toFixed(1));
  const [date, setDate] = useState(goalDate || "");
  const [saving, setSaving] = useState(false);
  const diff = current != null && Number(w) > 20 ? Number(w) - current : null;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await onSave(w, date);
        } finally {
          setSaving(false);
        }
      }}
    >
      <p className="text-[13px] text-muted text-center">
        {current != null ? `המשקל הנוכחי: ${fmtKg(current)}` : "המשקל שרוצים להגיע אליו"}
        {diff != null && Math.abs(diff) >= 0.1 && (
          <>
            {" · "}
            <span className="num text-fg font-medium">{fmtKg(Math.abs(diff))}</span> {diff < 0 ? "לרדת" : "לעלות"}
          </>
        )}
      </p>
      <WeightInput value={w} onChange={setW} autoFocus={goal == null} />
      <Field label="עד מתי? (לא חובה)">
        <input type="date" className="field" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <p className="text-[12px] text-muted text-center">אפשר לשנות או להסיר את היעד בכל שלב</p>
      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn btn-primary flex-1" disabled={saving || !(Number(w) > 20)}>
          <Target size={18} /> {goal == null ? "קביעת יעד" : "שמירה"}
        </button>
        {goal != null && <DeleteButton onConfirm={onRemove} label="הסרה" />}
      </div>
    </form>
  );
}

function etaLabel(days) {
  if (days < 14) return `${days} ימים`;
  if (days < 60) return `${Math.round(days / 7)} שבועות`;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: days > 300 ? "numeric" : undefined }).format(d);
}

// שינוי במשקל, צבוע לפי היעד: ירידה טובה כשרוצים לרדת, רעה כשרוצים לעלות
function Delta({ v, label, prefix, goal, compact }) {
  if (v == null || isNaN(v)) return null;
  const good = goal === "gain" ? v > 0 : goal === "lose" ? v < 0 : Math.abs(v) < 0.3;
  const tone = Math.abs(v) < 0.05 ? "text-muted" : good ? "text-good" : goal ? "text-warn" : "text-muted";
  return (
    <span className={`num font-medium ${compact ? "text-[13px]" : ""} ${tone}`}>
      {prefix && <span className="text-muted font-normal">{prefix} </span>}
      {v > 0 ? "▲" : v < 0 ? "▼" : "•"} {fmt1(Math.abs(v))}
      {label && <span className="text-muted font-normal"> {label}</span>}
    </span>
  );
}

function Stat({ label, value, unit, sub, tone }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-muted truncate">{label}</p>
      <p className="num text-[18px] font-semibold truncate">
        {value} {unit && <span className="text-[12px] font-normal text-muted">{unit}</span>}
      </p>
      {sub && <p className={`text-[11px] truncate ${tone ? `text-${tone}` : "text-muted"}`}>{sub}</p>}
    </div>
  );
}

function ToggleRow({ icon, label, hint, on, onChange }) {
  return (
    <div className="flex items-center gap-3 px-4 min-h-[64px]">
      <span className="grid place-items-center w-10 h-10 rounded-full bg-raised shrink-0">{icon}</span>
      <p className="flex-1 text-[15px]">
        <span className="block font-medium">{label}</span>
        <span className="block text-[13px] text-muted">{hint}</span>
      </p>
      <Switch on={on} onChange={onChange} label={label} />
    </div>
  );
}

export function QuickWeigh({ todayEntry, last, onSave, onEdit, title = "כמה את/ה שוקל/ת היום?" }) {
  const [w, setW] = useState(() => (todayEntry ? Number(todayEntry.weight_kg) : last ?? 70).toFixed(1));
  const [saving, setSaving] = useState(false);
  if (todayEntry)
    return (
      <button type="button" onClick={onEdit} className="press card mt-3 w-full flex items-center gap-3 p-4 text-start">
        <span className="grid place-items-center w-10 h-10 rounded-full bg-good/15 text-good shrink-0">
          <Flame size={19} />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-medium">נרשם להיום: {fmtKg(Number(todayEntry.weight_kg))}</span>
          <span className="block text-[13px] text-muted">כל הכבוד על העקביות. נגיעה לעריכה</span>
        </span>
        <Pencil size={16} className="text-muted" />
      </button>
    );
  return (
    <div className="card mt-3 p-5 rise">
      <p className="text-[17px] font-semibold text-center">{title}</p>
      <p className="text-[13px] text-muted text-center mt-0.5">{last ? `בשקילה הקודמת: ${fmtKg(last)}` : "הכי מדויק בבוקר, לפני האוכל"}</p>
      <div className="mt-4">
        <WeightInput value={w} onChange={setW} />
      </div>
      <button
        type="button"
        className="btn btn-primary w-full mt-5"
        disabled={saving || !(Number(w) > 20)}
        onClick={async () => {
          setSaving(true);
          try {
            await onSave(w);
          } finally {
            setSaving(false);
          }
        }}
      >
        <Target size={18} /> שמירה
      </button>
    </div>
  );
}

function EditForm({ entry, onSave, onDelete }) {
  const [w, setW] = useState(Number(entry.weight_kg ?? 70).toFixed(1));
  const [day, setDay] = useState(entry.day || todayStr());
  const [note, setNote] = useState(entry.note || "");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ id: entry.id, day, weight_kg: w, note: note.trim() });
      }}
    >
      <WeightInput value={w} onChange={setW} />
      <Field label="תאריך">
        <input type="date" className="field" value={day} max={todayStr()} onChange={(e) => setDay(e.target.value)} disabled={!!entry.id} />
      </Field>
      <Field label="הערה (לא חובה)">
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="אחרי חופשה, לפני ארוחת ערב…" enterKeyHint="done" />
      </Field>
      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn btn-primary flex-1">
          שמירה
        </button>
        {entry.id && <DeleteButton onConfirm={onDelete} label="" />}
      </div>
    </form>
  );
}
