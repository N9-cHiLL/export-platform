# Database schema (Supabase / Postgres)

This project uses **Supabase** for Postgres + Auth + Storage. Use the **exact column names and `document_type` values** below when writing queries or uploads so data stays consistent.

---

## Conventions

- **IDs**: `uuid` for `user_id` (matches `auth.users.id`).
- **Timestamps**: `timestamptz` columns use ISO-8601 in API responses.
- **Document files**: Stored in Storage bucket `company-documents`. The DB stores the **object path** (not a public URL), e.g. `{user_id}/{uuid}_{filename}`.

---

## `public.profiles`

| Column       | Type        | Notes |
|-------------|-------------|--------|
| `user_id`   | uuid (PK)   | Same as `auth.users.id`. |
| `email`     | text        | |
| `name`      | text        | |
| `mobile`    | text        | |
| `industry`  | text        | |
| `updated_at`| timestamptz | |

---

## `public.user_journey`

| Column         | Type        | Notes |
|----------------|-------------|--------|
| `user_id`      | uuid (PK)   | |
| `current_step` | int         | Journey step index (e.g. 1–4 on homepage). |
| `updated_at`   | timestamptz | |

---

## `public.company_details`

One row per user (company profile for export onboarding).

| Column               | Type        | Notes |
|----------------------|-------------|--------|
| `user_id`            | uuid (PK)   | FK → `auth.users(id)`. |
| `company_name`       | text        | Legal / registered name. |
| `industry`           | text        | |
| `country`            | text        | |
| `address`            | text        | Multi-line OK. |
| `website`            | text        | |
| `tax_id`             | text        | e.g. GST / VAT. |
| `incorporation_date` | date        | `YYYY-MM-DD`. |
| `created_at`         | timestamptz | |
| `updated_at`         | timestamptz | |

---

## `public.company_documents`

Rows can represent **uploaded files** or a request to **apply for** a document the user does not have yet.

| Column                 | Type        | Notes |
|------------------------|-------------|--------|
| `id`                   | uuid (PK)   | |
| `user_id`              | uuid        | FK → `auth.users(id)`. |
| `document_type`        | text        | **Must use one of the canonical values** (see below). |
| `submission_kind`      | text        | `upload` \| `apply_for_document`. |
| `application_notes`    | text        | Optional; used when `submission_kind = apply_for_document`. |
| `content`              | text        | Legacy / optional pasted text. |
| `storage_path`         | text        | Path inside bucket `company-documents` when uploaded. |
| `original_file_name`   | text        | |
| `mime_type`            | text        | e.g. `image/jpeg`, `application/pdf`. |
| `size_bytes`           | int         | |
| `created_at`           | timestamptz | |

### Canonical `document_type` values (required onboarding set)

Use these **exact strings** (snake_case):

| `document_type` | Meaning |
|-----------------|--------|
| `gst_certificate` | GST certificate |
| `company_registration_certificate` | Company registration certificate |
| `company_pan` | PAN of the company |
| `authorized_person_aadhaar` | Aadhaar of the authorised person |

**Rules:**

- For each of the four types, the user must either **upload** a file (`submission_kind = upload` and `storage_path` set) or choose **apply** (`submission_kind = apply_for_document`; `storage_path` null).
- At most **one current row per `(user_id, document_type)`** for these four types (enforced by a partial unique index in SQL).

### File upload rules (app-level)

- **Formats**: JPEG or PDF only.
- **Max size**: 200 KB per file.

---

## Storage: `company-documents`

- **Bucket id / name**: `company-documents`
- **Object key pattern**: `{user_id}/{uuid}_{sanitized_original_name}`
- **Policies**: Users may only read/write objects whose first path segment equals `auth.uid()` (see `app/-- Create company documents storage.sql`).

---

## SQL files in the repo

| File | Purpose |
|------|--------|
| `app/-- Create profiles table.sql` | `profiles`, `user_journey` |
| `app/-- Create company setup tables.sql` | `company_details`, `company_documents`, RLS |
| `app/-- Alter company_documents add file columns.sql` | Adds file columns if you created tables earlier |
| `app/-- Alter company_documents submission.sql` | Adds `submission_kind`, `application_notes`, unique index |
| `app/-- Create company documents storage.sql` | Storage bucket + policies |

After changing schema, update this document and any shared constants in `src/lib/companyDocumentRequirements.ts`.
