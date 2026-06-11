# AW Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a monitoring dashboard for the AmericaWorks PDF backup pipeline — real-time PC health checks, backup run tracking, scan statistics, with custom auth and encrypted config store.

**Architecture:** Monolith FastAPI backend with modular codebase (auth, monitoring, ingestion, config_store, audit, core). Next.js frontend with custom dark theme. Supabase PostgreSQL as the sole database. WebSocket for real-time PC status, REST polling for scan data.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy async, Alembic, asyncpg, Fernet encryption, RS256 JWT, bcrypt | Next.js 14, Tailwind CSS, shadcn/ui, TanStack Query, Recharts, Zustand

**Spec:** `docs/superpowers/specs/2026-06-09-aw-monitor-design.md`

---

## File Map

### Backend (`backend/`)

| File | Responsibility |
|------|---------------|
| `pyproject.toml` | Dependencies, project metadata |
| `.env.example` | Template for environment variables |
| `app/__init__.py` | Empty package init |
| `app/main.py` | FastAPI app factory, lifespan, router includes |
| `app/dependencies.py` | Shared DI: `get_db`, `get_current_user`, `get_current_active_user` |
| `app/core/__init__.py` | Empty |
| `app/core/database.py` | SQLAlchemy async engine, session factory, Base model |
| `app/core/config.py` | Pydantic Settings reading `.env` |
| `app/core/middleware.py` | CORS config, request logging middleware |
| `app/auth/__init__.py` | Empty |
| `app/auth/models.py` | SQLAlchemy models: User, Session, PasswordHistory |
| `app/auth/schemas.py` | Pydantic schemas: LoginRequest, TokenResponse, UserRead, etc. |
| `app/auth/passwords.py` | bcrypt hash/verify, password policy validation |
| `app/auth/jwt.py` | RS256 token create/verify, key loading |
| `app/auth/service.py` | Login, refresh, logout, change-password logic |
| `app/auth/router.py` | `/api/auth/*` endpoints |
| `app/auth/rbac.py` | `require_role()` dependency factory |
| `app/users/__init__.py` | Empty |
| `app/users/schemas.py` | CreateUser, UpdateUser, UserListResponse |
| `app/users/service.py` | CRUD users, role assignment |
| `app/users/router.py` | `/api/users/*` endpoints |
| `app/audit/__init__.py` | Empty |
| `app/audit/models.py` | SQLAlchemy model: AuditLog |
| `app/audit/service.py` | `log_action()` helper |
| `app/audit/router.py` | `/api/audit-log` endpoint |
| `app/config_store/__init__.py` | Empty |
| `app/config_store/encryption.py` | Fernet encrypt/decrypt using ENCRYPTION_KEY |
| `app/config_store/models.py` | SQLAlchemy model: ConfigEntry |
| `app/config_store/schemas.py` | ConfigEntryRead, ConfigEntryUpdate |
| `app/config_store/service.py` | CRUD + in-memory cache + encrypt/decrypt on write/read |
| `app/config_store/defaults.py` | Default config entries seeded on first boot |
| `app/config_store/router.py` | `/api/config/*` endpoints |
| `app/monitoring/__init__.py` | Empty |
| `app/monitoring/models.py` | SQLAlchemy models: PC, HealthCheck |
| `app/monitoring/schemas.py` | PCRead, HealthCheckRead, PCCreate, etc. |
| `app/monitoring/probes.py` | Ping, SMB port, SMB auth, folder access probes |
| `app/monitoring/service.py` | Orchestrates 4-tier check for one PC |
| `app/monitoring/scheduler.py` | Background asyncio task, interval from config |
| `app/monitoring/websocket.py` | ConnectionManager, `/ws/health` endpoint |
| `app/monitoring/router.py` | `/api/pcs/*` endpoints, on-demand check triggers |
| `app/ingestion/__init__.py` | Empty |
| `app/ingestion/models.py` | SQLAlchemy models: ScanSnapshot, BackupRun |
| `app/ingestion/schemas.py` | BackupRunCreate, ScanSnapshotRead, etc. |
| `app/ingestion/express_client.py` | httpx async client polling Express API |
| `app/ingestion/service.py` | Webhook processing, status derivation, polling logic |
| `app/ingestion/router.py` | `/api/scans/*`, `/api/backup-runs/*`, `/api/webhooks/*` |
| `migrations/alembic.ini` | Alembic config |
| `migrations/env.py` | Alembic env pointing at SQLAlchemy Base |
| `tests/conftest.py` | Shared fixtures: test client, test DB, auth helpers |
| `tests/auth/test_passwords.py` | Password hashing + policy tests |
| `tests/auth/test_jwt.py` | Token create/verify tests |
| `tests/auth/test_service.py` | Login/refresh/logout tests |
| `tests/auth/test_router.py` | Auth endpoint integration tests |
| `tests/auth/test_rbac.py` | Role-based access tests |
| `tests/config_store/test_encryption.py` | Fernet encrypt/decrypt tests |
| `tests/config_store/test_service.py` | Config CRUD + cache tests |
| `tests/monitoring/test_probes.py` | Probe unit tests (mocked network) |
| `tests/monitoring/test_service.py` | Health check orchestration tests |
| `tests/ingestion/test_service.py` | Webhook processing + status derivation tests |

### Frontend (`frontend/`)

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies |
| `tailwind.config.ts` | Custom dark theme, status colors, typography |
| `app/layout.tsx` | Root layout, providers (QueryClient, auth) |
| `app/(auth)/login/page.tsx` | Login page |
| `app/dashboard/layout.tsx` | Dashboard shell: sidebar + topbar |
| `app/dashboard/page.tsx` | Main overview: health grid + backup summary |
| `app/dashboard/pcs/page.tsx` | PC list with filters |
| `app/dashboard/pcs/[id]/page.tsx` | Single PC detail + health timeline |
| `app/dashboard/backup-runs/page.tsx` | Backup run history table |
| `app/dashboard/backup-runs/[id]/page.tsx` | Single run detail |
| `app/dashboard/scans/page.tsx` | Scan history + trend charts |
| `app/dashboard/config/page.tsx` | Config store management |
| `app/dashboard/users/page.tsx` | User management |
| `app/dashboard/audit-log/page.tsx` | Audit log viewer |
| `app/dashboard/profile/page.tsx` | Profile, change password, sessions |
| `components/ui/*` | shadcn base components (customized) |
| `components/health-grid.tsx` | PC grid with status-grouped tiles |
| `components/pc-tile.tsx` | Individual PC status tile |
| `components/pc-slide-over.tsx` | Slide-over panel for PC health timeline |
| `components/backup-summary.tsx` | Latest backup run summary panel |
| `components/trend-sparkline.tsx` | 30-day trend sparkline |
| `components/alert-panel.tsx` | Quick alerts (offline PCs, failures) |
| `components/config-editor.tsx` | Config namespace/key editor with masked secrets |
| `components/status-badge.tsx` | Reusable status badge (ONLINE/OFFLINE/etc.) |
| `components/data-table.tsx` | Reusable sortable/filterable table |
| `hooks/use-health-stream.ts` | WebSocket hook for real-time PC status |
| `hooks/use-auth.ts` | Auth state + token refresh logic |
| `hooks/use-config.ts` | Config store data hook |
| `lib/api.ts` | Fetch wrapper with auth header injection + refresh |
| `lib/types.ts` | TypeScript types matching backend schemas |
| `lib/utils.ts` | Helpers: `cn()`, date formatting, status colors |
| `stores/auth-store.ts` | Zustand store for auth state |

---

## Branching Strategy

All work happens in the `D:\Code\aw\aw-monitor` project directory. Create a `develop` branch from `main` first. Each phase gets its own feature branch off `develop`, merged back when the phase is complete.

```
main
 └→ develop
      ├→ feat/backend-core    (Tasks 1-2)   → merge to develop
      ├→ feat/auth             (Tasks 3-6)   → merge to develop
      ├→ feat/audit            (Task 7)      → merge to develop
      ├→ feat/config-store     (Task 8)      → merge to develop
      ├→ feat/monitoring       (Tasks 9-10)  → merge to develop
      ├→ feat/ingestion        (Task 11)     → merge to develop
      ├→ feat/frontend-foundation (Tasks 12-14) → merge to develop
      └→ feat/frontend-pages   (Tasks 15-18) → merge to develop
```

**Before each phase:** `git checkout develop && git checkout -b feat/<phase-name>`
**After each phase:** `git checkout develop && git merge feat/<phase-name>`
**Commits happen after every task** within the phase branch.

---

## Task Dependency Order

```
Task 1 (scaffolding)
  └→ Task 2 (database + migrations)
       ├→ Task 3 (password + JWT)
       │    └→ Task 4 (auth models + service)
       │         └→ Task 5 (auth router + RBAC + dependencies)
       │              ├→ Task 6 (user management)
       │              ├→ Task 7 (audit module)
       │              ├→ Task 8 (config store)
       │              ├→ Task 9 (monitoring models + probes)
       │              │    └→ Task 10 (monitoring scheduler + WebSocket + router)
       │              └→ Task 11 (ingestion)
       └→ Task 12 (frontend scaffolding + theme)
            └→ Task 13 (frontend auth + login)
                 └→ Task 14 (frontend dashboard layout)
                      ├→ Task 15 (frontend PC health grid)
                      ├→ Task 16 (frontend backup runs + scans)
                      ├→ Task 17 (frontend config + users + audit)
                      └→ Task 18 (frontend profile/settings)
```

---

## Task 1: Backend Scaffolding + Core Module

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/database.py`
- Create: `backend/app/core/middleware.py`
- Create: `backend/app/main.py`

- [ ] **Step 1: Create `pyproject.toml` with all dependencies**

```toml
[project]
name = "aw-monitor"
version = "0.1.0"
description = "Monitoring dashboard for AmericaWorks PDF backup pipeline"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "sqlalchemy[asyncio]>=2.0.30",
    "asyncpg>=0.29.0",
    "alembic>=1.13.0",
    "pydantic-settings>=2.3.0",
    "python-jose[cryptography]>=3.3.0",
    "bcrypt>=4.1.0",
    "cryptography>=42.0.0",
    "smbprotocol>=1.13.0",
    "httpx>=0.27.0",
    "python-multipart>=0.0.9",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.2.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.27.0",
    "aiosqlite>=0.20.0",
]

[build-system]
requires = ["setuptools>=68.0"]
build-backend = "setuptools.backends._legacy:_Backend"
```

- [ ] **Step 2: Create `.env.example`**

```
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/aw_monitor
ENCRYPTION_KEY=base64-encoded-32-byte-key-here
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
CORS_ORIGINS=http://localhost:3000
```

- [ ] **Step 3: Create `app/core/config.py`**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    encryption_key: str
    jwt_private_key_path: str = "./keys/private.pem"
    jwt_public_key_path: str = "./keys/public.pem"
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
```

- [ ] **Step 4: Create `app/core/database.py`**

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

- [ ] **Step 5: Create `app/core/middleware.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings


def setup_middleware(app: FastAPI) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
```

- [ ] **Step 6: Create `app/main.py` with lifespan**

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.middleware import setup_middleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: background tasks will be registered here in later tasks
    yield
    # Shutdown: cleanup


def create_app() -> FastAPI:
    app = FastAPI(title="AW Monitor", version="0.1.0", lifespan=lifespan)
    setup_middleware(app)

    @app.get("/health")
    async def health_check():
        return {"status": "ok"}

    return app


app = create_app()
```

- [ ] **Step 7: Create empty `__init__.py` files**

Create empty files at:
- `backend/app/__init__.py`
- `backend/app/core/__init__.py`

- [ ] **Step 8: Install dependencies and verify server starts**

```bash
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Expected: Server starts, `GET /health` returns `{"status": "ok"}`

- [ ] **Step 9: Commit**

```bash
git init
git add .
git commit -m "feat: backend scaffolding with FastAPI, core module, health endpoint"
```

---

## Task 2: Database + Alembic + Initial Migration

**Files:**
- Create: `backend/migrations/alembic.ini`
- Create: `backend/migrations/env.py`
- Create: `backend/app/auth/__init__.py`
- Create: `backend/app/auth/models.py`
- Create: `backend/app/audit/__init__.py`
- Create: `backend/app/audit/models.py`
- Create: `backend/app/config_store/__init__.py`
- Create: `backend/app/config_store/models.py`
- Create: `backend/app/monitoring/__init__.py`
- Create: `backend/app/monitoring/models.py`
- Create: `backend/app/ingestion/__init__.py`
- Create: `backend/app/ingestion/models.py`

- [ ] **Step 1: Create all SQLAlchemy models — `app/auth/models.py`**

