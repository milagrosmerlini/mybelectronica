-- Run this in Supabase SQL Editor

create table if not exists public.myb_orders (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.myb_photos (
  id text primary key,
  order_id text not null references public.myb_orders(id) on delete cascade,
  name text,
  data_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists myb_photos_order_id_idx on public.myb_photos(order_id);

create table if not exists public.myb_meta (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.myb_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_myb_orders_updated_at on public.myb_orders;
create trigger trg_myb_orders_updated_at
before update on public.myb_orders
for each row execute function public.myb_touch_updated_at();

drop trigger if exists trg_myb_meta_updated_at on public.myb_meta;
create trigger trg_myb_meta_updated_at
before update on public.myb_meta
for each row execute function public.myb_touch_updated_at();

alter table public.myb_orders enable row level security;
alter table public.myb_photos enable row level security;
alter table public.myb_meta enable row level security;

-- WARNING: Public access policies for anon key usage from static frontend.
-- If you add auth later, tighten these policies.

drop policy if exists "myb_orders_anon_all" on public.myb_orders;
create policy "myb_orders_anon_all"
on public.myb_orders
for all
to anon
using (true)
with check (true);

drop policy if exists "myb_photos_anon_all" on public.myb_photos;
create policy "myb_photos_anon_all"
on public.myb_photos
for all
to anon
using (true)
with check (true);

drop policy if exists "myb_meta_anon_all" on public.myb_meta;
create policy "myb_meta_anon_all"
on public.myb_meta
for all
to anon
using (true)
with check (true);
