import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, House, LayoutGrid } from "lucide-react";
import { SECTIONS, effectiveTabs, useTabs } from "../lib/sections";
import { useNutritionHidden } from "../lib/nutritionVisibility";

const HOME = { to: "/", label: "בית", icon: House, end: true };
const MORE = { to: "/more", label: "עוד", icon: LayoutGrid };

// הסרגל התחתון: בית ו"עוד" קבועים, שלושת האמצעיים נבחרים ב"עוד ← הסרגל התחתון"
export function TabBar() {
  const { pathname } = useLocation();
  const [chosen] = useTabs();
  const [hidden] = useNutritionHidden();
  const middle = effectiveTabs(chosen, hidden).map((k) => ({ key: k, ...SECTIONS[k] }));
  // הטאב הפעיל: ההתאמה הארוכה ביותר; מה שלא שייך לאף טאב - "עוד"
  const activeTo = (() => {
    if (pathname === "/") return "/";
    let best = null;
    for (const t of middle) for (const m of t.match ?? [t.to]) if (pathname.startsWith(m) && (!best || m.length > best.len)) best = { to: t.to, len: m.length };
    return best?.to ?? "/more";
  })();
  const TABS = [HOME, ...middle, MORE];
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-bg/80 backdrop-blur-xl border-t"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="ניווט ראשי"
    >
      <div className="mx-auto max-w-xl grid grid-cols-5 h-[var(--tabbar-h)]">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = activeTo === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={`press no-select flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-200 ${active ? "text-fg" : "text-muted"}`}
            >
              <span className={`grid place-items-center h-8 w-14 rounded-full transition-colors duration-200 ${active ? "bg-accent text-accent-ink" : ""}`}>
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              </span>
              {label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

// חזרה למסך שממנו הגענו (קישורים מהבית / "עוד" שומרים את שמו ב-state).
// בלי state: אם יש fallback - קישור אליו, אחרת אין כפתור (הגענו מסרגל הטאבים)
export function BackButton({ fallback }) {
  const { state } = useLocation();
  const nav = useNavigate();
  const cls = "press flex items-center gap-0.5 text-[16px] text-accent-text font-medium -ms-1 h-10";
  if (state?.back)
    return (
      <button type="button" className={cls} onClick={() => nav(-1)}>
        <ChevronRight size={22} /> {state.back}
      </button>
    );
  if (!fallback) return null;
  return (
    <Link to={fallback.to} className={cls}>
      <ChevronRight size={22} /> {fallback.label}
    </Link>
  );
}

// כותרת גדולה בסגנון iOS; בגלילה מופיעה כותרת קומפקטית דביקה
export function Page({ title, subtitle, action, children, back }) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+96px)]">
      <div
        className={`fixed top-0 inset-x-0 z-30 transition-[opacity,transform] duration-200 ease-out ${compact ? "opacity-100" : "opacity-0 -translate-y-1 pointer-events-none"}`}
        aria-hidden={!compact}
      >
        <div className="bg-bg/80 backdrop-blur-xl border-b" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="mx-auto max-w-xl h-12 px-4 grid grid-cols-[1fr_auto_1fr] items-center">
            <div>{back}</div>
            <p className="text-[16px] font-semibold text-center truncate">{title}</p>
            <div className="flex justify-end">{action}</div>
          </div>
        </div>
      </div>

      <header className="pt-[calc(env(safe-area-inset-top)+12px)] mb-4">
        <div className="flex items-center justify-between h-10">
          <div>{back}</div>
          <div className="flex items-center gap-1">{action}</div>
        </div>
        <h1 className="text-[34px] leading-[1.1] font-bold tracking-tight mt-1">{title}</h1>
        {subtitle && <p className="text-muted text-[15px] mt-1">{subtitle}</p>}
      </header>
      {children}
    </div>
  );
}
