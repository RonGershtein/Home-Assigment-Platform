import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Landmark, Plus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BackButton, Page } from "../components/Shell";
import Sheet from "../components/Sheet";
import { DeleteButton, Empty, Fab, Field, SectionTitle, Segmented, Skeletons } from "../components/ui";
import { useTable } from "../hooks/useTable";
import { ACCOUNT_KINDS, LONG_TERM_KINDS, accountKind } from "../lib/catalog";
import { compactMoney, daysUntil, fmtDate, money, MONTHS, relDays, todayStr, toNumber } from "../lib/format";

export function MoneySwitch({ value }) {
  const nav = useNavigate();
  const { state } = useLocation();
  return (
    <Segmented
      className="mb-4"
      value={value}
      onChange={(v) => nav(v === "accounts" ? "/money" : "/budget", { replace: true, state })}
      options={[
        { value: "accounts", label: "חסכונות וחשבונות" },
        { value: "budget", label: "הכנסות והוצאות" },
      ]}
    />
  );
}

export default function Money() {
  const accounts = useTable("accounts");
  const snapshots = useTable("account_snapshots");
  const [editing, setEditing] = useState(null);
  const [updating, setUpdating] = useState(null);

  const live = accounts.rows.filter((a) => !a.archived);
  const total = live.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const liquid = live.filter((a) => !LONG_TERM_KINDS.has(a.kind)).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const checking = live.filter((a) => a.kind === "checking").reduce((s, a) => s + (Number(a.balance) || 0), 0);

  // שווי כולל לפי חודש: היתרה האחרונה הידועה של כל חשבון באותו חודש
  const history = useMemo(() => {
    const ids = new Set(live.map((a) => a.id));
    const snaps = snapshots.rows.filter((s) => ids.has(s.account_id)).sort((a, b) => a.taken_on.localeCompare(b.taken_on));
    if (!snaps.length) return [];
    const months = [...new Set(snaps.map((s) => s.taken_on.slice(0, 7)))].slice(-12);
    return months.map((m) => {
      const last = new Map();
      for (const s of snaps) if (s.taken_on.slice(0, 7) <= m) last.set(s.account_id, Number(s.balance) || 0);
      const [, mm] = m.split("-").map(Number);
      return { m, label: MONTHS[mm - 1].slice(0, 3), value: [...last.values()].reduce((a, b) => a + b, 0) };
    });
  }, [snapshots.rows, live]);

  const delta = history.length > 1 ? history.at(-1).value - history.at(-2).value : null;

  const groups = useMemo(
    () => ACCOUNT_KINDS.map((k) => ({ ...k, items: live.filter((a) => (a.kind || "other") === k.key) })).filter((g) => g.items.length),
    [live]
  );

  async function saveBalance(account, balance) {
    const taken_on = todayStr();
    await accounts.update(account.id, { balance, balance_updated_at: new Date().toISOString() });
    // תמונת מצב אחת ליום לכל חשבון
    const same = snapshots.rows.find((s) => s.account_id === account.id && s.taken_on === taken_on);
    if (same) await snapshots.update(same.id, { balance });
    else await snapshots.create({ account_id: account.id, balance, taken_on });
  }

  return (
    <Page title="כסף" back={<BackButton />}>
      <MoneySwitch value="accounts" />

      <div className="hero p-5">
        <p className="text-[13px] text-muted">שווי כולל</p>
        <p className="num text-[52px] leading-[1.05] font-bold tracking-[-0.03em]">{money(total)}</p>
        {delta != null && (
          <p className={`num text-[14px] font-medium mt-0.5 ${delta >= 0 ? "text-good" : "text-crit"}`}>
            {delta >= 0 ? "▲" : "▼"} {money(Math.abs(delta))} מהחודש הקודם
          </p>
        )}
        {history.length > 1 && (
          <div className="h-[120px] -mx-2 mt-3" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--chart-tick)", fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis hide domain={["dataMin - 1000", "dataMax + 1000"]} />
                <Tooltip
                  cursor={{ stroke: "var(--chart-grid)" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--line))", borderRadius: 14, fontFamily: "Rubik" }}
                  labelStyle={{ color: "hsl(var(--muted))" }}
                  formatter={(v) => [money(v), "שווי"]}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--accent))" strokeWidth={2.5} fill="hsl(var(--accent))" fillOpacity={0.12} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t">
          <div>
            <p className="text-[12px] text-muted">נזיל</p>
            <p className="num text-[18px] font-semibold">{compactMoney(liquid)}</p>
          </div>
          <div>
            <p className="text-[12px] text-muted">בעו"ש</p>
            <p className="num text-[18px] font-semibold">{compactMoney(checking)}</p>
          </div>
        </div>
      </div>

      {accounts.loading ? (
        <div className="mt-6">
          <Skeletons n={3} />
        </div>
      ) : live.length === 0 ? (
        <Empty icon={<Landmark size={28} strokeWidth={1.8} />} title="עוד אין חשבונות" text='מוסיפים עו"ש, קופות חיסכון ופיקדונות, ומעדכנים יתרה פעם בחודש.' />
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            <SectionTitle right={<span className="num text-[14px] text-muted">{money(g.items.reduce((s, a) => s + (Number(a.balance) || 0), 0))}</span>}>
              {g.icon} {g.label}
            </SectionTitle>
            <ul className="card overflow-hidden divide-y">
              {g.items.map((a) => {
                const age = a.balance_updated_at ? -daysUntil(a.balance_updated_at.slice(0, 10)) : null;
                return (
                  <li key={a.id} className="flex items-center gap-2 ps-4 pe-2 min-h-[64px]">
                    <button type="button" className="flex-1 text-start py-3 min-w-0" onClick={() => setEditing(a)}>
                      <p className="text-[16px] font-medium truncate">{a.name}</p>
                      <p className={`text-[12px] truncate ${age != null && age > 45 ? "text-warn" : "text-muted"}`}>
                        {[a.institution, a.owner, age != null ? `עודכן ${relDays(-age)}` : null].filter(Boolean).join(" · ")}
                      </p>
                    </button>
                    <button type="button" className="press text-end rounded-xl px-2 py-1.5" onClick={() => setUpdating(a)} aria-label={`עדכון יתרה: ${a.name}`}>
                      <p className="num text-[17px] font-semibold">{money(Number(a.balance) || 0)}</p>
                      <p className="text-[11px] text-accent-text font-medium">עדכון</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <Fab onClick={() => setEditing({})} label="חשבון" icon={<Plus size={20} strokeWidth={2.6} />} />

      <Sheet open={!!updating} onClose={() => setUpdating(null)} title={updating ? `יתרה: ${updating.name}` : ""}>
        {updating && (
          <BalanceForm
            key={updating.id}
            account={updating}
            history={snapshots.rows.filter((s) => s.account_id === updating.id).sort((a, b) => b.taken_on.localeCompare(a.taken_on))}
            onSave={async (b) => {
              setUpdating(null);
              await saveBalance(updating, b);
            }}
          />
        )}
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "עריכת חשבון" : "חשבון חדש"}>
        {editing && (
          <AccountForm
            key={editing.id || "new"}
            a={editing}
            onSave={async (values, balance) => {
              setEditing(null);
              if (editing.id) return accounts.update(editing.id, values);
              const created = await accounts.create({ ...values, balance, balance_updated_at: new Date().toISOString(), archived: false });
              await snapshots.create({ account_id: created.id, balance, taken_on: todayStr() });
            }}
            onDelete={
              editing.id &&
              (async () => {
                setEditing(null);
                await accounts.remove(editing.id);
                snapshots.refresh();
              })
            }
          />
        )}
      </Sheet>
    </Page>
  );
}

function BalanceForm({ account, history, onSave }) {
  const [v, setV] = useState(String(account.balance ?? ""));
  const n = toNumber(v);
  const diff = n != null ? n - (Number(account.balance) || 0) : 0;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (n != null) onSave(n);
      }}
    >
      <input className="field num text-center text-[28px] h-16 font-semibold" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} autoFocus onFocus={(e) => e.target.select()} />
      {diff !== 0 && (
        <p className={`num text-center text-[14px] font-medium ${diff > 0 ? "text-good" : "text-crit"}`}>
          {diff > 0 ? "+" : "−"}
          {money(Math.abs(diff))}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={n == null}>
        עדכון יתרה
      </button>
      {history.length > 0 && (
        <div>
          <span className="label mt-2">היסטוריה</span>
          <ul className="bg-raised rounded-2xl divide-y divide-line/60">
            {history.slice(0, 8).map((s) => (
              <li key={s.id} className="flex justify-between px-4 py-2.5 text-[14px]">
                <span className="text-muted">{fmtDate(s.taken_on)}</span>
                <span className="num font-medium">{money(Number(s.balance))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

function AccountForm({ a, onSave, onDelete }) {
  const [f, setF] = useState({ name: a.name || "", kind: a.kind || "checking", institution: a.institution || "", owner: a.owner || "משותף", notes: a.notes || "" });
  const [balance, setBalance] = useState("");
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (f.name.trim()) onSave({ ...f, name: f.name.trim(), institution: f.institution.trim(), owner: f.owner.trim(), notes: f.notes.trim() }, toNumber(balance) ?? 0);
      }}
    >
      <div>
        <span className="label">סוג</span>
        <div className="grid grid-cols-4 gap-2">
          {ACCOUNT_KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setF((p) => ({ ...p, kind: k.key }))}
              className={`press rounded-2xl py-2.5 flex flex-col items-center gap-1 text-[12px] leading-tight ${f.kind === k.key ? "bg-accent text-accent-ink font-semibold" : "bg-raised"}`}
            >
              <span className="text-lg">{k.icon}</span>
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <Field label="שם">
        <input className="field" value={f.name} onChange={set("name")} placeholder={`${accountKind(f.kind).label} - ${f.kind === "checking" ? "לאומי" : "מיטב"}`} autoFocus={!a.id} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="גוף מנהל / בנק">
          <input className="field" value={f.institution} onChange={set("institution")} />
        </Field>
        <Field label="של מי">
          <input className="field" value={f.owner} onChange={set("owner")} />
        </Field>
      </div>
      {!a.id && (
        <Field label="יתרה נוכחית">
          <input className="field num" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="₪0" />
        </Field>
      )}
      <Field label="הערות">
        <textarea className="field" rows={2} value={f.notes} onChange={set("notes")} placeholder="מספר חשבון, תאריך שחרור פיקדון…" />
      </Field>
      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn btn-primary flex-1" disabled={!f.name.trim()}>
          שמירה
        </button>
        {onDelete && <DeleteButton onConfirm={onDelete} label="" />}
      </div>
    </form>
  );
}

