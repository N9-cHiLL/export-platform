-- Run once if you created `company_documents` before file upload columns existed
alter table public.company_documents add column if not exists storage_path text;
alter table public.company_documents add column if not exists original_file_name text;
alter table public.company_documents add column if not exists mime_type text;
alter table public.company_documents add column if not exists size_bytes int;
