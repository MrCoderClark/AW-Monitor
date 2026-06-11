# AW Monitor

Operations monitoring dashboard for the AmericaWorks PDF backup pipeline. Tracks PC health, backup run results, and scan statistics across 12 lab PCs.

## Project Structure

- **Backend:** `backend/` — Python FastAPI, SQLAlchemy async, Alembic migrations, asyncpg
- **Frontend:** `frontend/` — Next.js 14 (App Router), Tailwind CSS, shadcn/ui, TanStack Query, Recharts, Zustand
- **Database:** Self-hosted Supabase (PostgreSQL only — NO Supabase Auth)
- **Docs:** `docs/superpowers/specs/` and `docs/superpowers/plans/`

## Key Design Documents

- **Spec:** `docs/superpowers/specs/2026-06-09-aw-monitor-design.md`
- **Implementation Plan:** `docs/superpowers/plans/2026-06-09-aw-monitor-implementation.md`

## Architecture

Monolith with modular codebase. Backend modules: `auth`, `users`, `audit`, `config_store`, `monitoring`, `ingestion`, `core`.

### Auth System (custom, from scratch)
- RS256 JWT (asymmetric keys), bcrypt (12 rounds)
- RBAC with 4 roles: SUPER_ADMIN > ADMIN > MANAGER > USER
- Session management with refresh tokens
- Password history (last 5), account lockout (5 failed = 15 min lock)

### PC Health Monitoring
- 4-tier checks: ICMP ping → SMB port 445 → admin share auth (smbprotocol) → folder access listing
- 5 statuses: ONLINE, OFFLINE, SMB_BLOCKED, AUTH_FAILED, DEGRADED
- WebSocket for real-time status push (only broadcasts on status changes)
- `/api/pcs/{id}/detail` returns uptime stats, tier diagnostics, shared folders, backup failure history

### Config Store
- AES-256 Fernet encrypted key-value store in DB
- Single ENCRYPTION_KEY env var, everything else stored encrypted
- Stores SMB credentials, health check intervals, Express API URL, webhook secrets

### Ingestion
- Queries client-files-viewer PostgreSQL directly (FileMetadata table) for scan stats and file listings
- Config key `express_api.base_url` holds the connection string: `postgresql://postgres:r00tadmin@192.168.70.10:5432/clientfiles`
- Polls on interval (default 30 min) to save scan snapshots
- `/api/files` and `/api/files/dates` proxy live queries to the external DB
- `/api/files/{file_id}/download` streams PDF from UNC path (token via query param for browser viewing)
- `/api/dashboard/stats` combined endpoint returns both scan + backup stats
- Receives webhook POSTs from PowerShell backup script for backup run events

### Frontend
- Dark-first operations theme — NOT generic AI-generated UI
- Custom color palette, distinctive design identity
- REST polling (30s via TanStack Query) for scan data, WebSocket for PC health
- Scans page: paginated file list (50/page), per-file View PDF / Download dropdown
- Dashboard: combined Quick Stats (scan + backup data), enriched PC detail slide-over

## Git Workflow

**Branch naming:** Numbered branches (e.g., `01-backend-scaffolding`, `02-database-models`, etc.)

**Process per branch:**
1. Create numbered branch from `main`
2. Implement task(s), commit
3. Push branch to remote
4. User manually creates PR and merges on github.com
5. Back in terminal: `git checkout main && git pull`
6. Create next numbered branch

**Do NOT:**
- Auto-merge branches
- Create PRs via CLI
- Push to main directly

## Implementation Phases (18 Tasks)

| # | Branch | Tasks | Description |
|---|--------|-------|-------------|
| 01 | `01-backend-scaffolding` | Task 1 | FastAPI app factory, core config/database/middleware |
| 02 | `02-database-models` | Task 2 | All SQLAlchemy models, Alembic setup, initial migration |
| 03 | `03-password-jwt` | Task 3 | bcrypt hashing, RS256 JWT, tests |
| 04 | `04-auth-service` | Task 4 | Auth schemas, login/session/password service, tests |
| 05 | `05-auth-router-rbac` | Task 5 | Auth router, RBAC, dependency injection, session endpoints |
| 06 | `06-user-management` | Task 6 | User CRUD, role assignment, admin endpoints |
| 07 | `07-audit-module` | Task 7 | Audit log service and endpoint |
| 08 | `08-config-store` | Task 8 | Fernet encryption, config CRUD, cache, defaults seeding |
| 09 | `09-monitoring-probes` | Task 9 | 4-tier health probes, health check service |
| 10 | `10-monitoring-scheduler` | Task 10 | Scheduler, WebSocket manager, monitoring router |
| 10 | `10-monitoring-ingestion` | Tasks 10-11 | Scheduler, WebSocket, Express poller, webhook, backup tracking |
| 11 | `11-frontend-scaffolding-auth` | Tasks 12-13 | Next.js init, dark theme, types, API client, auth store, login |
| 12 | `12-dashboard-health-grid` | Tasks 14-15 | Sidebar, topbar, dashboard shell, WebSocket health grid |
| 13 | `13-backup-scans-pages` | Task 16 | Backup runs list/detail, scans page, file listings, trend charts |
| 14 | `14-dashboard-scans-enhancements` | — | Scans pagination, PDF download, dashboard stats fix, PC detail modal |
| 15 | `15-admin-pages` | Task 17 | Config editor, user management, audit log pages |
| 16 | `16-profile-remaining` | Task 18 | Profile settings, PC management, root redirect |

## Related Projects

- **client-files-viewer** (`D:\Code\aw\client-files-viewer`): The existing Express.js/Next.js app that scans PCs, indexes PDFs, and serves them. This app (aw-monitor) consumes its scan results.
- **PowerShell script** (`D:\Code\aw\client-files-viewer\backend\scripts\Lab_Client_Assessments_Backupv2.ps1`): Runs daily, scans 24 PCs (PC1-PC24, 192.168.72.x subnet), copies PDFs to `\\192.168.70.10\Client_Assessments`.

## Network Context

- 12 lab PCs with DHCP IPs on 192.168.72.x subnet (see `backend/app/scripts/seed_pcs.py` for names and IPs)
- File server: 192.168.70.10
- Share path: `\\192.168.70.10\Client_Assessments`
- SMB admin share user: `infotech`
- Client-files-viewer DB: `postgresql://postgres:r00tadmin@192.168.70.10:5432/clientfiles`
- Backend default port: 8000 (runs on 8001 — Supabase Kong occupies 8000)
- Frontend default port: 3000