```python
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False, default="USER")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    must_change_pw: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    failed_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sessions: Mapped[list["Session"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    password_history: Mapped[list["PasswordHistory"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    refresh_token: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    device_info: Mapped[str | None] = mapped_column(String)
    ip_address: Mapped[str | None] = mapped_column(String)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="sessions")


class PasswordHistory(Base):
    __tablename__ = "password_history"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()
```

- [ ] **Step 2: Create `app/audit/models.py`**

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String, nullable=False)
    resource: Mapped[str | None] = mapped_column(String)
    details: Mapped[dict | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_audit_log_user", "user_id"),
        Index("idx_audit_log_created", "created_at"),
    )
```

- [ ] **Step 3: Create `app/config_store/models.py`**

```python
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ConfigEntry(Base):
    __tablename__ = "config_entries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    namespace: Mapped[str] = mapped_column(String, nullable=False)
    key: Mapped[str] = mapped_column(String, nullable=False)
    value: Mapped[str | None] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String)
    is_sensitive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("namespace", "key", name="uq_config_ns_key"),)
```

- [ ] **Step 4: Create `app/monitoring/models.py`**

```python
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Real, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PC(Base):
    __tablename__ = "pcs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    ip_address: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[str | None] = mapped_column(String)
    is_monitored: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    health_checks: Mapped[list["HealthCheck"]] = relationship(back_populates="pc", cascade="all, delete-orphan")


class HealthCheck(Base):
    __tablename__ = "health_checks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    pc_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pcs.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    ping_ms: Mapped[float | None] = mapped_column(Real)
    tier_reached: Mapped[int] = mapped_column(Integer, nullable=False)
    failure_reason: Mapped[str | None] = mapped_column(String)
    details: Mapped[dict | None] = mapped_column(JSONB)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    pc: Mapped["PC"] = relationship(back_populates="health_checks")

    __table_args__ = (Index("idx_health_checks_pc_time", "pc_id", checked_at.desc()),)
```

- [ ] **Step 5: Create `app/ingestion/models.py`**

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, Real, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ScanSnapshot(Base):
    __tablename__ = "scan_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    total_files: Mapped[int] = mapped_column(Integer, nullable=False)
    new_files: Mapped[int] = mapped_column(Integer, nullable=False)
    files_by_type: Mapped[dict | None] = mapped_column(JSONB)
    storage_total: Mapped[str | None] = mapped_column(String)
    storage_avg: Mapped[str | None] = mapped_column(String)
    source_api_url: Mapped[str | None] = mapped_column(String)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BackupRun(Base):
    __tablename__ = "backup_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    files_copied: Mapped[int] = mapped_column(Integer, nullable=False)
    files_skipped: Mapped[int] = mapped_column(Integer, nullable=False)
    duplicates: Mapped[int] = mapped_column(Integer, nullable=False)
    total_size_mb: Mapped[float] = mapped_column(Real, nullable=False)
    duration_seconds: Mapped[float] = mapped_column(Real, nullable=False)
    pcs_scanned: Mapped[int] = mapped_column(Integer, nullable=False)
    pcs_failed: Mapped[list | None] = mapped_column(JSONB)
    date_folder: Mapped[str | None] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 6: Create empty `__init__.py` for all modules**

Create empty files at:
- `backend/app/auth/__init__.py`
- `backend/app/audit/__init__.py`
- `backend/app/config_store/__init__.py`
- `backend/app/monitoring/__init__.py`
- `backend/app/ingestion/__init__.py`
- `backend/app/users/__init__.py`

- [ ] **Step 7: Initialize Alembic — `migrations/alembic.ini`**

```ini
[alembic]
script_location = migrations
sqlalchemy.url = postgresql+asyncpg://user:pass@localhost:5432/aw_monitor

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 8: Create `migrations/env.py`**

```python
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings
from app.core.database import Base

# Import all models so Alembic sees them
import app.auth.models  # noqa: F401
import app.audit.models  # noqa: F401
import app.config_store.models  # noqa: F401
import app.monitoring.models  # noqa: F401
import app.ingestion.models  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = settings.database_url
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(settings.database_url)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

- [ ] **Step 9: Create `migrations/script.py.mako`**

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 10: Generate and run the initial migration**

```bash
cd backend
alembic -c migrations/alembic.ini revision --autogenerate -m "initial schema"
alembic -c migrations/alembic.ini upgrade head
```

Expected: All tables created (users, sessions, password_history, audit_log, config_entries, pcs, health_checks, scan_snapshots, backup_runs)

- [ ] **Step 11: Commit**

```bash
git add .
git commit -m "feat: database models and initial Alembic migration for all modules"
```

---

## Task 3: Password Hashing + JWT Module

**Files:**
- Create: `backend/app/auth/passwords.py`
- Create: `backend/app/auth/jwt.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/auth/__init__.py`
- Create: `backend/tests/auth/test_passwords.py`
- Create: `backend/tests/auth/test_jwt.py`

- [ ] **Step 1: Write password tests — `tests/auth/test_passwords.py`**

```python
import pytest

from app.auth.passwords import hash_password, verify_password, validate_password_strength


def test_hash_and_verify():
    hashed = hash_password("SecurePass123!")
    assert hashed != "SecurePass123!"
    assert verify_password("SecurePass123!", hashed)


def test_verify_wrong_password():
    hashed = hash_password("SecurePass123!")
    assert not verify_password("WrongPassword1!", hashed)


def test_validate_strength_valid():
    errors = validate_password_strength("SecurePass123!")
    assert errors == []


def test_validate_strength_too_short():
    errors = validate_password_strength("Short1!")
    assert any("12 characters" in e for e in errors)


def test_validate_strength_no_uppercase():
    errors = validate_password_strength("securepass123!")
    assert any("uppercase" in e for e in errors)


def test_validate_strength_no_lowercase():
    errors = validate_password_strength("SECUREPASS123!")
    assert any("lowercase" in e for e in errors)


def test_validate_strength_no_digit():
    errors = validate_password_strength("SecurePassword!")
    assert any("digit" in e for e in errors)


def test_validate_strength_no_special():
    errors = validate_password_strength("SecurePass1234")
    assert any("special" in e for e in errors)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/auth/test_passwords.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.auth.passwords'`

- [ ] **Step 3: Implement `app/auth/passwords.py`**

```python
import bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def validate_password_strength(password: str) -> list[str]:
    errors = []
    if len(password) < 12:
        errors.append("Password must be at least 12 characters")
    if not any(c.isupper() for c in password):
        errors.append("Password must contain at least one uppercase letter")
    if not any(c.islower() for c in password):
        errors.append("Password must contain at least one lowercase letter")
    if not any(c.isdigit() for c in password):
        errors.append("Password must contain at least one digit")
    if not any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in password):
        errors.append("Password must contain at least one special character")
    return errors
```

- [ ] **Step 4: Run password tests to verify they pass**

```bash
pytest tests/auth/test_passwords.py -v
```

Expected: All 7 tests PASS

- [ ] **Step 5: Generate RSA key pair for JWT**

```bash
cd backend
mkdir keys
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
echo "keys/" >> .gitignore
```

- [ ] **Step 6: Write JWT tests — `tests/auth/test_jwt.py`**

```python
import uuid

import pytest

from app.auth.jwt import create_access_token, create_refresh_token, decode_access_token


def test_create_and_decode_access_token():
    user_id = uuid.uuid4()
    token = create_access_token(user_id=str(user_id), role="ADMIN")
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["role"] == "ADMIN"


def test_access_token_has_expiry():
    token = create_access_token(user_id="test-id", role="USER")
    payload = decode_access_token(token)
    assert "exp" in payload


def test_decode_invalid_token():
    payload = decode_access_token("invalid.token.here")
    assert payload is None


def test_create_refresh_token_is_unique():
    t1 = create_refresh_token()
    t2 = create_refresh_token()
    assert t1 != t2
```

- [ ] **Step 7: Run JWT tests to verify they fail**

```bash
pytest tests/auth/test_jwt.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.auth.jwt'`

- [ ] **Step 8: Implement `app/auth/jwt.py`**

```python
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

from jose import JWTError, jwt

from app.core.config import settings

_private_key: str | None = None
_public_key: str | None = None

ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
ALGORITHM = "RS256"


def _load_private_key() -> str:
    global _private_key
    if _private_key is None:
        _private_key = Path(settings.jwt_private_key_path).read_text()
    return _private_key


def _load_public_key() -> str:
    global _public_key
    if _public_key is None:
        _public_key = Path(settings.jwt_public_key_path).read_text()
    return _public_key


def create_access_token(user_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, _load_private_key(), algorithm=ALGORITHM)


def create_refresh_token() -> str:
    return secrets.token_urlsafe(64)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, _load_public_key(), algorithms=[ALGORITHM])
    except JWTError:
        return None
```

- [ ] **Step 9: Run JWT tests to verify they pass**

```bash
pytest tests/auth/test_jwt.py -v
```

Expected: All 4 tests PASS

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "feat: password hashing with bcrypt and RS256 JWT token management"
```

---

## Task 4: Auth Models, Schemas, and Service

**Files:**
- Create: `backend/app/auth/schemas.py`
- Create: `backend/app/auth/service.py`
- Create: `backend/tests/auth/test_service.py`

- [ ] **Step 1: Create `app/auth/schemas.py`**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: str
    password: str
    device_info: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    must_change_pw: bool
    last_login_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionRead(BaseModel):
    id: uuid.UUID
    device_info: str | None
    ip_address: str | None
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Write auth service tests — `tests/auth/test_service.py`**

```python
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base
from app.auth.models import User
from app.auth.passwords import hash_password
from app.auth.service import authenticate_user, create_session, refresh_session, revoke_session


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession):
    user = User(
        email="test@example.com",
        password_hash=hash_password("ValidPass123!"),
        first_name="Test",
        last_name="User",
        role="USER",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_authenticate_valid(db_session, test_user):
    user = await authenticate_user(db_session, "test@example.com", "ValidPass123!")
    assert user is not None
    assert user.email == "test@example.com"


@pytest.mark.asyncio
async def test_authenticate_wrong_password(db_session, test_user):
    user = await authenticate_user(db_session, "test@example.com", "WrongPass123!")
    assert user is None


@pytest.mark.asyncio
async def test_authenticate_nonexistent_email(db_session):
    user = await authenticate_user(db_session, "nobody@example.com", "ValidPass123!")
    assert user is None


@pytest.mark.asyncio
async def test_create_and_refresh_session(db_session, test_user):
    tokens = await create_session(db_session, test_user, ip_address="127.0.0.1")
    assert tokens.access_token
    assert tokens.refresh_token

    new_tokens = await refresh_session(db_session, tokens.refresh_token, ip_address="127.0.0.1")
    assert new_tokens is not None
    assert new_tokens.refresh_token != tokens.refresh_token


@pytest.mark.asyncio
async def test_refresh_invalid_token(db_session):
    result = await refresh_session(db_session, "invalid-token", ip_address="127.0.0.1")
    assert result is None


@pytest.mark.asyncio
async def test_revoke_session(db_session, test_user):
    tokens = await create_session(db_session, test_user, ip_address="127.0.0.1")
    revoked = await revoke_session(db_session, tokens.refresh_token)
    assert revoked is True

    result = await refresh_session(db_session, tokens.refresh_token, ip_address="127.0.0.1")
    assert result is None
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pytest tests/auth/test_service.py -v
```

Expected: FAIL — `cannot import name 'authenticate_user' from 'app.auth.service'`

- [ ] **Step 4: Implement `app/auth/service.py`**

```python
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token, create_refresh_token
from app.auth.models import PasswordHistory, Session, User
from app.auth.passwords import hash_password, verify_password, validate_password_strength
from app.auth.schemas import TokenResponse

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
REFRESH_TOKEN_DAYS = 7
PASSWORD_HISTORY_LIMIT = 5


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        return None

    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        return None

    if not verify_password(password, user.password_hash):
        user.failed_attempts += 1
        if user.failed_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
        await db.flush()
        return None

    user.failed_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    await db.flush()
    return user


async def create_session(
    db: AsyncSession,
    user: User,
    ip_address: str | None = None,
    device_info: str | None = None,
) -> TokenResponse:
    access_token = create_access_token(user_id=str(user.id), role=user.role)
    refresh_token = create_refresh_token()

    session = Session(
        user_id=user.id,
        refresh_token=refresh_token,
        device_info=device_info,
        ip_address=ip_address,
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS),
    )
    db.add(session)
    await db.flush()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


