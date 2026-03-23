-- Merchant requirement posts (Exploring Opportunities — global marketplace board)
-- Run in Supabase SQL editor after auth and profiles exist.

create extension if not exists pgcrypto;

create table if not exists public.merchant_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  product_category text,
  region_or_country text,
  quantity_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint merchant_requirements_title_len check (char_length(trim(title)) >= 3),
  constraint merchant_requirements_desc_len check (char_length(trim(description)) >= 10)
);

create index if not exists merchant_requirements_created_at_idx
  on public.merchant_requirements (created_at desc);

alter table public.merchant_requirements enable row level security;

drop policy if exists merchant_requirements_select_public on public.merchant_requirements;
drop policy if exists merchant_requirements_insert_own on public.merchant_requirements;
drop policy if exists merchant_requirements_update_own on public.merchant_requirements;
drop policy if exists merchant_requirements_delete_own on public.merchant_requirements;

-- Anyone can browse listings (including anonymous) for discovery
create policy merchant_requirements_select_public on public.merchant_requirements
  for select
  using (true);

-- Authenticated users post only as themselves
create policy merchant_requirements_insert_own on public.merchant_requirements
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy merchant_requirements_update_own on public.merchant_requirements
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy merchant_requirements_delete_own on public.merchant_requirements
  for delete
  to authenticated
  using (auth.uid() = user_id);
