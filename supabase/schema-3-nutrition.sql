-- HomeSync שלב 3: תזונה - מעקב משקל, פרופיל גוף (BMI / BMR / יעד קלוריות), יומן אוכל והתראות.
-- מריצים פעם אחת ב-Supabase → SQL Editor (בטוח להריץ שוב).

-- פרופיל תזונה: אחד לכל משתמש. share = בן/בת הזוג רואים את המשקל והאוכל שלי.
create table if not exists public.nutrition_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  height_cm numeric(5, 1),
  birth_date date,
  sex text check (sex in ('male', 'female')),
  activity text not null default 'light' check (activity in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text not null default 'maintain' check (goal in ('lose', 'maintain', 'gain')),
  goal_weight_kg numeric(5, 2),
  weekly_rate_kg numeric(4, 2) not null default 0.5,
  calorie_target integer,                       -- יעד ידני; null = מחושב מ-BMR
  share boolean not null default true,          -- משותף עם הבית
  daily_prompt boolean not null default true,   -- שאלת המשקל במסך הבית כל יום
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- שקילה: רשומה אחת ליום לכל אדם (שקילה נוספת באותו יום מעדכנת)
create table if not exists public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null default current_date,
  weight_kg numeric(5, 2) not null check (weight_kg > 20 and weight_kg < 400),
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);
create index if not exists weight_entries_user_day on public.weight_entries (user_id, day desc);

-- יומן אוכל
create table if not exists public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null default current_date,
  meal text not null default 'snack' check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null,
  kcal integer not null default 0 check (kcal >= 0),
  protein_g numeric(6, 1),
  qty numeric(6, 2) not null default 1,
  unit text,
  food_key text,                                -- מזהה במאגר המזון (ל"אכלת לאחרונה")
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists food_entries_user_day on public.food_entries (user_id, day desc);

-- מי רואה את הנתונים של מי: שלי תמיד, של בן/בת הזוג רק אם הפעילו שיתוף (ברירת מחדל: כן)
create or replace function public.nutrition_visible(owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select owner = auth.uid() or coalesce((select share from public.nutrition_profiles where user_id = owner), true);
$$;

do $$
declare t text;
begin
  foreach t in array array['nutrition_profiles', 'weight_entries', 'food_entries'] loop
    execute format('drop trigger if exists touch on public.%I', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

drop policy if exists read_visible on public.nutrition_profiles;
drop policy if exists own_write on public.nutrition_profiles;
drop policy if exists own_update on public.nutrition_profiles;
drop policy if exists own_delete on public.nutrition_profiles;
create policy read_visible on public.nutrition_profiles for select to authenticated using (public.nutrition_visible(user_id));
create policy own_write on public.nutrition_profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy own_update on public.nutrition_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_delete on public.nutrition_profiles for delete to authenticated using (user_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['weight_entries', 'food_entries'] loop
    execute format('drop policy if exists read_visible on public.%I', t);
    execute format('drop policy if exists own_write on public.%I', t);
    execute format('drop policy if exists own_update on public.%I', t);
    execute format('drop policy if exists own_delete on public.%I', t);
    execute format('create policy read_visible on public.%I for select to authenticated using (public.nutrition_visible(user_id))', t);
    execute format('create policy own_write on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy own_update on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy own_delete on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- התראת ערב (יומן אוכל): 17:00 UTC = 19:00/20:00 בישראל. תזכורת השקילה נשלחת עם ה-daily של הבוקר.
select cron.schedule('notify-evening', '0 17 * * *', $$select public.call_notify('evening')$$);
