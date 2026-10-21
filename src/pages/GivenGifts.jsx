import { useEffect, useMemo, useState } from "react";
import { CalendarHeart, Plus, Repeat } from "lucide-react";
import Sheet from "../components/Sheet";
import { DeleteButton, Empty, Fab, Field, SearchField, Skeletons, Switch } from "../components/ui";
import { useTable } from "../hooks/useTable";
import { fmtDate, fmtNum, money, todayStr, toNumber } from "../lib/format";

export const EVENT_TYPES = [
  { key: "wedding", label: "חתונה", icon: "💍" },
  { key: "brit", label: "ברית / בריתה", icon: "👶" },
  { key: "bar_mitzvah", label: "בר מצווה", icon: "📜" },
  { key: "bat_mitzvah", label: "בת מצווה", icon: "🎀" },
  { key: "engagement", label: "אירוסין", icon: "💐" },
  { key: "birthday", label: "יום הולדת", icon: "🎂" },
  { key: "birth", label: "לידה", icon: "🍼" },
  { key: "housewarming", label: "חנוכת בית", icon: "🏠" },
  { key: "other", label: "אחר", icon: "🎉" },
];
export const eventOf = (k) => EVENT_TYPES.find((e) => e.key === k) ?? EVENT_TYPES.at(-1);

const METHODS = ["מזומן", "ביט", "פייבוקס", "צ׳ק", "העברה", "שובר / BuyMe"];
const BUDGET_CATEGORY = "מתנות ואירועים";

