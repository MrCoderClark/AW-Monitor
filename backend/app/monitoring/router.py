import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.core.database import get_db
from app.dependencies import require_role
from app.monitoring.models import HealthCheck, PC
from app.monitoring.schemas import HealthCheckRead, PCCreate, PCDetailStats, PCHealthSnapshot, PCRead, PCUpdate
from app.monitoring.service import check_pc_health, get_all_pcs, get_latest_snapshot, get_pc_detail_stats, get_pc_health_history
from app.monitoring.websocket import health_manager

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


@router.get("/{pc_id}/detail", response_model=PCDetailStats)
async def get_pc_detail(
    pc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("USER")),
):
    result = await db.execute(select(PC).where(PC.id == pc_id))
    pc = result.scalar_one_or_none()
    if pc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PC not found")

    stats = await get_pc_detail_stats(db, pc)
    latest = await db.execute(
        select(HealthCheck).where(HealthCheck.pc_id == pc.id).order_by(HealthCheck.checked_at.desc()).limit(1)
    )
    check = latest.scalar_one_or_none()

    pc_read = PCRead.model_validate(pc)
    if check:
        pc_read.latest_status = check.status
        pc_read.latest_ping_ms = check.ping_ms

    return PCDetailStats(
        pc=pc_read,
        latest_check=HealthCheckRead.model_validate(stats["latest_check"]) if stats["latest_check"] else None,
        uptime_pct=stats["uptime_pct"],
        checks_24h=stats["checks_24h"],
        online_24h=stats["online_24h"],
        recent_backup_failures=stats["recent_backup_failures"],
    )


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
