-- HomeSync שלב 2: מתנות שנתנו, התראות push, תמונות ויתרה לשוברים, כמויות בקניות.
-- הוחל דרך Supabase MCP ב-2026-10-21. סודות ה-VAPID וה-cron נשמרים ב-Vault ולא כאן:
--   vault.create_secret('<public>', 'vapid_public'); vault.create_secret('<private>', 'vapid_private'); vault.create_secret('<random>', 'cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shopping_items
  add column if not exists quantity numeric(8, 2) not null default 1,
  add column if not exists unit text,
  add column if not exists created_by uuid default auth.uid() references auth.users (id) on delete set null;

alter table public.vouchers
  add column if not exists balance numeric(12, 2),
  add column if not exists image_path text;

create table if not exists public.given_gifts (
  id uuid primary key default gen_random_uuid(),
  person text not null,
  event_type text not null default 'wedding'
    check (event_type in ('wedding', 'brit', 'bar_mitzvah', 'bat_mitzvah', 'birthday', 'engagement', 'birth', 'housewarming', 'other')),
  event_date date not null default current_date,
  amount numeric(12, 2) not null default 0,
  method text,
  notes text default '',
  gift_id uuid references public.gifts (id) on delete set null,
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  prefs jsonb not null default '{"vouchers": true, "tasks": true, "shopping": true}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notify_log (key text primary key, sent_at timestamptz not null default now());

-- RLS: given_gifts למשק הבית; profiles קריאה לכולם, כתיבה לעצמי; push_subscriptions רק שלי; notify_log לשרת בלבד
alter table public.profiles enable row level security;
alter table public.given_gifts enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notify_log enable row level security;
create policy household on public.given_gifts for all to authenticated using (true) with check (true);
create policy read_all on public.profiles for select to authenticated using (true);
create policy own_write on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy own_update on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own on public.push_subscriptions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- תמונות שוברים: באקט פרטי
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vouchers', 'vouchers', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

-- הפונקציה notify (supabase/functions/notify) קוראת לסודות דרך push_config(), זמינה רק ל-service_role
create or replace function public.push_config() returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_object_agg(name, decrypted_secret) from vault.decrypted_secrets where name in ('vapid_public', 'vapid_private', 'cron_secret');
$$;
revoke all on function public.push_config() from public, anon, authenticated;
grant execute on function public.push_config() to service_role;

create or replace function public.call_notify(kind text) returns bigint language sql security definer set search_path = '' as $$
  select net.http_post(
    url := 'https://nzxtivlplxqudctmnufi.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := jsonb_build_object('kind', kind),
    timeout_milliseconds := 20000);
$$;
revoke all on function public.call_notify(text) from public, anon, authenticated;

select cron.schedule('notify-daily', '0 6 * * *', $$select public.call_notify('daily')$$);
select cron.schedule('notify-shopping', '*/2 * * * *', $$select public.call_notify('shopping')$$);
select cron.schedule('notify-log-cleanup', '30 3 * * 0', $$delete from public.notify_log where sent_at < now() - interval '60 days'$$);
