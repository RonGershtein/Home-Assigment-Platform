import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChefHat, ChevronLeft, Gift, ListChecks, Scale, ShoppingCart, Ticket, X } from "lucide-react";
import { toast } from "sonner";
import WeightInput from "../components/WeightInput";
import { fmtKg } from "../lib/nutrition";
import { Page } from "../components/Shell";
import ThemeToggle from "../components/ThemeToggle";
import { CheckCircle, SectionTitle, useLeaving } from "../components/ui";
import { useTable } from "../hooks/useTable";
import { LONG_TERM_KINDS, shopCat } from "../lib/catalog";
import { matchGrocery } from "../lib/groceries";
import { compactMoney, daysUntil, greeting, money, monthKey, monthLabel, relDays, todayStr } from "../lib/format";

const BACK = { back: "בית" };
const sum = (rows) => rows.reduce((s, t) => s + (Number(t.amount) || 0), 0);

export default function Home({ user }) {
  const shopping = useTable("shopping_items");
  const tasks = useTable("tasks");
  const vouchers = useTable("vouchers");
  const tx = useTable("transactions");
  const accounts = useTable("accounts");
  const weights = useTable("weight_entries");
  const nutrition = useTable("nutrition_profiles");
  const me = user?.id ?? "demo";

  const [leavingIds, leave] = useLeaving();
  const toBuy = shopping.rows.filter((i) => !i.is_purchased);

  // מטלות: קודם עם תאריך (הקרוב ראשון), אחר כך החדשות
  const open = useMemo(
    () =>
      tasks.rows
        .filter((t) => !t.is_done)
        .sort((a, b) => {
          if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
          if (a.due_date) return -1;
          if (b.due_date) return 1;
          return (b.created_at || "").localeCompare(a.created_at || "");
        }),
    [tasks.rows]
  );

  const expiring = useMemo(
    () =>
      vouchers.rows
        .filter((v) => v.status !== "used" && v.expiry_date)
        .map((v) => ({ ...v, d: daysUntil(v.expiry_date) }))
        .filter((v) => v.d >= 0 && v.d <= 30)
        .sort((a, b) => a.d - b.d),
    [vouchers.rows]
  );

  const month = monthKey(new Date());
  const monthTx = tx.rows.filter((t) => t.date?.startsWith(month));
  const out = sum(monthTx.filter((t) => t.kind === "expense"));
  const inc = sum(monthTx.filter((t) => t.kind === "income"));
  const liquid = accounts.rows.filter((a) => !a.archived && !LONG_TERM_KINDS.has(a.kind)).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const spentShare = inc ? Math.min(1, out / inc) : out ? 1 : 0;

  const date = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <Page title={greeting()} subtitle={date} action={<ThemeToggle />}>
      <WeightPrompt me={me} weights={weights} profile={nutrition.rows.find((p) => p.user_id === me)} loading={weights.loading || nutrition.loading} />
      <Link to="/budget" state={BACK} className="press hero block p-5 rise">
        <div className="flex items-center justify-between text-[13px] text-muted">
          <span>{inc ? "נשאר החודש" : "הוצאות החודש"}</span>
          <span>{monthLabel(month)}</span>
        </div>
        {tx.loading ? (
          <div className="skeleton h-[52px] w-48 mt-2 !rounded-xl" />
        ) : (
          <p className={`num text-[52px] leading-[1.05] font-bold tracking-[-0.03em] mt-1 ${inc && inc - out < 0 ? "text-crit" : ""}`}>
            {money(Math.round(inc ? inc - out : out))}
          </p>
        )}
        <div className="h-2 rounded-full bg-raised mt-4 overflow-hidden" aria-hidden="true">
          <div className={`bar h-full rounded-full ${spentShare > 0.9 ? "bg-crit" : "bg-accent"}`} style={{ width: `${Math.max(2, spentShare * 100)}%` }} />
        </div>
        <div className="flex justify-between mt-3 text-[13px]">
          <span className="text-muted">
            הוצאו <span className="num text-fg font-medium">{money(Math.round(out))}</span>
            {inc > 0 && (
              <>
                {" "}
                מתוך <span className="num text-fg font-medium">{money(Math.round(inc))}</span>
              </>
            )}
          </span>
          <span className="text-muted">
            נזיל <span className="num text-fg font-medium">{accounts.loading ? "…" : compactMoney(liquid)}</span>
          </span>
        </div>
      </Link>

      <SectionTitle right={<SeeAll to="/shopping" label={toBuy.length ? `${toBuy.length} פריטים` : null} />}>לקנות</SectionTitle>
      <Link to="/shopping" className="press card block p-4">
        {shopping.loading ? (
          <div className="skeleton h-10 !rounded-xl" />
        ) : toBuy.length === 0 ? (
          <span className="flex items-center gap-3 text-muted text-[15px]">
            <ShoppingCart size={20} /> הרשימה ריקה. נגיעה להוספה
          </span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {toBuy.slice(0, 8).map((i) => (
              <span key={i.id} className="inline-flex items-center gap-1.5 h-9 ps-2 pe-3 rounded-full bg-raised text-[14px]">
                <span className="text-[17px] leading-none">{matchGrocery(i.item_name)?.icon ?? shopCat(i.category).icon}</span>
                {i.item_name}
              </span>
            ))}
            {toBuy.length > 8 && <span className="inline-flex items-center h-9 px-3 rounded-full text-[14px] text-muted num">+{toBuy.length - 8}</span>}
          </div>
        )}
      </Link>

      <SectionTitle right={<SeeAll to="/tasks" label={open.length ? `${open.length} פתוחות` : null} />}>מטלות</SectionTitle>
      {tasks.loading ? (
        <div className="skeleton h-14" />
      ) : open.length === 0 ? (
        <Link to="/tasks" className="press card flex items-center gap-3 p-4 text-muted text-[15px]">
          <ListChecks size={20} /> אין מטלות פתוחות
        </Link>
      ) : (
        <ul className="card divide-y overflow-hidden">
          {open.slice(0, 4).map((t) => {
            const d = daysUntil(t.due_date);
            return (
              <li key={t.id} className={`enter flex items-center gap-3 ps-4 pe-3 min-h-[56px] ${leavingIds.has(t.id) ? "leaving" : ""}`}>
                <CheckCircle
                  on={leavingIds.has(t.id)}
                  onClick={() => leave(t.id, () => tasks.update(t.id, { is_done: true, done_at: new Date().toISOString() }))} label={`סימון "${t.title}" כבוצעה`} />
                <Link to="/tasks" state={BACK} className="flex-1 min-w-0 py-3 text-[15px] font-medium truncate">
                  {t.title}
                </Link>
                {d != null && <span className={`text-[13px] font-medium shrink-0 ${d < 0 ? "text-crit" : d <= 3 ? "text-warn" : "text-muted"}`}>{relDays(d)}</span>}
              </li>
            );
          })}
        </ul>
      )}

      {expiring.length > 0 && (
        <>
          <SectionTitle right={<SeeAll to="/vouchers" />}>שוברים שפגים בקרוב</SectionTitle>
          <ul className="card divide-y overflow-hidden">
            {expiring.slice(0, 3).map((v) => (
              <li key={v.id}>
                <Link to="/vouchers" state={BACK} className="press flex items-center gap-3 px-4 min-h-[56px]">
                  <span className="flex-1 min-w-0 text-[15px] font-medium truncate">{v.title}</span>
                  {v.voucher_type === "cash" && v.amount != null && <span className="num text-[15px] text-muted">{money(v.amount)}</span>}
                  <span className={`text-[13px] font-medium ${v.d <= 7 ? "text-crit" : "text-warn"}`}>{relDays(v.d)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionTitle>עוד בבית</SectionTitle>
      <ul className="card divide-y overflow-hidden">
        {[
          ["/vouchers", Ticket, "שוברים", `${vouchers.rows.filter((v) => v.status !== "used" && (daysUntil(v.expiry_date) ?? 0) >= 0).length} בתוקף`],
          ["/gifts", Gift, "מתנות ואירועים", null],
          ["/recipes", ChefHat, "מתכונים", null],
          ["/nutrition", Scale, "תזונה ומשקל", null],
        ].map(([to, Icon, label, hint]) => (
          <li key={to}>
            <Link to={to} state={BACK} className="press flex items-center gap-3 px-4 min-h-[56px]">
              <Icon size={20} className="text-muted shrink-0" />
              <span className="flex-1 text-[15px] font-medium">{label}</span>
              {hint && !vouchers.loading && <span className="text-[13px] text-muted num">{hint}</span>}
              <ChevronLeft size={18} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}

function SeeAll({ to, label }) {
  return (
    <Link to={to} state={BACK} className="press flex items-center gap-0.5 text-[14px] text-accent-text font-medium h-8">
      {label || "הכל"}
      <ChevronLeft size={16} />
    </Link>
  );
}

// שאלת המשקל היומית: מופיעה עד שרושמים (או דוחים להיום). כבויה דרך "תזונה ← שאלת המשקל במסך הבית"
const DISMISS_KEY = "weight-prompt-dismissed";
function WeightPrompt({ me, weights, profile, loading }) {
  const today = todayStr();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === today;
    } catch {
      return false;
    }
  });
  const mine = useMemo(() => weights.rows.filter((e) => e.user_id === me).sort((a, b) => b.day.localeCompare(a.day)), [weights.rows, me]);
  const last = mine[0] ? Number(mine[0].weight_kg) : null;
  const [w, setW] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);

  if (loading || dismissed || profile?.daily_prompt === false) return null;
  const todayEntry = mine.find((e) => e.day === today);
  if (todayEntry && !saved) return null;

  const value = w === "" ? (last ?? 70).toFixed(1) : w;
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, today);
    } catch {}
    setDismissed(true);
  };
  const save = async () => {
    const n = Math.round(Number(value) * 10) / 10;
    if (!(n > 20 && n < 400)) return toast.error("משקל לא תקין");
    setSaving(true);
    try {
      await weights.create({ user_id: me, day: today, weight_kg: n, note: "" });
      setSaved({ n, delta: last != null ? n - last : null });
    } catch {
    } finally {
      setSaving(false);
    }
  };

  if (saved)
    return (
      <Link to="/nutrition" state={BACK} className="press card flex items-center gap-3 p-4 mb-4 rise">
        <span className="grid place-items-center w-10 h-10 rounded-full bg-accent text-accent-ink shrink-0">
          <Scale size={19} />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-medium">נרשם: {fmtKg(saved.n)}</span>
          <span className="block text-[13px] text-muted">{saved.delta == null ? "שקילה ראשונה. מכאן מתחיל הגרף" : Math.abs(saved.delta) < 0.05 ? "בדיוק כמו בפעם הקודמת" : `${saved.delta < 0 ? "▼" : "▲"} ${fmtKg(Math.abs(saved.delta))} מהשקילה הקודמת · לגרף`}</span>
        </span>
        <ChevronLeft size={18} className="text-muted" />
      </Link>
    );

  return (
    <div className="card p-4 mb-4 rise">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[16px] font-semibold">כמה את/ה שוקל/ת היום?</p>
          <p className="text-[13px] text-muted mt-0.5">{last != null ? `בפעם הקודמת: ${fmtKg(last)}` : "שקילה ראשונה - הכי טוב בבוקר"}</p>
        </div>
        <button type="button" className="icon-btn -me-2 -mt-1" onClick={dismiss} aria-label="לא היום">
          <X size={18} />
        </button>
      </div>
      <div className="mt-3">
        <WeightInput value={value} onChange={setW} size="sm" />
      </div>
      <button type="button" className="btn btn-primary w-full mt-4 h-11" disabled={saving} onClick={save}>
        שמירה
      </button>
    </div>
  );
}
