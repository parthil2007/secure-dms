# SecureDMS — Secure Digital Document Management System

**SIH 26190** · Evidence & legal document management with a tamper-evident chain of custody.

A full-stack rebuild: a PostgreSQL + Express backend implementing every API the dashboard needs, and an editable Vite + React frontend that replaces the deployed static bundle.

---

## Repository layout

```
Default Project/
├── package.json      root scripts: `npm run build` (both apps) · `npm start` (production)
├── render.yaml       Render blueprint: web service + managed Postgres
├── DEPLOY.md         step-by-step guide to putting the whole stack on one URL
├── start.ps1         boots Postgres + API + dashboard (-Stop | -ApiOnly | -WebOnly)
├── start.cmd         double-click wrapper (avoids the PowerShell execution policy)
├── env.ps1           portable tool paths + Start-Postgres/Start-Api/Start-Web
├── backend/          Express + PostgreSQL API (port 5000)
│   ├── src/
│   │   ├── server.js         bootstrap: DB auto-init/seed, CORS, /uploads, serves
│   │   │                     frontend/dist + SPA fallback, error handler
│   │   ├── db.js             pg pool, query/one/rows/withTransaction helpers
│   │   ├── config.js         paths, upload limits, port
│   │   ├── db/
│   │   │   ├── schema.sql    tables, indexes, sequences (idempotent)
│   │   │   ├── init.js       creates the schema
│   │   │   └── seed.js       demo users/cases/documents + sample files
│   │   ├── middleware/       auth (JWT), upload (multer)
│   │   ├── lib/              hashing & chain, audit logger, serializers, numbering
│   │   └── routes/           auth, dashboard, cases, documents, search, shares,
│   │                         audit, reports, users, admin, integrity
│   └── uploads/              stored evidence files (created automatically)
└── frontend/         Vite + React 18 + Tailwind (port 5173)
    └── src/
        ├── lib/        api client, formatting helpers
        ├── context/    auth (JWT in localStorage as `sdms_token`)
        ├── components/ layout (sidebar/topbar), shared UI primitives
        └── pages/      every route of the dashboard
```

---

## Prerequisites

No admin rights or Windows services are required — Node and PostgreSQL run as portable tools:

| Tool | Path |
| --- | --- |
| Node.js v24.19.0 | `C:\Users\mehta\AppData\Local\opencode-tools\node-v24.19.0-win-x64` |
| PostgreSQL 17.6 | `C:\Users\mehta\AppData\Local\opencode-tools\pgsql\pgsql` |
| Cluster data dir | `C:\Users\mehta\AppData\Local\opencode-tools\pgsql\data` (port **5432**) |
| Git 2.55 (portable) | `C:\Users\mehta\AppData\Local\opencode-tools\git\cmd\git.exe` |

Add `...\opencode-tools\git\cmd` to `PATH` (or `env.ps1` does it for you) to run
`git` from any shell.

---

## Running it

### 0. One command (recommended)

**Double-click `start.cmd`** — or from PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

(`.ps1` scripts are blocked by Windows' default execution policy, so the `-File`
wrapper or `start.cmd` is needed — neither changes your system policy.)

| File | Does |
| --- | --- |
| `start.cmd` | starts Postgres + API + dashboard, each in its own window |
| `stop.cmd` | shuts the whole stack down |
| `start.ps1 -ApiOnly` | Postgres + API only |

### 1. Start PostgreSQL (portable)

```powershell
$pg = "C:\Users\mehta\AppData\Local\opencode-tools\pgsql\pgsql"
& "$pg\bin\pg_ctl.exe" -D "C:\Users\mehta\AppData\Local\opencode-tools\pgsql\data" `
    -l "C:\Users\mehta\AppData\Local\opencode-tools\pgsql\server.log" -o "-p 5432" start
```

Database `sdms`, role `sdms` / password `sdms_local` already exist.

### 2. Start the backend (port 5000)

```powershell
$nodeDir = "C:\Users\mehta\AppData\Local\opencode-tools\node-v24.19.0-win-x64"
$env:PATH = "$nodeDir;$env:PATH"
cd "C:\Users\mehta\OneDrive\Documents\Default Project\backend"
node --watch --watch-path=src src/server.js      # restarts only when src/ changes
```

One-off database commands:

```powershell
node src/db/init.js      # create/refresh schema (idempotent)
node src/db/seed.js      # load demo data (add --force to wipe + reseed)
```

### 3. Start the frontend (port 5173)

```powershell
cd "..\frontend"
npm run dev
```

Open **http://localhost:5173** — the Vite dev server proxies `/api` and `/uploads` to `http://localhost:5000`, so no CORS configuration is needed locally.

> Production builds: set `VITE_API_URL=https://your-api-host/api` in `frontend/.env` and add that origin to `CORS_ORIGIN` in `backend/.env`.

### 4. Verify the app (headless smoke test)

```powershell
npm run smoke
```

This mounts **all 19 routes** in jsdom and drives them against the live backend
(44 real API calls), asserting that every route renders its own page with no
React errors. It is the fastest way to confirm a change didn't break rendering —
it prints a per-route table and exits non-zero on any failure:

