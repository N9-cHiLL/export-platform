-- Add submission tracking for required documents (upload vs apply for document)
-- Run in Supabase SQL Editor after base `company_documents` exists.

alter table public.company_documents
  add column if not exists submission_kind text default 'upload';

alter table public.company_documents
  add column if not exists application_notes text;

-- Normalize legacy rows
update public.company_documents
set submission_kind = 'upload'
where submission_kind is null;

alter table public.company_documents
  alter column submission_kind set not null;

alter table public.company_documents
  drop constraint if exists company_documents_submission_kind_check;

alter table public.company_documents
  add constraint company_documents_submission_kind_check
  check (submission_kind in ('upload', 'apply_for_document'));

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
