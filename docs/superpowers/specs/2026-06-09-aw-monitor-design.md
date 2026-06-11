# AW Monitor — Design Specification

**Date:** 2026-06-09
**Status:** Draft
**Author:** jclark

---

## 1. Overview

AW Monitor is an internal monitoring and dashboard web application that provides real-time visibility into the PDF assessment file backup pipeline at AmericaWorks NYC.

The existing system consists of a PowerShell script that scans 24 lab PCs daily, copies PDF assessment files (O*NET Interest Profiler, VIA Character Strengths) to a network share, and an Express.js/Next.js app (client-files-viewer) that indexes and serves those files. Monitoring of that pipeline is currently limited to email reports and log files.

AW Monitor provides a live dashboard showing PC health status, backup run results, scan statistics, and historical trends — all behind a production-grade authentication system with role-based access control.

### Tech Stack

- **Backend:** Python, FastAPI, SQLAlchemy (async), Alembic
- **Frontend:** Next.js (App Router), Tailwind CSS, shadcn/ui (heavily customized), TanStack Query, Recharts, Zustand
- **Database:** Self-hosted Supabase (PostgreSQL only — no Supabase Auth)
- **Real-time:** Native WebSocket via FastAPI

---

## 2. Architecture

### 2.1 High-Level Data Flow

Three data paths feed the monitoring app:

1. **Health Monitor** — Python backend probes 24 PCs on a schedule (ping, SMB port, auth, folder access). Pushes status changes to the frontend via WebSocket.
2. **Ingestion Service** — Polls the existing Express.js API (`/api/reports`) for scan/index stats. Also receives webhook POSTs from the PowerShell backup script at the end of each run.
3. **Config Store** — Admins manage the PC list, SMB credentials, check intervals, and notification settings from the UI. All secrets encrypted with AES-256 Fernet.

```
┌─────────────────────┐
│  24 Lab PCs         │
│  192.168.72.x       │
└────────┬────────────┘
         │
         │ SMB probe (every 5-15 min)
         ▼
┌─────────────────────────────────────────────┐
│  AW Monitor (FastAPI)                       │
│                                             │
│  ┌──────────┐ ┌───────────┐ ┌────────────┐ │
│  │ Health   │ │ Ingestion │ │ Config     │ │
│  │ Monitor  │ │ Service   │ │ Store      │ │
│  └────┬─────┘ └─────┬─────┘ └─────┬──────┘ │
│       │             │              │        │
│       │  ┌──────────┘              │        │
│       ▼  ▼                        ▼        │
│  ┌─────────────┐          ┌──────────────┐  │
│  │ Supabase PG │          │ AES-256      │  │
│  │ (own DB)    │          │ encrypted    │  │
│  └─────────────┘          └──────────────┘  │
│       │                                     │
│  ┌────┴──────────────────┐                  │
│  │ Auth Module           │                  │
│  │ (JWT RS256 + RBAC)    │                  │
│  └───────────────────────┘                  │
└──────────────┬──────────────────────────────┘
               │
         ┌─────┴──────┐
         │ WebSocket  │ (PC health, real-time)
         │ REST API   │ (scan data, polling)
         └─────┬──────┘
               ▼
┌──────────────────────────┐
│  Next.js Frontend        │
│  Tailwind + shadcn       │
└──────────────────────────┘

         ▲                    ▲
         │ REST (poll)        │ Webhook POST
         │                    │
┌────────┴───────┐   ┌───────┴──────────┐
│ Existing       │   │ PowerShell       │
│ Express API    │   │ Backup Script    │
│ (scan results) │   │ (run summary)    │
└────────────────┘   └──────────────────┘
```

### 2.2 Architectural Approach

Monolith API with modular codebase. Single FastAPI application with clean internal module boundaries. Each module (auth, monitoring, ingestion, config_store, audit) has its own router, models, schemas, and service layer. The auth module is architecturally isolated and extractable to a microservice later if needed.

Health check scheduling runs as a background task within the FastAPI process via `asyncio`. All 24 PCs are checked concurrently using `asyncio.gather`.

---

## 3. Auth Module

Custom-built authentication system — no Supabase Auth. Standalone module with its own API surface.

### 3.1 Core Features