async def refresh_session(
    db: AsyncSession,
    refresh_token: str,
    ip_address: str | None = None,
) -> TokenResponse | None:
    result = await db.execute(select(Session).where(Session.refresh_token == refresh_token))
    session = result.scalar_one_or_none()

    if session is None or session.expires_at < datetime.now(timezone.utc):
        return None

    result = await db.execute(select(User).where(User.id == session.user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return None

    await db.delete(session)

    return await create_session(db, user, ip_address=ip_address, device_info=session.device_info)


async def revoke_session(db: AsyncSession, refresh_token: str) -> bool:
    result = await db.execute(select(Session).where(Session.refresh_token == refresh_token))
    session = result.scalar_one_or_none()
    if session is None:
        return False
    await db.delete(session)
    await db.flush()
    return True


async def change_password(db: AsyncSession, user: User, current_password: str, new_password: str) -> list[str]:
    if not verify_password(current_password, user.password_hash):
        return ["Current password is incorrect"]

    errors = validate_password_strength(new_password)
    if errors:
        return errors

    result = await db.execute(
        select(PasswordHistory)
        .where(PasswordHistory.user_id == user.id)
        .order_by(PasswordHistory.created_at.desc())
        .limit(PASSWORD_HISTORY_LIMIT)
    )
    history = result.scalars().all()
    for entry in history:
        if verify_password(new_password, entry.password_hash):
            return [f"Cannot reuse any of your last {PASSWORD_HISTORY_LIMIT} passwords"]

    db.add(PasswordHistory(user_id=user.id, password_hash=user.password_hash))
    user.password_hash = hash_password(new_password)
    user.must_change_pw = False
    await db.flush()
    return []
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/auth/test_service.py -v
```

Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: auth schemas and service — login, session management, password change"
```

---

## Task 5: Auth Router, RBAC, and Dependencies

**Files:**
- Create: `backend/app/auth/rbac.py`
- Create: `backend/app/dependencies.py`
- Create: `backend/app/auth/router.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/auth/test_rbac.py`

- [ ] **Step 1: Create `app/auth/rbac.py`** (role hierarchy only — `require_role` lives in `dependencies.py`)

```python
ROLE_HIERARCHY = {
    "SUPER_ADMIN": 4,
    "ADMIN": 3,
    "MANAGER": 2,
    "USER": 1,
}
```

- [ ] **Step 2: Create `app/dependencies.py`**

```python
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import decode_access_token
from app.auth.models import User
from app.auth.rbac import ROLE_HIERARCHY
from app.core.database import get_db

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def require_role(minimum_role: str):
    min_level = ROLE_HIERARCHY[minimum_role]

    async def _check(current_user: User = Depends(get_current_user)):
        user_level = ROLE_HIERARCHY.get(current_user.role, 0)
        if user_level < min_level:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return _check
```

- [ ] **Step 3: Create `app/auth/router.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserRead,
)
from app.auth.service import authenticate_user, change_password, create_session, refresh_session, revoke_session
from app.core.database import get_db
from app.dependencies import get_current_user
from app.auth.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, body.email, body.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return await create_session(db, user, ip_address=request.client.host, device_info=body.device_info)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)):
    tokens = await refresh_session(db, body.refresh_token, ip_address=request.client.host)
    if tokens is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    await revoke_session(db, body.refresh_token)


@router.get("/me", response_model=UserRead)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/change-password")
async def change_pw(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    errors = await change_password(db, current_user, body.current_password, body.new_password)
    if errors:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=errors)
    return {"message": "Password changed successfully"}
```

- [ ] **Step 4: Update `app/main.py` to include auth router**

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.auth.router import router as auth_router
from app.core.middleware import setup_middleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="AW Monitor", version="0.1.0", lifespan=lifespan)
    setup_middleware(app)

    app.include_router(auth_router)

    @app.get("/health")
    async def health_check():
        return {"status": "ok"}

    return app


app = create_app()
```

- [ ] **Step 5: Write RBAC test — `tests/auth/test_rbac.py`**

```python
import pytest

from app.auth.rbac import ROLE_HIERARCHY


def test_role_hierarchy_order():
    assert ROLE_HIERARCHY["SUPER_ADMIN"] > ROLE_HIERARCHY["ADMIN"]
    assert ROLE_HIERARCHY["ADMIN"] > ROLE_HIERARCHY["MANAGER"]
    assert ROLE_HIERARCHY["MANAGER"] > ROLE_HIERARCHY["USER"]


def test_all_roles_present():
    expected = {"SUPER_ADMIN", "ADMIN", "MANAGER", "USER"}
    assert set(ROLE_HIERARCHY.keys()) == expected
```

- [ ] **Step 6: Run all auth tests**

```bash
pytest tests/auth/ -v
```

Expected: All tests PASS

- [ ] **Step 7: Verify server starts with auth routes**

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Visit `http://localhost:8000/docs` — should show auth endpoints in Swagger UI.

- [ ] **Step 8: Add session management endpoints to `app/auth/router.py`**

Append to the existing router:

```python
from app.auth.schemas import SessionRead
from sqlalchemy import select
from app.auth.models import Session


@router.get("/sessions", response_model=list[SessionRead])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Session).where(Session.user_id == current_user.id))
    return result.scalars().all()


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import uuid as _uuid
    result = await db.execute(select(Session).where(Session.id == _uuid.UUID(session_id)))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    # Users can revoke own sessions; ADMIN+ can revoke any
    from app.auth.rbac import ROLE_HIERARCHY
    if session.user_id != current_user.id and ROLE_HIERARCHY.get(current_user.role, 0) < ROLE_HIERARCHY["ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot revoke another user's session")
    await db.delete(session)
```

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: auth router, RBAC middleware, session management, dependency injection"
```

---

## Task 6: User Management

**Files:**
- Create: `backend/app/users/schemas.py`
- Create: `backend/app/users/service.py`
- Create: `backend/app/users/router.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create `app/users/schemas.py`**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel


class CreateUserRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    role: str = "USER"


class UpdateUserRequest(BaseModel):
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    is_active: bool | None = None


class UpdateRoleRequest(BaseModel):
    role: str


class UserListResponse(BaseModel):
    users: list["UserRead"]
    total: int


class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    must_change_pw: bool
    last_login_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Create `app/users/service.py`**

```python
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.passwords import hash_password, validate_password_strength
from app.auth.rbac import ROLE_HIERARCHY
from app.users.schemas import CreateUserRequest, UpdateUserRequest


async def list_users(db: AsyncSession, skip: int = 0, limit: int = 50) -> tuple[list[User], int]:
    total_result = await db.execute(select(func.count(User.id)))
    total = total_result.scalar_one()
    result = await db.execute(select(User).offset(skip).limit(limit).order_by(User.created_at.desc()))
    return result.scalars().all(), total


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, data: CreateUserRequest) -> tuple[User | None, list[str]]:
    if data.role not in ROLE_HIERARCHY:
        return None, [f"Invalid role: {data.role}"]

    errors = validate_password_strength(data.password)
    if errors:
        return None, errors

    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        return None, ["Email already registered"]

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role=data.role,
        must_change_pw=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user, []


async def update_user(db: AsyncSession, user: User, data: UpdateUserRequest) -> User:
    if data.email is not None:
        user.email = data.email
    if data.first_name is not None:
        user.first_name = data.first_name
    if data.last_name is not None:
        user.last_name = data.last_name
    if data.is_active is not None:
        user.is_active = data.is_active
    await db.flush()
    await db.refresh(user)
    return user


async def update_role(db: AsyncSession, user: User, new_role: str) -> tuple[User | None, str | None]:
    if new_role not in ROLE_HIERARCHY:
        return None, f"Invalid role: {new_role}"
    user.role = new_role
    await db.flush()
    await db.refresh(user)
    return user, None


async def delete_user(db: AsyncSession, user: User) -> None:
    await db.delete(user)
    await db.flush()
```

- [ ] **Step 3: Create `app/users/router.py`**

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.core.database import get_db
from app.dependencies import require_role
from app.users.schemas import CreateUserRequest, UpdateRoleRequest, UpdateUserRequest, UserListResponse, UserRead
from app.users.service import create_user, delete_user, get_user_by_id, list_users, update_role, update_user

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=UserListResponse)
async def get_users(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    users, total = await list_users(db, skip, limit)
    return UserListResponse(users=users, total=total)


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_new_user(
    body: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    user, errors = await create_user(db, body)
    if errors:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=errors)
    return user


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    user = await get_user_by_id(db, str(user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserRead)
async def update_existing_user(
    user_id: uuid.UUID,
    body: UpdateUserRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    user = await get_user_by_id(db, str(user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return await update_user(db, user, body)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("SUPER_ADMIN")),
):
    user = await get_user_by_id(db, str(user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await delete_user(db, user)


@router.put("/{user_id}/role", response_model=UserRead)
async def change_role(
    user_id: uuid.UUID,
    body: UpdateRoleRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("SUPER_ADMIN")),
):
    user = await get_user_by_id(db, str(user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    updated, error = await update_role(db, user, body.role)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    return updated
```

- [ ] **Step 4: Add users router to `app/main.py`**

Add this import and include:

```python
from app.users.router import router as users_router
# ...inside create_app():
app.include_router(users_router)
```

- [ ] **Step 5: Verify Swagger UI shows user endpoints**

```bash
uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` — user CRUD endpoints should appear.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: user management — CRUD, role assignment, admin-only endpoints"
```

---

## Task 7: Audit Module

**Files:**
- Create: `backend/app/audit/service.py`
- Create: `backend/app/audit/router.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create `app/audit/service.py`**

```python
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.models import AuditLog


async def log_action(
    db: AsyncSession,
    user_id: uuid.UUID | None,
    action: str,
    resource: str | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
) -> None:
    entry = AuditLog(
        user_id=user_id,
        action=action,
        resource=resource,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    await db.flush()


async def get_audit_logs(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    action: str | None = None,
    user_id: str | None = None,
) -> tuple[list[AuditLog], int]:
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))

    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    if user_id:
        query = query.where(AuditLog.user_id == uuid.UUID(user_id))
        count_query = count_query.where(AuditLog.user_id == uuid.UUID(user_id))

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    result = await db.execute(query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all(), total
```

- [ ] **Step 2: Create `app/audit/router.py`**

```python
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.service import get_audit_logs
from app.auth.models import User
from app.core.database import get_db
from app.dependencies import require_role

router = APIRouter(prefix="/api/audit-log", tags=["audit"])


class AuditLogRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    action: str
    resource: str | None
    details: dict | None
    ip_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    logs: list[AuditLogRead]
    total: int


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    action: str | None = None,
    user_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    logs, total = await get_audit_logs(db, skip, limit, action, user_id)
    return AuditLogListResponse(logs=logs, total=total)
```

- [ ] **Step 3: Add audit router to `app/main.py`**

```python
from app.audit.router import router as audit_router
# ...inside create_app():
app.include_router(audit_router)
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: audit module — log_action helper and paginated audit log endpoint"
```

---

## Task 8: Config Store

**Files:**
- Create: `backend/app/config_store/encryption.py`
- Create: `backend/app/config_store/schemas.py`
- Create: `backend/app/config_store/service.py`
- Create: `backend/app/config_store/defaults.py`
- Create: `backend/app/config_store/router.py`
- Create: `backend/tests/config_store/__init__.py`
- Create: `backend/tests/config_store/test_encryption.py`
- Create: `backend/tests/config_store/test_service.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write encryption tests — `tests/config_store/test_encryption.py`**

```python
import os

import pytest

os.environ.setdefault("ENCRYPTION_KEY", "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcw==")

from app.config_store.encryption import decrypt_value, encrypt_value


def test_encrypt_decrypt_roundtrip():
    plaintext = "my-secret-password"
    encrypted = encrypt_value(plaintext)
    assert encrypted != plaintext
    assert decrypt_value(encrypted) == plaintext


def test_encrypted_values_differ():
    encrypted1 = encrypt_value("same-value")
    encrypted2 = encrypt_value("same-value")
    # Fernet uses random IV, so encryptions differ
    assert encrypted1 != encrypted2


def test_decrypt_both():
    e1 = encrypt_value("same-value")
    e2 = encrypt_value("same-value")
    assert decrypt_value(e1) == "same-value"
    assert decrypt_value(e2) == "same-value"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/config_store/test_encryption.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement `app/config_store/encryption.py`**

```python
import base64

from cryptography.fernet import Fernet

from app.core.config import settings

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key_bytes = base64.urlsafe_b64decode(settings.encryption_key)
        if len(key_bytes) != 32:
            raise ValueError("ENCRYPTION_KEY must be 32 bytes (base64-encoded)")
        fernet_key = base64.urlsafe_b64encode(key_bytes)
        _fernet = Fernet(fernet_key)
    return _fernet


def encrypt_value(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_value(ciphertext: str) -> str:
    return _get_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
```

- [ ] **Step 4: Run encryption tests to verify they pass**

```bash
pytest tests/config_store/test_encryption.py -v
```

Expected: All 3 tests PASS

- [ ] **Step 5: Create `app/config_store/schemas.py`**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel


class ConfigEntryRead(BaseModel):
    id: uuid.UUID
    namespace: str
    key: str
    value: str | None
    type: str
    description: str | None
    is_sensitive: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConfigEntryUpdate(BaseModel):
    value: str


class ConfigRevealRequest(BaseModel):
    password: str
```

- [ ] **Step 6: Create `app/config_store/service.py`**

```python
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config_store.encryption import decrypt_value, encrypt_value
from app.config_store.models import ConfigEntry

_cache: dict[str, Any] = {}
MASKED = "•" * 8


def _cache_key(namespace: str, key: str) -> str:
    return f"{namespace}.{key}"


async def load_cache(db: AsyncSession) -> None:
    result = await db.execute(select(ConfigEntry))
    entries = result.scalars().all()
    for entry in entries:
        ck = _cache_key(entry.namespace, entry.key)
        if entry.is_sensitive and entry.value:
            _cache[ck] = decrypt_value(entry.value)
        else:
            _cache[ck] = entry.value


def get_cached(namespace: str, key: str) -> Any:
    return _cache.get(_cache_key(namespace, key))


def get_cached_int(namespace: str, key: str, default: int = 0) -> int:
    val = get_cached(namespace, key)
    if val is None:
        return default
    return int(val)


async def list_entries(db: AsyncSession, namespace: str | None = None) -> list[ConfigEntry]:
    query = select(ConfigEntry).order_by(ConfigEntry.namespace, ConfigEntry.key)
    if namespace:
        query = query.where(ConfigEntry.namespace == namespace)
    result = await db.execute(query)
    return result.scalars().all()


async def get_entry(db: AsyncSession, namespace: str, key: str) -> ConfigEntry | None:
    result = await db.execute(
        select(ConfigEntry).where(ConfigEntry.namespace == namespace, ConfigEntry.key == key)
    )
    return result.scalar_one_or_none()


async def upsert_entry(
    db: AsyncSession,
    namespace: str,
    key: str,
    value: str,
    updated_by: uuid.UUID | None = None,
) -> ConfigEntry:
    entry = await get_entry(db, namespace, key)
    if entry is None:
        raise ValueError(f"Config entry {namespace}.{key} not found")

    if entry.is_sensitive:
        entry.value = encrypt_value(value)
    else:
        entry.value = value
    entry.updated_by = updated_by
    await db.flush()
    await db.refresh(entry)

    _cache[_cache_key(namespace, key)] = value
    return entry


async def reveal_entry(db: AsyncSession, namespace: str, key: str) -> str | None:
    entry = await get_entry(db, namespace, key)
    if entry is None or not entry.is_sensitive or entry.value is None:
        return None
    return decrypt_value(entry.value)


def mask_entry_value(entry: ConfigEntry) -> str | None:
    if entry.is_sensitive:
        return MASKED if entry.value else None
    return entry.value
```

- [ ] **Step 7: Create `app/config_store/defaults.py`**

```python
import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config_store.encryption import encrypt_value
from app.config_store.models import ConfigEntry

DEFAULT_ENTRIES = [
    ("smb", "username", None, "secret", "SMB admin share username", True),
    ("smb", "password", None, "secret", "SMB admin share password", True),
    ("smb", "domain", None, "string", "SMB domain (e.g., WORKGROUP)", False),
    ("health", "interval_minutes", "10", "number", "Minutes between health checks", False),
    ("health", "ping_timeout_ms", "2000", "number", "Ping timeout in milliseconds", False),
    ("health", "smb_timeout_ms", "3000", "number", "SMB port check timeout in milliseconds", False),
    ("health", "retention_days", "90", "number", "Days to retain health check records", False),
    ("express_api", "base_url", None, "string", "Base URL of the existing Express API", False),
    ("express_api", "poll_minutes", "30", "number", "Minutes between Express API polls", False),
    ("webhook", "secret", None, "secret", "Shared secret for webhook authentication", True),
    ("notifications", "enabled", "false", "boolean", "Enable email notifications", False),
    ("notifications", "smtp_host", None, "string", "SMTP server host", False),
    ("notifications", "smtp_port", "587", "number", "SMTP server port", False),
    ("notifications", "smtp_user", None, "secret", "SMTP username", True),
    ("notifications", "smtp_pass", None, "secret", "SMTP password", True),
    ("notifications", "recipients", "[]", "json", "Notification recipients (JSON array)", False),
]


async def seed_defaults(db: AsyncSession) -> int:
    created = 0
    for namespace, key, value, entry_type, description, is_sensitive in DEFAULT_ENTRIES:
        existing = await db.execute(
            select(ConfigEntry).where(ConfigEntry.namespace == namespace, ConfigEntry.key == key)
        )
        if existing.scalar_one_or_none() is not None:
            continue

        actual_value = value
        if namespace == "webhook" and key == "secret" and value is None:
            actual_value = encrypt_value(secrets.token_urlsafe(32))
        elif is_sensitive and actual_value is not None:
            actual_value = encrypt_value(actual_value)

        entry = ConfigEntry(
            namespace=namespace,
            key=key,
            value=actual_value,
            type=entry_type,
            description=description,
            is_sensitive=is_sensitive,
        )
        db.add(entry)
        created += 1

    await db.flush()
    return created
```

- [ ] **Step 8: Create `app/config_store/router.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.passwords import verify_password
from app.config_store.defaults import seed_defaults
from app.config_store.schemas import ConfigEntryRead, ConfigEntryUpdate, ConfigRevealRequest
from app.config_store.service import get_entry, list_entries, mask_entry_value, reveal_entry, upsert_entry
from app.core.database import get_db
from app.dependencies import require_role

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("", response_model=list[ConfigEntryRead])
async def get_all_config(
    namespace: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    entries = await list_entries(db, namespace)
    for entry in entries:
        entry.value = mask_entry_value(entry)
    return entries


@router.get("/{namespace}/{key}", response_model=ConfigEntryRead)
async def get_config_entry(
    namespace: str,
    key: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    entry = await get_entry(db, namespace, key)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config entry not found")
    entry.value = mask_entry_value(entry)
    return entry


@router.put("/{namespace}/{key}", response_model=ConfigEntryRead)
async def update_config_entry(
    namespace: str,
    key: str,
    body: ConfigEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    entry = await get_entry(db, namespace, key)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config entry not found")

    if entry.is_sensitive and current_user.role != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only SUPER_ADMIN can modify secrets")

    updated = await upsert_entry(db, namespace, key, body.value, updated_by=current_user.id)
    updated.value = mask_entry_value(updated)
    return updated


@router.post("/{namespace}/{key}/reveal")
async def reveal_config_secret(
    namespace: str,
    key: str,
    body: ConfigRevealRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("SUPER_ADMIN")),
):
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Password verification failed")

    value = await reveal_entry(db, namespace, key)
    if value is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Secret not found")
    return {"value": value}


@router.post("/seed")
async def seed_config(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("SUPER_ADMIN")),
):
    created = await seed_defaults(db)
    return {"message": f"Seeded {created} config entries"}
```

- [ ] **Step 9: Add config router to `app/main.py` and load cache on startup**

Add to imports and `create_app`:

```python
from app.config_store.router import router as config_router
from app.config_store.service import load_cache
from app.core.database import async_session_factory

# In lifespan:
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_session_factory() as db:
        await load_cache(db)
    yield

# In create_app:
app.include_router(config_router)
```

- [ ] **Step 10: Run all tests**

```bash
pytest tests/ -v
```

Expected: All tests PASS

- [ ] **Step 11: Commit**

```bash
git add .
git commit -m "feat: config store — Fernet encryption, in-memory cache, CRUD endpoints, defaults seeding"
```

---

## Task 9: Monitoring — Models, Probes, and Service

**Files:**
- Create: `backend/app/monitoring/schemas.py`
- Create: `backend/app/monitoring/probes.py`
- Create: `backend/app/monitoring/service.py`
- Create: `backend/tests/monitoring/__init__.py`
- Create: `backend/tests/monitoring/test_probes.py`
- Create: `backend/tests/monitoring/test_service.py`

- [ ] **Step 1: Create `app/monitoring/schemas.py`**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel


class PCCreate(BaseModel):
    name: str
    ip_address: str
    location: str | None = None
    is_monitored: bool = True


class PCUpdate(BaseModel):
    name: str | None = None
    ip_address: str | None = None
    location: str | None = None
    is_monitored: bool | None = None


class PCRead(BaseModel):
    id: uuid.UUID
    name: str
    ip_address: str
    location: str | None
    is_monitored: bool
    created_at: datetime
    latest_status: str | None = None
    latest_ping_ms: float | None = None

    model_config = {"from_attributes": True}


class HealthCheckRead(BaseModel):
    id: uuid.UUID
    pc_id: uuid.UUID
    status: str
    ping_ms: float | None
    tier_reached: int
    failure_reason: str | None
    details: dict | None
    checked_at: datetime

    model_config = {"from_attributes": True}


class PCHealthSnapshot(BaseModel):
    pc_id: str
    pc_name: str
    ip_address: str
    status: str
    ping_ms: float | None
    tier_reached: int
    failure_reason: str | None
    checked_at: datetime | None
```

- [ ] **Step 2: Write probe tests — `tests/monitoring/test_probes.py`**

```python
import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from app.monitoring.probes import probe_ping, probe_smb_port, ProbeResult


@pytest.mark.asyncio
async def test_probe_ping_success():
    mock_process = AsyncMock()
    mock_process.returncode = 0
    mock_process.communicate = AsyncMock(return_value=(b"time=5ms", b""))

    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        result = await probe_ping("192.168.1.1", timeout_ms=2000)
        assert result.success is True


@pytest.mark.asyncio
async def test_probe_ping_failure():
    mock_process = AsyncMock()
    mock_process.returncode = 1
    mock_process.communicate = AsyncMock(return_value=(b"Request timed out", b""))

    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        result = await probe_ping("192.168.1.1", timeout_ms=2000)
        assert result.success is False


@pytest.mark.asyncio
async def test_probe_smb_port_success():
    mock_writer = AsyncMock()
    mock_writer.close = AsyncMock()
    mock_writer.wait_closed = AsyncMock()

    with patch("asyncio.open_connection", return_value=(AsyncMock(), mock_writer)):
        result = await probe_smb_port("192.168.1.1", timeout_s=3)
        assert result.success is True


@pytest.mark.asyncio
async def test_probe_smb_port_timeout():
    with patch("asyncio.open_connection", side_effect=asyncio.TimeoutError()):
        result = await probe_smb_port("192.168.1.1", timeout_s=3)
        assert result.success is False
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pytest tests/monitoring/test_probes.py -v
```

Expected: FAIL

- [ ] **Step 4: Implement `app/monitoring/probes.py`**

```python
import asyncio
import re
import sys
import time
from dataclasses import dataclass


@dataclass
class ProbeResult:
    success: bool
    duration_ms: float = 0.0
    detail: str = ""
    data: dict | None = None


async def probe_ping(ip: str, timeout_ms: int = 2000) -> ProbeResult:
    start = time.monotonic()
    try:
        if sys.platform == "win32":
            cmd = ["ping", "-n", "1", "-w", str(timeout_ms), ip]
        else:
            timeout_s = max(1, timeout_ms // 1000)
            cmd = ["ping", "-c", "1", "-W", str(timeout_s), ip]

        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await asyncio.wait_for(process.communicate(), timeout=timeout_ms / 1000 + 2)
        elapsed = (time.monotonic() - start) * 1000

        if process.returncode == 0:
            ping_ms = elapsed
            match = re.search(r"time[=<](\d+\.?\d*)", stdout.decode("utf-8", errors="replace"))
            if match:
                ping_ms = float(match.group(1))
            return ProbeResult(success=True, duration_ms=ping_ms, detail="Ping OK", data={"ping_ms": ping_ms})
        return ProbeResult(success=False, duration_ms=elapsed, detail="No response")
    except (asyncio.TimeoutError, OSError) as e:
        elapsed = (time.monotonic() - start) * 1000
        return ProbeResult(success=False, duration_ms=elapsed, detail=str(e))


async def probe_smb_port(ip: str, timeout_s: int = 3) -> ProbeResult:
    start = time.monotonic()
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(ip, 445), timeout=timeout_s)
        elapsed = (time.monotonic() - start) * 1000
        writer.close()
        await writer.wait_closed()
        return ProbeResult(success=True, duration_ms=elapsed, detail="Port 445 open")
    except (asyncio.TimeoutError, OSError, ConnectionRefusedError) as e:
        elapsed = (time.monotonic() - start) * 1000
        return ProbeResult(success=False, duration_ms=elapsed, detail=str(e))


async def probe_smb_auth(ip: str, username: str, password: str, domain: str = "", timeout_s: int = 5) -> ProbeResult:
    start = time.monotonic()
    try:
        from smbprotocol.connection import Connection
        from smbprotocol.session import Session as SMBSession

        conn = Connection(uuid.uuid4(), ip, 445)
        await asyncio.get_event_loop().run_in_executor(None, conn.connect)

        session = SMBSession(conn, username, password, domain=domain if domain else None)
        await asyncio.get_event_loop().run_in_executor(None, session.connect)

        elapsed = (time.monotonic() - start) * 1000

        await asyncio.get_event_loop().run_in_executor(None, session.disconnect, True)
        await asyncio.get_event_loop().run_in_executor(None, conn.disconnect, True)

        return ProbeResult(success=True, duration_ms=elapsed, detail="SMB auth OK")
    except Exception as e:
        elapsed = (time.monotonic() - start) * 1000
        return ProbeResult(success=False, duration_ms=elapsed, detail=str(e))


async def probe_folder_access(
    ip: str, username: str, password: str, domain: str = "", timeout_s: int = 5
) -> ProbeResult:
    start = time.monotonic()
    try:
        from smbclient import listdir, register_session

        await asyncio.get_event_loop().run_in_executor(
            None, lambda: register_session(ip, username=username, password=password)
        )

        users_path = f"\\\\{ip}\\C$\\Users"
        entries = await asyncio.get_event_loop().run_in_executor(None, lambda: listdir(users_path))

        folders_found = []
        target_folders = {"Desktop", "Documents", "Downloads"}
        skip_users = {"Public", "Default", "Default User", "All Users"}

        for user_dir in entries:
            if user_dir in skip_users:
                continue
            for target in target_folders:
                try:
                    sub_path = f"{users_path}\\{user_dir}\\{target}"
                    await asyncio.get_event_loop().run_in_executor(None, lambda p=sub_path: listdir(p))
                    folders_found.append(f"{user_dir}/{target}")
                except OSError:
                    pass

        elapsed = (time.monotonic() - start) * 1000

        if folders_found:
            return ProbeResult(
                success=True, duration_ms=elapsed, detail=f"Found {len(folders_found)} folders",
                data={"folders_found": folders_found},
            )
        return ProbeResult(success=False, duration_ms=elapsed, detail="No accessible user folders found")
    except Exception as e:
        elapsed = (time.monotonic() - start) * 1000
        return ProbeResult(success=False, duration_ms=elapsed, detail=str(e))


import uuid  # noqa: E402 (needed by probe_smb_auth)
```

- [ ] **Step 5: Run probe tests**

```bash
pytest tests/monitoring/test_probes.py -v
```

Expected: All 4 tests PASS

- [ ] **Step 6: Implement `app/monitoring/service.py`**

```python
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config_store.service import get_cached, get_cached_int
from app.monitoring.models import HealthCheck, PC
from app.monitoring.probes import probe_folder_access, probe_ping, probe_smb_auth, probe_smb_port
from app.monitoring.schemas import PCHealthSnapshot


async def check_pc_health(db: AsyncSession, pc: PC) -> HealthCheck:
    username = get_cached("smb", "username") or ""
    password = get_cached("smb", "password") or ""
    domain = get_cached("smb", "domain") or ""
    ping_timeout = get_cached_int("health", "ping_timeout_ms", 2000)
    smb_timeout_s = get_cached_int("health", "smb_timeout_ms", 3000) // 1000

    tier_timings = {}
    ping_ms_val = None

    # Tier 1: Ping
    ping_result = await probe_ping(pc.ip_address, timeout_ms=ping_timeout)
    tier_timings["ping_ms"] = ping_result.duration_ms
    if not ping_result.success:
        return await _save_check(db, pc, "OFFLINE", 0, ping_result.detail, tier_timings, None)

    ping_ms_val = ping_result.data.get("ping_ms") if ping_result.data else ping_result.duration_ms

    # Tier 2: SMB Port
    smb_result = await probe_smb_port(pc.ip_address, timeout_s=smb_timeout_s)
    tier_timings["smb_ms"] = smb_result.duration_ms
    if not smb_result.success:
        return await _save_check(db, pc, "SMB_BLOCKED", 1, smb_result.detail, tier_timings, ping_ms_val)

    # Tier 3: Auth
    auth_result = await probe_smb_auth(pc.ip_address, username, password, domain)
    tier_timings["auth_ms"] = auth_result.duration_ms
    if not auth_result.success:
        return await _save_check(db, pc, "AUTH_FAILED", 2, auth_result.detail, tier_timings, ping_ms_val)

    # Tier 4: Folder Access
    folder_result = await probe_folder_access(pc.ip_address, username, password, domain)
    tier_timings["folder_ms"] = folder_result.duration_ms
    if not folder_result.success:
        return await _save_check(db, pc, "DEGRADED", 3, folder_result.detail, tier_timings, ping_ms_val)

    folders = folder_result.data.get("folders_found", []) if folder_result.data else []
    details = {"tier_timings": tier_timings, "folders_found": folders}
    return await _save_check(db, pc, "ONLINE", 4, None, details, ping_ms_val)


async def _save_check(
    db: AsyncSession,
    pc: PC,
    status: str,
    tier: int,
    failure_reason: str | None,
    details: dict,
    ping_ms: float | None,
) -> HealthCheck:
    check = HealthCheck(
        pc_id=pc.id,
        status=status,
        ping_ms=ping_ms,
        tier_reached=tier,
        failure_reason=failure_reason,
        details=details if not isinstance(details, dict) or "tier_timings" in details else {"tier_timings": details},
        checked_at=datetime.now(timezone.utc),
    )
    db.add(check)
    await db.flush()
    return check


async def get_all_pcs(db: AsyncSession) -> list[PC]:
    result = await db.execute(select(PC).order_by(PC.name))
    return result.scalars().all()


async def get_monitored_pcs(db: AsyncSession) -> list[PC]:
    result = await db.execute(select(PC).where(PC.is_monitored == True).order_by(PC.name))  # noqa: E712
    return result.scalars().all()


async def get_latest_snapshot(db: AsyncSession) -> list[PCHealthSnapshot]:
    pcs = await get_all_pcs(db)
    snapshots = []
    for pc in pcs:
        result = await db.execute(
            select(HealthCheck)
            .where(HealthCheck.pc_id == pc.id)
            .order_by(HealthCheck.checked_at.desc())
            .limit(1)
        )
        latest = result.scalar_one_or_none()
        snapshots.append(PCHealthSnapshot(
            pc_id=str(pc.id),
            pc_name=pc.name,
            ip_address=pc.ip_address,
            status=latest.status if latest else "UNKNOWN",
            ping_ms=latest.ping_ms if latest else None,
            tier_reached=latest.tier_reached if latest else 0,
            failure_reason=latest.failure_reason if latest else None,
            checked_at=latest.checked_at if latest else None,
        ))
    return snapshots


async def get_pc_health_history(
    db: AsyncSession, pc_id: str, limit: int = 100
) -> list[HealthCheck]:
    result = await db.execute(
        select(HealthCheck)
        .where(HealthCheck.pc_id == pc_id)
        .order_by(HealthCheck.checked_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: PC health monitoring — 4-tier probes, health check service, schemas"
```

---

## Task 10: Monitoring — Scheduler, WebSocket, and Router

**Files:**
- Create: `backend/app/monitoring/scheduler.py`
- Create: `backend/app/monitoring/websocket.py`
- Create: `backend/app/monitoring/router.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create `app/monitoring/websocket.py`**

```python
import json
from datetime import datetime

from fastapi import WebSocket

from app.monitoring.schemas import PCHealthSnapshot


class ConnectionManager:
    def __init__(self):
        self._connections: list[WebSocket] = []
        self._last_snapshot: dict[str, PCHealthSnapshot] = {}

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.append(websocket)
        if self._last_snapshot:
            await websocket.send_text(json.dumps({
                "type": "snapshot",
                "data": [s.model_dump(mode="json") for s in self._last_snapshot.values()],
            }, default=str))

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self._connections:
            self._connections.remove(websocket)

    async def broadcast_change(self, snapshot: PCHealthSnapshot) -> None:
        previous = self._last_snapshot.get(snapshot.pc_id)
        self._last_snapshot[snapshot.pc_id] = snapshot

        if previous and previous.status == snapshot.status:
            return

        message = json.dumps({
            "type": "status_change",
            "data": snapshot.model_dump(mode="json"),
        }, default=str)

        dead = []
        for ws in self._connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    def update_snapshot(self, snapshot: PCHealthSnapshot) -> None:
        self._last_snapshot[snapshot.pc_id] = snapshot


health_manager = ConnectionManager()
```

- [ ] **Step 2: Create `app/monitoring/scheduler.py`**

```python
import asyncio
import logging
import random

from app.config_store.service import get_cached_int
from app.core.database import async_session_factory
from app.monitoring.models import PC
from app.monitoring.schemas import PCHealthSnapshot
from app.monitoring.service import check_pc_health, get_monitored_pcs
from app.monitoring.websocket import health_manager

logger = logging.getLogger(__name__)

_scheduler_task: asyncio.Task | None = None


async def _run_all_checks() -> None:
    async with async_session_factory() as db:
        pcs = await get_monitored_pcs(db)
        if not pcs:
            return

        async def _check_one(pc: PC):
            try:
                async with async_session_factory() as check_db:
                    result = await check_pc_health(check_db, pc)
                    await check_db.commit()
                    snapshot = PCHealthSnapshot(
                        pc_id=str(pc.id),
                        pc_name=pc.name,
                        ip_address=pc.ip_address,
                        status=result.status,
                        ping_ms=result.ping_ms,
                        tier_reached=result.tier_reached,
                        failure_reason=result.failure_reason,
                        checked_at=result.checked_at,
                    )
                    await health_manager.broadcast_change(snapshot)
            except Exception as e:
                logger.error(f"Health check failed for {pc.name}: {e}")

        # Stagger: spread checks over 30 seconds
        tasks = []
        for i, pc in enumerate(pcs):
            delay = (30.0 / max(len(pcs), 1)) * i
            tasks.append(_delayed_check(pc, delay, _check_one))
        await asyncio.gather(*tasks)


async def _delayed_check(pc, delay, check_fn):
    await asyncio.sleep(delay)
    await check_fn(pc)


async def _scheduler_loop() -> None:
    while True:
        try:
            await _run_all_checks()
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")

        interval = get_cached_int("health", "interval_minutes", 10) * 60
        await asyncio.sleep(interval)


def start_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task is None or _scheduler_task.done():
        _scheduler_task = asyncio.create_task(_scheduler_loop())
        logger.info("Health check scheduler started")


def stop_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        _scheduler_task = None
```

- [ ] **Step 3: Create `app/monitoring/router.py`**

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.core.database import get_db
from app.dependencies import require_role
from app.monitoring.models import HealthCheck, PC
from app.monitoring.schemas import HealthCheckRead, PCCreate, PCRead, PCUpdate
from app.monitoring.service import check_pc_health, get_all_pcs, get_latest_snapshot, get_pc_health_history
from app.monitoring.websocket import health_manager
from app.monitoring.schemas import PCHealthSnapshot

router = APIRouter(prefix="/api/pcs", tags=["monitoring"])


@router.get("", response_model=list[PCRead])
async def list_pcs(db: AsyncSession = Depends(get_db), _: User = Depends(require_role("USER"))):
    pcs = await get_all_pcs(db)
    result = []
    for pc in pcs:
        latest = await db.execute(
            select(HealthCheck).where(HealthCheck.pc_id == pc.id).order_by(HealthCheck.checked_at.desc()).limit(1)
        )
        check = latest.scalar_one_or_none()
        pc_read = PCRead.model_validate(pc)
        if check:
            pc_read.latest_status = check.status
            pc_read.latest_ping_ms = check.ping_ms
        result.append(pc_read)
    return result


@router.post("", response_model=PCRead, status_code=status.HTTP_201_CREATED)
async def create_pc(
    body: PCCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    pc = PC(name=body.name, ip_address=body.ip_address, location=body.location, is_monitored=body.is_monitored)
    db.add(pc)
    await db.flush()
    await db.refresh(pc)
    return pc


@router.get("/health/snapshot")
async def get_health_snapshot(db: AsyncSession = Depends(get_db), _: User = Depends(require_role("USER"))):
    return await get_latest_snapshot(db)


@router.get("/{pc_id}", response_model=PCRead)
async def get_pc(
    pc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("USER")),
):
    result = await db.execute(select(PC).where(PC.id == pc_id))
    pc = result.scalar_one_or_none()
    if pc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PC not found")
    return pc


@router.put("/{pc_id}", response_model=PCRead)
async def update_pc(
    pc_id: uuid.UUID,
    body: PCUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    result = await db.execute(select(PC).where(PC.id == pc_id))
    pc = result.scalar_one_or_none()
    if pc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PC not found")
    if body.name is not None:
        pc.name = body.name
    if body.ip_address is not None:
        pc.ip_address = body.ip_address
    if body.location is not None:
        pc.location = body.location
    if body.is_monitored is not None:
        pc.is_monitored = body.is_monitored
    await db.flush()
    await db.refresh(pc)
    return pc


@router.delete("/{pc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pc(
    pc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("SUPER_ADMIN")),
):
    result = await db.execute(select(PC).where(PC.id == pc_id))
    pc = result.scalar_one_or_none()
    if pc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PC not found")
    await db.delete(pc)


@router.get("/{pc_id}/health", response_model=list[HealthCheckRead])
async def get_health_history(
    pc_id: uuid.UUID,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("USER")),
):
    return await get_pc_health_history(db, str(pc_id), limit)


@router.post("/{pc_id}/check")
async def trigger_check(
    pc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    result = await db.execute(select(PC).where(PC.id == pc_id))
    pc = result.scalar_one_or_none()
    if pc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PC not found")
    check = await check_pc_health(db, pc)
    snapshot = PCHealthSnapshot(
        pc_id=str(pc.id), pc_name=pc.name, ip_address=pc.ip_address,
        status=check.status, ping_ms=check.ping_ms, tier_reached=check.tier_reached,
        failure_reason=check.failure_reason, checked_at=check.checked_at,
    )
    await health_manager.broadcast_change(snapshot)
    return HealthCheckRead.model_validate(check)


@router.post("/check-all")
async def trigger_check_all(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    from app.monitoring.scheduler import _run_all_checks
    await _run_all_checks()
    return {"message": "Health checks triggered for all monitored PCs"}
```

- [ ] **Step 4: Add WebSocket endpoint to `app/main.py`**

```python
from fastapi import WebSocket, WebSocketDisconnect
from app.monitoring.router import router as monitoring_router
from app.monitoring.websocket import health_manager
from app.monitoring.scheduler import start_scheduler, stop_scheduler

# In lifespan:
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_session_factory() as db:
        await load_cache(db)
    start_scheduler()
    yield
    stop_scheduler()

# In create_app, after other routers:
app.include_router(monitoring_router)

@app.websocket("/ws/health")
async def health_ws(websocket: WebSocket):
    await health_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        health_manager.disconnect(websocket)
```

- [ ] **Step 5: Run all tests**

```bash
pytest tests/ -v
```

Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: monitoring scheduler, WebSocket manager, PC CRUD and health check endpoints"
```

---

## Task 11: Ingestion Module

**Files:**
- Create: `backend/app/ingestion/schemas.py`
- Create: `backend/app/ingestion/express_client.py`
- Create: `backend/app/ingestion/service.py`
- Create: `backend/app/ingestion/router.py`
- Create: `backend/tests/ingestion/__init__.py`
- Create: `backend/tests/ingestion/test_service.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create `app/ingestion/schemas.py`**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel


class BackupRunCreate(BaseModel):
    files_copied: int
    files_skipped: int
    duplicates: int
    total_size_mb: float
    duration_seconds: float
    pcs_scanned: int
    pcs_failed: list[str] | None = None
    date_folder: str | None = None


class BackupRunRead(BaseModel):
    id: uuid.UUID
    files_copied: int
    files_skipped: int
    duplicates: int
    total_size_mb: float
    duration_seconds: float
    pcs_scanned: int
    pcs_failed: list[str] | None
    date_folder: str | None
    status: str
    received_at: datetime

    model_config = {"from_attributes": True}


class BackupRunStats(BaseModel):
    total_runs: int
    avg_duration_seconds: float
    avg_files_copied: float
    success_rate: float
    last_run: BackupRunRead | None


class ScanSnapshotRead(BaseModel):
    id: uuid.UUID
    total_files: int
    new_files: int
    files_by_type: dict | None
    storage_total: str | None
    storage_avg: str | None
    captured_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Write ingestion tests — `tests/ingestion/test_service.py`**

```python
from app.ingestion.service import derive_backup_status


def test_derive_status_success():
    assert derive_backup_status(files_copied=10, pcs_failed=[]) == "SUCCESS"
    assert derive_backup_status(files_copied=10, pcs_failed=None) == "SUCCESS"


def test_derive_status_partial():
    assert derive_backup_status(files_copied=5, pcs_failed=["PC1"]) == "PARTIAL"


def test_derive_status_failure():
    assert derive_backup_status(files_copied=0, pcs_failed=["PC1"]) == "FAILURE"


def test_derive_status_no_files():
    assert derive_backup_status(files_copied=0, pcs_failed=[]) == "NO_FILES"
    assert derive_backup_status(files_copied=0, pcs_failed=None) == "NO_FILES"
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pytest tests/ingestion/test_service.py -v
```

Expected: FAIL

- [ ] **Step 4: Implement `app/ingestion/service.py`**

```python
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingestion.models import BackupRun, ScanSnapshot
from app.ingestion.schemas import BackupRunCreate, BackupRunStats


def derive_backup_status(files_copied: int, pcs_failed: list[str] | None) -> str:
    has_failures = pcs_failed and len(pcs_failed) > 0
    if files_copied > 0 and not has_failures:
        return "SUCCESS"
    if files_copied > 0 and has_failures:
        return "PARTIAL"
    if files_copied == 0 and has_failures:
        return "FAILURE"
    return "NO_FILES"


async def create_backup_run(db: AsyncSession, data: BackupRunCreate) -> BackupRun:
    status = derive_backup_status(data.files_copied, data.pcs_failed)
    run = BackupRun(
        files_copied=data.files_copied,
        files_skipped=data.files_skipped,
        duplicates=data.duplicates,
        total_size_mb=data.total_size_mb,
        duration_seconds=data.duration_seconds,
        pcs_scanned=data.pcs_scanned,
        pcs_failed=data.pcs_failed,
        date_folder=data.date_folder,
        status=status,
    )
    db.add(run)
    await db.flush()
    await db.refresh(run)
    return run


async def list_backup_runs(db: AsyncSession, skip: int = 0, limit: int = 50) -> tuple[list[BackupRun], int]:
    total_result = await db.execute(select(func.count(BackupRun.id)))
    total = total_result.scalar_one()
    result = await db.execute(
        select(BackupRun).order_by(BackupRun.received_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all(), total


async def get_backup_run(db: AsyncSession, run_id: str) -> BackupRun | None:
    result = await db.execute(select(BackupRun).where(BackupRun.id == run_id))
    return result.scalar_one_or_none()


async def get_backup_stats(db: AsyncSession) -> BackupRunStats:
    total_result = await db.execute(select(func.count(BackupRun.id)))
    total = total_result.scalar_one()

    avg_result = await db.execute(
        select(func.avg(BackupRun.duration_seconds), func.avg(BackupRun.files_copied))
    )
    row = avg_result.one()
    avg_duration = float(row[0] or 0)
    avg_files = float(row[1] or 0)

    success_result = await db.execute(
        select(func.count(BackupRun.id)).where(BackupRun.status == "SUCCESS")
    )
    success_count = success_result.scalar_one()
    success_rate = (success_count / total * 100) if total > 0 else 0

    latest_result = await db.execute(select(BackupRun).order_by(BackupRun.received_at.desc()).limit(1))
    latest = latest_result.scalar_one_or_none()

    return BackupRunStats(
        total_runs=total,
        avg_duration_seconds=round(avg_duration, 2),
        avg_files_copied=round(avg_files, 1),
        success_rate=round(success_rate, 1),
        last_run=latest,
    )


async def save_scan_snapshot(db: AsyncSession, data: dict, source_url: str) -> ScanSnapshot:
    snapshot = ScanSnapshot(
        total_files=data.get("totalFiles", 0),
        new_files=data.get("newFilesThisWeek", 0),
        files_by_type=data.get("filesByAssessmentType"),
        storage_total=data.get("storageStats", {}).get("totalSize"),
        storage_avg=data.get("storageStats", {}).get("averageFileSize"),
        source_api_url=source_url,
    )
    db.add(snapshot)
    await db.flush()
    await db.refresh(snapshot)
    return snapshot


async def get_latest_snapshot(db: AsyncSession) -> ScanSnapshot | None:
    result = await db.execute(select(ScanSnapshot).order_by(ScanSnapshot.captured_at.desc()).limit(1))
    return result.scalar_one_or_none()


async def list_scan_snapshots(db: AsyncSession, skip: int = 0, limit: int = 50) -> list[ScanSnapshot]:
    result = await db.execute(
        select(ScanSnapshot).order_by(ScanSnapshot.captured_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()
```

- [ ] **Step 5: Run ingestion tests to verify they pass**

```bash
pytest tests/ingestion/test_service.py -v
```

Expected: All 4 tests PASS

- [ ] **Step 6: Create `app/ingestion/express_client.py`**

```python
import asyncio
import logging

import httpx

from app.config_store.service import get_cached, get_cached_int
from app.core.database import async_session_factory
from app.ingestion.service import save_scan_snapshot

logger = logging.getLogger(__name__)

_poller_task: asyncio.Task | None = None


async def _poll_express_api() -> None:
    base_url = get_cached("express_api", "base_url")
    if not base_url:
        logger.warning("express_api.base_url not configured, skipping poll")
        return

    url = f"{base_url.rstrip('/')}/api/reports/weekly"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

        async with async_session_factory() as db:
            await save_scan_snapshot(db, data, url)
            await db.commit()
            logger.info(f"Saved scan snapshot: {data.get('totalFiles', 0)} total files")
    except Exception as e:
        logger.error(f"Express API poll failed: {e}")


async def _poller_loop() -> None:
    while True:
        try:
            await _poll_express_api()
        except Exception as e:
            logger.error(f"Poller loop error: {e}")

        interval = get_cached_int("express_api", "poll_minutes", 30) * 60
        await asyncio.sleep(interval)


def start_poller() -> None:
    global _poller_task
    if _poller_task is None or _poller_task.done():
        _poller_task = asyncio.create_task(_poller_loop())
        logger.info("Express API poller started")


def stop_poller() -> None:
    global _poller_task
    if _poller_task and not _poller_task.done():
        _poller_task.cancel()
        _poller_task = None
```

- [ ] **Step 7: Create `app/ingestion/router.py`**

```python
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.config_store.service import get_cached
from app.core.database import get_db
from app.dependencies import require_role
from app.ingestion.schemas import BackupRunCreate, BackupRunRead, BackupRunStats, ScanSnapshotRead
from app.ingestion.service import (
    create_backup_run,
    get_backup_run,
    get_backup_stats,
    get_latest_snapshot,
    list_backup_runs,
    list_scan_snapshots,
)

router = APIRouter(tags=["ingestion"])


# Backup runs
@router.get("/api/backup-runs", response_model=list[BackupRunRead])
async def get_backup_runs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("USER")),
):
    runs, _ = await list_backup_runs(db, skip, limit)
    return runs


@router.get("/api/backup-runs/stats", response_model=BackupRunStats)
async def get_runs_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("USER")),
):
    return await get_backup_stats(db)


@router.get("/api/backup-runs/{run_id}", response_model=BackupRunRead)
async def get_run(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("USER")),
):
    run = await get_backup_run(db, str(run_id))
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup run not found")
    return run


# Scan snapshots
@router.get("/api/scans/latest", response_model=ScanSnapshotRead | None)
async def latest_scan(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("USER")),
):
    return await get_latest_snapshot(db)


@router.get("/api/scans/history", response_model=list[ScanSnapshotRead])
async def scan_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("USER")),
):
    return await list_scan_snapshots(db, skip, limit)


# Webhook
@router.post("/api/webhooks/backup-run", response_model=BackupRunRead, status_code=status.HTTP_201_CREATED)
async def receive_backup_webhook(
    body: BackupRunCreate,
    x_webhook_secret: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    expected = get_cached("webhook", "secret")
    if not expected or x_webhook_secret != expected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid webhook secret")
    return await create_backup_run(db, body)
```

- [ ] **Step 8: Add ingestion router and poller to `app/main.py`**

```python
from app.ingestion.router import router as ingestion_router
from app.ingestion.express_client import start_poller, stop_poller

# In create_app:
app.include_router(ingestion_router)

# In lifespan:
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_session_factory() as db:
        await load_cache(db)
    start_scheduler()
    start_poller()
    yield
    stop_scheduler()
    stop_poller()
```

- [ ] **Step 9: Run all backend tests**

```bash
pytest tests/ -v
```

Expected: All tests PASS

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "feat: ingestion module — Express API poller, webhook receiver, backup run tracking"
```

---

## Task 12: Frontend Scaffolding + Custom Theme

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/app/layout.tsx`
- Create: `frontend/lib/utils.ts`
- Create: `frontend/lib/types.ts`
- Create: `frontend/lib/api.ts`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd D:\Code\aw\aw-monitor
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --no-turbopack
```

- [ ] **Step 2: Install additional dependencies**

```bash
cd frontend
npm install @tanstack/react-query recharts zustand
npx shadcn@latest init
```

When prompted for shadcn init, select:
- Style: New York
- Base color: Neutral
- CSS variables: Yes

- [ ] **Step 3: Install shadcn components**

```bash
npx shadcn@latest add button input label card badge table dialog sheet tabs separator dropdown-menu avatar tooltip scroll-area
```

- [ ] **Step 4: Create custom `tailwind.config.ts`**

Replace the generated config with:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          0: "#0a0a0f",
          1: "#12121a",
          2: "#1a1a25",
          3: "#222230",
        },
        accent: {
          DEFAULT: "#6366f1",
          muted: "#4f46e5",
          subtle: "rgba(99, 102, 241, 0.12)",
        },
        status: {
          online: "#22c55e",
          "online-muted": "rgba(34, 197, 94, 0.15)",
          degraded: "#f59e0b",
          "degraded-muted": "rgba(245, 158, 11, 0.15)",
          offline: "#ef4444",
          "offline-muted": "rgba(239, 68, 68, 0.15)",
          auth: "#f97316",
          "auth-muted": "rgba(249, 115, 22, 0.15)",
          smb: "#a855f7",
          "smb-muted": "rgba(168, 85, 247, 0.15)",
          unknown: "#6b7280",
        },
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.06)",
          hover: "rgba(255, 255, 255, 0.12)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      spacing: {
        "4.5": "1.125rem",
      },
      animation: {
        "status-pulse": "status-pulse 2s ease-in-out infinite",
      },
      keyframes: {
        "status-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

- [ ] **Step 5: Create `lib/types.ts`**

```typescript
export type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "USER";

export type PCStatus = "ONLINE" | "OFFLINE" | "SMB_BLOCKED" | "AUTH_FAILED" | "DEGRADED" | "UNKNOWN";

export type BackupRunStatus = "SUCCESS" | "PARTIAL" | "FAILURE" | "NO_FILES";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  is_active: boolean;
  must_change_pw: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface PC {
  id: string;
  name: string;
  ip_address: string;
  location: string | null;
  is_monitored: boolean;
  created_at: string;
  latest_status: PCStatus | null;
  latest_ping_ms: number | null;
}

export interface HealthCheck {
  id: string;
  pc_id: string;
  status: PCStatus;
  ping_ms: number | null;
  tier_reached: number;
  failure_reason: string | null;
  details: Record<string, unknown> | null;
  checked_at: string;
}

export interface PCHealthSnapshot {
  pc_id: string;
  pc_name: string;
  ip_address: string;
  status: PCStatus;
  ping_ms: number | null;
  tier_reached: number;
  failure_reason: string | null;
  checked_at: string | null;
}

export interface BackupRun {
  id: string;
  files_copied: number;
  files_skipped: number;
  duplicates: number;
  total_size_mb: number;
  duration_seconds: number;
  pcs_scanned: number;
  pcs_failed: string[] | null;
  date_folder: string | null;
  status: BackupRunStatus;
  received_at: string;
}

export interface BackupRunStats {
  total_runs: number;
  avg_duration_seconds: number;
  avg_files_copied: number;
  success_rate: number;
  last_run: BackupRun | null;
}

export interface ScanSnapshot {
  id: string;
  total_files: number;
  new_files: number;
  files_by_type: Record<string, number> | null;
  storage_total: string | null;
  storage_avg: string | null;
  captured_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface ConfigEntry {
  id: string;
  namespace: string;
  key: string;
  value: string | null;
  type: string;
  description: string | null;
  is_sensitive: boolean;
  updated_at: string;
}
```

- [ ] **Step 6: Create `lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { BackupRunStatus, PCStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_CONFIG: Record<PCStatus, { label: string; color: string; bg: string }> = {
  ONLINE: { label: "Online", color: "text-status-online", bg: "bg-status-online-muted" },
  DEGRADED: { label: "Degraded", color: "text-status-degraded", bg: "bg-status-degraded-muted" },
  OFFLINE: { label: "Offline", color: "text-status-offline", bg: "bg-status-offline-muted" },
  AUTH_FAILED: { label: "Auth Failed", color: "text-status-auth", bg: "bg-status-auth-muted" },
  SMB_BLOCKED: { label: "SMB Blocked", color: "text-status-smb", bg: "bg-status-smb-muted" },
  UNKNOWN: { label: "Unknown", color: "text-status-unknown", bg: "bg-neutral-800" },
};

export const BACKUP_STATUS_CONFIG: Record<BackupRunStatus, { label: string; color: string }> = {
  SUCCESS: { label: "Success", color: "text-status-online" },
  PARTIAL: { label: "Partial", color: "text-status-degraded" },
  FAILURE: { label: "Failed", color: "text-status-offline" },
  NO_FILES: { label: "No Files", color: "text-status-unknown" },
};

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

- [ ] **Step 7: Create `lib/api.ts`**

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token = await getAccessToken();

  const doFetch = async (accessToken: string | null) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
    return fetch(`${API_BASE}${path}`, { ...options, headers });
  };

  let res = await doFetch(token);

  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doFetch(newToken);
    } else {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/login";
      throw new Error("Session expired");
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(Array.isArray(error.detail) ? error.detail.join(", ") : error.detail || res.statusText);
  }

  if (res.status === 204) return null as T;
  return res.json();
}
```

- [ ] **Step 8: Verify frontend builds**

```bash
cd frontend
npm run build
```

Expected: Build succeeds

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: frontend scaffolding — Next.js, custom dark theme, types, API client"
```

---

## Task 13: Frontend Auth — Store, Hook, and Login Page

**Files:**
- Create: `frontend/stores/auth-store.ts`
- Create: `frontend/hooks/use-auth.ts`
- Create: `frontend/app/(auth)/login/page.tsx`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Create `stores/auth-store.ts`**

```typescript
import { create } from "zustand";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ user: null, isLoading: false });
    window.location.href = "/login";
  },
}));
```

- [ ] **Step 2: Create `hooks/use-auth.ts`**

```typescript
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { User } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

