import logging

import asyncpg

from app.config_store.service import get_cached

logger = logging.getLogger(__name__)

FILE_BY_ID_QUERY = """
    SELECT id, filename, "folderDate", "filePath", "fileSize",
           "assessmentType", "clientFirstName", "clientLastName",
           "createdAt", "modifiedDate"
    FROM "FileMetadata"
    WHERE id = $1
"""

FILES_QUERY = """
    SELECT
        id, filename, "folderDate", "filePath", "fileSize",
        "assessmentType", "clientFirstName", "clientLastName",
        "createdAt", "modifiedDate"
    FROM "FileMetadata"
    WHERE ($1::text IS NULL OR "folderDate" = $1)
    ORDER BY "createdAt" DESC
    LIMIT $2 OFFSET $3
"""

FILES_COUNT_QUERY = """
    SELECT COUNT(*) FROM "FileMetadata"
    WHERE ($1::text IS NULL OR "folderDate" = $1)
"""

DATES_QUERY = """
    SELECT "folderDate", COUNT(*) AS file_count
    FROM "FileMetadata"
    GROUP BY "folderDate"
    ORDER BY "folderDate" DESC
    LIMIT 100
"""


async def _get_conn() -> asyncpg.Connection:
    db_url = get_cached("express_api", "base_url")
    if not db_url:
        raise ValueError("express_api.base_url not configured")
    return await asyncpg.connect(db_url)


async def list_files(folder_date: str | None = None, limit: int = 50, offset: int = 0) -> dict:
    conn = await _get_conn()
    try:
        rows = await conn.fetch(FILES_QUERY, folder_date, limit, offset)
        count_row = await conn.fetchrow(FILES_COUNT_QUERY, folder_date)
        total = count_row["count"]

        files = [
            {
                "id": str(r["id"]),
                "filename": r["filename"],
                "folder_date": r["folderDate"],
                "file_path": r["filePath"],
                "file_size": int(r["fileSize"]),
                "assessment_type": r["assessmentType"],
                "client_first_name": r["clientFirstName"],
                "client_last_name": r["clientLastName"],
                "created_at": r["createdAt"].isoformat() if r["createdAt"] else None,
                "modified_date": r["modifiedDate"].isoformat() if r["modifiedDate"] else None,
            }
            for r in rows
        ]
        return {"files": files, "total": total}
    finally:
        await conn.close()


async def get_file_by_id(file_id: int) -> dict | None:
    conn = await _get_conn()
    try:
        row = await conn.fetchrow(FILE_BY_ID_QUERY, file_id)
        if not row:
            return None
        return {
            "id": str(row["id"]),
            "filename": row["filename"],
            "folder_date": row["folderDate"],
            "file_path": row["filePath"],
            "file_size": int(row["fileSize"]),
            "assessment_type": row["assessmentType"],
        }
    finally:
        await conn.close()


async def list_folder_dates() -> list[dict]:
    conn = await _get_conn()
    try:
        rows = await conn.fetch(DATES_QUERY)
        return [{"folder_date": r["folderDate"], "file_count": r["file_count"]} for r in rows]
    finally:
        await conn.close()
