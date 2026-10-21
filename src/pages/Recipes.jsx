import { useMemo, useState } from "react";
import { ExternalLink, Loader2, Plus } from "lucide-react";
import { Page } from "../components/Shell";
import Sheet from "../components/Sheet";
import { DeleteButton, Empty, Fab, Field, SearchField, Skeletons } from "../components/ui";
import { useTable } from "../hooks/useTable";
import { RECIPE_VERDICTS, verdictOf } from "../lib/catalog";
import { BackLink } from "./Vouchers";

const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export default function Recipes() {
  const recipes = useTable("recipes");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null);

  const counts = useMemo(() => {
    const c = {};
    for (const r of recipes.rows) c[r.verdict || "try"] = (c[r.verdict || "try"] || 0) + 1;
    return c;
  }, [recipes.rows]);

  const list = useMemo(() => {
    const term = q.trim();
    return recipes.rows.filter(
      (r) => (filter === "all" || (r.verdict || "try") === filter) && (!term || r.title?.includes(term) || r.description?.includes(term))
    );
  }, [recipes.rows, q, filter]);

  return (
    <Page title="מתכונים" back={<BackLink />}>
      {recipes.rows.length > 4 && <SearchField value={q} onChange={setQ} placeholder="חיפוש מתכון" />}
      <div className="hscroll mt-3">
        <button type="button" className="chip" data-on={filter === "all"} onClick={() => setFilter("all")}>
          הכל <span className="num opacity-60">{recipes.rows.length}</span>
        </button>
        {RECIPE_VERDICTS.map((v) => (
          <button key={v.key} type="button" className="chip" data-on={filter === v.key} onClick={() => setFilter(v.key)}>
            {v.icon} {v.label} {counts[v.key] ? <span className="num opacity-60">{counts[v.key]}</span> : null}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {recipes.loading ? (
          <Skeletons n={4} h={88} />
        ) : list.length === 0 ? (
          <Empty icon="🍳" title="אין מתכונים כאן" text="מדביקים לינק למתכון - הכותרת והתמונה נשלפות לבד." />
        ) : (
          <ul className="grid grid-cols-2 gap-2 stagger">
            {list.map((r) => {
              const v = verdictOf(r.verdict);
              return (
                <li key={r.id} className="card overflow-hidden flex flex-col">
                  <button type="button" className="press text-start flex-1 flex flex-col" onClick={() => setEditing(r)}>
                    <div className="aspect-[4/3] bg-raised relative">
                      {r.image_url ? (
                        <img src={r.image_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-4xl opacity-60">🍽️</div>
                      )}
                      <span className="absolute top-2 start-2 h-7 px-2 rounded-full bg-black/55 text-white text-[12px] font-medium flex items-center gap-1 backdrop-blur">
                        {v.icon} {v.label}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-[15px] font-semibold leading-snug line-clamp-2">{r.title}</p>
                      {r.description && <p className="text-[13px] text-muted mt-1 line-clamp-2">{r.description}</p>}
                    </div>
                  </button>
                  {r.link && (
                    <a href={r.link} target="_blank" rel="noreferrer" className="press mx-3 mb-3 mt-auto h-9 rounded-xl bg-raised flex items-center justify-center gap-1.5 text-[13px] text-muted">
                      <ExternalLink size={14} /> {host(r.link) || "פתיחה"}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Fab onClick={() => setEditing({})} label="מתכון" icon={<Plus size={20} strokeWidth={2.6} />} />

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "עריכת מתכון" : "מתכון חדש"}>
        {editing && (
          <RecipeForm
            key={editing.id || "new"}
            r={editing}
            onSave={async (values) => {
              if (editing.id) await recipes.update(editing.id, values);
              else await recipes.create(values);
              setEditing(null);
            }}
            onDelete={
              editing.id &&
              (async () => {
                await recipes.remove(editing.id);
                setEditing(null);
              })
            }
          />
        )}
      </Sheet>
    </Page>
  );
}

function RecipeForm({ r, onSave, onDelete }) {
  const [f, setF] = useState({ title: r.title || "", link: r.link || "", description: r.description || "", image_url: r.image_url || "", verdict: r.verdict || "try" });
  const [fetching, setFetching] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function preview(link) {
    if (!/^https?:\/\//i.test(link)) return;
    setFetching(true);
    try {
      const res = await fetch(`/api/preview?url=${encodeURIComponent(link)}`);
      if (!res.ok) return;
      const p = await res.json();
      setF((prev) => ({ ...prev, title: prev.title || p.title || "", image_url: prev.image_url || p.image || "" }));
    } catch {
      // בלי תצוגה מקדימה - ממלאים ידנית
    } finally {
      setFetching(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (f.title.trim()) onSave({ ...f, title: f.title.trim(), link: f.link.trim(), description: f.description.trim(), image_url: f.image_url.trim() });
      }}
    >
      <Field label="לינק למתכון">
        <div className="relative">
          <input
            className="field pe-11"
            dir="ltr"
            type="url"
            inputMode="url"
            value={f.link}
            onChange={set("link")}
            onBlur={() => preview(f.link.trim())}
            onPaste={(e) => preview(e.clipboardData.getData("text").trim())}
            placeholder="https://"
            autoFocus={!r.id}
          />
          {fetching && <Loader2 size={18} className="absolute top-1/2 -translate-y-1/2 end-4 animate-spin text-muted" />}
        </div>
      </Field>
      {f.image_url && <img src={f.image_url} alt="" className="w-full aspect-[16/9] object-cover rounded-2xl bg-raised" onError={() => setF((p) => ({ ...p, image_url: "" }))} />}
      <Field label="שם">
        <input className="field" value={f.title} onChange={set("title")} placeholder="עוגיות חמאה" />
      </Field>
      <div>
        <span className="label">איך יצא?</span>
        <div className="grid grid-cols-4 gap-2">
          {RECIPE_VERDICTS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setF((p) => ({ ...p, verdict: v.key }))}
              className={`press rounded-2xl py-3 flex flex-col items-center gap-1 text-[13px] ${f.verdict === v.key ? "bg-accent text-accent-ink font-semibold" : "bg-raised"}`}
            >
              <span className="text-xl">{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <Field label="הערות">
        <textarea className="field" rows={3} value={f.description} onChange={set("description")} placeholder="מה לשנות בפעם הבאה…" />
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
