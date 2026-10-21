-- HomeSync - סכמת Supabase. מריצים פעם אחת ב-SQL Editor.
-- אפליקציה של משק בית אחד: כל משתמש מחובר (אתם שניים) רואה ועורך הכל.

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text not null default 'other',
  is_purchased boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.item_categories (
  id uuid primary key default gen_random_uuid(),
  item_name text not null unique,
  category text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  is_done boolean not null default false,
  size text not null default 'small' check (size in ('small', 'big')),
  due_date date,
  notes text default '',
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  voucher_type text not null default 'cash' check (voucher_type in ('cash', 'gift')),
  amount numeric(12, 2),
  gift_description text,
  expiry_date date,
  voucher_code text,
  store_url text,
  status text not null default 'active' check (status in ('active', 'used')),
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  giver_name text not null,
  guest_count integer not null default 0,
  amount numeric(12, 2) not null default 0,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  link text default '',
  description text default '',
  image_url text default '',
  verdict text not null default 'try' check (verdict in ('loved', 'ok', 'no', 'try')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'checking',
  institution text default '',
  owner text default '',
  balance numeric(14, 2) not null default 0,
  balance_updated_at timestamptz,
  archived boolean not null default false,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  balance numeric(14, 2) not null,
  taken_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, taken_on)
);

create table if not exists public.tx_categories (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income', 'expense')),
  name text not null,
  icon text default '🏷️',
  monthly_budget numeric(12, 2),
  sort integer default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(12, 2) not null check (amount >= 0),
  date date not null default current_date,
  category_id uuid references public.tx_categories (id) on delete set null,
  description text default '',
  method text,
  recurring boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists transactions_date_idx on public.transactions (date);

do $$
declare t text;
begin
  foreach t in array array['shopping_items','item_categories','tasks','vouchers','gifts','recipes','accounts','account_snapshots','tx_categories','transactions'] loop
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

-- קטגוריות ברירת מחדל להכנסות והוצאות
insert into public.tx_categories (kind, name, icon, monthly_budget, sort)
select * from (values
  ('expense', 'סופר ומזון', '🛒', 3000, 1), ('expense', 'דיור ושכירות', '🏠', null, 2), ('expense', 'חשבונות', '💡', 800, 3),
  ('expense', 'רכב ודלק', '🚗', 1200, 4), ('expense', 'מסעדות ויציאות', '🍕', 800, 5), ('expense', 'קניות', '🛍️', null, 6),
  ('expense', 'בריאות', '💊', null, 7), ('expense', 'מנויים', '📺', 200, 8), ('expense', 'מתנות ואירועים', '🎁', null, 9),
  ('expense', 'חופשות', '✈️', null, 10), ('expense', 'אחר', '📦', null, 99),
  ('income', 'משכורת', '💼', null, 1), ('income', 'מילואים', '🎖️', null, 2), ('income', 'החזרים', '↩️', null, 3), ('income', 'אחר', '✨', null, 99)
) as v(kind, name, icon, monthly_budget, sort)
where not exists (select 1 from public.tx_categories);
