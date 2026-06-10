import asyncio
import logging

from app.config_store.service import get_cached_int
from app.core.database import async_session_factory
from app.monitoring.schemas import PCHealthSnapshot
from app.monitoring.service import check_pc_health, get_monitored_pcs
from app.monitoring.websocket import health_manager

logger = logging.getLogger(__name__)

_scheduler_task: asyncio.Task | None = None


async def _run_all_checks() -> None:
    async with async_session_factory() as db:
        pcs = await get_monitored_pcs(db)
        for pc in pcs:
            try:
                check = await check_pc_health(db, pc)
                snapshot = PCHealthSnapshot(
                    pc_id=str(pc.id),
                    pc_name=pc.name,
                    ip_address=pc.ip_address,
                    status=check.status,
                    ping_ms=check.ping_ms,
                    tier_reached=check.tier_reached,
                    failure_reason=check.failure_reason,
                    checked_at=check.checked_at,
                )
                await health_manager.broadcast_change(snapshot)
            except Exception as e:
                logger.error(f"Health check failed for {pc.name}: {e}")
            await asyncio.sleep(0.5)
        await db.commit()


async def _scheduler_loop() -> None:
    while True:
        try:
            await _run_all_checks()
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
        interval = get_cached_int("health", "check_interval_seconds", 300)
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
