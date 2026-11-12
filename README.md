# ReVibe

Turn screenshots of technicians' chat reports into accomplishment reports with charts.

- **Capture:** watch a phone screen live from a PC and take screenshots, or upload
  screenshots straight from a phone.
- **Store:** screenshots go to a Cloudflare R2 bucket; reports go to PostgreSQL.
- **Generate:** EasyOCR reads each screenshot and Qwen2.5-0.5B-Instruct writes the report
  locally on CPU. No AI token or hosted AI service is used.
- **Report:** charts (job categories, reports per day, issue types, rectification time),
  exportable to PDF or Excel.

## Requirements

- Windows PC with Python 3.11+ and Node.js 24+
- A PostgreSQL database URL
- A Cloudflare R2 bucket and an R2 API token with read and write access
- The downloaded model files (already present locally; excluded from Git):
  - `backend/models/easyocr/craft_mlt_25k.pth`
  - `backend/models/easyocr/english_g2.pth`
  - `backend/models/Qwen2.5-0.5B-Instruct/` (weights, config and tokenizer files)

  Automatic downloads are disabled. Keep these folders when moving the app to another
  computer.

## 1. Configure

Copy the example settings file:

```powershell
Copy-Item .env.example .env
```

Then open `.env` (repo root) and fill in:

| Setting | Where to find it |
|---|---|
| `DATABASE_URL` | Your Postgres connection URL, e.g. `postgresql://user:password@host:5432/dbname` |
| `R2_ACCOUNT_ID` | Cloudflare dashboard → R2 → Account ID |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | R2 → Manage API tokens → Create token (Object Read & Write) |
| `R2_BUCKET` | The bucket name |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Optional: a first admin login (password 8+ characters). Or use `npm run auth:provision admin` below |
| `BETTER_AUTH_SECRET` | 32+ random characters: `node -e "console.log(crypto.randomBytes(32).toString('base64'))"` |
| `AUTH_ALLOWED_HOSTS` | `localhost:3000`, plus `<PC-IP>:3000` to sign in from a phone, comma-separated |

The backend and the website both read this one file.

### Database (Prisma)

Every table is defined in `frontend/prisma/schema.prisma` and created by versioned
migrations in `frontend/prisma/migrations/`. Apply them from `frontend/`:

```powershell
npm run db:migrate      # also runs automatically before `npm run dev` and `npm start`
```

A database created by an earlier version of ReVibe is upgraded in place: its data is kept and
screenshots saved before folders existed are moved into a folder named **Unsorted**. The
Python backend reads and writes the same tables through SQLAlchemy (`backend/models.py`) and
refuses to start until the migrations have run.

To change the schema: edit `schema.prisma`, run `npm run db:migrate:dev -- --name <change>`
(creates and applies a new migration), then update `backend/models.py` to match.

### Admins

There is no sign-up page; admins are managed from a terminal in `frontend/`:

```powershell
npm run auth:provision                  # apply migrations and sync the optional env admin
npm run auth:provision admin            # asks for email + password (hidden) and creates that admin
npm run auth:provision admin you@x.com  # same, with the email given; re-run to change the password
npm run auth:list                       # list admins
npm run auth:remove you@x.com           # remove and sign out; the last admin can't be removed
```

Every admin has full access. An admin in `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`)
is created or updated on every provision and website start; leave both empty if you use
only the command. A `frontend/.env.local`, if you create one, overrides values for the
website only.

Never commit `.env`; it is in `.gitignore`.

## 2. Install (first time only)

From the repository root, in PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
cd frontend
npm ci                     # also generates the Prisma client
npm run db:migrate
npm run auth:provision admin
npm run build
cd ..
```

Run `npm run build` again after you change frontend code.

## 3. Run

You need two terminals, both opened in the repository root.

**Terminal 1 (backend):**

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

**Terminal 2 (website):**

```powershell
cd frontend
npm start -- -H 0.0.0.0
```

Then open the app:

- **On this PC:** http://localhost:3000
- **On a phone (same Wi-Fi):** `http://<PC-IP>:3000`. To find `<PC-IP>`, run `ipconfig`
  and use the **IPv4 Address** (e.g. `192.168.1.20`). If the phone can't connect, allow
  Node.js through Windows Firewall for private networks.