- **Registration & Login** — email + password, bcrypt hashing (12 rounds), returns access token (15 min) + refresh token (7 days)
- **JWT Tokens** — asymmetric RS256 signing (RSA key pair). Access token is short-lived and stateless. Refresh token stored in DB for revocation.
- **Session Management** — tracks active sessions per user (device, IP, last active). Users can view and revoke their own sessions. Admins can revoke any user's sessions.
- **Password Policy** — minimum 12 characters, complexity requirements, password history (prevent reuse of last 5), forced change on first login for admin-created accounts
- **Account Lockout** — 5 failed attempts locks account for 15 minutes, progressive backoff

### 3.2 RBAC Roles

| Role | Permissions |
|------|------------|
| `SUPER_ADMIN` | Full access. Manage all users, edit config store (including secrets), manage roles. |
| `ADMIN` | Manage users (except super admins), view config, trigger health checks. |
| `MANAGER` | View all dashboard data, export reports. |
| `USER` | View dashboard only. |

### 3.3 Database Tables

```sql
-- users
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR NOT NULL UNIQUE,
    password_hash   VARCHAR NOT NULL,
    first_name      VARCHAR NOT NULL,
    last_name       VARCHAR NOT NULL,
    role            VARCHAR NOT NULL DEFAULT 'USER',  -- SUPER_ADMIN, ADMIN, MANAGER, USER
    is_active       BOOLEAN NOT NULL DEFAULT true,
    must_change_pw  BOOLEAN NOT NULL DEFAULT false,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- sessions
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token   VARCHAR NOT NULL UNIQUE,
    device_info     VARCHAR,
    ip_address      VARCHAR,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- password_history
CREATE TABLE password_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash   VARCHAR NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_history_user ON password_history(user_id);

-- audit_log (user_id SET NULL so audit trail survives user deletion)
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR NOT NULL,
    resource        VARCHAR,
    details         JSONB,
    ip_address      VARCHAR,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
```

### 3.4 API Endpoints

```
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me
PUT    /api/auth/change-password

GET    /api/users                 (ADMIN+)
POST   /api/users                (ADMIN+)
GET    /api/users/:id            (ADMIN+)
PUT    /api/users/:id            (ADMIN+)
DELETE /api/users/:id            (SUPER_ADMIN)
PUT    /api/users/:id/role       (SUPER_ADMIN)

GET    /api/sessions             (own sessions)
DELETE /api/sessions/:id         (own or ADMIN+)
GET    /api/audit-log            (ADMIN+)
```

### 3.5 Why RS256

With a shared secret (HS256), any service that validates tokens can also forge them. RS256 uses a private key to sign and a public key to verify — the frontend or any future service can validate tokens without being able to create them. Ready for microservice extraction if needed.

---

## 4. PC Health Monitoring

### 4.1 Four-Tier Health Check

Each check runs sequentially per PC. If a tier fails, subsequent tiers are skipped and the failure reason is recorded. All 24 PCs are checked concurrently using `asyncio.gather`.

| Tier | Check | Method | Timeout |
|------|-------|--------|---------|
| 1 | ICMP Ping | `asyncio` subprocess → `ping -n 1 -w 2000` | 2s |
| 2 | SMB Port 445 | `asyncio` socket connect | 3s |
| 3 | Authentication | `smbprotocol` → connect to C$ share | 5s |
| 4 | Folder Access | List `Users/*/Desktop,Documents,Downloads` | 5s |

### 4.2 Status Model

| Status | Meaning | Tiers Passed |
|--------|---------|-------------|
| `ONLINE` | Fully accessible, PDFs reachable | All 4 |
| `AUTH_FAILED` | Reachable but credentials rejected or C$ disabled | 1, 2 |
| `SMB_BLOCKED` | Machine alive but port 445 blocked/not listening | 1 only |
| `OFFLINE` | No ping response | None |
| `DEGRADED` | Authenticated but target folders missing or unreadable | 1, 2, 3 |

### 4.3 Scheduling

- Default interval: every 10 minutes (configurable via config store)
- On-demand: admins can trigger an immediate check for a single PC or all PCs from the UI
- Staggered startup: checks are spread over 30 seconds on app boot to avoid network spikes

### 4.4 Real-Time Push