export function useAuth({ required = true }: { required?: boolean } = {}) {
  const { user, isLoading, setUser } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setUser(null);
      if (required) router.push("/login");
      return;
    }

    if (!user) {
      apiFetch<User>("/api/auth/me")
        .then(setUser)
        .catch(() => {
          setUser(null);
          if (required) router.push("/login");
        });
    }
  }, [user, required, router, setUser]);

  return { user, isLoading };
}
```

- [ ] **Step 3: Create `app/(auth)/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import type { TokenResponse } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const tokens = await apiFetch<TokenResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);

      const user = await apiFetch("/api/auth/me");
      setUser(user as any);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-white tracking-tight">AW Monitor</h1>
          <p className="text-sm text-neutral-500 mt-1">Operations Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-neutral-400 text-xs uppercase tracking-wider">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-surface-2 border-border text-white placeholder:text-neutral-600 focus:border-accent focus:ring-accent/20"
              placeholder="you@americaworks.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-neutral-400 text-xs uppercase tracking-wider">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-surface-2 border-border text-white placeholder:text-neutral-600 focus:border-accent focus:ring-accent/20"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <p className="text-sm text-status-offline bg-status-offline-muted px-3 py-2 rounded">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-muted text-white font-medium"
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update `app/layout.tsx` with providers and dark class**

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "AW Monitor",
  description: "Operations monitoring dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-surface-0 text-neutral-200`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Create `app/providers.tsx`**

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 6: Verify the login page renders**

