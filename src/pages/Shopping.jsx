import { useMemo, useRef, useState } from "react";
import { ArrowUp, ChevronDown, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Page } from "../components/Shell";
import Sheet from "../components/Sheet";
import { CheckCircle, Empty, SectionTitle, Skeletons } from "../components/ui";
import { useTable } from "../hooks/useTable";
import { SHOP_CATEGORIES, shopCat } from "../lib/catalog";
import { COMMON_GROCERIES, matchGrocery } from "../lib/groceries";

// אייקון לפריט: מהקטלוג, ואם לא נמצא - של הקטגוריה
const iconOf = (name, category) => matchGrocery(name)?.icon ?? shopCat(category).icon;

const norm = (s) => s.trim().replace(/\s+/g, " ");

export default function Shopping() {
  const items = useTable("shopping_items");
  const memory = useTable("item_categories");
  const [text, setText] = useState("");
  const [picked, setPicked] = useState(null); // קטגוריה שנבחרה ידנית לפריט שמוקלד
  const [catSheet, setCatSheet] = useState(null); // { item } או { forInput: true }
  const [showBought, setShowBought] = useState(false);
  const input = useRef(null);

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
    return memory.rows
      .filter((m) => m.item_name.includes(q) && m.item_name !== q && !onList.has(m.item_name))
      .slice(0, 6);
  }, [text, memory.rows, toBuy]);

  async function add(name = text, category = guess) {
    const item_name = norm(name);
    if (!item_name) return;
    setText("");
    setPicked(null);
    input.current?.focus();
    const existing = items.rows.find((i) => i.item_name === item_name);
    if (existing && !existing.is_purchased) return toast("כבר ברשימה");
    if (existing) await items.update(existing.id, { is_purchased: false, category });
    else await items.create({ item_name, category, is_purchased: false });
    if (remembered.get(item_name) !== category) memory.api.upsert({ item_name, category }, "item_name").then(memory.refresh);
  }

  async function setCategory(item, category) {
    setCatSheet(null);
    if (!item) return setPicked(category);
    await items.update(item.id, { category });
    memory.api.upsert({ item_name: item.item_name, category }, "item_name").then(memory.refresh);
  }

  function share() {
    const lines = groups.flatMap((g) => [`${g.icon} ${g.label}`, ...g.items.map((i) => `▫️ ${i.item_name}`), ""]);
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
          add();
        }}
      >
        <div className="card flex items-center gap-1.5 p-1.5 shadow-float/0">
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
            className="flex-1 min-w-0 bg-transparent outline-none px-2 h-11 placeholder:text-muted/80"
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
              <button key={s.item_name} type="button" className="chip bg-card" onClick={() => add(s.item_name, s.category)}>
                {iconOf(s.item_name, s.category)} {s.item_name}
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
        <Empty icon="🧺" title="אין מה לקנות" text="פריטים שמוסיפים מקבלים קטגוריה אוטומטית לפי מה שהוספתם בעבר." />
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            <SectionTitle>
              {g.icon} {g.label} <span className="num font-normal opacity-70">· {g.items.length}</span>
            </SectionTitle>
            <ul className="card overflow-hidden divide-y">
              {g.items.map((i) => (
                <Row key={i.id} item={i} onToggle={() => items.update(i.id, { is_purchased: true })} onCat={() => setCatSheet({ item: i })} />
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

      <Sheet open={!!catSheet} onClose={() => setCatSheet(null)} title="קטגוריה">
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

function Row({ item, done, onToggle, onCat }) {
  return (
    <li className="enter flex items-center gap-3 ps-4 pe-2 min-h-[56px]">
      <CheckCircle on={!!done} onClick={onToggle} label={done ? "החזרה לרשימה" : "סימון כנקנה"} />
      <button type="button" className={`flex-1 text-start py-3 text-[16px] ${done ? "line-through text-muted" : ""}`} onClick={onToggle}>
        {item.item_name}
      </button>
      <button
        type="button"
        className={`press grid place-items-center w-10 h-10 rounded-xl bg-raised text-[20px] shrink-0 ${done ? "opacity-50 grayscale" : ""}`}
        onClick={onCat}
        aria-label={`קטגוריה: ${shopCat(item.category).label} - שינוי`}
      >
        {iconOf(item.item_name, item.category)}
      </button>
    </li>
  );
}