- FastAPI WebSocket endpoint at `/ws/health`
- Frontend connects on dashboard load
- Server pushes only status changes (not every check result)
- On initial connect, server sends current snapshot of all PCs

### 4.5 Database Tables

```sql
-- pcs
CREATE TABLE pcs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR NOT NULL,          -- e.g., "PC1"
    ip_address      VARCHAR NOT NULL,
    location        VARCHAR,                   -- e.g., "Lab Room A"
    is_monitored    BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- health_checks
CREATE TABLE health_checks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pc_id           UUID NOT NULL REFERENCES pcs(id) ON DELETE CASCADE,
    status          VARCHAR NOT NULL,          -- ONLINE, OFFLINE, SMB_BLOCKED, AUTH_FAILED, DEGRADED
    ping_ms         REAL,
    tier_reached    INTEGER NOT NULL,          -- 1-4
    failure_reason  VARCHAR,
    details         JSONB,                     -- {tier_timings: {ping_ms, smb_ms, auth_ms, folder_ms}, folders_found: [...], error_detail: ""}
    checked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_health_checks_pc_time ON health_checks(pc_id, checked_at DESC);
```

### 4.6 Data Retention

- Granular check results kept for 90 days (configurable)
- After 90 days, aggregate to daily summaries (uptime %, avg ping) and delete raw records

---

## 5. Ingestion Service

### 5.1 Express API Polling

Polls the existing client-files-viewer API for file/scan statistics.

- **Endpoint consumed:** `GET /api/reports/weekly` (and custom date ranges)
- **Poll interval:** every 30 minutes (configurable) — scan data only changes once a day
- **Stores snapshots** for trend charts over time

