from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingestion.models import BackupRun, ScanSnapshot
from app.ingestion.schemas import BackupRunCreate, BackupRunStats, DashboardStats


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


async def get_latest_scan_snapshot(db: AsyncSession) -> ScanSnapshot | None:
    result = await db.execute(select(ScanSnapshot).order_by(ScanSnapshot.captured_at.desc()).limit(1))
    return result.scalar_one_or_none()


async def list_scan_snapshots(db: AsyncSession, skip: int = 0, limit: int = 50) -> list[ScanSnapshot]:
    result = await db.execute(
        select(ScanSnapshot).order_by(ScanSnapshot.captured_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()


async def get_dashboard_stats(db: AsyncSession) -> DashboardStats:
    backup_stats = await get_backup_stats(db)
    latest_scan = await get_latest_scan_snapshot(db)

    return DashboardStats(
        total_runs=backup_stats.total_runs,
        success_rate=backup_stats.success_rate,
        avg_duration_seconds=backup_stats.avg_duration_seconds,
        last_run=backup_stats.last_run,
        total_files=latest_scan.total_files if latest_scan else 0,
        new_files=latest_scan.new_files if latest_scan else 0,
        storage_total=latest_scan.storage_total if latest_scan else None,
        last_scan_at=latest_scan.captured_at if latest_scan else None,
    )
