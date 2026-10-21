import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Repeat, Settings2 } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { toast } from "sonner";
import { Page } from "../components/Shell";
import Sheet from "../components/Sheet";
import { DeleteButton, Empty, Fab, Field, SectionTitle, Segmented, Skeletons } from "../components/ui";
import { useTable } from "../hooks/useTable";
import { PAY_METHODS } from "../lib/catalog";
import { fmtDate, MONTHS, money, monthKey, monthLabel, shiftMonth, todayStr, toNumber } from "../lib/format";
import { MoneySwitch } from "./Money";

const sum = (arr) => arr.reduce((s, t) => s + (Number(t.amount) || 0), 0);

export default function Budget() {
  const tx = useTable("transactions");
  const cats = useTable("tx_categories");
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(null);
  const [managing, setManaging] = useState(false);

  const catById = useMemo(() => new Map(cats.rows.map((c) => [c.id, c])), [cats.rows]);
  const inMonth = useMemo(() => tx.rows.filter((t) => t.date?.startsWith(month)), [tx.rows, month]);
  const income = inMonth.filter((t) => t.kind === "income");
  const expense = inMonth.filter((t) => t.kind === "expense");
  const totalIn = sum(income);
  const totalOut = sum(expense);
  const net = totalIn - totalOut;

  // 6 חודשים אחרונים עד החודש הנבחר
  const trend = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const m = shiftMonth(month, i - 5);
        const rows = tx.rows.filter((t) => t.date?.startsWith(m));
        return {
          m,
          label: MONTHS[Number(m.slice(5)) - 1].slice(0, 3),
          in: sum(rows.filter((t) => t.kind === "income")),
          out: sum(rows.filter((t) => t.kind === "expense")),
        };
      }),
    [tx.rows, month]
  );

  const byCategory = useMemo(() => {
    const m = new Map();
    for (const t of expense) m.set(t.category_id, (m.get(t.category_id) || 0) + (Number(t.amount) || 0));
    const rows = cats.rows
      .filter((c) => c.kind === "expense" && (m.has(c.id) || c.monthly_budget))
      .map((c) => ({ ...c, spent: m.get(c.id) || 0 }));
    if (m.has(null) || m.has(undefined)) rows.push({ id: "none", name: "ללא קטגוריה", icon: "❔", spent: (m.get(null) || 0) + (m.get(undefined) || 0) });
    return rows.sort((a, b) => b.spent - a.spent);
  }, [expense, cats.rows]);

  const prevRecurring = useMemo(() => {
    const prev = shiftMonth(month, -1);
    const have = new Set(inMonth.filter((t) => t.recurring).map((t) => `${t.kind}|${t.description}|${t.category_id}`));
    return tx.rows.filter((t) => t.recurring && t.date?.startsWith(prev) && !have.has(`${t.kind}|${t.description}|${t.category_id}`));
  }, [tx.rows, inMonth, month]);

  async function copyRecurring() {
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const rows = prevRecurring.map(({ kind, amount, category_id, description, method, date }) => ({
      kind,
      amount,
      category_id,
      description,
      method,
      recurring: true,
      date: `${month}-${String(Math.min(Number(date.slice(8, 10)), lastDay)).padStart(2, "0")}`,
    }));
    await tx.api.create(rows);
    tx.refresh();
    toast.success(`נוספו ${rows.length} תנועות קבועות`);
  }

  const list = (tab === "income" ? income : expense).sort((a, b) => b.date.localeCompare(a.date) || (b.created_at || "").localeCompare(a.created_at || ""));
  const isCurrent = month === monthKey(new Date());

  return (
    <Page
      title="כסף"
      action={
        <button type="button" className="icon-btn" onClick={() => setManaging(true)} aria-label="קטגוריות ותקציב">
          <Settings2 size={20} />
        </button>
      }
    >
      <MoneySwitch value="budget" />

      <div className="flex items-center justify-between mb-3">
        <button type="button" className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="חודש קודם">
          <ChevronRight size={22} />
        </button>
        <button type="button" className="press text-[17px] font-semibold h-10 px-3 rounded-full" onClick={() => setMonth(monthKey(new Date()))}>
          {monthLabel(month)}
          {!isCurrent && <span className="text-[12px] text-accent-text font-medium ms-2">חזרה להיום</span>}
        </button>
        <button type="button" className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="חודש הבא">
          <ChevronLeft size={22} />
        </button>
      </div>

      <div className="hero p-5">
        <p className="text-[13px] text-muted">{net >= 0 ? "נשאר החודש" : "חריגה החודש"}</p>
        <p className={`num text-[40px] leading-tight font-bold tracking-tight ${net < 0 ? "text-crit" : ""}`}>{money(Math.round(net))}</p>
        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t">
          <button type="button" className="press text-start" onClick={() => setTab("income")}>
            <p className="text-[12px] text-muted">הכנסות</p>
            <p className="num text-[18px] font-semibold text-good">{money(Math.round(totalIn))}</p>
          </button>
          <button type="button" className="press text-start" onClick={() => setTab("expense")}>
            <p className="text-[12px] text-muted">הוצאות</p>
            <p className="num text-[18px] font-semibold">{money(Math.round(totalOut))}</p>
          </button>
        </div>
      </div>

      {prevRecurring.length > 0 && (
        <button type="button" className="press card w-full mt-2 p-4 flex items-center gap-3 text-start" onClick={copyRecurring}>
          <span className="grid place-items-center w-10 h-10 rounded-full bg-accent/15 text-accent-text shrink-0">
            <Repeat size={18} />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-medium">להוסיף {prevRecurring.length} תנועות קבועות?</span>
            <span className="block text-[13px] text-muted">משכורות, שכירות ומנויים מהחודש הקודם</span>
          </span>
        </button>
      )}

      <Segmented
        className="mt-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "סקירה" },
          { value: "expense", label: "הוצאות", count: expense.length },
          { value: "income", label: "הכנסות", count: income.length },
        ]}
      />

      {tx.loading || cats.loading ? (
        <div className="mt-4">
          <Skeletons n={4} />
        </div>
      ) : tab === "overview" ? (
        <>
          <SectionTitle>חצי שנה אחרונה</SectionTitle>
          <div className="card p-3 h-[170px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} barGap={3} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} onClick={(e) => e?.activePayload && setMonth(e.activePayload[0].payload.m)}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--chart-tick)", fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: "var(--chart-grid)", radius: 8 }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--line))", borderRadius: 14, fontFamily: "Rubik", direction: "rtl" }}
                  labelStyle={{ color: "hsl(var(--muted))" }}
                  formatter={(v, k) => [money(v), k === "in" ? "הכנסות" : "הוצאות"]}
                />
                <Bar dataKey="in" fill="hsl(var(--good))" radius={[6, 6, 2, 2]} maxBarSize={14} isAnimationActive={false} />
                <Bar dataKey="out" fill="hsl(var(--fg) / 0.75)" radius={[6, 6, 2, 2]} maxBarSize={14} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <SectionTitle>לאן הלך הכסף</SectionTitle>
          {byCategory.length === 0 ? (
            <Empty icon="🧾" title="אין הוצאות בחודש הזה" text="מוסיפים הוצאה בכפתור למטה." />
          ) : (
            <ul className="card divide-y overflow-hidden">
              {byCategory.map((c) => {
                const pct = c.monthly_budget ? c.spent / c.monthly_budget : null;
                const tone = pct == null ? "bg-fg/60" : pct > 1 ? "bg-crit" : pct > 0.85 ? "bg-warn" : "bg-good";
                const share = totalOut ? c.spent / totalOut : 0;
                return (
                  <li key={c.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl w-7 text-center">{c.icon}</span>
                      <span className="flex-1 text-[15px] font-medium truncate">{c.name}</span>
                      <span className="text-end">
                        <span className="num block text-[15px] font-semibold">{money(c.spent)}</span>
                        <span className="num block text-[12px] text-muted">{c.monthly_budget ? `מתוך ${money(c.monthly_budget)}` : `${Math.round(share * 100)}%`}</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-raised mt-2 ms-10 overflow-hidden">
                      <div className={`bar h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, (pct ?? share) * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : list.length === 0 ? (
        <Empty icon={tab === "income" ? "💰" : "🧾"} title={tab === "income" ? "אין הכנסות בחודש הזה" : "אין הוצאות בחודש הזה"} />
      ) : (
        <ul className="card divide-y overflow-hidden mt-4">
          {list.map((t) => {
            const c = catById.get(t.category_id);
            return (
              <li key={t.id}>
                <button type="button" className="press w-full text-start flex items-center gap-3 px-4 py-3 min-h-[60px]" onClick={() => setEditing(t)}>
                  <span className="grid place-items-center w-10 h-10 rounded-full bg-raised text-lg shrink-0">{c?.icon || "❔"}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-medium truncate">
                      {t.description || c?.name || "ללא תיאור"}
                      {t.recurring && <Repeat size={12} className="inline ms-1.5 text-muted" />}
                    </span>
                    <span className="block text-[12px] text-muted truncate">
                      {fmtDate(t.date)} · {c?.name || "ללא קטגוריה"}
                      {t.method ? ` · ${PAY_METHODS.find((m) => m.key === t.method)?.label ?? ""}` : ""}
                    </span>
                  </span>
                  <span className={`num text-[16px] font-semibold shrink-0 ${t.kind === "income" ? "text-good" : ""}`}>
                    {t.kind === "income" ? "+" : "−"}
                    {money(Number(t.amount) || 0)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Fab onClick={() => setEditing({ kind: tab === "income" ? "income" : "expense" })} label={tab === "income" ? "הכנסה" : "הוצאה"} icon={<Plus size={20} strokeWidth={2.6} />} />

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "עריכת תנועה" : "תנועה חדשה"}>
        {editing && (
          <TxForm
            key={editing.id || "new"}
            t={editing}
            month={month}
            cats={cats.rows}
            onSave={async (values) => {
              setEditing(null);
              if (editing.id) await tx.update(editing.id, values);
              else await tx.create(values);
            }}
            onDelete={
              editing.id &&
              (async () => {
                setEditing(null);
                await tx.remove(editing.id);
              })
            }
          />
        )}
      </Sheet>

      <Sheet open={managing} onClose={() => setManaging(false)} title="קטגוריות ותקציב">
        <CategoryManager cats={cats} />
      </Sheet>
    </Page>
  );
}

function TxForm({ t, month, cats, onSave, onDelete }) {
  // תנועה חדשה בחודש שמוצג: היום אם זה החודש הנוכחי, אחרת ה-1 בחודש
  const defaultDate = todayStr().startsWith(month) ? todayStr() : `${month}-01`;
  const [kind, setKind] = useState(t.kind || "expense");
  const [amount, setAmount] = useState(t.amount ?? "");
  const [categoryId, setCategoryId] = useState(t.category_id || null);
  const [description, setDescription] = useState(t.description || "");
  const [date, setDate] = useState(t.date || defaultDate);
  const [method, setMethod] = useState(t.method || "credit");
  const [recurring, setRecurring] = useState(!!t.recurring);
  const options = cats.filter((c) => c.kind === kind).sort((a, b) => (a.sort ?? 50) - (b.sort ?? 50));
  const n = toNumber(amount);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (n) onSave({ kind, amount: Math.abs(n), category_id: categoryId, description: description.trim(), date, method, recurring });
      }}
    >
      <Segmented
        value={kind}
        onChange={(k) => {
          setKind(k);
          setCategoryId(null);
        }}
        options={[
          { value: "expense", label: "הוצאה" },
          { value: "income", label: "הכנסה" },
        ]}
      />
      <input
        className={`field num text-center text-[30px] h-16 font-semibold ${kind === "income" ? "text-good" : ""}`}
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="₪0"
        autoFocus={!t.id}
        aria-label="סכום"
      />
      <div>
        <span className="label">קטגוריה</span>
        <div className="grid grid-cols-4 gap-2">
          {options.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`press rounded-2xl py-2.5 px-1 flex flex-col items-center gap-1 text-[12px] leading-tight text-center ${categoryId === c.id ? "bg-accent text-accent-ink font-semibold" : "bg-raised"}`}
            >
              <span className="text-lg">{c.icon}</span>
              <span className="line-clamp-2">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
      <Field label="תיאור">
        <input className="field" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind === "income" ? "משכורת" : "שופרסל"} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="תאריך">
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="אמצעי">
          <select className="field" value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAY_METHODS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="press flex items-center justify-between bg-raised rounded-2xl px-4 h-12">
        <span className="flex items-center gap-2 text-[15px]">
          <Repeat size={16} className="text-muted" /> חוזרת כל חודש
        </span>
        <input type="checkbox" className="w-5 h-5 accent-[hsl(var(--accent))]" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
      </label>
      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn btn-primary flex-1" disabled={!n}>
          שמירה
        </button>
        {onDelete && <DeleteButton onConfirm={onDelete} label="" />}
      </div>
    </form>
  );
}

function CategoryManager({ cats }) {
  const [kind, setKind] = useState("expense");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const rows = cats.rows.filter((c) => c.kind === kind).sort((a, b) => (a.sort ?? 50) - (b.sort ?? 50));

  return (
    <div className="space-y-4 pb-2">
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: "expense", label: "הוצאות" },
          { value: "income", label: "הכנסות" },
        ]}
      />
      {kind === "expense" && <p className="text-[13px] text-muted px-1">תקציב חודשי לקטגוריה - משאירים ריק אם לא רוצים מעקב.</p>}
      <ul className="bg-raised rounded-2xl divide-y divide-line/60">
        {rows.map((c) => (
          <li key={c.id} className="flex items-center gap-2 ps-4 pe-2 h-14">
            <span className="text-lg w-6 text-center">{c.icon}</span>
            <span className="flex-1 text-[15px] truncate">{c.name}</span>
            {kind === "expense" && (
              <input
                className="w-24 h-10 rounded-xl bg-card px-3 num text-center outline-none focus:ring-2 ring-accent"
                inputMode="decimal"
                defaultValue={c.monthly_budget ?? ""}
                placeholder="תקציב"
                aria-label={`תקציב ל${c.name}`}
                onBlur={(e) => {
                  const v = toNumber(e.target.value);
                  if (v !== (c.monthly_budget ?? null)) cats.update(c.id, { monthly_budget: v });
                }}
              />
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          cats.create({ kind, name: name.trim(), icon: icon.trim() || "🏷️", monthly_budget: null, sort: 50 });
          setName("");
          setIcon("");
        }}
      >
        <input className="field w-16 text-center px-2" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🏷️" aria-label="אייקון" />
        <input className="field flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="קטגוריה חדשה" />
        <button type="submit" className="btn btn-primary px-4" disabled={!name.trim()} aria-label="הוספה">
          <Plus size={18} />
        </button>
      </form>
    </div>
  );
}