The backend listens only on this PC. Phones reach it through the website at `/api`.

For development with hot reload, run `npm run dev` instead of `npm start`. The dev server
is meant for this PC; use `npm start` when testing from a phone.

## 4. Use

The page is laid out as four numbered steps:

1. **Choose a folder.** Click **New folder** and name it, e.g. "Nov 11 – Team 5". Use the
   pencil icon to rename the selected folder, and the dropdown to sort folders by newest or
   by name. Screenshots, charts and exports all belong to the selected folder.
2. **Capture screenshots**
   - **From a PC (live):** mirror your phone to the PC with
     [scrcpy](https://github.com/Genymobile/scrcpy) (Android), Phone Link, or an AirPlay
     receiver (iPhone). Click **Watch screen** and pick the mirror window. You'll see the
     phone live. Click **Take screenshot** whenever a report is on screen.
   - **From a phone:** phone browsers cannot capture other apps, so take a normal
     screenshot with the phone's buttons, then tap **Add screenshots** and choose it.
   Then click **Generate report**: processes every new screenshot, about a minute each on CPU.
   The first run also loads the models, which takes longer. Unreadable images are marked
   **Failed** and skipped next time.
3. **Review screenshots:** filter by All, Pending or Ready to see each one's status.
4. **Report & export:** charts and reports for the selected folder.
   - **Export PDF** opens the print dialog. Choose **Save as PDF**; the file is named after the folder.
   - **Export Excel** downloads `<folder name>.xlsx` with every report and its extracted fields.

Review extracted names, codes, dates and generated text before using them. Rectification
charts show whether a time was recorded, not whether the job was verified as complete.

Every page and API call requires signing in; sessions last 7 days. **Sign out** is in the
top bar. Sign-in travels over plain HTTP on your Wi-Fi, so use it only on networks you trust.

## Deploy with Docker

`docker-compose.yml` runs three services from two images:

| Service | What it does | Reachable |
|---|---|---|
| `migrate` | Applies Prisma migrations, then exits; the others wait for it | — |
| `backend` | FastAPI + local OCR/AI (CPU-only PyTorch) | Only inside the compose network |
| `web` | Next.js website, login and `/api` proxy to `backend` | Published on port `3000` for your nginx server |

Postgres and R2 stay external (`DATABASE_URL`, `R2_*`). The AI models are baked into the
backend image at build time (~1.1 GB), so `backend/models/` must be present on the machine that
builds it. Ports come from `.env`: `WEB_PORT` (published port, default `3000`) and `BACKEND_PORT`
(backend port inside the compose network, default `8000`). Rebuild after changing `BACKEND_PORT`.

**Server needs:** Docker with the Compose plugin, about 4 GB RAM (the model loads into
memory), and network access from your nginx server to port 3000.

**1. Code, models and settings** (models and `.env` are not in Git):

```bash
git clone <your-repo-url> revibe && cd revibe
# copy backend/models/ and .env from your PC into the same paths, e.g. with scp
nano .env    # set APP_URL=https://your-domain (the address nginx serves)
```

**2. Build and start:**

```bash
docker compose up -d --build
docker compose ps                     # backend and web should become "healthy"
docker compose exec web npm run auth:provision admin    # first admin
```

**3. Point your nginx at it:** proxy your domain to `http://<docker-host>:3000`. Two settings
matter: `client_max_body_size 12m;` (screenshots are up to 10 MB) and
`proxy_read_timeout 600s;` (report generation runs on the CPU and can take minutes). Pass the
`Host` and `X-Forwarded-For`/`X-Forwarded-Proto` headers as usual. Port 3000 is published on
all interfaces: allow only the nginx server in the firewall, or bind it to a private IP in
`docker-compose.yml` (e.g. `"10.0.0.5:${WEB_PORT:-3000}:3000"`). `WEB_PORT=8080` in `.env` changes the host port.

**Update:** `deploy.sh` pulls, rebuilds, restarts (migrations run first), waits until `backend` and
`web` are healthy, and removes old images. Install it once so `deploy` works from any folder:

```bash
sudo ln -sf "$PWD/deploy.sh" /usr/local/bin/deploy    # run in the repo folder, once
deploy                                                 # every update after that
```

**Operate:**

```bash
docker compose logs -f backend               # or web / migrate
docker compose exec web npm run auth:list
docker compose exec web npm run auth:remove someone@example.com
docker compose up -d                          # after editing .env (restart alone keeps old values)
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Backend exits with `KeyError: 'DATABASE_URL'` (or an `R2_` setting) | That setting is missing from `.env`. |
| Website won't start: `Fill in ... in .env` | That login setting is missing from `.env`. |
| Phone shows an error when signing in | Add `<PC-IP>:3000` to `AUTH_ALLOWED_HOSTS` and restart the website. |
| `Database tables ... are missing` (backend or website) | Run `npm run db:migrate` in `frontend/`. |
| Website shows "Couldn't load screenshots" | The backend isn't running, or it can't reach Postgres or R2. Check Terminal 1. |
| No **Watch screen** button | The browser can't share its screen (all phones, or a page opened over `http://<IP>`). Use `http://localhost:3000` on the PC. |
| "Local inference failed" | The model files are missing or the PC is out of memory. Check `backend/models/`. |
| Port 3000 is busy | Run `npm start -- -H 0.0.0.0 -p 3001` and open port 3001 instead. |

## Checks

From the repository root:

```powershell
.\.venv\Scripts\python.exe -m backend.test_main
.\.venv\Scripts\python.exe -m backend.test_main --integration
```

The integration check uses the real sample image and downloaded models while blocking
outgoing network connections.

In `frontend`: `npm run lint`, `npm run build`, and
`node --test tests/report-summary.test.mjs`.

## Project structure

```
backend/
  main.py             FastAPI app: startup checks and routers
  config.py           settings from the repo-root .env
  models.py           SQLAlchemy models of the folders / screenshots tables
  database.py         engine, per-request sessions, "migrations applied?" check
  schemas.py          API request/response shapes
  storage.py          Cloudflare R2 upload, download and temporary links
  inference.py        local OCR + LLM: screenshot -> fields + report
  routers/folders.py      create, rename, list and sort folders; Excel export
  routers/screenshots.py  upload screenshots; generate a report per screenshot
  test_main.py        tests (python -m backend.test_main)
docker-compose.yml    migrate + backend + web (see "Deploy with Docker")
backend/Dockerfile    backend image (CPU-only PyTorch; models baked in)
frontend/Dockerfile   website image (also runs migrations and admin commands)
frontend/
  prisma/schema.prisma    every table: login + folders + screenshots
  prisma/migrations/      versioned SQL migrations
  prisma.config.ts        Prisma CLI settings (reads the repo-root .env)
  scripts/db-migrate.ts   npm run db:migrate (upgrades pre-Prisma databases in place)
  scripts/auth.ts         npm run auth:provision [admin] | auth:list | auth:remove
frontend/src/
  app/page.tsx        page layout and state: overview, then steps 1–4
  app/login/          sign-in page
  app/api/auth/       Better Auth endpoints
  proxy.ts            requires a session for every page and /api call
  instrumentation.ts  on start: settings check + optional env admin (lib/auth-setup.ts)
  components/         folder-bar, capture-section, capture-toolbar,
                      screenshot-grid, report-section, section-heading
  lib/api.ts          typed client for the backend
  lib/prisma.ts       shared Prisma client
  lib/auth.ts         Better Auth config (Prisma adapter, sign-up disabled)
  lib/admins.ts       add, list and remove admins
  lib/screen-capture.ts   screen grab and floating controls window
  lib/report-summary.ts   chart data
  generated/prisma/   Prisma client (generated by npm ci / prisma generate; not in Git)
```
