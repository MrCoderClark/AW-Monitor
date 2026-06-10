import uuid
from datetime import datetime

from pydantic import BaseModel


class BackupRunCreate(BaseModel):
    files_copied: int
    files_skipped: int
    duplicates: int
    total_size_mb: float
    duration_seconds: float
    pcs_scanned: int
    pcs_failed: list[str] | None = None
    date_folder: str | None = None


class BackupRunRead(BaseModel):
    id: uuid.UUID
    files_copied: int
    files_skipped: int
    duplicates: int
    total_size_mb: float
    duration_seconds: float
    pcs_scanned: int
    pcs_failed: list[str] | None
    date_folder: str | None
    status: str
    received_at: datetime

    model_config = {"from_attributes": True}


class BackupRunStats(BaseModel):
    total_runs: int
    avg_duration_seconds: float
    avg_files_copied: float
    success_rate: float
    last_run: BackupRunRead | None


class ScanSnapshotRead(BaseModel):
    id: uuid.UUID
    total_files: int
    new_files: int
    files_by_type: dict | None
    storage_total: str | None
    storage_avg: str | None
    captured_at: datetime

    model_config = {"from_attributes": True}