```bash
cd frontend
npm run dev
```

Visit `http://localhost:3000/login` — dark themed login page should display.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: frontend auth — Zustand store, auth hook, login page with dark theme"
```

---

## Task 14: Frontend Dashboard Layout

**Files:**
- Create: `frontend/app/dashboard/layout.tsx`
- Create: `frontend/app/dashboard/page.tsx`
- Create: `frontend/components/sidebar.tsx`
- Create: `frontend/components/topbar.tsx`
- Create: `frontend/components/status-badge.tsx`

This task creates the dashboard shell. The main overview page will initially render placeholder content — real components (health grid, backup summary) are wired in Tasks 15-16.

- [ ] **Step 1: Create `components/status-badge.tsx`**

```tsx
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, BACKUP_STATUS_CONFIG } from "@/lib/utils";
import type { PCStatus, BackupRunStatus } from "@/lib/types";

export function PCStatusBadge({ status }: { status: PCStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.UNKNOWN;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium", config.bg, config.color)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.color.replace("text-", "bg-"))} />
      {config.label}
    </span>
  );
}

export function BackupStatusBadge({ status }: { status: BackupRunStatus }) {
  const config = BACKUP_STATUS_CONFIG[status] || BACKUP_STATUS_CONFIG.NO_FILES;
  return (
    <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
  );
}
```

- [ ] **Step 2: Create `components/sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import type { Role } from "@/lib/types";

