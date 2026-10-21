import { useMemo, useRef, useState } from "react";
import { ArrowUp, ChevronDown, Share2, ShoppingBasket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Page } from "../components/Shell";
import Sheet from "../components/Sheet";
import { CheckCircle, Empty, SectionTitle, Skeletons, useLeaving } from "../components/ui";
import { useTable } from "../hooks/useTable";
import { SHOP_CATEGORIES, shopCat } from "../lib/catalog";
import { COMMON_GROCERIES, GROCERIES, matchGrocery } from "../lib/groceries";
import { UNITS, formatQuantity, parseQuantity, stepOf } from "../lib/quantity";
import { useSession } from "../lib/auth";

// אייקון לפריט: מהקטלוג, ואם לא נמצא - של הקטגוריה
const iconOf = (name, category) => matchGrocery(name)?.icon ?? shopCat(category).icon;

const norm = (s) => s.trim().replace(/\s+/g, " ");
const FINALS = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };
const foldFinals = (s) => s.replace(/[ךםןףץ]/g, (c) => FINALS[c]);

export default function Shopping() {
  const items = useTable("shopping_items");
  const profiles = useTable("profiles");
  const session = useSession();
  const me = session.user?.id;
  const names = useMemo(() => new Map(profiles.rows.map((p) => [p.user_id, p.name])), [profiles.rows]);
  // "מי הוסיף" מוצג רק כשזה מישהו אחר
  const addedBy = (i) => (i.created_by && i.created_by !== me ? names.get(i.created_by) : null);
  const memory = useTable("item_categories");
  const [text, setText] = useState("");
  const [picked, setPicked] = useState(null); // קטגוריה שנבחרה ידנית לפריט שמוקלד
  const [catSheet, setCatSheet] = useState(null); // { item } או { forInput: true }
  const [showBought, setShowBought] = useState(false);
  const input = useRef(null);
  const [leavingIds, leave] = useLeaving();

  const remembered = useMemo(() => new Map(memory.rows.map((m) => [m.item_name, m.category])), [memory.rows]);
  const guess = picked ?? remembered.get(norm(text)) ?? matchGrocery(text)?.category ?? "other";

  const toBuy = items.rows.filter((i) => !i.is_purchased);
  const bought = items.rows.filter((i) => i.is_purchased);

  // קיבוץ לפי סדר המעברים בסופר
  const groups = useMemo(
    () =>
      SHOP_CATEGORIES.map((c) => ({ ...c, items: toBuy.filter((i) => (i.category || "other") === c.key) })).filter((g) => g.items.length),
    [toBuy]
  );

  // הוספה מהירה: קודם מה שקניתם לאחרונה, אחר כך מוצרים נפוצים
  const quick = useMemo(() => {
    const onList = new Set(toBuy.map((i) => i.item_name));
    const seen = new Set();
    const out = [];
    const recent = [...memory.rows].sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
    for (const m of [...recent.map((m) => ({ name: m.item_name, category: m.category })), ...COMMON_GROCERIES]) {
      if (onList.has(m.name) || seen.has(m.name)) continue;
      seen.add(m.name);
      out.push({ name: m.name, category: m.category });
      if (out.length >= 24) break;
    }
    return out;
  }, [memory.rows, toBuy]);

  const suggestions = useMemo(() => {
    const q = norm(text);
    if (q.length < 1) return [];
    const onList = new Set(toBuy.map((i) => i.item_name));
    // קודם מה שמתחיל במה שהוקלד, אחר כך מילה שמתחילה בו, ואחר כך מכיל. ההיסטוריה שלכם לפני הקטלוג
    // אותיות סופיות מקופלות: "מלפפון" הוא תחילת "מלפפונים"
    const fq = foldFinals(q);
    const rank = (name) => {
      const n = foldFinals(name);
      return n.startsWith(fq) ? 0 : n.split(" ").some((w) => w.startsWith(fq)) ? 1 : n.includes(fq) ? 2 : -1;
    };
    const pool = [
      ...memory.rows.map((m) => ({ name: m.item_name, category: m.category, mine: 0 })),
      ...GROCERIES.map((g) => ({ name: g.name, category: g.category, mine: 1 })),
    ];
    const seen = new Set([q]);
    return pool
      .map((p) => ({ ...p, r: rank(p.name) }))
      .filter((p) => p.r >= 0 && !onList.has(p.name))
      .sort((a, b) => a.r - b.r || a.mine - b.mine || a.name.length - b.name.length)
      .filter((p) => !seen.has(p.name) && seen.add(p.name))
      .slice(0, 8);
  }, [text, memory.rows, toBuy]);

  // הקלדה חופשית מפוענחת לכמות ("2 חלב"); בחירה מהצעות נשמרת כמו שהיא
  async function add(name = text, category = guess, parse = false) {
    const q = parse ? parseQuantity(name) : { name, quantity: 1, unit: null };
    const item_name = norm(q.name);
    if (!item_name) return;
    if (parse && q.name !== name && !picked) category = remembered.get(item_name) ?? matchGrocery(item_name)?.category ?? category;
    setText("");
    setPicked(null);
    input.current?.focus();
    const existing = items.rows.find((i) => i.item_name === item_name);
    if (existing && !existing.is_purchased) {
      if (q.quantity === 1 && !q.unit) return toast("כבר ברשימה");
      await items.update(existing.id, { quantity: q.quantity, unit: q.unit });
      return toast(`עודכנה הכמות: ${formatQuantity(q.quantity, q.unit) ?? "1"}`);
    }
    if (existing) await items.update(existing.id, { is_purchased: false, category, quantity: q.quantity, unit: q.unit });
    else await items.create({ item_name, category, is_purchased: false, quantity: q.quantity, unit: q.unit });
    if (remembered.get(item_name) !== category) memory.api.upsert({ item_name, category }, "item_name").then(memory.refresh);
  }

  async function setCategory(item, category) {
    setCatSheet(null);
    if (!item) return setPicked(category);
    await items.update(item.id, { category });
    memory.api.upsert({ item_name: item.item_name, category }, "item_name").then(memory.refresh);
  }

  function share() {
    const lines = groups.flatMap((g) => [
      `${g.icon} ${g.label}`,
      ...g.items.map((i) => `▫️ ${i.item_name}${formatQuantity(i.quantity, i.unit) ? ` (${formatQuantity(i.quantity, i.unit)})` : ""}`),
      "",
    ]);
    const msg = `🛒 רשימת קניות\n\n${lines.join("\n")}`.trim();
    if (navigator.share) navigator.share({ text: msg }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const cat = shopCat(guess);

  return (
    <Page
      title="קניות"
      subtitle={toBuy.length ? `${toBuy.length} פריטים לקנות` : "הרשימה ריקה"}
      action={
        toBuy.length > 0 && (
          <button type="button" className="icon-btn" onClick={share} aria-label="שיתוף הרשימה">
            <Share2 size={20} />
          </button>
        )
      }
    >
      <form
        className="sticky top-[calc(env(safe-area-inset-top)+56px)] z-20 -mx-4 px-4 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(text, guess, true);
        }}
      >
        <div className="card flex items-center gap-1.5 p-1.5 transition-shadow duration-150 focus-within:shadow-[inset_0_0_0_2px_hsl(var(--accent))]">
          <button
            type="button"
            className="press no-select shrink-0 h-11 ps-2.5 pe-2 rounded-2xl bg-raised flex items-center gap-1 text-[14px]"
            onClick={() => setCatSheet({ forInput: true })}
            aria-label={`קטגוריה: ${cat.label}`}
          >
            <span className="text-lg">{picked ? cat.icon : iconOf(text, guess)}</span>
            <ChevronDown size={14} className="text-muted" />
          </button>
          <input
            ref={input}
            className="bare flex-1 min-w-0 bg-transparent outline-none px-2 h-11 placeholder:text-muted/80"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPicked(null);
            }}
            placeholder="מה צריך לקנות?"
            enterKeyHint="done"
            autoComplete="off"
          />
          <button type="submit" disabled={!norm(text)} className="press shrink-0 grid place-items-center h-11 w-11 rounded-2xl bg-accent text-accent-ink disabled:opacity-30" aria-label="הוספה">
            <ArrowUp size={20} strokeWidth={2.6} />
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="hscroll mt-2 -mx-4 px-4">
            {suggestions.map((s) => (
              <button key={s.name} type="button" className="chip bg-card" onClick={() => add(s.name, s.category)}>
                <span className="text-[17px] leading-none">{iconOf(s.name, s.category)}</span>
                {s.name}
              </button>
            ))}
          </div>
        )}
      </form>

      {!text && quick.length > 0 && (
        <section className="mt-2" aria-label="הוספה מהירה">
          <p className="text-[13px] font-medium text-muted px-1 mb-2">הוספה מהירה</p>
          <div className="grid grid-rows-2 grid-flow-col auto-cols-max gap-2 overflow-x-auto overscroll-x-contain -mx-4 px-4 pb-1 [scrollbar-width:none]">
            {quick.map((q) => (
              <button key={q.name} type="button" className="chip" onClick={() => add(q.name, q.category)}>
                <span className="text-[17px] leading-none">{iconOf(q.name, q.category)}</span>
                {q.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {items.loading ? (
        <div className="mt-4">
          <Skeletons n={5} h={56} />
        </div>
      ) : toBuy.length === 0 ? (
        <Empty icon={<ShoppingBasket size={28} strokeWidth={1.8} />} title="אין מה לקנות" text="פריטים שמוסיפים מקבלים קטגוריה אוטומטית לפי מה שהוספתם בעבר." />
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            <SectionTitle>
              {g.icon} {g.label} <span className="num font-normal opacity-70">· {g.items.length}</span>
            </SectionTitle>
            <ul className="card overflow-hidden divide-y">
              {g.items.map((i) => (
                <Row key={i.id} item={i} by={addedBy(i)} leaving={leavingIds.has(i.id)} onToggle={() => leave(i.id, () => items.update(i.id, { is_purchased: true }))} onCat={() => setCatSheet({ item: i })} />
              ))}
            </ul>
          </section>
        ))
      )}

      {bought.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between px-1">
            <button type="button" className="press flex items-center gap-1.5 text-[15px] font-semibold text-muted h-10" onClick={() => setShowBought((v) => !v)} aria-expanded={showBought}>
              נקנו <span className="num font-normal">({bought.length})</span>
              <ChevronDown size={16} className={`transition-transform duration-200 ${showBought ? "rotate-180" : ""}`} />
            </button>
            <button type="button" className="press flex items-center gap-1.5 text-[14px] text-crit h-10 px-2" onClick={() => items.remove(bought.map((b) => b.id))}>
              <Trash2 size={15} /> ניקוי
            </button>
          </div>
          {showBought && (
            <ul className="card overflow-hidden divide-y mt-1 rise">
              {bought.map((i) => (
                <Row key={i.id} item={i} done onToggle={() => items.update(i.id, { is_purchased: false })} onCat={() => setCatSheet({ item: i })} />
              ))}
            </ul>
          )}
        </section>
      )}

      <Sheet open={!!catSheet} onClose={() => setCatSheet(null)} title={catSheet?.item ? catSheet.item.item_name : "קטגוריה"}>
        {catSheet?.item && (
          <QuantityEditor
            key={catSheet.item.id}
            item={items.rows.find((i) => i.id === catSheet.item.id) ?? catSheet.item}
            onChange={(patch) => items.update(catSheet.item.id, patch)}
          />
        )}
        {catSheet?.item && <p className="label mt-5">מחלקה בסופר</p>}
        <div className="grid grid-cols-3 gap-2 pb-2">
          {SHOP_CATEGORIES.map((c) => {
            const current = catSheet?.item ? catSheet.item.category : guess;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(catSheet?.item, c.key)}
                className={`press rounded-2xl py-4 flex flex-col items-center gap-1.5 text-[14px] ${current === c.key ? "bg-accent text-accent-ink font-semibold" : "bg-raised"}`}
              >
                <span className="text-2xl">{c.icon}</span>
                {c.label}
              </button>
            );
          })}
        </div>
      </Sheet>
    </Page>
  );
}

