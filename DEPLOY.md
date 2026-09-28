# Deploying SecureDMS — one URL for the whole stack

The app is split into three pieces on your machine (React dev server, Express API,
PostgreSQL). In production **they collapse into one origin**, so a single Render
service answers for everything:

```
Browser ──► https://<your-app>.onrender.com
              ├── /                 React build (static files)
              ├── /documents/5      index.html  (SPA fallback on refresh)
              ├── /uploads/<file>   evidence files
              └── /api/*            Express API
                        └──────────► Render PostgreSQL  (DATABASE_URL)
```

---

## Why a single service works

| Piece | What makes it share an origin |
| --- | --- |
| Frontend → API | `API_BASE` defaults to `/api` — a **relative** URL, so the browser calls whatever host serves the page. No CORS, no second domain. |
| API → Frontend | `backend/src/server.js` serves `frontend/dist` when it exists, and falls back to `index.html` for every non-`/api` GET so deep links work on refresh. |
| API → Database | `db.js` reads `DATABASE_URL` (Render injects it) and switches TLS on automatically for any non-local host. |
| First boot | `initSchema()` runs on startup (idempotent `IF NOT EXISTS`), then `seed()` loads the demo accounts **only if the users table is empty**. |

Nothing about this is Render-specific — Railway, Fly.io, or a VPS behave the same.

---

## Prerequisites

* A **GitHub** account — Render deploys from a Git repository.
* A **Render** account (<https://render.com> — sign up free).

---

## Step 1 — Push the code to GitHub

From the project root (`Default Project`):

```powershell
# one-time identity (skip if already set)
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"

git add .
git commit -m "SecureDMS: full backend + dashboard"

# create an empty repo on GitHub and push to it (HTTPS + Personal Access Token),
# or use the GitHub CLI:
#   gh repo create secure-dms --private --source . --push
git remote add origin https://github.com/<you>/secure-dms.git
git branch -M main
git push -u origin main
```

Keep the repository **private** unless you're happy with the seeded government-style
demo data being public.

> `node_modules/`, `dist/`, `uploads/` and `.env` are already in `.gitignore`,
> so secrets and local state never leave your machine.

---

## Step 2 — Create the database (Render)

1. Dashboard → **New** → **PostgreSQL**
2. Name it e.g. `secure-dms-db`, pick the **Free** instance type, create it.
3. Open its **Connections** tab — you'll need nothing by hand: Render injects
   `DATABASE_URL` into any web service you attach it to. (If you attach it later,
   the variable appears automatically.)

---

## Step 3 — Create the web service

1. **New** → **Web Service** → connect the GitHub repo you pushed.
2. Settings:

   | Field | Value |
   | --- | --- |
   | Runtime | Node |
   | Build Command | `npm run build` |
   | Start Command | `npm start` |
   | Instance Type | Free |

3. **Environment** (Advanced section):

   | Key | Value | Why |
   | --- | --- | --- |
   | `NODE_ENV` | `production` | |
   | `JWT_SECRET` | *(generate a long random string)* | signing tokens — never commit this |
   | `DATABASE_URL` | *(injected by the Postgres add-on)* | set automatically in step 4 |
   | `AUTO_INIT_DB` | `true` | create tables on boot |
   | `AUTO_SEED` | `true` | load demo users/cases when the DB is empty |
   | `CORS_ORIGIN` | *(leave unset)* | same origin in production, CORS allows all |

4. **Create** and watch the logs.

`render.yaml` in this repo declares the same service + database, so you can
alternatively use **New → Blueprint**, pick the repo, and let Render read it.

---

## Step 4 — Verify the deploy

The build log must show:

```
> vite build
✓ built in ~8s
```

The runtime log must show:

```
Database schema ready.
SecureDMS API listening on http://localhost:10000
Serving dashboard from .../frontend/dist
```

Then open `https://<your-app>.onrender.com`:

* `/` → login page
* sign in as `admin@secure-dms.gov.in` / `SecureDms@2026`
* upload a file, open its integrity check, share it, then **refresh the page** —
  the deep link must still render (SPA fallback working).

---

## Environment variable reference

| Name | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | Render sets this itself; don't override it |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `JWT_SECRET` | `change-me…` in dev | **required** in production |
| `JWT_EXPIRES_IN` | `7d` | token lifetime |
| `AUTO_INIT_DB` | `true` | run `schema.sql` on boot (idempotent) |
| `AUTO_SEED` | `true` | seed only when `users` is empty — set `false` once you have real data |
| `UPLOAD_DIR` | `uploads` | where evidence files are written |
| `MAX_FILE_SIZE_MB` | `100` | multer limit |
| `CORS_ORIGIN` | allow all | comma-separated origins; unnecessary on one origin |
| `PG_POOL_MAX` | `10` | connection pool size — lower it on small database plans |
| `PGSSLMODE` | *(auto)* | `require` to force TLS |

---

## Production preview locally

Before pushing anything you can run exactly what Render will run:

```powershell
npm run build          # installs both workspaces + vite build
$env:PORT = "5000"
npm start              # node backend/src/server.js
```

Now `http://localhost:5000` serves **both** the dashboard and `/api` — no Vite
involved. `npm run dev:web` (port 5173) remains available for development.

---

## Free-tier caveats — read this if the data matters

1. **Cold starts.** Free instances sleep after a period of inactivity; the first
   request after that waits ~30–60 s. Fine for a demo, annoying for a judge.
2. **Ephemeral disk.** Uploaded files live in `backend/uploads`, which is wiped
   on every redeploy/restart on a free instance. Your integrity chain survives in
   PostgreSQL (the hash is stored in the row), but the *bytes* do not — a
   missing file is reported as a broken reference by the integrity check.
   * Mitigation: a paid instance with a persistent disk, or point uploads at
     object storage (S3 / Backblaze B2 / Cloudinary) — a small `multer.storage`
     swap in `backend/src/middleware/upload.js`.
3. **The database is shared/limited on the free plan** — check Render's current
   limits for retention, pausing and expiry, and take an export before a demo.
4. **Demo data loads automatically.** Once you've got real records, set
   `AUTO_SEED=false` and redeploy.

---

## Deploying updates

```
git add -A
git commit -m "…"
git push
```

Render rebuilds and restarts automatically (enable *Auto Deploy* on the service).
Schema changes are safe to push — `schema.sql` only ever uses `IF NOT EXISTS`;
add a migration statement there when you introduce new columns.

---

## If you later want two services instead

Move the SPA to Vercel (build `frontend/`, output `dist`) and keep the API on
Render. Then set `VITE_API_URL=https://<api>.onrender.com` when building:

```powershell
$env:VITE_API_URL = "https://<api>.onrender.com"
npm run build --prefix frontend
```

and set `CORS_ORIGIN=https://<app>.vercel.app` on the API. One extra environment
variable each way — that's the only coupling between the two.