const ROLE_LEVEL: Record<Role, number> = { SUPER_ADMIN: 4, ADMIN: 3, MANAGER: 2, USER: 1 };

interface NavItem {
  href: string;
  label: string;
  icon: string;
  minRole: Role;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "◉", minRole: "USER" },
  { href: "/dashboard/pcs", label: "PCs", icon: "◫", minRole: "USER" },
  { href: "/dashboard/backup-runs", label: "Backups", icon: "↻", minRole: "USER" },
  { href: "/dashboard/scans", label: "Scans", icon: "⊞", minRole: "USER" },
  { href: "/dashboard/config", label: "Config", icon: "⚙", minRole: "ADMIN" },
  { href: "/dashboard/users", label: "Users", icon: "◎", minRole: "ADMIN" },
  { href: "/dashboard/audit-log", label: "Audit", icon: "☰", minRole: "ADMIN" },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const userLevel = user ? ROLE_LEVEL[user.role] : 0;

  const visibleItems = NAV_ITEMS.filter((item) => userLevel >= ROLE_LEVEL[item.minRole]);

  return (
    <aside className="w-14 hover:w-44 transition-all duration-200 bg-surface-1 border-r border-border flex flex-col py-4 group overflow-hidden">
      <div className="px-3 mb-6">
        <span className="text-accent font-bold text-lg">AW</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-2 py-2 rounded text-sm transition-colors",
                isActive ? "bg-accent-subtle text-accent" : "text-neutral-500 hover:text-neutral-200 hover:bg-surface-2"
              )}
            >
              <span className="w-5 text-center shrink-0">{item.icon}</span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-2 mt-auto">
        <Link
          href="/settings/profile"
          className="flex items-center gap-3 px-2 py-2 rounded text-sm text-neutral-500 hover:text-neutral-200 hover:bg-surface-2"
        >
          <span className="w-5 text-center shrink-0">⊕</span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Settings</span>
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Create `components/topbar.tsx`**