// מה שנתנו באירועים, עם קישור למתנה שהם נתנו לנו ולהוצאה בתקציב
export function GivenView({ given, gifts, startWith, onStarted }) {
  const tx = useTable("transactions");
  const cats = useTable("tx_categories");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);

  // פתיחה ישירה מטאב "קיבלנו" ("הולכים לאירוע שלהם")
  useEffect(() => {
    if (!startWith) return;
    setEditing({ person: startWith.giver_name, gift_id: startWith.id });
    onStarted();
  }, [startWith, onStarted]);

  const giftById = useMemo(() => new Map(gifts.map((g) => [g.id, g])), [gifts]);
  const year = String(new Date().getFullYear());
  const thisYear = given.rows.filter((g) => g.event_date?.startsWith(year));
  const totalYear = thisYear.reduce((s, g) => s + (Number(g.amount) || 0), 0);
  const totalAll = given.rows.reduce((s, g) => s + (Number(g.amount) || 0), 0);

  const list = useMemo(() => {
    const term = q.trim();
    return given.rows
      .filter((g) => !term || g.person?.includes(term) || g.notes?.includes(term))
      .sort((a, b) => (b.event_date || "").localeCompare(a.event_date || ""));
  }, [given.rows, q]);

  const giftsCategory = cats.rows.find((c) => c.kind === "expense" && c.name === BUDGET_CATEGORY);

  async function save(values, toBudget) {
    const prev = editing;
    setEditing(null);
    const description = `מתנה: ${eventOf(values.event_type).label} - ${values.person}`;
    const txValues = { kind: "expense", amount: values.amount, date: values.event_date, category_id: giftsCategory?.id ?? null, description, method: null, recurring: false };

    let transaction_id = prev.transaction_id ?? null;
    if (toBudget && values.amount > 0) {
      if (transaction_id) await tx.update(transaction_id, txValues);
      else transaction_id = (await tx.create(txValues))?.id ?? null;
    } else if (!toBudget && transaction_id) {
      await tx.remove(transaction_id);
      transaction_id = null;
    }
    if (prev.id) await given.update(prev.id, { ...values, transaction_id });
    else await given.create({ ...values, transaction_id });
  }

  return (
    <>
      <div className="hero p-5 mb-4">
        <p className="text-[13px] text-muted">נתנו ב-{year}</p>
        <p className="num text-[52px] leading-[1.05] font-bold tracking-[-0.03em]">{money(totalYear)}</p>
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t text-center">
          <Stat label="אירועים השנה" value={fmtNum(thisYear.length)} />
          <Stat label="ממוצע לאירוע" value={money(thisYear.length ? Math.round(totalYear / thisYear.length) : 0)} />
          <Stat label="סה״כ מאז ומעולם" value={money(totalAll)} />
        </div>
      </div>

      {given.rows.length > 5 && (
        <div className="mb-3">
          <SearchField value={q} onChange={setQ} placeholder="חיפוש לפי שם" />
        </div>
      )}

      {given.loading ? (
        <Skeletons n={4} h={64} />
      ) : list.length === 0 ? (
        <Empty
          icon={<CalendarHeart size={28} strokeWidth={1.8} />}
          title={q ? "לא מצאתי" : "עוד לא רשמתם אירועים"}
          text="הולכים לחתונה, ברית או בר מצווה? רושמים כאן כמה נתתם, ורואים מיד כמה הם נתנו לכם."
        />
      ) : (
        <ul className="card overflow-hidden divide-y stagger">
          {list.map((g) => {
            const ev = eventOf(g.event_type);
            const theirs = g.gift_id ? giftById.get(g.gift_id) : null;
            return (
              <li key={g.id}>
                <button type="button" className="press w-full text-start flex items-center gap-3 px-4 py-3 min-h-[64px]" onClick={() => setEditing(g)}>
                  <span className="grid place-items-center w-10 h-10 rounded-full bg-raised text-[19px] shrink-0">{ev.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[16px] font-medium truncate">{g.person}</span>
                    <span className="block text-[13px] text-muted truncate">
                      {ev.label} · {fmtDate(g.event_date)}
                      {theirs ? ` · הם נתנו ${money(Number(theirs.amount) || 0)}` : ""}
                    </span>
                  </span>
                  <span className="num text-[17px] font-semibold shrink-0">{money(Number(g.amount) || 0)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Fab onClick={() => setEditing({})} label="אירוע" icon={<Plus size={20} strokeWidth={2.6} />} />

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "עריכת אירוע" : "הולכים לאירוע"}>
        {editing && (
          <GivenForm
            key={editing.id || "new"}
            g={editing}
            gifts={gifts}
            giftById={giftById}
            onSave={save}
            onDelete={
              editing.id &&
              (async () => {
                const g = editing;
                setEditing(null);
                await given.remove(g.id);
                if (g.transaction_id) await tx.remove(g.transaction_id).catch(() => {});
              })
            }
          />
        )}
      </Sheet>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="num text-[17px] font-semibold">{value}</p>
      <p className="text-[12px] text-muted mt-0.5">{label}</p>
    </div>
  );
}

function GivenForm({ g, gifts, giftById, onSave, onDelete }) {
  const [person, setPerson] = useState(g.person || "");
  const [giftId, setGiftId] = useState(g.gift_id || null);
  const [type, setType] = useState(g.event_type || "wedding");
  const [date, setDate] = useState(g.event_date || todayStr());
  const [amount, setAmount] = useState(g.amount ?? "");
  const [method, setMethod] = useState(g.method || null);
  const [notes, setNotes] = useState(g.notes || "");
  const [toBudget, setToBudget] = useState(g.id ? Boolean(g.transaction_id) : true);
  const [focused, setFocused] = useState(false);

  const theirs = giftId ? giftById.get(giftId) : null;

  // התאמה לרשימת המתנות שקיבלנו - לפי השם שמוקלד
  const matches = useMemo(() => {
    const term = person.trim();
    if (term.length < 2 || theirs?.giver_name === term) return [];
    return gifts.filter((x) => x.giver_name?.includes(term)).slice(0, 5);
  }, [person, gifts, theirs]);

  const theirAmount = Number(theirs?.amount) || 0;
  const presets = [...new Set([theirAmount, 300, 400, 500, 600, 800, 1000].filter(Boolean))].slice(0, 6);
  const n = toNumber(amount);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!person.trim()) return;
        onSave(
          { person: person.trim(), gift_id: giftId, event_type: type, event_date: date || todayStr(), amount: n ?? 0, method, notes: notes.trim() },
          toBudget
        );
      }}
    >
      <Field label="של מי האירוע?">
        <input
          className="field"
          value={person}
          onChange={(e) => {
            setPerson(e.target.value);
            if (theirs && e.target.value.trim() !== theirs.giver_name) setGiftId(null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="שם, כמו שרשום במתנות שקיבלנו"
          autoFocus={!g.id && !g.person}
          autoComplete="off"
        />
      </Field>
      {focused && matches.length > 0 && (
        <div className="hscroll -mt-2">
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              className="chip bg-raised"
              onClick={() => {
                setPerson(m.giver_name);
                setGiftId(m.id);
              }}
            >
              {m.giver_name} <span className="num opacity-60">{money(Number(m.amount) || 0)}</span>
            </button>
          ))}
        </div>
      )}

      {theirs && (
        <div className="hero p-4 rise">
          <p className="text-[13px] text-muted">הם נתנו לכם בחתונה</p>
          <p className="num text-[28px] font-bold leading-tight">{money(theirAmount)}</p>
          <p className="text-[13px] text-muted mt-1">
            {Number(theirs.guest_count) > 0 ? `${fmtNum(theirs.guest_count)} הגיעו` : "לא הגיעו"}
            {theirs.notes ? ` · ${theirs.notes}` : ""}
          </p>
        </div>
      )}

      <div>
        <span className="label">איזה אירוע</span>
        <div className="grid grid-cols-3 gap-2">
          {EVENT_TYPES.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => setType(e.key)}
              className={`press rounded-2xl py-2.5 px-1 flex flex-col items-center gap-1 text-[13px] leading-tight ${type === e.key ? "bg-accent text-accent-ink font-semibold" : "bg-raised"}`}
            >
              <span className="text-lg">{e.icon}</span>
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <Field label="כמה נותנים">
        <input className="field num text-[22px] font-semibold h-14" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="₪0" />
      </Field>
      <div className="hscroll -mt-2">
        {presets.map((p) => (
          <button key={p} type="button" className="chip bg-raised" data-on={n === p} onClick={() => setAmount(String(p))}>
            {p === theirAmount ? <Repeat size={14} /> : null}
            <span className="num">{money(p)}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="תאריך">
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="איך נתנו">
          <select className="field" value={method ?? ""} onChange={(e) => setMethod(e.target.value || null)}>
            <option value="">—</option>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <label className="flex items-center justify-between bg-raised rounded-2xl px-4 min-h-[56px] gap-3">
        <span className="text-[15px]">
          <span className="block font-medium">להוסיף להוצאות</span>
          <span className="block text-[12px] text-muted">בקטגוריה "{BUDGET_CATEGORY}"</span>
        </span>
        <Switch on={toBudget} onChange={setToBudget} label="להוסיף להוצאות" />
      </label>

      <Field label="הערות">
        <textarea className="field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="איפה, עם מי הלכנו…" />
      </Field>

      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn btn-primary flex-1" disabled={!person.trim()}>
          שמירה
        </button>
        {onDelete && <DeleteButton onConfirm={onDelete} label="" />}
      </div>
    </form>
  );
}
