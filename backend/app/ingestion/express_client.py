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
