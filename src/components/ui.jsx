import { useEffect, useRef, useState } from "react";
import { Check, Search, Trash2, X } from "lucide-react";

export function Segmented({ value, onChange, options, className = "" }) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={`relative grid bg-raised rounded-full p-1 no-select ${className}`} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }} role="tablist">
      <div
        className="absolute top-1 bottom-1 rounded-full bg-card dark:bg-hover transition-transform duration-[260ms] ease-[var(--ease-in-out)]"
        style={{ width: `calc((100% - 8px) / ${options.length})`, insetInlineStart: 4, transform: `translateX(${-i * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`relative h-9 rounded-full text-[14px] font-medium transition-colors duration-200 ${o.value === value ? "text-fg" : "text-muted"}`}
        >
          {o.label}
          {o.count != null && <span className="num opacity-60 ms-1">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

// סימון עם השהיה קצרה לאנימציית היציאה (.leaving) לפני שהפריט עובר רשימה
export function useLeaving(ms = 380) {
  const [ids, setIds] = useState(() => new Set());
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const leave = (id, fn) => {
    if (ids.has(id)) return;
    setIds((s) => new Set(s).add(id));
    timers.current.push(
      setTimeout(async () => {
        try {
          await fn();
        } finally {
          setIds((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
        }
      }, ms)
    );
  };
  return [ids, leave];
}

// מתג בסגנון iOS
export function Switch({ on, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`press relative w-[52px] h-8 rounded-full shrink-0 transition-colors duration-200 disabled:opacity-40 ${on ? "bg-accent" : "bg-hover"}`}
    >
      <span
        className="absolute top-1 start-1 w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
        style={{ transform: on ? "translateX(-20px)" : "translateX(0)" }}
      />
    </button>
  );
}

export function CheckCircle({ on, onClick, label }) {
  return (
    <button type="button" className="check" data-on={on} onClick={onClick} aria-pressed={on} aria-label={label}>
      <Check size={16} strokeWidth={3} />
    </button>
  );
}

export function Empty({ icon, title, text, action }) {
  return (
    <div className="rise flex flex-col items-center text-center py-14 px-6">
      <div className="grid place-items-center w-16 h-16 rounded-full bg-card text-muted mb-4">{icon}</div>
      <p className="text-[17px] font-semibold">{title}</p>
      {text && <p className="text-muted text-[14px] mt-1 max-w-[30ch]">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = "חיפוש" }) {
  return (
    <div className="relative">
      <Search size={18} className="absolute top-1/2 -translate-y-1/2 start-4 text-muted pointer-events-none" />
      <input
        type="search"
        enterKeyHint="search"
        className="field ps-11 pe-10 bg-card"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button type="button" className="icon-btn absolute top-1/2 -translate-y-1/2 end-1" onClick={() => onChange("")} aria-label="ניקוי">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

// מחיקה בשתי נגיעות: הראשונה "מחמשת", השנייה מוחקת. בלי חלון אישור קופץ
export function DeleteButton({ onConfirm, label = "מחיקה", className = "" }) {
  const [armed, setArmed] = useState(false);
  const t = useRef();
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button
      type="button"
      className={`btn ${armed ? "bg-crit text-white" : "btn-danger"} ${className}`}
      onClick={() => {
        if (armed) return onConfirm();
        setArmed(true);
        clearTimeout(t.current);
        t.current = setTimeout(() => setArmed(false), 3000);
      }}
    >
      <Trash2 size={17} />
      {armed ? "לחצו שוב למחיקה" : label}
    </button>
  );
}

export function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function SectionTitle({ children, right, className = "" }) {
  return (
    <div className={`flex items-center justify-between mt-7 mb-2.5 px-1 ${className}`}>
      <h2 className="text-[15px] font-semibold text-muted">{children}</h2>
      {right}
    </div>
  );
}

export function Skeletons({ n = 4, h = 64 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: h }} />
      ))}
    </div>
  );
}

export function Fab({ onClick, label, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="press fixed z-30 end-5 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+16px)] h-14 ps-5 pe-6 rounded-full bg-accent text-accent-ink font-semibold shadow-float flex items-center gap-2 text-[15px]"
    >
      {icon}
      {label}
    </button>
  );
}