```
route                      status   content   DOM      text
────────────────────────── ──────── ───────── ──────── ─────
/dashboard                 OK       ok        39660    1548
/cases                     OK       ok        28785    1347
...
ALL ROUTES RENDERED CLEANLY
```

> `smoke/preload.cjs` creates the browser globals before any module loads,
> because `react-dom` decides at import time whether `window` exists. Without it
> React falls back to its legacy IE9 input polyfill under jsdom.

---

## Deploying to Render (one URL)

Production serves the React build and the API from the **same origin**, so one
Render web service + one managed Postgres is the whole deployment:

```powershell
npm run build     # installs both workspaces, runs `vite build`
npm start         # node backend/src/server.js
```

`http://localhost:5000` then behaves exactly like the deployed site: the
dashboard, `/api`, and `/uploads` all come from one port. Details — including
the free-tier caveats around cold starts and ephemeral upload storage — are in
**[DEPLOY.md](./DEPLOY.md)**, and `render.yaml` declares the same service +
database as a Render Blueprint.

---

## Demo accounts

Password for all seeded accounts: **`SecureDms@2026`**

| Role | Email |
| --- | --- |
| Administrator | `admin@secure-dms.gov.in` |
| Investigator | `investigator@secure-dms.gov.in` |
| Analyst | `analyst@secure-dms.gov.in` |
| Prosecutor | `prosecutor@secure-dms.gov.in` |

The login page lists these one-click.

---

## API reference

Base URL `http://localhost:5000/api` · JWT sent as `Authorization: Bearer <token>` · token stored in `localStorage` under `sdms_token`.

### Auth
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/register` | `{name, email, password, role?, department?, badgeId?}` → `{token, user}` |
| POST | `/login` | `{email, password}` → `{token, user}` |
| GET | `/profile` | current user |
| PUT | `/profile` | update profile / change password |

### Dashboard
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/dashboard/stats` | KPIs, type/status breakdowns, recent activity |
| GET | `/dashboard/charts` | 12-month document series, 14-day activity, case types, storage trend |

### Cases
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/cases` | `q, status, priority, page, limit, sort` |
| POST | `/cases` | auto-mints `CASE-YYYY-00001` from a sequence |
| GET | `/cases/:id` | case + documents + related activity |
| PUT | `/cases/:id` | partial update |
| DELETE | `/cases/:id` | **admin only** |

### Documents
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/documents` | `q, caseId, type, status, confidentiality, page, limit, sort` |
| POST | `/documents` | register metadata without a file |
| POST | `/documents/upload` | multipart `file` + metadata; computes SHA-256, appends to chain |
| GET | `/documents/:id` | document + versions + custody + shares + audit activity |
| PUT | `/documents/:id` | metadata update |
| DELETE | `/documents/:id` | uploader or admin |
| GET | `/documents/:id/versions` | version history |
| POST | `/documents/:id/versions` | multipart `file` + `note` → new revision |
| GET | `/documents/:id/file?version=n` | authenticated download (audited) |
| POST | `/documents/:id/verify` | re-hash file, validate chain, set `verified` / `rejected` |

### Everything else
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/search` | `q, type=all|documents|cases|users, limit` |
| GET / POST | `/shares` | list shares / create share `{documentId|caseId, email, permission, message, expiresAt}` |
| DELETE | `/shares/:id` | revoke |
| GET | `/audit-logs` | `q, action, entityType, userId, page, limit` + distinct action list |
| GET | `/reports` | overview, monthly series, case types, top cases, officer load, integrity split |
| GET | `/users` | directory (also used for assignment/sharing) |
| PUT / DELETE | `/users/:id` | **admin** — role/status/department, delete |
| GET | `/admin/stats` | **admin** — user, storage and role statistics |
| GET | `/integrity?deep=true` | verify every document's file hash and the whole hash chain |
| GET | `/health` | liveness probe (no auth) |

---

## How integrity protection works

1. **Content hash** — every stored file is hashed with SHA-256 (`hash_sha256`).
2. **Chain hash** — each document seals itself to its predecessor:
   `chain_hash = SHA256(prev_hash | content_hash | doc_number)`
3. **Genesis link** — the first document chains from `000…0` (64 zeros).
4. **Detection** — `POST /documents/:id/verify` re-hashes the bytes and recomputes the chain link; `GET /integrity?deep=true` walks the entire repository and reports any break. Tampered files are flagged `rejected`.
5. **Custody trail** — collection, revision, verification and download events append to `chain_of_custody`; user-facing actions append to `audit_logs`.

Uploads are serialised with a Postgres advisory lock so two concurrent uploads cannot fork the chain.

---

## Schema

`users`, `cases`, `documents`, `document_versions`, `shares`, `chain_of_custody`, `audit_logs`, plus sequences `seq_case_number` and `seq_document_number`.

---

## Features

- Case management with priority/status filters and document linkage
- Evidence upload (100 MB, common doc/media/archive types; executables blocked)
- Version history with per-revision hashes and re-upload
- Global search across documents, cases and people
- Sharing with `view` / `download` / `edit` permissions and optional expiry
- Full audit trail with filters and pagination
- Integrity dashboard with deep verification
- Reports with charts and print/PDF export
- Role-based access control (admin, investigator, analyst, prosecutor, viewer)
- Dark mode, responsive layout, per-user avatars
