from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
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
        details=details if "tier_timings" in details else {"tier_timings": details},
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


async def get_pc_detail_stats(db: AsyncSession, pc: PC) -> dict:
    from app.ingestion.models import BackupRun

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    total_24h = await db.execute(
        select(func.count(HealthCheck.id))
        .where(HealthCheck.pc_id == pc.id, HealthCheck.checked_at >= cutoff)
    )
    checks_24h = total_24h.scalar_one()

    online_24h = await db.execute(
        select(func.count(HealthCheck.id))
        .where(HealthCheck.pc_id == pc.id, HealthCheck.checked_at >= cutoff, HealthCheck.status == "ONLINE")
    )
    online_count = online_24h.scalar_one()

    uptime_pct = (online_count / checks_24h * 100) if checks_24h > 0 else 0.0

    latest_result = await db.execute(
        select(HealthCheck)
        .where(HealthCheck.pc_id == pc.id)
        .order_by(HealthCheck.checked_at.desc())
        .limit(1)
    )
    latest_check = latest_result.scalar_one_or_none()

    # Find recent backup runs where this PC failed
    recent_runs = await db.execute(
        select(BackupRun)
        .where(BackupRun.pcs_failed.isnot(None))
        .order_by(BackupRun.received_at.desc())
        .limit(20)
    )
    failure_dates = []
    for run in recent_runs.scalars().all():
        if run.pcs_failed and pc.name in run.pcs_failed:
            failure_dates.append(run.received_at.isoformat())

    return {
        "latest_check": latest_check,
        "uptime_pct": round(uptime_pct, 1),
        "checks_24h": checks_24h,
        "online_24h": online_count,
        "recent_backup_failures": failure_dates[:5],
    }