```sql
-- scan_snapshots
CREATE TABLE scan_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_files     INTEGER NOT NULL,
    new_files       INTEGER NOT NULL,
    files_by_type   JSONB,
    storage_total   VARCHAR,
    storage_avg     VARCHAR,
    source_api_url  VARCHAR,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.2 PowerShell Webhook

A small addition to the end of the PowerShell backup script that POSTs the run summary:

```powershell
$webhookBody = @{
    files_copied = $processedCount
    files_skipped = $skippedCount
    duplicates = $duplicateCount
    total_size_mb = $totalSizeMB
    duration_seconds = [math]::Round($totalDuration, 2)
    pcs_scanned = $scannedPCs
    pcs_failed = $failedPCs
    date_folder = $dateFolder
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://<monitoring-app>/api/webhooks/backup-run" `
    -Method POST -Body $webhookBody -ContentType "application/json" `
    -Headers @{ "X-Webhook-Secret" = "configured-in-config-store" }
```

**Webhook security:** shared secret stored in the config store, validated on every incoming request.

```sql
-- backup_runs
CREATE TABLE backup_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    files_copied        INTEGER NOT NULL,
    files_skipped       INTEGER NOT NULL,
    duplicates          INTEGER NOT NULL,
    total_size_mb       REAL NOT NULL,
    duration_seconds    REAL NOT NULL,
    pcs_scanned         INTEGER NOT NULL,
    pcs_failed          JSONB,             -- array of PC names
    date_folder         VARCHAR,
    status              VARCHAR NOT NULL,   -- SUCCESS, PARTIAL, FAILURE, NO_FILES
    received_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.3 Derived Status Logic

- `SUCCESS` — files_copied > 0 and pcs_failed is empty
- `PARTIAL` — files_copied > 0 but some PCs failed
- `FAILURE` — files_copied = 0 and errors occurred
- `NO_FILES` — no PDFs found across any PC

### 5.4 API Endpoints

```
GET    /api/scans/latest          (latest snapshot)
GET    /api/scans/history         (paginated, filterable by date range)
GET    /api/backup-runs           (paginated list)
GET    /api/backup-runs/:id       (single run detail)
GET    /api/backup-runs/stats     (aggregated: avg duration, success rate)
POST   /api/webhooks/backup-run   (webhook receiver, secret-authenticated)
```

---

## 6. Config Store

Encrypted key-value configuration system, manageable from the UI.

### 6.1 Encryption

- Single `ENCRYPTION_KEY` environment variable — the only secret in `.env`
- Derives a Fernet key for AES-256 encryption
- `secret` type values encrypted at rest in the database
- Non-secret types stored as plaintext

### 6.2 Config Entry Types

| Type | Encrypted | Example |
|------|-----------|---------|
| `string` | No | `smtp.host = smtp.gmail.com` |
| `secret` | Yes | `smb.password = ****` |
| `number` | No | `health.interval_minutes = 10` |
| `json` | No | `notifications.recipients = [...]` |
| `boolean` | No | `notifications.enabled = true` |

### 6.3 Default Namespaces

```
smb.username              (secret)
smb.password              (secret)
smb.domain                (string)

health.interval_minutes   (number, default: 10)
health.ping_timeout_ms    (number, default: 2000)
health.smb_timeout_ms     (number, default: 3000)
health.retention_days     (number, default: 90)

express_api.base_url      (string)
express_api.poll_minutes  (number, default: 30)

webhook.secret            (secret, auto-generated on first boot)

notifications.enabled     (boolean)
notifications.smtp_host   (string)
notifications.smtp_port   (number)
notifications.smtp_user   (secret)
notifications.smtp_pass   (secret)
notifications.recipients  (json)
```

### 6.4 Database Table

```sql
-- config_entries
CREATE TABLE config_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    namespace       VARCHAR NOT NULL,
    key             VARCHAR NOT NULL,
    value           TEXT,                      -- encrypted if type is secret
    type            VARCHAR NOT NULL,          -- string, secret, number, json, boolean
    description     VARCHAR,
    is_sensitive    BOOLEAN NOT NULL DEFAULT false,
    updated_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(namespace, key)
);
```

### 6.5 Runtime Behavior

- All config loaded into an in-memory dict on startup
- On update via API, cache entry refreshed immediately
- No DB round-trip for config reads during health checks

### 6.6 Access Control

- `SUPER_ADMIN` — full read/write, can view decrypted secrets
- `ADMIN` — read all, write non-sensitive only, secrets shown masked
- `MANAGER`, `USER` — no access to config section

### 6.7 Audit

Every config change logged to `audit_log`: who, when, which key. Secret old/new values are NOT logged.

### 6.8 API Endpoints

```
GET    /api/config                         (ADMIN+, list all, secrets masked)
GET    /api/config/:namespace              (ADMIN+, entries in namespace)
GET    /api/config/:namespace/:key         (ADMIN+, single entry)
PUT    /api/config/:namespace/:key         (SUPER_ADMIN for secrets, ADMIN for rest)
POST   /api/config/:namespace/:key/reveal  (SUPER_ADMIN, requires password re-entry)
POST   /api/config/seed                    (SUPER_ADMIN, populate defaults on first boot)
```

---

## 7. Frontend

### 7.1 Pages

```
/login                     — Login page
/dashboard                 — Main overview (default after login)
/dashboard/pcs             — PC list with detailed status per machine
/dashboard/pcs/:id         — Single PC detail (health history, timeline)
/dashboard/backup-runs     — Backup run history table
/dashboard/backup-runs/:id — Single run detail
/dashboard/scans           — Scan snapshot history and trend charts
/dashboard/config          — Config store management (ADMIN+)
/dashboard/users           — User management (ADMIN+)
/dashboard/audit-log       — Audit log viewer (ADMIN+)
/dashboard/profile         — Own profile, change password, sessions
```

### 7.2 Main Dashboard Layout

Not a generic grid of cards. A purpose-built operations view:

- **Top bar** — app name, current user, role badge, notification bell, time since last backup run
- **Sidebar** — minimal, icon-driven, collapsible
- **Primary zone (left ~65%)** — PC health grid. Each PC is a tile showing name, IP, status color, ping latency. Tiles grouped by status (online first, then degraded, then offline) so problems float to the top. Clicking a tile opens a slide-over panel with that PC's health timeline.
- **Secondary zone (right ~35%)** — stacked panels: latest backup run summary, 30-day trend sparkline, quick alerts

### 7.3 Design Principles

- **Dark-first with purpose** — dark base with a specific accent color palette. Operations/monitoring tool aesthetic, not SaaS dashboard.
- **Data density over whitespace** — monitoring tool operators want information density. Tighter spacing than typical shadcn defaults.
- **Color conveys meaning** — status colors are the primary visual language. No decorative gradients. Green/amber/red with specific shades tied to each status.
- **Typography hierarchy** — monospace for IPs, ports, technical values. Sans-serif for labels and headers. Clear size steps.
- **Motion with intent** — status transitions animate (tile fading from green to red). No gratuitous hover effects or page transitions.
- **No card soup** — each section has a distinct visual treatment suited to its data type.

### 7.4 Real-Time Strategy

- **WebSocket** for PC health status — live updates via `useHealthStream` hook
- **TanStack Query polling** for scan history and backup runs — configurable interval (default 30s)
- **Supabase Realtime** available as a future enhancement if needed

### 7.5 Key Frontend Dependencies

| Package | Purpose |
|---------|---------|
| `next` | React framework (App Router) |
| `tailwindcss` | Styling |
| `shadcn/ui` | Component foundation (heavily customized) |
| `@tanstack/react-query` | Data fetching + polling |
| `recharts` | Charts and sparklines |
| `zustand` | Lightweight state management |

---

## 8. Project Structure

```
aw-monitor/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── dependencies.py
│   │   ├── auth/
│   │   │   ├── router.py
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   ├── jwt.py
│   │   │   ├── passwords.py
│   │   │   └── rbac.py
│   │   ├── users/
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   ├── monitoring/
│   │   │   ├── router.py
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   ├── probes.py
│   │   │   ├── scheduler.py
│   │   │   └── websocket.py
│   │   ├── ingestion/
│   │   │   ├── router.py
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   └── express_client.py
│   │   ├── config_store/
│   │   │   ├── router.py
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   ├── encryption.py
│   │   │   └── defaults.py
│   │   ├── audit/
│   │   │   ├── router.py
│   │   │   ├── models.py
│   │   │   └── service.py
│   │   └── core/
│   │       ├── database.py
│   │       ├── config.py
│   │       └── middleware.py
│   ├── migrations/
│   │   ├── alembic.ini
│   │   ├── env.py
│   │   └── versions/
│   ├── tests/
│   ├── .env.example
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── dashboard/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── pcs/
│   │   │   ├── backup-runs/
│   │   │   ├── scans/page.tsx
│   │   │   ├── config/page.tsx
│   │   │   ├── users/page.tsx
│   │   │   └── audit-log/page.tsx
│   │   ├── dashboard/profile/page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── health-grid.tsx
│   │   ├── pc-tile.tsx
│   │   ├── backup-summary.tsx
│   │   ├── trend-sparkline.tsx
│   │   ├── config-editor.tsx
│   │   ├── status-badge.tsx
│   │   └── alert-panel.tsx
│   ├── hooks/
│   │   ├── use-health-stream.ts
│   │   ├── use-auth.ts
│   │   └── use-config.ts
│   ├── lib/
│   │   ├── api.ts
│   │   ├── types.ts
│   │   └── utils.ts
│   ├── tailwind.config.ts
│   ├── package.json
│   └── Dockerfile
├── docs/
└── README.md
```

---

## 9. Key Backend Dependencies

| Package | Purpose |
|---------|---------|
| `fastapi` | Web framework |
| `uvicorn` | ASGI server |
| `sqlalchemy[asyncio]` | Async ORM |
| `asyncpg` | PostgreSQL async driver |
| `alembic` | Database migrations |
| `pydantic-settings` | Env/config loading |
| `python-jose[cryptography]` | JWT RS256 tokens |
| `bcrypt` | Password hashing |
| `cryptography` | Fernet encryption for config store |
| `smbprotocol` | SMB connectivity for PC health checks |
| `httpx` | Async HTTP client for Express API polling |

---

## 10. Environment Variables

The app requires minimal environment configuration. Most settings live in the config store.

```
# .env (minimal)
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/aw_monitor
ENCRYPTION_KEY=<base64-encoded-32-byte-key>
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
CORS_ORIGINS=http://localhost:3000
```

---

## 11. Development Notes

- **Project location:** `D:\Code\aw\aw-monitor\`
- **Database:** Self-hosted Supabase (Docker) — PostgreSQL only
- **Deployment:** Deferred — development-first
- **Existing system integration:** Minimal changes to client-files-viewer. Only addition is the webhook POST in the PowerShell backup script (~5 lines).
