import { useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", next === "dark" ? "#0e0e10" : "#f4f4f1"));
    setTheme(next);
  };
  return (
    <button type="button" className="icon-btn" onClick={flip} aria-label={theme === "dark" ? "מצב בהיר" : "מצב כהה"}>
      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
