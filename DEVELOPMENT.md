# Running ReVibe in development

Hot-reload setup on a Windows PC. For production, Docker and full settings, see [README.md](README.md).

## Prerequisites

- Python 3.11+ and Node.js 24+
- A PostgreSQL database and a Cloudflare R2 bucket
- Model files in `backend/models/` (`easyocr/` and `Qwen2.5-0.5B-Instruct/`); they are not in Git
- A filled-in `.env` in the repo root (the settings table is in [README.md § Configure](README.md#1-configure))

## First-time setup

From the repo root, in PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt

cd frontend
npm ci                          # also generates the Prisma client
npm run auth:provision admin    # applies migrations, then asks for an admin email + password
cd ..
```

## Run

Two terminals, both started in the repo root.

**Terminal 1: backend (FastAPI, auto-reloads on Python changes)**

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir backend
```

**Terminal 2: frontend (Next.js dev server, hot reload)**

```powershell
cd frontend
npm run dev                     # runs db:migrate first
```

Open http://localhost:3000 and sign in with the admin you provisioned.

The website forwards `/api/*` to the backend at `http://127.0.0.1:8000`. Set `API_URL` to point it somewhere else.

`--reload` restarts the backend on each save, and that restart loads the OCR/LLM models again. Leave the flag off when you're testing report generation.

## Common dev tasks

| Task | Command (in `frontend/` unless noted) |
|---|---|
| Change the DB schema | Edit `prisma/schema.prisma`, run `npm run db:migrate:dev -- --name <change>`, then update `backend/models.py` to match |
| Apply migrations | `npm run db:migrate` |
| Manage admins | `npm run auth:list`, `npm run auth:remove <email>` |
| Lint | `npm run lint` |
| Frontend tests | `node --test tests/report-summary.test.mjs` |
| Backend tests (repo root) | `.\.venv\Scripts\python.exe -m backend.test_main` |
| Backend integration test (repo root, uses real models) | `.\.venv\Scripts\python.exe -m backend.test_main --integration` |

## Notes

- The dev server is for this PC only. To test from a phone, use `npm run build` and then `npm start -- -H 0.0.0.0` (see README).
- **Watch screen** works only on `http://localhost:3000`, because browsers allow screen capture only on secure origins.
- Problems: see [README.md § Troubleshooting](README.md#troubleshooting).
