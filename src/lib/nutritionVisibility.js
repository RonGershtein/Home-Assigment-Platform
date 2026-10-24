import { useEffect, useState } from "react";

// הסתרת "תזונה ומשקל" מהאפליקציה: נשמר במכשיר (localStorage). ביחד עם כיבוי שאלת המשקל והתזכורות
// (שנשמרים בשרת) זה מכבה את כל מה שקשור לדיאטה בלי למחוק נתונים.
const KEY = "homesync:nutrition-hidden";
const EVENT = "nutrition-hidden-change";

export function isNutritionHidden() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setNutritionHidden(hidden) {
  try {
    if (hidden) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function useNutritionHidden() {
  const [hidden, setHidden] = useState(isNutritionHidden);
  useEffect(() => {
    const sync = () => setHidden(isNutritionHidden());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return [hidden, setNutritionHidden];
}
