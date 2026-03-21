-- Create profiles table
create table if not exists public.profiles (
  user_id uuid primary key,
  email text,
  name text,
  mobile text,
  industry text,
  updated_at timestamptz default now()
);

-- Create user_journey table
create table if not exists public.user_journey (
  user_id uuid primary key,
  current_step int,
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.user_journey enable row level security;

-- Profiles policies (authenticated users can manage only their row)
create policy profiles_select_own on public.profiles
  for select
  using (auth.uid() = user_id);

create policy profiles_insert_own on public.profiles
  for insert
  with check (auth.uid() = user_id);

create policy profiles_update_own on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- User_journey policies (authenticated users can manage only their row)
create policy journey_select_own on public.user_journey
  for select
  using (auth.uid() = user_id);

create policy journey_insert_own on public.user_journey
  for insert
  with check (auth.uid() = user_id);

create policy journey_update_own on public.user_journey
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);