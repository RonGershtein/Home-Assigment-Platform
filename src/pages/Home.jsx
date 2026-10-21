import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Page } from "../components/Shell";
import ThemeToggle from "../components/ThemeToggle";
import { SectionTitle } from "../components/ui";
import { useTable } from "../hooks/useTable";
import { LONG_TERM_KINDS } from "../lib/catalog";
import { compactMoney, daysUntil, greeting, money, monthKey, relDays } from "../lib/format";

export default function Home() {
  const shopping = useTable("shopping_items");
  const tasks = useTable("tasks");
  const vouchers = useTable("vouchers");
  const tx = useTable("transactions");
  const accounts = useTable("accounts");

  const toBuy = shopping.rows.filter((i) => !i.is_purchased);
  const open = tasks.rows.filter((t) => !t.is_done);
  const dueTasks = open
    .filter((t) => t.due_date && daysUntil(t.due_date) <= 7)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

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
  const out = monthTx.filter((t) => t.kind === "expense").reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const inc = monthTx.filter((t) => t.kind === "income").reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const liquid = accounts.rows.filter((a) => !a.archived && !LONG_TERM_KINDS.has(a.kind)).reduce((s, a) => s + (Number(a.balance) || 0), 0);

  const loading = shopping.loading || tasks.loading || tx.loading || accounts.loading;
  const date = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <Page title={greeting()} subtitle={date} action={<ThemeToggle />}>
      <div className="grid grid-cols-2 gap-2 stagger">
        <Tile loading={loading} to="/shopping" icon="🛒" label="לקנות" value={toBuy.length} hint={toBuy.slice(0, 3).map((i) => i.item_name).join(", ") || "הרשימה ריקה"} />
        <Tile loading={loading} to="/tasks" icon="✅" label="מטלות פתוחות" value={open.length} hint={open[0]?.title || "הכל סגור"} />
        <Tile loading={loading} to="/budget" icon="🧾" label="הוצאות החודש" value={compactMoney(out)} hint={inc ? `נשאר ${compactMoney(inc - out)}` : "אין עדיין הכנסות"} />
        <Tile loading={loading} to="/money" icon="🏦" label="כסף נזיל" value={compactMoney(liquid)} hint="עו״ש וחסכונות" />
      </div>

      {expiring.length > 0 && (
        <>
          <SectionTitle right={<Link to="/vouchers" state={BACK} className="text-[14px] text-accent-text font-medium">הכל</Link>}>🎟️ שוברים שפגים בקרוב</SectionTitle>
          <ul className="card divide-y overflow-hidden">
            {expiring.slice(0, 4).map((v) => (
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

      {dueTasks.length > 0 && (
        <>
          <SectionTitle right={<Link to="/tasks" state={BACK} className="text-[14px] text-accent-text font-medium">הכל</Link>}>📅 השבוע</SectionTitle>
          <ul className="card divide-y overflow-hidden">
            {dueTasks.slice(0, 4).map((t) => {
              const d = daysUntil(t.due_date);
              return (
                <li key={t.id}>
                  <Link to="/tasks" state={BACK} className="press flex items-center gap-3 px-4 min-h-[56px]">
                    <span className="flex-1 min-w-0 text-[15px] font-medium truncate">{t.title}</span>
                    <span className={`text-[13px] font-medium ${d < 0 ? "text-crit" : "text-warn"}`}>{relDays(d)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <SectionTitle>עוד בבית</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["/vouchers", "🎟️", "שוברים"],
          ["/gifts", "💌", "מתנות חתונה"],
          ["/recipes", "🍳", "מתכונים"],
        ].map(([to, icon, label]) => (
          <Link key={to} to={to} state={BACK} className="press card flex flex-col items-center gap-2 py-4 text-[14px] font-medium">
            <span className="text-2xl">{icon}</span>
            {label}
          </Link>
        ))}
      </div>
    </Page>
  );
}

const BACK = { back: "בית" };

function Tile({ to, icon, label, value, hint, loading }) {
  return (
    <Link to={to} state={BACK} className="press card p-4 flex flex-col min-h-[128px]">
      <div className="flex items-center justify-between">
        <span className="text-xl">{icon}</span>
        <ChevronLeft size={16} className="text-muted" />
      </div>
      {loading ? <div className="skeleton h-7 w-20 mt-auto mb-1 !rounded-lg" /> : <p className="num text-[26px] font-bold mt-auto leading-tight">{value}</p>}
      <p className="text-[13px] font-medium">{label}</p>
      <p className="text-[12px] text-muted truncate mt-0.5">{loading ? "\u00a0" : hint}</p>
    </Link>
  );
}