```tsx
"use client";

import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";

export function Topbar() {
  const { user, logout } = useAuthStore();

  return (
    <header className="h-12 bg-surface-1 border-b border-border flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-neutral-300">Operations Dashboard</h2>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <>
            <Badge variant="outline" className="text-2xs text-accent border-accent/30 bg-accent-subtle">
              {user.role.replace("_", " ")}
            </Badge>
            <span className="text-xs text-neutral-500">
              {user.first_name} {user.last_name}
            </span>
            <button onClick={logout} className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">
              Sign out
            </button>
          </>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create `app/dashboard/layout.tsx`**

```tsx
"use client";

import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth({ required: true });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-neutral-600 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-surface-0 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-4 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `app/dashboard/page.tsx` (placeholder)**

```tsx
export default function DashboardPage() {
  return (
    <div className="grid grid-cols-[1fr_380px] gap-4 h-full">
      <div className="bg-surface-1 rounded-lg border border-border p-4">
        <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-4">PC Health</h3>
        <p className="text-neutral-600 text-sm">Health grid will be wired in next task.</p>
      </div>
      <div className="space-y-4">
        <div className="bg-surface-1 rounded-lg border border-border p-4">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Latest Backup</h3>
          <p className="text-neutral-600 text-sm">Backup summary will be wired in next task.</p>
        </div>
        <div className="bg-surface-1 rounded-lg border border-border p-4">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Alerts</h3>
          <p className="text-neutral-600 text-sm">Alert panel will be wired in next task.</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify the dashboard layout renders**

```bash
cd frontend && npm run dev
```

Navigate to `http://localhost:3000/dashboard` (after login). Sidebar, topbar, and placeholder content should display with the dark theme.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: dashboard layout — sidebar, topbar, status badges, dark operations theme"
```

---

## Task 15: Frontend PC Health Grid + WebSocket

**Files:**
- Create: `frontend/hooks/use-health-stream.ts`
- Create: `frontend/components/health-grid.tsx`
- Create: `frontend/components/pc-tile.tsx`
- Create: `frontend/components/pc-slide-over.tsx`
- Modify: `frontend/app/dashboard/page.tsx`

- [ ] **Step 1: Create `hooks/use-health-stream.ts`**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import type { PCHealthSnapshot } from "@/lib/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/health";

export function useHealthStream() {
  const [snapshots, setSnapshots] = useState<Map<string, PCHealthSnapshot>>(new Map());
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "snapshot") {
          const map = new Map<string, PCHealthSnapshot>();
          for (const s of msg.data) {
            map.set(s.pc_id, s);
          }
          setSnapshots(map);
        } else if (msg.type === "status_change") {
          setSnapshots((prev) => {
            const next = new Map(prev);
            next.set(msg.data.pc_id, msg.data);
            return next;
          });
        }
      };
    }

    connect();
    return () => wsRef.current?.close();
  }, []);

  return { snapshots: Array.from(snapshots.values()), connected };
}
```

