# הבית (HomeSync)

ניהול הבית לאייפון: קניות, מטלות, שוברים, מתנות חתונה, מתכונים, חסכונות וחשבונות, והכנסות והוצאות.
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
