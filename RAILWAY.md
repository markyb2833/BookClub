# Deploy BookClub on Railway

Follow in order. **~20 minutes** the first time.

## 0. Repo

- Code on **GitHub** (e.g. `markyb2833/BookClub`).
- This folder is the **repo root** (`package.json` + `Dockerfile` + `app/` live here).
- **Push** the latest `main` (includes `Dockerfile`, `railway.toml`, `app/page.tsx`, `/api/health/railway`).

## 1. Create project

1. [railway.app](https://railway.app) → **New project**.
2. **Deploy from GitHub** → install the Railway app → choose **this repo**.
3. Railway creates a **web** service from the Dockerfile.

## 2. Root directory

**Service → Settings → Root Directory**

- If `package.json` is at the **repo root** (same level as `app/`): leave **empty**.
- Only set `app` if your Git layout nests the Next app one level down.

## 3. Postgres

1. **+ New** → **Database** → **PostgreSQL**.
2. Open your **web** service → **Variables** → **Add variable**:
   - Name: `DATABASE_URL`
   - Use **Reference** → select **Postgres** → `DATABASE_URL`  
   (Do not paste by hand unless you must.)

## 4. Auth (required)

On the **web** service → **Variables**:

| Name | Value |
|------|--------|
| `NEXTAUTH_SECRET` | Run locally: `openssl rand -base64 32` — paste the output |
| `NEXTAUTH_URL` | Your public URL, e.g. `https://YOUR-SERVICE.up.railway.app` — **no** trailing slash |

After Railway gives you a domain (step 6), **fix `NEXTAUTH_URL`** if it changed, then **Redeploy**.

## 5. Redis (recommended)

1. **+ New** → **Redis**.
2. On **web** → **Variables** → add **`REDIS_URL`** as a **Reference** to the Redis service.

*(Without Redis, some features may error; healthcheck no longer requires it.)*

## 6. Public URL

**Web service → Settings → Networking → Generate domain**  
Copy `https://…` → set **`NEXTAUTH_URL`** to that origin → **Redeploy**.

## 7. Meilisearch (for `/search`)

BookClub expects a **`works`** index. The search API creates the index and settings on first use; documents are added when books are **imported** (Open Library gap-fill on search, etc.). Same image as local `docker-compose.yml`: **`getmeili/meilisearch:v1.7`**.

### 7a. Add a Meilisearch service

1. In the **same Railway project** as the web app → **+ New** → **Empty service** (or **Docker** / deploy from image — wording varies).
2. **Settings** (or deploy source) → deploy the image:  
   **`getmeili/meilisearch:v1.7`**  
   (full reference: `docker.io/getmeili/meilisearch:v1.7`).
3. **Networking / Ports:** expose **7700** (Meilisearch’s default). If Railway asks for a **port**, set **7700** for this service.
4. On the **Meilisearch** service → **Variables**:

| Variable | Value |
|----------|--------|
| `MEILI_MASTER_KEY` | Long secret, e.g. `openssl rand -base64 32` (save it — you’ll paste it on the web app) |
| `MEILI_ENV` | `production` |
| `MEILI_HTTP_ADDR` | `0.0.0.0:7700` |

5. **Deploy** the Meilisearch service and wait until it’s **running**.

### 7b. Point the web app at Meilisearch

On the **web** service → **Variables**:

| Name | Value |
|------|--------|
| `MEILISEARCH_API_KEY` | **Exactly the same** string as `MEILI_MASTER_KEY` on the Meilisearch service (or use a **Reference** if Railway exposes it). |
| `MEILISEARCH_HOST` | Internal base URL **including port 7700**, no path. Examples that work on Railway: |

- Prefer **private networking** (same project): open the **Meilisearch** service → **Connect** / **Networking** / docs for **internal URL**. Typical shape:  
  `http://<something>.railway.internal:7700`  
  (Exact hostname is shown in the Railway UI for that service.)
- If you only see a **public** URL, use that with **`https://`** and the port Railway assigns (only if you intentionally expose Meilisearch — less ideal).

After saving, **Redeploy** the **web** service.

### 7c. Verify

- `GET /api/health` → `meilisearch: true`.
- Open **`/search`**, run a query — first hits may come from **Open Library gap-fill**; your DB catalogue is indexed when those import paths run.

**Templates:** you can also search Railway’s template hub for “Meilisearch” and wire the same env vars on **web**.

## 8. Deploy

- **GitHub connected:** push to `main` → auto deploy.
- Or locally: `npm run railway:up` (after `railway login` + `railway link` in this directory).

## 9. Verify

- Open `/` → BookClub landing (“Your reading life…”).
- `GET /api/health/railway` → `200` + `{ "status": "ok" }`.
- `GET /api/health` → may show `degraded` until Redis/Meilisearch exist — **OK**.
- Register + log in.

## 10. If something fails

```bash
npm run railway:doctor
```

Catches local build issues before you waste another deploy.

## 11. Failed migration on deploy (P3009 / P3018)

If `prisma migrate deploy` fails mid-deploy, Railway restarts in a loop until you **clear the failed migration** and redeploy with a fixed migration file.

1. **Fix the migration in git** (empty/broken SQL, wrong column order, etc.) and push.
2. **Mark the failed migration as rolled back** against the **same** `DATABASE_URL` Railway uses (one-time):

   ```bash
   # From your machine, with Railway Postgres reachable (e.g. Railway CLI proxy or copied DATABASE_URL):
   cd app   # or repo root where prisma/ lives
   npx prisma migrate resolve --rolled-back "MIGRATION_FOLDER_NAME"
   ```

   Example: `--rolled-back "20260322132520_new"` if that migration failed.

3. **Redeploy** the web service. `migrate deploy` will re-apply that migration (now fixed), then continue with any later ones.

If `migrate resolve` complains about checksums after you edited an already-recorded migration, ask in Prisma docs / support; usually **rolled-back** is enough when the migration **never finished applying** (Postgres rolled back the statement).

## What this stack does

- **Dockerfile** — Node 22, `npm ci`, `prisma generate`, `next build`.
- **`scripts/railway-start.sh`** — `prisma migrate deploy` then `next start` (DB must be reachable at runtime).
- **`railway.toml`** — Docker build, healthcheck on **`/api/health/railway`** (Postgres only).

---

**CLI shortcuts:** `npm run railway -- help` or `bash scripts/railway.sh help`