- [ ] **Step 2: Create `components/pc-tile.tsx`**

```tsx
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, formatRelativeTime } from "@/lib/utils";
import type { PCHealthSnapshot } from "@/lib/types";

interface PCTileProps {
  snapshot: PCHealthSnapshot;
  onClick: () => void;
}

export function PCTile({ snapshot, onClick }: PCTileProps) {
  const config = STATUS_CONFIG[snapshot.status] || STATUS_CONFIG.UNKNOWN;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative p-3 rounded-lg border text-left transition-all duration-300",
        "hover:border-border-hover hover:scale-[1.02]",
        config.bg,
        "border-transparent"
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-white">{snapshot.pc_name}</span>
        <span className={cn("h-2 w-2 rounded-full", config.color.replace("text-", "bg-"), snapshot.status === "OFFLINE" && "animate-status-pulse")} />
      </div>
      <div className="font-mono text-2xs text-neutral-500">{snapshot.ip_address}</div>
      {snapshot.ping_ms !== null && (
        <div className="font-mono text-2xs text-neutral-600 mt-1">{snapshot.ping_ms.toFixed(0)}ms</div>
      )}
      {snapshot.checked_at && (
        <div className="text-2xs text-neutral-700 mt-1">{formatRelativeTime(snapshot.checked_at)}</div>
      )}
    </button>
  );
}
```

- [ ] **Step 3: Create `components/health-grid.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { PCHealthSnapshot, PCStatus } from "@/lib/types";
import { PCTile } from "./pc-tile";
import { PCSlideOver } from "./pc-slide-over";

const STATUS_PRIORITY: PCStatus[] = ["OFFLINE", "AUTH_FAILED", "SMB_BLOCKED", "DEGRADED", "ONLINE", "UNKNOWN"];

interface HealthGridProps {
  snapshots: PCHealthSnapshot[];
}

export function HealthGrid({ snapshots }: HealthGridProps) {
  const [selectedPCId, setSelectedPCId] = useState<string | null>(null);

  const sorted = [...snapshots].sort((a, b) => {
    return STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status);
  });

  const selectedPC = snapshots.find((s) => s.pc_id === selectedPCId);

  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {sorted.map((snapshot) => (
          <PCTile key={snapshot.pc_id} snapshot={snapshot} onClick={() => setSelectedPCId(snapshot.pc_id)} />
        ))}
      </div>

      {selectedPC && (
        <PCSlideOver pc={selectedPC} onClose={() => setSelectedPCId(null)} />
      )}
    </>
  );
}
```

- [ ] **Step 4: Create `components/pc-slide-over.tsx`**

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api";
import type { HealthCheck, PCHealthSnapshot } from "@/lib/types";
import { PCStatusBadge } from "./status-badge";
import { formatRelativeTime } from "@/lib/utils";

interface PCSlideOverProps {
  pc: PCHealthSnapshot;
  onClose: () => void;
}

export function PCSlideOver({ pc, onClose }: PCSlideOverProps) {
  const { data: history } = useQuery({
    queryKey: ["pc-health", pc.pc_id],
    queryFn: () => apiFetch<HealthCheck[]>(`/api/pcs/${pc.pc_id}/health?limit=20`),
  });

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="bg-surface-1 border-border w-[400px]">
        <SheetHeader>
          <SheetTitle className="text-white flex items-center gap-3">
            {pc.pc_name}
            <PCStatusBadge status={pc.status} />
          </SheetTitle>
          <p className="font-mono text-xs text-neutral-500">{pc.ip_address}</p>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          <h4 className="text-xs uppercase tracking-wider text-neutral-500">Recent Checks</h4>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {history?.map((check) => (
              <div key={check.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-surface-2">
                <PCStatusBadge status={check.status} />
                <span className="font-mono text-2xs text-neutral-600">
                  {check.ping_ms ? `${check.ping_ms.toFixed(0)}ms` : "—"}
                </span>
                <span className="text-2xs text-neutral-600">{formatRelativeTime(check.checked_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 5: Update `app/dashboard/page.tsx` to wire in health grid**

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { HealthGrid } from "@/components/health-grid";
import { apiFetch } from "@/lib/api";
import { useHealthStream } from "@/hooks/use-health-stream";
import type { BackupRunStats } from "@/lib/types";
import { BACKUP_STATUS_CONFIG, formatRelativeTime } from "@/lib/utils";

export default function DashboardPage() {
  const { snapshots, connected } = useHealthStream();

  const { data: backupStats } = useQuery({
    queryKey: ["backup-stats"],
    queryFn: () => apiFetch<BackupRunStats>("/api/backup-runs/stats"),
    refetchInterval: 30_000,
  });

  const onlineCount = snapshots.filter((s) => s.status === "ONLINE").length;
  const totalCount = snapshots.length;

  return (
    <div className="grid grid-cols-[1fr_380px] gap-4 h-full">
      <div className="bg-surface-1 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500">
            PC Health
            <span className="ml-2 text-neutral-600">
              {onlineCount}/{totalCount}
            </span>
          </h3>
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-status-online" : "bg-status-offline animate-status-pulse"}`} />
        </div>
        <HealthGrid snapshots={snapshots} />
      </div>

      <div className="space-y-4">
        <div className="bg-surface-1 rounded-lg border border-border p-4">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Latest Backup</h3>
          {backupStats?.last_run ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Status</span>
                <span className={`text-xs font-medium ${BACKUP_STATUS_CONFIG[backupStats.last_run.status]?.color}`}>
                  {backupStats.last_run.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Files Copied</span>
                <span className="text-xs text-white font-mono">{backupStats.last_run.files_copied}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Skipped</span>
                <span className="text-xs text-neutral-400 font-mono">{backupStats.last_run.files_skipped}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Duration</span>
                <span className="text-xs text-neutral-400 font-mono">{backupStats.last_run.duration_seconds.toFixed(1)}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">When</span>
                <span className="text-xs text-neutral-600">{formatRelativeTime(backupStats.last_run.received_at)}</span>
              </div>
            </div>
          ) : (
            <p className="text-neutral-600 text-sm">No backup runs recorded yet.</p>
          )}
        </div>

        <div className="bg-surface-1 rounded-lg border border-border p-4">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Quick Stats</h3>
          {backupStats && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Total Runs</span>
                <span className="text-xs text-white font-mono">{backupStats.total_runs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Success Rate</span>
                <span className="text-xs text-status-online font-mono">{backupStats.success_rate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-neutral-500">Avg Duration</span>
                <span className="text-xs text-neutral-400 font-mono">{backupStats.avg_duration_seconds}s</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify the dashboard renders with health grid**

```bash
cd frontend && npm run dev
```

Visit dashboard — health grid (empty until PCs are added) and backup stats panels should render with proper dark theme styling.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: PC health grid with WebSocket live updates, slide-over detail panel, backup stats"
```

---

## Task 16: Frontend — Backup Runs + Scans Pages

**Files:**
- Create: `frontend/components/data-table.tsx`
- Create: `frontend/components/trend-sparkline.tsx`
- Create: `frontend/app/dashboard/backup-runs/page.tsx`
- Create: `frontend/app/dashboard/backup-runs/[id]/page.tsx`
- Create: `frontend/app/dashboard/scans/page.tsx`

This task creates the backup run list, detail view, scans history, and trend charts. Follows the same data-dense, dark-first patterns. See spec section 7.3 for design principles. Each page uses TanStack Query polling (30s default).

Code for each file follows the same patterns established in Tasks 13-15. Create the files with proper data fetching via `apiFetch`, TanStack Query hooks, status badges, monospace values, and the custom color scheme from `tailwind.config.ts`.

- [ ] **Step 1: Create `components/data-table.tsx`** — a reusable sortable table component using shadcn `Table` with neutral-500 headers, surface-2 hover rows, and monospace value cells.

- [ ] **Step 2: Create `components/trend-sparkline.tsx`** — a Recharts `AreaChart` wrapper using the accent color for the fill and status-online for success rate line.

- [ ] **Step 3: Create `app/dashboard/backup-runs/page.tsx`** — paginated table of backup runs using data-table, BackupStatusBadge, monospace values, TanStack Query with `/api/backup-runs`.

- [ ] **Step 4: Create `app/dashboard/backup-runs/[id]/page.tsx`** — single run detail view showing all fields, failed PCs list, file stats.

- [ ] **Step 5: Create `app/dashboard/scans/page.tsx`** — latest snapshot display + history table + trend-sparkline for total files and new files over time, using `/api/scans/latest` and `/api/scans/history`.

- [ ] **Step 6: Verify all pages render**

```bash
cd frontend && npm run dev
```

Navigate to `/dashboard/backup-runs`, `/dashboard/backup-runs/[id]`, `/dashboard/scans`.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: backup runs list/detail and scans history with trend charts"
```

---

## Task 17: Frontend — Config, Users, Audit Pages

**Files:**
- Create: `frontend/components/config-editor.tsx`
- Create: `frontend/app/dashboard/config/page.tsx`
- Create: `frontend/app/dashboard/users/page.tsx`
- Create: `frontend/app/dashboard/audit-log/page.tsx`

These pages are ADMIN+ only. They follow the same design system. Config editor shows namespaced entries with masked secrets and a reveal button. User management is a table with role badges and action dropdowns. Audit log is a filterable log viewer.

- [x] **Step 1: Create `components/config-editor.tsx`** — groups config entries by namespace, shows masked values for secrets with a "Reveal" button that prompts for password re-entry via dialog, uses `PUT /api/config/:ns/:key` for updates.

- [x] **Step 2: Create `app/dashboard/config/page.tsx`** — renders config-editor, fetches from `/api/config`, shows seed button for SUPER_ADMIN on first boot.

- [x] **Step 3: Create `app/dashboard/users/page.tsx`** — user table with role badges, create user dialog, edit/delete actions via dropdown, role change for SUPER_ADMIN.

- [x] **Step 4: Create `app/dashboard/audit-log/page.tsx`** — paginated audit log table with action and user_id filters, timestamps in relative format.

- [x] **Step 5: Verify admin pages render and restrict by role**

- [x] **Step 6: Commit**

```bash
git add .
git commit -m "feat: config editor, user management, and audit log pages (admin-only)"
```

---

## Task 18: Frontend — Profile/Settings + Remaining Pages

**Files:**
- Create: `frontend/app/settings/profile/page.tsx`
- Create: `frontend/app/dashboard/pcs/page.tsx`
- Create: `frontend/app/dashboard/pcs/[id]/page.tsx`
- Create: `frontend/app/(home)/page.tsx`

- [x] **Step 1: Create `app/dashboard/profile/page.tsx`** — shows current user info, change password form (current + new + confirm), active sessions list with revoke buttons. (Moved from `app/settings/profile/` to `app/dashboard/profile/` to keep within dashboard layout.)

- [x] **Step 2: Create `app/dashboard/pcs/page.tsx`** — PC list with status dots, add/edit/delete dialogs, summary stats (total, online, monitored).

- [x] **Step 3: PC detail** — handled via enriched slide-over modal on dashboard health grid (branch 14), not a separate `[id]` route.

- [x] **Step 4: Update `app/page.tsx`** — root redirect to `/dashboard`; auth guard in dashboard layout handles redirect to `/login` if not authenticated.

- [x] **Step 5: Verify all pages render end-to-end**

```bash
cd frontend && npm run dev
```

Navigate through all pages. Verify role-based nav filtering, data loading, dark theme consistency.

- [x] **Step 6: Commit**

```bash
git add .
git commit -m "feat: profile settings, PC management pages, and root redirect"
```

---

## Final Notes

**After all tasks are complete:**
1. Create a SUPER_ADMIN user via a management command or direct DB insert for initial access
2. Seed the config store defaults from the UI
3. Add the 24 PCs from the UI or via API
4. Add the webhook call to the PowerShell backup script
5. Verify end-to-end: health checks running, WebSocket updates in browser, backup webhook received
