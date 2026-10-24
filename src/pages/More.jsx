import { Link } from "react-router-dom";
import { ChevronLeft, LogOut, RotateCcw } from "lucide-react";
import { Page } from "../components/Shell";
import ThemeToggle from "../components/ThemeToggle";
import { NotificationSettings, NutritionVisibility, ProfileName, TabBarSettings } from "../components/Settings";
import { SectionTitle } from "../components/ui";
import { signOut } from "../lib/auth";
import { resetDemo } from "../lib/localBackend";
import { useNutritionHidden } from "../lib/nutritionVisibility";
import { SECTIONS, SECTION_ORDER, effectiveTabs, useTabs } from "../lib/sections";
import { isDemoMode } from "../lib/supabase";

export default function More({ user }) {
  const [tabs] = useTabs();
  const [hidden] = useNutritionHidden();
  const inBar = new Set(effectiveTabs(tabs, hidden));
  // כאן מופיע כל מה שלא בסרגל התחתון (ותזונה רק אם לא הוסתרה)
  const links = SECTION_ORDER.filter((k) => !inBar.has(k) && !(k === "nutrition" && hidden)).map((k) => ({ key: k, ...SECTIONS[k] }));
  return (
    <Page title="עוד" action={<ThemeToggle />}>
      <ul className="card divide-y overflow-hidden">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} state={{ back: "עוד" }} className="press flex items-center gap-3 px-4 min-h-[64px]">
              <span className="grid place-items-center w-10 h-10 rounded-full bg-raised text-fg">
                <l.icon size={19} />
              </span>
              <span className="flex-1">
                <span className="block text-[16px] font-medium">{l.label}</span>
                <span className="block text-[13px] text-muted">{l.hint}</span>
              </span>
              <ChevronLeft size={18} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>

      <SectionTitle>התאמה אישית</SectionTitle>
      <div className="card divide-y overflow-hidden">
        <TabBarSettings />
        <NutritionVisibility user={user} />
      </div>

      {!isDemoMode && <NotificationSettings />}

      <SectionTitle>חשבון</SectionTitle>
      <div className="card divide-y overflow-hidden">
        {!isDemoMode && <ProfileName user={user} />}
        <p className="px-4 py-3 text-[14px] text-muted truncate">{isDemoMode ? "מצב הדגמה - הנתונים נשמרים רק במכשיר הזה" : user?.email}</p>
        {isDemoMode ? (
          <button type="button" className="press w-full flex items-center gap-3 px-4 h-14 text-crit" onClick={resetDemo}>
            <RotateCcw size={18} /> איפוס נתוני ההדגמה
          </button>
        ) : (
          <button type="button" className="press w-full flex items-center gap-3 px-4 h-14 text-crit" onClick={signOut}>
            <LogOut size={18} /> התנתקות
          </button>
        )}
      </div>
    </Page>
  );
}