function Row({ item, by, done, leaving, onToggle, onCat }) {
  return (
    <li className={`enter flex items-center gap-3 ps-4 pe-2 min-h-[56px] ${leaving ? "leaving" : ""}`}>
      <CheckCircle on={!!done !== !!leaving} onClick={onToggle} label={done ? "החזרה לרשימה" : "סימון כנקנה"} />
      <button type="button" className="flex-1 min-w-0 text-start py-2.5" onClick={onToggle}>
        <span className="flex items-center gap-2">
          <span className={`text-[16px] truncate ${done ? "line-through text-muted" : ""}`}>{item.item_name}</span>
          {formatQuantity(item.quantity, item.unit) && (
            <span className="num shrink-0 h-6 px-2 rounded-full bg-accent/20 text-accent-text text-[13px] font-semibold grid place-items-center">{formatQuantity(item.quantity, item.unit)}</span>
          )}
        </span>
        {by && !done && <span className="block text-[12px] text-muted mt-0.5">נוסף ע״י {by}</span>}
      </button>
      <button
        type="button"
        className={`press grid place-items-center w-10 h-10 rounded-xl bg-raised text-[20px] shrink-0 ${done ? "opacity-50 grayscale" : ""}`}
        onClick={onCat}
        aria-label={`עריכת ${item.item_name}: כמות וקטגוריה`}
      >
        {iconOf(item.item_name, item.category)}
      </button>
    </li>
  );
}

function QuantityEditor({ item, onChange }) {
  const unit = item.unit ?? null;
  const q = Number(item.quantity) || 1;
  const step = stepOf(unit);
  const set = (quantity, u = unit) => onChange({ quantity: Math.max(step, Math.round(quantity * 100) / 100), unit: u });
  return (
    <div>
      <span className="label">כמות</span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-soft w-12 px-0 text-xl" onClick={() => set(q - step)} disabled={q <= step} aria-label="פחות">
          −
        </button>
        <p className="num flex-1 text-center text-[24px] font-semibold">{formatQuantity(q, unit) ?? "1"}</p>
        <button type="button" className="btn btn-soft w-12 px-0 text-xl" onClick={() => set(q + step)} aria-label="יותר">
          +
        </button>
      </div>
      <div className="hscroll mt-3">
        {UNITS.map((u) => (
          <button
            key={u.label}
            type="button"
            className="chip bg-raised"
            data-on={unit === u.key}
            onClick={() => set(u.key === "g" ? 500 : u.key === "kg" || u.key === "l" ? 1 : unit === "g" ? 1 : q, u.key)}
          >
            {u.label}
          </button>
        ))}
      </div>
    </div>
  );
}
