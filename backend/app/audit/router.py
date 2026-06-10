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
