# Copilot Instructions: Export Platform

## Project Overview

**Export Platform** is a Next.js 16 SaaS application that guides Indian exporters through a 4-step journey: Opportunity Discovery → Company Setup → Sample Approval → Bank Funding. It uses Supabase for auth, database, and real-time features.

**Key Tech Stack:**
- Next.js 16 (App Router, React 19)
- TypeScript (strict mode)
- Supabase (PostgreSQL + Auth)
- Tailwind CSS 4 + PostCSS
- ESLint 9 with Next.js config

## Architecture Patterns

### Full-Stack Data Flow
- **Client Pages:** Use `"use client"` directive (e.g., `app/page.tsx`, `app/company-setup/page.tsx`)
- **Supabase Client:** Instantiated in `src/lib/supabase.ts` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **API Routes:** Server-side admin operations in `app/api/admin/` and utility endpoints in `app/api/auth/`
- **Service Role vs. Anon:** Admin routes use `SUPABASE_SERVICE_ROLE_KEY` for privileged operations; client uses anonymous key

### Key Conventions
1. **Error Normalization:** `page.tsx` normalizes Supabase auth errors into user-friendly messages (e.g., duplicate email → "already in use")
2. **Multi-Query Fallbacks:** `app/api/auth/check-email/route.ts` demonstrates schema-qualified vs. dotted table queries as fallback pattern
3. **Server-Side Profile Creation:** Admin route (`app/api/admin/create-user/route.ts`) atomically creates user, profile, and journey records
4. **Client State Management:** Pages manage form state locally (email, password, auth mode) without Redux/Context

### Database Schema (Inferred from Code)
```
auth.users (Supabase managed)
  - id (uuid)
  - email
  - password_hash

profiles
  - id (uuid) = user_id
  - user_id (uuid, fk)
  - name, mobile, industry, email
  - created_at, updated_at

user_journey
  - user_id (uuid, fk)
  - current_step (int, 1-4)

company_details
  - user_id (uuid, fk)
  - company_name, industry, country, address, website, tax_id, incorporation_date
  - created_at, updated_at
```

## Developer Workflows

### Getting Started
```bash
npm install
npm run dev              # Start dev server on localhost:3000
npm run build            # Production build
npm run start            # Run production build
npm run lint             # Run ESLint
```

### Environment Setup
Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key]
SUPABASE_SERVICE_ROLE_KEY=[service role key]
ADMIN_CREATE_SECRET=[optional: admin route auth token]
```

### Testing Admin Routes
Use the `/api/admin/create-user` endpoint with a POST request:
```json
{
  "secret": "ADMIN_CREATE_SECRET_VALUE",
  "email": "test@example.com",
  "password": "securepass",
  "name": "User Name",
  "mobile": "+91...",
  "industry": "Textiles"
}
```

## Project-Specific Patterns

### Multi-Mode UI (Documents vs. Scratch)
`company-setup/page.tsx` demonstrates dual-mode data entry:
- **Documents Mode:** User pastes extracted OCR/document text; component regex-extracts fields
- **Scratch Mode:** Direct form entry with manual field population
- Uses `useState<Mode>("documents")` to toggle; regex patterns in `extractField()`

### Client-Side Form Validation
- Email existence check via `POST /api/auth/check-email` before signup
- Normalization of Supabase auth errors to prevent confusing technical messages
- Form state: `[authEmail, authPassword, authName, authMobile, authIndustry, authMode]`

### Server-Side Admin Operations
1. Validate admin secret (if set)
2. Create auth user with `supabaseAdmin.auth.admin.createUser()`
3. Handle "already exists" error by fetching user ID from `auth.users`
4. Upsert profiles and user_journey records atomically
5. Return user object for client-side session management

### Path Alias
TypeScript path configured as `"@/*": ["./*"]` — use `@/` for absolute imports from project root (not yet implemented in current files, but available).

## Common Pitfalls & Debugging

### Email Enumeration
`/api/auth/check-email` explicitly enables email enumeration for MVP UX. Mark for removal in production.

### Service Role Queries
`auth.users` requires `SUPABASE_SERVICE_ROLE_KEY`. Anon key cannot access auth schema. Routes include fallback query logic (`schema("auth").from("users")` vs. `from("auth.users")`) for robustness.

### TypeScript Strict Mode
- Strict null checks enabled; always handle nullable Supabase responses
- Use optional chaining (`??`) for falsy defaults
- Declare types explicitly (e.g., `useState<string | null>(null)`)

### HMR & Dev Server
Next.js App Router auto-reloads on file save. Client components update live; server route changes may require manual refresh.

## File Organization

```
app/                      # Next.js App Router pages & routes
├── page.tsx              # Home/auth page (client)
├── layout.tsx            # Root layout with fonts & metadata
├── company-setup/
│   └── page.tsx          # Company setup form (multi-mode, client)
├── discovery/
│   └── page.tsx          # Opportunity discovery page (stub)
├── globals.css           # Tailwind directives
└── api/
    ├── admin/create-user/route.ts    # Protected admin user creation
    └── auth/check-email/route.ts     # Email existence check

src/lib/                  # Shared utilities
└── supabase.ts           # Supabase client singleton

SQL/                      # Database schema files
├── Create company setup tables.sql
└── Create profiles table.sql
```

## Key Files to Reference

| File | Purpose |
|------|---------|
| `app/page.tsx` | Demonstrates auth flow (signup/signin), error handling, UI state |
| `app/company-setup/page.tsx` | Multi-mode form entry (documents/scratch), regex extraction |
| `app/api/admin/create-user/route.ts` | Server-side user creation, profile seeding, journey init |
| `app/api/auth/check-email/route.ts` | Fallback query pattern, email enumeration |
| `src/lib/supabase.ts` | Client initialization (no auth context layer yet) |

## When to Ask for Clarification

- Database schema specifics beyond inferred types (check SQL files in `app/`)
- User journey step definitions and progression logic (check `STEPS` array in `page.tsx`)
- Business rules for export workflow (product fit, licensing, sampling timeline)
- Future integration points (payment APIs, document storage, third-party services)
