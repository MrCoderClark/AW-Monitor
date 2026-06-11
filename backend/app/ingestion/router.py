import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.config_store.service import get_cached
from app.core.database import get_db
from app.dependencies import require_role
from app.ingestion.file_query import get_file_by_id, list_files, list_folder_dates
from app.ingestion.schemas import BackupRunCreate, BackupRunRead, BackupRunStats, DashboardStats, ScanSnapshotRead
from app.ingestion.service import (
    create_backup_run,
    get_backup_run,
    get_backup_stats,
    get_dashboard_stats,
    get_latest_scan_snapshot,
    list_backup_runs,
    list_scan_snapshots,
)

router = APIRouter(tags=["ingestion"])


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


@router.get("/api/dashboard/stats", response_model=DashboardStats)
async def dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("USER")),
):
    return await get_dashboard_stats(db)


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


@router.get("/api/scans/latest", response_model=ScanSnapshotRead | None)
async def latest_scan(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("USER")),
):
    return await get_latest_scan_snapshot(db)


@router.get("/api/scans/history", response_model=list[ScanSnapshotRead])
async def scan_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("USER")),
):
    return await list_scan_snapshots(db, skip, limit)


@router.get("/api/files")
async def get_files(
    folder_date: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _: User = Depends(require_role("USER")),
):
    try:
        return await list_files(folder_date, limit, skip)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


@router.get("/api/files/dates")
async def get_file_dates(
    _: User = Depends(require_role("USER")),
):
    try:
        return await list_folder_dates()
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


@router.get("/api/files/{file_id}/download")
async def download_file(
    file_id: int,
    token: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Supports both Authorization header and ?token= query param for browser viewing."""
    from app.auth.jwt import decode_access_token

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token required")

    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    try:
        file_meta = await get_file_by_id(file_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    if not file_meta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    file_path = file_meta["file_path"]
    if not file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File path not available")

    resolved = Path(file_path)
    if not resolved.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    return FileResponse(
        path=str(resolved),
        filename=file_meta["filename"],
        media_type="application/pdf",
    )


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
