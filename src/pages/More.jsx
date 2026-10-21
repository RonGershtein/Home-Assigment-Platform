import { Link } from "react-router-dom";
import { ChevronLeft, LogOut, RotateCcw } from "lucide-react";
import { Page } from "../components/Shell";
import ThemeToggle from "../components/ThemeToggle";
import { SectionTitle } from "../components/ui";
import { signOut } from "../lib/auth";
import { resetDemo } from "../lib/localBackend";
import { isDemoMode } from "../lib/supabase";

const LINKS = [
  { to: "/vouchers", icon: "🎟️", label: "שוברים", hint: "לפי תוקף, קודים ואתרים" },
  { to: "/gifts", icon: "💌", label: "מתנות חתונה", hint: "מי הגיע וכמה נתן" },
  { to: "/recipes", icon: "🍳", label: "מתכונים", hint: "לינקים ומה אהבנו" },
  { to: "/money", icon: "🏦", label: "חסכונות וחשבונות", hint: 'עו"ש, קופות, פיקדונות' },
  { to: "/budget", icon: "🧾", label: "הכנסות והוצאות", hint: "תקציב חודשי לפי קטגוריות" },
];

export default function More({ user }) {
  return (
    <Page title="עוד" action={<ThemeToggle />}>
      <ul className="card divide-y overflow-hidden">
        {LINKS.map((l) => (
          <li key={l.to}>
            <Link to={l.to} state={{ back: "עוד" }} className="press flex items-center gap-3 px-4 min-h-[64px]">
              <span className="grid place-items-center w-10 h-10 rounded-full bg-raised text-xl">{l.icon}</span>
              <span className="flex-1">
                <span className="block text-[16px] font-medium">{l.label}</span>
                <span className="block text-[13px] text-muted">{l.hint}</span>
              </span>
              <ChevronLeft size={18} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>

      <SectionTitle>חשבון</SectionTitle>
      <div className="card divide-y overflow-hidden">
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
