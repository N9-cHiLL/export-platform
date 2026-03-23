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
  submission_kind text not null default 'upload',
  application_notes text,
  content text,
  -- File uploads (Supabase Storage path under bucket `company-documents`)
  storage_path text,
  original_file_name text,
  mime_type text,
  size_bytes int,
  created_at timestamptz default now(),
  constraint company_documents_submission_kind_check
    check (submission_kind in ('upload', 'apply_for_document'))
);

-- If you already created `company_documents` without these columns, run:
-- app/-- Alter company_documents add file columns.sql
-- app/-- Alter company_documents submission.sql

-- One row per user per required document type (canonical keys only)
drop index if exists company_documents_user_requirement_unique;
create unique index company_documents_user_requirement_unique
  on public.company_documents (user_id, document_type)
  where document_type in (
    'gst_certificate',
    'company_registration_certificate',
    'company_pan',
    'authorized_person_aadhaar'
  );

-- Enable Row Level Security
alter table public.company_details enable row level security;
alter table public.company_documents enable row level security;

-- Policies: drop first so this script is safe to re-run (policies already exist from a previous run)
drop policy if exists company_details_select_own on public.company_details;
drop policy if exists company_details_insert_own on public.company_details;
drop policy if exists company_details_update_own on public.company_details;
drop policy if exists company_documents_select_own on public.company_documents;
drop policy if exists company_documents_insert_own on public.company_documents;
drop policy if exists company_documents_update_own on public.company_documents;
drop policy if exists company_documents_delete_own on public.company_documents;

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

