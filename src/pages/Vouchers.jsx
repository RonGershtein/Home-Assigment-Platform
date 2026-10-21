import { useMemo, useState } from "react";
import { CheckCheck, Copy, ExternalLink, Hourglass, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";
import { BackButton, Page } from "../components/Shell";
import Sheet from "../components/Sheet";
import { DeleteButton, Empty, Fab, Field, SearchField, Segmented, Skeletons } from "../components/ui";
import { useTable } from "../hooks/useTable";
import { daysUntil, fmtDate, money, relDays, toNumber } from "../lib/format";

// תקף / פג בקרוב / פג - לפי תאריך התפוגה
function stateOf(v) {
  if (v.status === "used") return "used";
  const d = daysUntil(v.expiry_date);
  if (d != null && d < 0) return "expired";
  if (d != null && d <= 30) return "soon";
  return "ok";
}

const TONE = {
  ok: "text-good",
  soon: "text-warn",
  expired: "text-crit",
  used: "text-muted",
};

const EMPTY = {
  active: { icon: <Ticket size={28} strokeWidth={1.8} />, title: "אין שוברים בתוקף", text: "מוסיפים שובר עם תאריך תפוגה ומקבלים תזכורת חזותית לפני שהוא פג." },
  expired: { icon: <Hourglass size={28} strokeWidth={1.8} />, title: "אף שובר לא פג", text: "שוברים שעבר התוקף שלהם בלי שנוצלו יעברו לכאן." },
  used: { icon: <CheckCheck size={28} strokeWidth={1.8} />, title: "עוד לא ניצלתם שוברים", text: 'לוחצים "סימון כמנוצל" על שובר והוא עובר לכאן.' },
};

export const BackLink = () => <BackButton fallback={{ to: "/more", label: "עוד" }} />;

export default function Vouchers() {
  const vouchers = useTable("vouchers");
  const [view, setView] = useState("active");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);

  const active = vouchers.rows.filter((v) => v.status !== "used" && stateOf(v) !== "expired");
  const expired = vouchers.rows.filter((v) => stateOf(v) === "expired");
  const used = vouchers.rows.filter((v) => v.status === "used");
  const byView = { active, expired, used };
  const activeValue = active.reduce((s, v) => s + (v.voucher_type === "cash" ? Number(v.amount) || 0 : 0), 0);
  const soonCount = active.filter((v) => stateOf(v) === "soon").length;

  const list = useMemo(() => {
    const term = q.trim();
    const base = byView[view].filter(
      (v) => !term || [v.title, v.notes, v.gift_description, v.voucher_code].some((f) => f?.includes(term))
    );
    // הקרוב לפוג ראשון; בלי תאריך - בסוף
    return base.sort((a, b) => {
      if (view !== "active") return (b.expiry_date || "").localeCompare(a.expiry_date || "");
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return a.expiry_date.localeCompare(b.expiry_date);
    });
  }, [view, q, active, expired, used]);

  return (
    <Page title="שוברים" back={<BackLink />}>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="hero p-4">
          <p className="text-[13px] text-muted">שווי בשוברים</p>
          <p className="num text-[26px] font-bold mt-0.5">{money(activeValue)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[13px] text-muted">פגים החודש</p>
          <p className={`num text-[26px] font-bold mt-0.5 ${soonCount ? "text-warn" : ""}`}>{soonCount}</p>
        </div>
      </div>

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: "active", label: "בתוקף", count: active.length },
          { value: "expired", label: "פגו", count: expired.length },
          { value: "used", label: "נוצלו", count: used.length },
        ]}
      />
      {vouchers.rows.length > 6 && (
        <div className="mt-3">
          <SearchField value={q} onChange={setQ} placeholder="חיפוש שובר" />
        </div>
      )}

      <div className="mt-4">
        {vouchers.loading ? (
          <Skeletons n={4} h={96} />
        ) : list.length === 0 ? (
          <Empty {...EMPTY[view]} />
        ) : (
          <ul className="space-y-2 stagger">
            {list.map((v) => (
              <VoucherCard key={v.id} v={v} onOpen={() => setEditing(v)} onUse={() => vouchers.update(v.id, { status: v.status === "used" ? "active" : "used" })} />
            ))}
          </ul>
        )}
      </div>

      <Fab onClick={() => setEditing({})} label="שובר" icon={<Plus size={20} strokeWidth={2.6} />} />

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "עריכת שובר" : "שובר חדש"}>
        {editing && (
          <VoucherForm
            key={editing.id || "new"}
            v={editing}
            onSave={async (values) => {
              if (editing.id) await vouchers.update(editing.id, values);
              else await vouchers.create({ ...values, status: "active" });
              setEditing(null);
            }}
            onDelete={
              editing.id &&
              (async () => {
                await vouchers.remove(editing.id);
                setEditing(null);
              })
            }
          />
        )}
      </Sheet>
    </Page>
  );
}

