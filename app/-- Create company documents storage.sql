-- Supabase Storage for company document uploads (JPEG / PDF, max 200 KB enforced in app + optional bucket limit)
-- Run in Supabase SQL Editor after `app/-- Create company setup tables.sql`
-- Path convention: {user_id}/{uuid}_{filename}

insert into storage.buckets (id, name, public)
values ('company-documents', 'company-documents', false)
on conflict (id) do nothing;

-- Idempotent: drop then recreate (safe for dev re-runs)
drop policy if exists "company_documents_storage_select_own" on storage.objects;
drop policy if exists "company_documents_storage_insert_own" on storage.objects;
drop policy if exists "company_documents_storage_update_own" on storage.objects;
drop policy if exists "company_documents_storage_delete_own" on storage.objects;

create policy "company_documents_storage_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'company-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "company_documents_storage_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'company-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "company_documents_storage_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'company-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'company-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "company_documents_storage_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'company-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);
