# Ajaia Docs

A focused, full-stack collaborative document editor built with Next.js (App Router, TypeScript), Tailwind CSS, Tiptap, Prisma ORM, and SQLite.

## Features

- **Rich-Text Editor (Tiptap):** Bold, italic, underline, Normal / H1 / H2 / H3 styles, bulleted lists, numbered lists, undo/redo, active formatting state highlights, explicit Save button + `Cmd/Ctrl + S`, and unsaved-changes warnings.
- **Role-Based Access Control:** Server-enforced `OWNER`, `EDITOR`, and `VIEWER` permissions backed by signed HTTP-only session cookies (`ajaia_user_id`).
- **File Import:** Drag-and-drop or file picker upload for `.txt` and `.md` files (max 2 MB) converted into sanitized rich-text documents.
- **HTML Sanitization:** Strict allowlist sanitization (`sanitize-html`) protecting stored and imported documents from XSS payloads and inline event handlers.
- **1-Click Demo User Switching:** Dedicated `/login` screen and persistent top-bar switcher to test ownership, sharing, and permission enforcement across seeded accounts.

## Seeded Demo Accounts

| Name | Email | Seeded Documents |
| --- | --- | --- |
| Alice Chen | `alice@ajaia.demo` | Owns *Q4 Product Launch Plan* (shared with Bob as Editor) and *Engineering Onboarding Notes* (private). Viewer on Bob's *Design Review Checklist*. |
| Bob Patel | `bob@ajaia.demo` | Owns *Design Review Checklist* (shared with Alice as Viewer). Editor on Alice's *Q4 Product Launch Plan*. |
| Charlie Kim | `charlie@ajaia.demo` | No initial documents (ideal for testing access denial and sharing upgrades). |

## Supported File Uploads

- **Allowed extensions:** `.txt`, `.md` (case-insensitive)
- **Maximum size:** `2 MB` (`2 * 1024 * 1024` bytes)
- Empty (`0` byte) files and unsupported formats are rejected with `400 Bad Request`.

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables (copy `.env.example` to `.env` and fill in your Neon Lakebase Postgres URLs):
   ```bash
   cp .env.example .env
   ```
   - `DATABASE_URL` — Neon **pooled** (`-pooler`) connection string used by Prisma for application queries.
   - `DATABASE_URL_UNPOOLED` — Neon **direct** (non-pooled) connection string used by Prisma (`directUrl`) for schema pushes and migrations.
   - `SESSION_SECRET` — HMAC secret for signing HTTP-only session cookies.

3. Push the Prisma schema to Neon Postgres and seed the demo accounts & documents:
   ```bash
   npx prisma db push
   npm run db:seed
   ```

4. Start the development server on port 3000:
   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000` and sign in as any demo account.

## Running Automated Tests

The Vitest integration suite runs against an isolated temporary PostgreSQL schema (`vitest_isolated`) and drops it automatically on completion:

```bash
npm test
```

## Lint & Production Build

```bash
npm run lint
npm run build
```

## Deployment Notes (Vercel + Neon Lakebase Postgres)

Prisma is configured for **Neon Lakebase Postgres** with pooled application queries (`url = env("DATABASE_URL")`) and direct schema migrations (`directUrl = env("DATABASE_URL_UNPOOLED")`):

1. Set `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and a strong random `SESSION_SECRET` (`openssl rand -hex 32`) in your hosting provider's Environment Variables.
2. Push the schema and seed once against your target branch:
   ```bash
   npx prisma db push
   npm run db:seed
   ```
3. Build and start (`npm run build` runs `prisma generate && next build`):
   ```bash
   npm run build
   npm run start
   ```
