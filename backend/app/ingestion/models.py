import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, REAL, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ScanSnapshot(Base):
    __tablename__ = "scan_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    total_files: Mapped[int] = mapped_column(Integer, nullable=False)
    new_files: Mapped[int] = mapped_column(Integer, nullable=False)
    files_by_type: Mapped[dict | None] = mapped_column(JSONB)
    storage_total: Mapped[str | None] = mapped_column(String)
    storage_avg: Mapped[str | None] = mapped_column(String)
    source_api_url: Mapped[str | None] = mapped_column(String)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BackupRun(Base):
    __tablename__ = "backup_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    files_copied: Mapped[int] = mapped_column(Integer, nullable=False)
    files_skipped: Mapped[int] = mapped_column(Integer, nullable=False)
    duplicates: Mapped[int] = mapped_column(Integer, nullable=False)
    total_size_mb: Mapped[float] = mapped_column(REAL, nullable=False)
    duration_seconds: Mapped[float] = mapped_column(REAL, nullable=False)
    pcs_scanned: Mapped[int] = mapped_column(Integer, nullable=False)
    pcs_failed: Mapped[list | None] = mapped_column(JSONB)
    date_folder: Mapped[str | None] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
