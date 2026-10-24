-- HomeSync שלב 4: תאריך יעד למשקל ("עד מתי"). מריצים פעם אחת ב-Supabase → SQL Editor (בטוח להריץ שוב).
alter table public.nutrition_profiles add column if not exists goal_date date;
