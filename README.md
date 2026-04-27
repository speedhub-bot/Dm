# DM — Instagram Auto-DM Suite

A full-stack Instagram outreach / auto-DM tool with a polished dashboard, multi-account support, drip campaigns, anti-ban throttling, an inbox for replies, and analytics.

> ⚠️ **Read this first.** Automating DMs against Instagram's private API can violate Instagram's Terms of Service and risks account bans / permanent shadow-bans, especially when sending unsolicited messages to non-followers. Use this tool only for authorized outreach (e.g., to your own followers, opted-in leads, customers in your CRM) and at conservative rates. The maintainers accept no liability for misuse.

The app ships with a **Demo Mode** (enabled by default) which simulates all Instagram interactions so you can explore the entire UI without risking a real account. Toggle `DEMO_MODE=false` in `backend/.env` to talk to Instagram for real (uses [`instagrapi`](https://github.com/subzeroid/instagrapi)).

---

## Features

### Multi-account
- Connect multiple IG accounts (with username/password + optional 2FA TOTP).
- Per-account throttle: min/max delay (default 45–120s), hourly cap (12/h), daily cap (50/day), working-hours window.
- Encrypted session storage (Fernet); passwords are encrypted at rest.

### Contacts
- Add manually, paste in bulk, import CSV (`username, full_name, notes, tags`), or **scrape an IG account's followers / following**.
- Tag contacts and organize them into Lists.

### Templates
- Variables: `{username}`, `{full_name}`, `{first_name}`.
- Spintax: `{hi|hey|yo}` randomly chosen per send.
- Variants: provide alternative bodies — one is picked per recipient.
- Live preview generator.

### Campaigns
- Pick an account + template + contact list → fire.
- Schedule a future start time, pause/resume any time.
- Per-recipient status tracking (pending / sent / failed / replied) with rendered body & error.
- Background scheduler (APScheduler) drips messages while respecting all throttles & working hours.

### Inbox
- Pulls recent threads, syncs to local DB.
- Reply directly from the dashboard (sends through the connected IG account).
- Per-thread unread counts.

### Analytics
- KPI cards: sent today, total sent, reply rate, active campaigns, contacts, accounts.
- 14-day timeseries chart (sent / replied / failed).
- Top accounts by send volume.
- Recent activity feed (audit log).

---

## Stack

- **Backend:** FastAPI · SQLAlchemy 2 · SQLite (default) / Postgres-ready · APScheduler · instagrapi · cryptography (Fernet) · python-jose (JWT) · passlib (bcrypt).
- **Frontend:** React 18 · TypeScript · Vite · Tailwind CSS · TanStack Query · React Router · Recharts · lucide-react · zustand · react-hot-toast.
- **Ops:** Docker + docker-compose (backend + nginx-served frontend).

---

## Quick start

### Option A — local dev (recommended)

Requires Python 3.11+ and Node 20+.

**Backend:**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit if you want
uvicorn app.main:app --reload --port 8000
```

The API is now at <http://localhost:8000>, docs at <http://localhost:8000/api/docs>.
On first run it auto-creates a SQLite DB and seeds an admin user from `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD` (default `admin@example.com / changeme123`).

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173> and log in. Vite proxies `/api/*` to the backend on port 8000.

### Option B — Docker compose (all-in-one)

```bash
cp backend/.env.example backend/.env  # optional
docker compose up --build
```

Frontend → <http://localhost:5173>, backend → <http://localhost:8000>. SQLite data persists in the `dm_data` Docker volume.

---

## Generate strong keys

```bash
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(48))"
python -c "from cryptography.fernet import Fernet; print('FERNET_KEY=' + Fernet.generate_key().decode())"
```

Put both in `backend/.env`.

---

## Project layout

```
dm/
├── backend/
│   ├── app/
│   │   ├── api/         # FastAPI routers (auth, accounts, contacts, templates, campaigns, inbox, analytics)
│   │   ├── core/        # config, security (JWT + Fernet)
│   │   ├── db/          # SQLAlchemy session
│   │   ├── models/      # ORM models
│   │   ├── schemas/     # Pydantic schemas
│   │   ├── services/    # instagrapi wrapper, templating, throttle helpers
│   │   ├── workers/     # APScheduler — campaign drip loop
│   │   └── main.py
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── lib/         # api, auth store, types, format helpers
│   │   └── pages/       # Login, Dashboard, Accounts, Contacts, Templates, Campaigns, Inbox, Analytics, Settings
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
└── docker-compose.yml
```

---

## API overview

All routes are under `/api`. JWT bearer token required (except `/auth/login` and `/auth/register`).

| Method | Path | Description |
| --- | --- | --- |
| POST | `/auth/register` | Create account (first user becomes admin) |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/auth/me` | Current user |
| GET / POST / PATCH / DELETE | `/accounts` | Manage IG accounts |
| POST | `/accounts/connect` | Login to IG (supports 2FA) |
| POST | `/accounts/{id}/disconnect` | Wipe session |
| GET / POST / PATCH / DELETE | `/contacts` | Manage contacts |
| POST | `/contacts/bulk` | Add many usernames |
| POST | `/contacts/import-csv` | CSV upload |
| POST | `/contacts/scrape` | Scrape followers/following of a target |
| GET / POST / DELETE | `/contact-lists` | Manage lists |
| GET / POST / PATCH / DELETE | `/templates` | Manage templates |
| POST | `/templates/{id}/preview` | Preview rendered body |
| GET / POST | `/campaigns` | Manage campaigns |
| POST | `/campaigns/{id}/start` | Start / resume |
| POST | `/campaigns/{id}/pause` | Pause |
| GET | `/inbox/threads` | List threads |
| GET | `/inbox/threads/{id}` | Thread detail |
| POST | `/inbox/threads/{id}/reply` | Send reply |
| POST | `/inbox/sync` | Pull latest IG inbox |
| GET | `/analytics/dashboard` | KPIs + timeseries + recent events |

Browse the full Swagger UI at <http://localhost:8000/api/docs>.

---

## Anti-ban best practices (built into the scheduler)

- **Per-account caps:** 50/day, 12/hour by default — tunable per account.
- **Randomized delays:** uniform distribution between `min_delay_sec` and `max_delay_sec`.
- **Working hours:** no sends outside `work_hours_start`–`work_hours_end` (default 09:00–21:00 UTC).
- **Spintax + variants:** vary text on every send to dodge spam-pattern detection.
- **Cooldown after each send** before the next message goes out.
- **Warm-up new accounts** by lowering caps for the first 7 days.

---

## Roadmap ideas

- Drip sequences (multi-step campaigns).
- AI-generated reply suggestions.
- Webhooks (Zapier/Make/n8n) for reply events.
- Postgres + Redis for production multi-worker setups.
- Browser-automation backend (Playwright) as an alternative to the private API.

---

## License

MIT. See `LICENSE`.
