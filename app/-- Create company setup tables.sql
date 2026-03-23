-- Create company setup tables for step 2 ("Company Setup")
-- Run this in your Supabase SQL editor (or include in your migration workflow).

-- Company core details (one per user)
create table if not exists public.company_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_name text,
  industry text,
  country text,
  address text,
  website text,
  tax_id text,
  incorporation_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Company documents (store pasted/extracted text for MVP)
create extension if not exists pgcrypto;

create table if not exists public.company_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  document_type text,
  content text,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.company_details enable row level security;
alter table public.company_documents enable row level security;

-- Policies: authenticated users can manage only their row
create policy company_details_select_own on public.company_details
  for select
  using (auth.uid() = user_id);

create policy company_details_insert_own on public.company_details
  for insert
  with check (auth.uid() = user_id);

create policy company_details_update_own on public.company_details
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy company_documents_select_own on public.company_documents
  for select
  using (auth.uid() = user_id);

create policy company_documents_insert_own on public.company_documents
  for insert
  with check (auth.uid() = user_id);

create policy company_documents_update_own on public.company_documents
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy company_documents_delete_own on public.company_documents
  for delete
  using (auth.uid() = user_id);

