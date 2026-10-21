import { useMemo, useState } from "react";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { Page } from "../components/Shell";
import Sheet from "../components/Sheet";
import { DeleteButton, Empty, Fab, Field, SearchField, Skeletons } from "../components/ui";
import { useTable } from "../hooks/useTable";
import { fmtNum, money, toNumber } from "../lib/format";
import { BackLink } from "./Vouchers";

const SORTS = [
  { value: "name", label: "א-ב" },
  { value: "amount", label: "סכום" },
  { value: "recent", label: "אחרונים" },
];

export default function Gifts() {
  const gifts = useTable("gifts");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");
  const [editing, setEditing] = useState(null);

  const stats = useMemo(() => {
    const total = gifts.rows.reduce((s, g) => s + (Number(g.amount) || 0), 0);
    const guests = gifts.rows.reduce((s, g) => s + (Number(g.guest_count) || 0), 0);
    return { total, guests, perGuest: guests ? total / guests : 0 };
  }, [gifts.rows]);

  const list = useMemo(() => {
    const term = q.trim();
    const base = gifts.rows.filter((g) => !term || g.giver_name?.includes(term) || g.notes?.includes(term));
    const by = {
      name: (a, b) => (a.giver_name || "").localeCompare(b.giver_name || "", "he"),
      amount: (a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0),
      recent: (a, b) => (b.created_at || "").localeCompare(a.created_at || ""),
    }[sort];
    return [...base].sort(by);
  }, [gifts.rows, q, sort]);

  async function exportXlsx() {
    try {
      const { default: writeXlsxFile } = await import("write-excel-file");
      const header = ["שם", "מספר מגיעים", "סכום", "הערות"].map((value) => ({ value, fontWeight: "bold" }));
      const rows = list.map((g) => [
        { type: String, value: g.giver_name || "" },
        { type: Number, value: Number(g.guest_count) || 0 },
        { type: Number, value: Number(g.amount) || 0 },
        { type: String, value: g.notes || "" },
      ]);
      await writeXlsxFile([header, ...rows], { fileName: "מתנות-חתונה.xlsx", rightToLeft: true, columns: [{ width: 24 }, { width: 12 }, { width: 10 }, { width: 40 }] });
    } catch {
      toast.error("הייצוא נכשל");
    }
  }

  return (
    <Page
      title="מתנות חתונה"
      back={<BackLink />}
      action={
        gifts.rows.length > 0 && (
          <button type="button" className="icon-btn" onClick={exportXlsx} aria-label="ייצוא לאקסל">
            <Download size={20} />
          </button>
        )
      }
    >
      <div className="hero p-5 mb-4">
        <p className="text-[13px] text-muted">סה"כ התקבל</p>
        <p className="num text-[38px] leading-tight font-bold tracking-tight">{money(stats.total)}</p>
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t text-center">
          <Stat label="רשומות" value={fmtNum(gifts.rows.length)} />
          <Stat label="אורחים" value={fmtNum(stats.guests)} />
          <Stat label="ממוצע לאורח" value={money(Math.round(stats.perGuest))} />
        </div>
      </div>

      <div className="sticky top-[calc(env(safe-area-inset-top)+56px)] z-20 -mx-4 px-4 pb-2 bg-bg">
        <SearchField value={q} onChange={setQ} placeholder="כמה נתנו לנו? חפשו שם" />
        <div className="hscroll mt-2">
          {SORTS.map((s) => (
            <button key={s.value} type="button" className="chip" data-on={sort === s.value} onClick={() => setSort(s.value)}>
              {s.label}
            </button>
          ))}
          {q && <span className="text-[13px] text-muted self-center ms-auto num">{list.length} תוצאות</span>}
        </div>
      </div>

      <div className="mt-2">
        {gifts.loading ? (
          <Skeletons n={8} h={60} />
        ) : list.length === 0 ? (
          <Empty icon="💌" title={q ? "לא מצאתי" : "אין עדיין מתנות"} text={q ? `אין רשומה עם "${q}"` : "רושמים מי הביא כמה - ובאירוע הבא שלהם יודעים מה להחזיר."} />
        ) : (
          <ul className="card overflow-hidden divide-y">
            {list.map((g) => (
              <li key={g.id}>
                <button type="button" className="press w-full text-start flex items-center gap-3 px-4 py-3 min-h-[60px]" onClick={() => setEditing(g)}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[16px] font-medium truncate">{g.giver_name}</p>
                    <p className="text-[13px] text-muted truncate">
                      {Number(g.guest_count) > 0 ? `${fmtNum(g.guest_count)} מגיעים` : "לא הגיעו"}
                      {g.notes ? ` · ${g.notes}` : ""}
                    </p>
                  </div>
                  <p className="num text-[17px] font-semibold shrink-0">{money(Number(g.amount) || 0)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Fab onClick={() => setEditing({})} label="מתנה" icon={<Plus size={20} strokeWidth={2.6} />} />

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "עריכה" : "מתנה חדשה"}>
        {editing && (
          <GiftForm
            key={editing.id || "new"}
            g={editing}
            onSave={async (values) => {
              if (editing.id) await gifts.update(editing.id, values);
              else await gifts.create(values);
              setEditing(null);
            }}
            onDelete={
              editing.id &&
              (async () => {
                await gifts.remove(editing.id);
                setEditing(null);
              })
            }
          />
        )}
      </Sheet>
    </Page>
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

function GiftForm({ g, onSave, onDelete }) {
  const [name, setName] = useState(g.giver_name || "");
  const [count, setCount] = useState(g.guest_count ?? 2);
  const [amount, setAmount] = useState(g.amount ?? "");
  const [notes, setNotes] = useState(g.notes || "");
  const n = Number(count) || 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave({ giver_name: name.trim(), guest_count: n, amount: toNumber(amount) ?? 0, notes: notes.trim() });
      }}
    >
      <Field label="שם">
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="משפחת כהן" autoFocus={!g.id} />
      </Field>
      <div>
        <span className="label">כמה הגיעו</span>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-soft w-12 px-0 text-xl" onClick={() => setCount(Math.max(0, n - 1))} aria-label="פחות">
            −
          </button>
          <p className="num flex-1 text-center text-[22px] font-semibold">{n}</p>
          <button type="button" className="btn btn-soft w-12 px-0 text-xl" onClick={() => setCount(n + 1)} aria-label="יותר">
            +
          </button>
        </div>
      </div>
      <Field label="סכום">
        <input className="field num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="₪0" />
      </Field>
      <Field label="הערות">
        <textarea className="field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ביט / צ'ק / מזומן, קשר משפחתי…" />
      </Field>
      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn btn-primary flex-1" disabled={!name.trim()}>
          שמירה
        </button>
        {onDelete && <DeleteButton onConfirm={onDelete} label="" />}
      </div>
    </form>
  );
}
