# הבית (HomeSync)

ניהול הבית לאייפון: קניות, מטלות, שוברים, מתנות חתונה, מתכונים, חסכונות וחשבונות, הכנסות והוצאות, ותזונה (משקל, יומן אוכל, BMI ויעד קלוריות).
React + Vite + Tailwind, Supabase (DB, התחברות ועדכונים חיים), Vercel.

## הרצה מקומית
```bash
npm install
cp .env.example .env   # VITE_DEMO_MODE=true = נתוני הדגמה בדפדפן, בלי Supabase
npm run dev
```

## חיבור ל-Supabase
1. יוצרים פרויקט ב-supabase.com ומריצים את `supabase/schema.sql` ב-SQL Editor.
2. Authentication → Users → יוצרים משתמש לכל אחד מבני הבית (ומכבים הרשמה ציבורית: Authentication → Sign In / Providers → Allow new users to sign up).
3. ממלאים ב-`.env` את `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` ו-`SUPABASE_SERVICE_ROLE_KEY`.
4. העברת הנתונים מ-Base44: `npm run import:base44 -- --dry` לבדיקה, ואז `npm run import:base44`.
   הקבצים נמצאים ב-`data/base44-export/` (לא נכנסים ל-git).

## פריסה ל-Vercel
מייבאים את הריפו ב-Vercel, ומגדירים Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
באייפון: Safari → שיתוף → "הוספה למסך הבית".

## תזונה (שלב 3)
מסך "תזונה" (עוד ← תזונה) עם שלושה טאבים:
- **משקל** - שקילה יומית עם גרף (נקודות + ממוצע נע של 7 ימים + קו יעד), מגמה שבועית, זמן משוער ליעד, רצף, היסטוריה עם שם הרושם/ת,
  ותצוגת "שנינו" (קו לכל אחד). במסך הבית מופיעה כל יום שאלת "כמה את/ה שוקל/ת היום?" עד שרושמים.
- **אוכל** - יומן יומי לפי ארוחות עם טבעת קלוריות מול היעד, חלבון, מאגר של ~165 מאכלים ישראליים (`src/lib/foods.js`),
  "אכלת לאחרונה", הוספה ידנית, רישום לימים קודמים וגרף 7 ימים.
- **הגוף שלי** - BMI (מד WHO), BMR לפי Mifflin-St Jeor, תחזוקה (TDEE) ויעד קלוריות לפי המטרה והקצב, עם רצפה בטיחותית
  (1,200 / 1,500 קק"ל) וטווח חלבון. הנוסחאות ב-`src/lib/nutrition.js`.

**פרטיות:** כל אחד רואה את שלו תמיד; "לשתף עם הבית" (בטאב משקל) קובע אם בן/בת הזוג רואים את המשקל והאוכל שלך. נאכף ב-RLS.

**התראות:** "שקילה יומית" (בבוקר, אם אין רשומה להיום) ו"יומן אוכל" (סיכום ערב). מפעילים מתוך הטאב או ב"עוד ← התראות".

התקנה:
1. Supabase → SQL Editor → להריץ את `supabase/schema-3-nutrition.sql`.
2. לפרוס מחדש את פונקציית ההתראות: `npx supabase functions deploy notify --project-ref nzxtivlplxqudctmnufi`
   (או דרך Supabase MCP / הדשבורד).
