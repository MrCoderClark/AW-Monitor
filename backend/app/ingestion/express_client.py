import asyncio
import logging

import asyncpg

from app.config_store.service import get_cached, get_cached_int
from app.core.database import async_session_factory
from app.ingestion.service import save_scan_snapshot

logger = logging.getLogger(__name__)

_poller_task: asyncio.Task | None = None

STATS_QUERY = """
    SELECT
        COUNT(*) AS total_files,
        COUNT(*) FILTER (
            WHERE "createdAt" >= NOW() - INTERVAL '7 days'
        ) AS new_files,
        jsonb_object_agg(
            COALESCE("assessmentType", 'Unknown'),
            cnt
        ) AS files_by_type,
        pg_size_pretty(SUM("fileSize")) AS storage_total,
        pg_size_pretty(AVG("fileSize")) AS storage_avg
    FROM (
        SELECT "fileSize", "assessmentType", "createdAt"
        FROM "FileMetadata"
    ) AS base
    CROSS JOIN LATERAL (
        SELECT "assessmentType" AS at, COUNT(*) AS cnt
        FROM "FileMetadata"
        GROUP BY "assessmentType"
    ) AS type_counts
    WHERE base."assessmentType" = type_counts.at
"""

SIMPLE_STATS_QUERY = """
    SELECT
        COUNT(*) AS total_files,
        COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days') AS new_files,
        pg_size_pretty(SUM("fileSize")) AS storage_total,
        pg_size_pretty(AVG("fileSize")) AS storage_avg
    FROM "FileMetadata"
"""

TYPE_COUNTS_QUERY = """
    SELECT COALESCE("assessmentType", 'Unknown') AS atype, COUNT(*) AS cnt
    FROM "FileMetadata"
    GROUP BY "assessmentType"
    ORDER BY cnt DESC
"""


async def _poll_external_db() -> None:
    db_url = get_cached("express_api", "base_url")
    if not db_url:
        logger.warning("express_api.base_url not configured, skipping poll")
        return

    try:
        conn = await asyncpg.connect(db_url)
        try:
            row = await conn.fetchrow(SIMPLE_STATS_QUERY)
            type_rows = await conn.fetch(TYPE_COUNTS_QUERY)

            files_by_type = {r["atype"]: r["cnt"] for r in type_rows}

            data = {
                "totalFiles": row["total_files"],
                "newFilesThisWeek": row["new_files"],
                "filesByAssessmentType": files_by_type,
                "storageStats": {
                    "totalSize": row["storage_total"],
                    "averageFileSize": row["storage_avg"],
                },
            }

            async with async_session_factory() as db:
                await save_scan_snapshot(db, data, db_url)
                await db.commit()
                logger.info("Saved scan snapshot: %d total files, %d new", row["total_files"], row["new_files"])
        finally:
            await conn.close()
    except Exception as e:
        logger.error("External DB poll failed: %s", e)


async def _poller_loop() -> None:
    while True:
        try:
            await _poll_external_db()
        except Exception as e:
            logger.error("Poller loop error: %s", e)

        interval = get_cached_int("express_api", "poll_minutes", 30) * 60
        await asyncio.sleep(interval)


def start_poller() -> None:
    global _poller_task
    if _poller_task is None or _poller_task.done():
        _poller_task = asyncio.create_task(_poller_loop())
        logger.info("External DB poller started")


def stop_poller() -> None:
    global _poller_task
    if _poller_task and not _poller_task.done():
        _poller_task.cancel()
        _poller_task = None
