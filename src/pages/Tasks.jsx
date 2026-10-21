import { useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Page } from "../components/Shell";
import Sheet from "../components/Sheet";
import { CheckCircle, DeleteButton, Empty, Fab, Field, Segmented, Skeletons } from "../components/ui";
import { useTable } from "../hooks/useTable";
import { daysUntil, fmtDate, relDays } from "../lib/format";

const SIZES = [
  { value: "small", label: "קטנה", hint: "דקות עד שעה" },
  { value: "big", label: "גדולה", hint: "פרויקט / דורש תכנון" },
];
const FILTERS = [
  { value: "all", label: "הכל" },
  { value: "small", label: "⚡ קטנות" },
  { value: "big", label: "🏗️ גדולות" },
];

export default function Tasks() {
  const tasks = useTable("tasks");
  const [view, setView] = useState("open");
  const [size, setSize] = useState("all");
  const [editing, setEditing] = useState(null); // {} = חדש

  const open = tasks.rows.filter((t) => !t.is_done);
  const done = tasks.rows.filter((t) => t.is_done);

  const list = useMemo(() => {
    const base = (view === "open" ? open : done).filter((t) => size === "all" || (t.size || "small") === size);
    if (view === "done") return base.sort((a, b) => (b.done_at || b.updated_at || "").localeCompare(a.done_at || a.updated_at || ""));
    // פתוחות: עם תאריך יעד קודם (הקרוב ראשון), אחר כך לפי זמן יצירה
    return base.sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return (b.created_at || "").localeCompare(a.created_at || "");
    });
  }, [view, size, open, done]);

  const toggle = (t) => tasks.update(t.id, { is_done: !t.is_done, done_at: t.is_done ? null : new Date().toISOString() });

  return (
    <Page title="מטלות" subtitle={`${open.length} פתוחות · ${open.filter((t) => t.size === "big").length} גדולות`}>
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: "open", label: "פתוחות", count: open.length },
          { value: "done", label: "בוצעו", count: done.length },
        ]}
      />
      <div className="hscroll mt-3">
        {FILTERS.map((s) => (
          <button key={s.value} type="button" className="chip" data-on={size === s.value} onClick={() => setSize(s.value)}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tasks.loading ? (
          <Skeletons n={4} />
        ) : list.length === 0 ? (
          view === "open" ? (
            <Empty icon="✨" title="הכל סגור" text="אין מטלות פתוחות. זמן לקפה." />
          ) : (
            <Empty icon="📋" title="עוד לא סיימתם כלום" text="מטלות שמסמנים כבוצעו יופיעו כאן." />
          )
        ) : (
          <ul className="space-y-2 stagger">
            {list.map((t) => {
              const d = daysUntil(t.due_date);
              const late = !t.is_done && d != null && d < 0;
              const soon = !t.is_done && d != null && d >= 0 && d <= 3;
              return (
                <li key={t.id} className="card flex items-start gap-3 p-4">
                  <div className="pt-0.5">
                    <CheckCircle on={t.is_done} onClick={() => toggle(t)} label={t.is_done ? "החזרה לפתוחות" : "סימון כבוצעה"} />
                  </div>
                  <button type="button" className="flex-1 text-start min-w-0" onClick={() => setEditing(t)}>
                    <p className={`text-[16px] leading-snug ${t.is_done ? "line-through text-muted" : "font-medium"}`}>{t.title}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[13px] text-muted">
                      <span>{t.size === "big" ? "🏗️ גדולה" : "⚡ קטנה"}</span>
                      {t.due_date && (
                        <span className={`flex items-center gap-1 ${late ? "text-crit font-medium" : soon ? "text-warn font-medium" : ""}`}>
                          <CalendarDays size={13} />
                          {fmtDate(t.due_date)} · {relDays(d)}
                        </span>
                      )}
                    </div>
                    {t.notes && <p className="text-[14px] text-muted mt-1.5 line-clamp-2">{t.notes}</p>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Fab onClick={() => setEditing({})} label="מטלה" icon={<Plus size={20} strokeWidth={2.6} />} />

      <TaskSheet
        task={editing}
        onClose={() => setEditing(null)}
        onSave={async (values) => {
          if (editing?.id) await tasks.update(editing.id, values);
          else await tasks.create({ ...values, is_done: false });
          setEditing(null);
        }}
        onDelete={async () => {
          await tasks.remove(editing.id);
          setEditing(null);
        }}
      />
    </Page>
  );
}

function TaskSheet({ task, onClose, onSave, onDelete }) {
  const isNew = task && !task.id;
  return (
    <Sheet open={!!task} onClose={onClose} title={isNew ? "מטלה חדשה" : "עריכת מטלה"}>
      {task && <TaskForm key={task.id || "new"} task={task} onSave={onSave} onDelete={isNew ? null : onDelete} />}
    </Sheet>
  );
}

function TaskForm({ task, onSave, onDelete }) {
  const [title, setTitle] = useState(task.title || "");
  const [size, setSize] = useState(task.size || "small");
  const [due, setDue] = useState(task.due_date || "");
  const [notes, setNotes] = useState(task.notes || "");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSave({ title: title.trim(), size, due_date: due || null, notes: notes.trim() });
      }}
    >
      <Field label="מה צריך לעשות?">
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!task.id} placeholder="לתקן את הברז" enterKeyHint="done" />
      </Field>
      <div>
        <span className="label">גודל</span>
        <div className="grid grid-cols-2 gap-2">
          {SIZES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSize(s.value)}
              className={`press rounded-2xl p-3 text-start ${size === s.value ? "bg-accent text-accent-ink" : "bg-raised"}`}
            >
              <p className="font-semibold">{s.value === "big" ? "🏗️" : "⚡"} {s.label}</p>
              <p className="text-[12px] opacity-75 mt-0.5">{s.hint}</p>
            </button>
          ))}
        </div>
      </div>
      <Field label="תאריך יעד (לא חובה)">
        <input type="date" className="field" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <Field label="הערות">
        <textarea className="field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="פרטים, מספרי טלפון, לינקים…" />
      </Field>
      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn btn-primary flex-1" disabled={!title.trim()}>
          שמירה
        </button>
        {onDelete && <DeleteButton onConfirm={onDelete} label="" />}
      </div>
    </form>
  );
}
