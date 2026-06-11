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


class PCDetailStats(BaseModel):
    pc: PCRead
    latest_check: HealthCheckRead | None
    uptime_pct: float
    checks_24h: int
    online_24h: int
    recent_backup_failures: list[str]