function VoucherCard({ v, onOpen, onUse }) {
  const s = stateOf(v);
  const d = daysUntil(v.expiry_date);
  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(v.voucher_code);
      toast.success("הקוד הועתק");
    } catch {
      toast.error("לא הצלחתי להעתיק");
    }
  };

  return (
    <li className={`card overflow-hidden ${s === "used" || s === "expired" ? "opacity-70" : ""}`}>
      <button type="button" className="w-full text-start p-4 pb-3" onClick={onOpen}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[17px] font-semibold truncate">{v.title}</p>
            <p className="text-[14px] text-muted mt-0.5 truncate">
              {v.voucher_type === "gift" ? `🎁 ${v.gift_description || "מתנה"}` : "💳 שובר כספי"}
              {v.notes ? ` · ${v.notes}` : ""}
            </p>
          </div>
          {v.voucher_type === "cash" && v.amount != null && <p className="num text-[20px] font-bold shrink-0">{money(v.amount)}</p>}
        </div>
        <p className={`text-[13px] font-medium mt-2 ${TONE[s]}`}>
          {s === "used" ? "נוצל" : v.expiry_date ? `${s === "expired" ? "פג" : "בתוקף עד"} ${fmtDate(v.expiry_date)} · ${relDays(d)}` : "ללא תאריך תפוגה"}
        </p>
      </button>
      <div className="flex items-center gap-1 px-2 pb-2">
        {v.voucher_code && (
          <button type="button" className="press flex-1 min-w-0 h-10 rounded-xl bg-raised flex items-center justify-center gap-2 text-[14px]" onClick={copy}>
            <span className="num font-mono truncate" dir="ltr">
              {v.voucher_code}
            </span>
            <Copy size={15} className="text-muted shrink-0" />
          </button>
        )}
        {v.store_url && (
          <a href={v.store_url} target="_blank" rel="noreferrer" className="icon-btn bg-raised" aria-label="פתיחת האתר">
            <ExternalLink size={17} />
          </a>
        )}
        <button type="button" className={`press h-10 px-4 rounded-xl text-[14px] font-medium ${v.voucher_code ? "" : "flex-1"} ${v.status === "used" ? "bg-raised" : "bg-accent/15 text-accent-text"}`} onClick={onUse}>
          {v.status === "used" ? "החזרה לפעיל" : "סימון כמנוצל"}
        </button>
      </div>
    </li>
  );
}

function VoucherForm({ v, onSave, onDelete }) {
  const [f, setF] = useState({
    title: v.title || "",
    voucher_type: v.voucher_type || "cash",
    amount: v.amount ?? "",
    gift_description: v.gift_description || "",
    expiry_date: v.expiry_date || "",
    voucher_code: v.voucher_code || "",
    store_url: v.store_url || "",
    notes: v.notes || "",
  });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.title.trim()) return;
        onSave({
          title: f.title.trim(),
          voucher_type: f.voucher_type,
          amount: f.voucher_type === "cash" ? toNumber(f.amount) : null,
          gift_description: f.voucher_type === "gift" ? f.gift_description.trim() || null : null,
          expiry_date: f.expiry_date || null,
          voucher_code: f.voucher_code.trim() || null,
          store_url: f.store_url.trim() || null,
          notes: f.notes.trim(),
        });
      }}
    >
      <Segmented
        value={f.voucher_type}
        onChange={(t) => setF((p) => ({ ...p, voucher_type: t }))}
        options={[
          { value: "cash", label: "💳 כספי" },
          { value: "gift", label: "🎁 מתנה" },
        ]}
      />
      <Field label="איפה מממשים?">
        <input className="field" value={f.title} onChange={set("title")} placeholder="שופרסל, BuyMe, נופשונית…" autoFocus={!v.id} />
      </Field>
      {f.voucher_type === "cash" ? (
        <Field label="סכום">
          <input className="field num" inputMode="decimal" value={f.amount} onChange={set("amount")} placeholder="₪0" />
        </Field>
      ) : (
        <Field label="מה המתנה?">
          <input className="field" value={f.gift_description} onChange={set("gift_description")} placeholder="ארוחה זוגית, עיסוי…" />
        </Field>
      )}
      <Field label="בתוקף עד">
        <input type="date" className="field" value={f.expiry_date} onChange={set("expiry_date")} />
      </Field>
      <Field label="קוד / מספר שובר">
        <input className="field num" dir="ltr" value={f.voucher_code} onChange={set("voucher_code")} autoComplete="off" autoCapitalize="characters" />
      </Field>
      <Field label="קישור לאתר">
        <input className="field" dir="ltr" type="url" inputMode="url" value={f.store_url} onChange={set("store_url")} placeholder="https://" />
      </Field>
      <Field label="הערות">
        <textarea className="field" rows={2} value={f.notes} onChange={set("notes")} placeholder="ממי קיבלנו, איפה השובר הפיזי…" />
      </Field>
      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn btn-primary flex-1" disabled={!f.title.trim()}>
          שמירה
        </button>
        {onDelete && <DeleteButton onConfirm={onDelete} label="" />}
      </div>
    </form>
  );
}
