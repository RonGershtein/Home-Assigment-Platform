-- HomeSync: רכבים. טסט (מהרישוי לפי מספר רכב), היסטוריית טיפולים עם תמונות.
-- הוחל דרך Supabase MCP ב-2026-11-07. התמונות בבאקט vouchers תחת cars/<car_id>/.

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  plate text not null,
  nickname text,
  make text,
  model text,
  year int,
  color text,
  fuel text,
  test_until date,
  last_test date,
  photo_path text,
  photo_url text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.car_services (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id) on delete cascade,
  done_on date not null default current_date,
  kind text not null default 'service',
  km int,
  cost numeric(12, 2),
  garage text,
  notes text not null default '',
  photos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists car_services_car_idx on public.car_services (car_id, done_on desc);

do $$
declare t text;
begin
  foreach t in array array['cars','car_services'] loop
    execute format('drop trigger if exists touch on public.%I', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists household on public.%I', t);
    execute format('create policy household on public.%I for all to authenticated using (true) with check (true)', t);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
