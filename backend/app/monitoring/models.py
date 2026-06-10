import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, REAL, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PC(Base):
    __tablename__ = "pcs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    ip_address: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[str | None] = mapped_column(String)
    is_monitored: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    health_checks: Mapped[list["HealthCheck"]] = relationship(back_populates="pc", cascade="all, delete-orphan")


class HealthCheck(Base):
    __tablename__ = "health_checks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    pc_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pcs.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    ping_ms: Mapped[float | None] = mapped_column(REAL)
    tier_reached: Mapped[int] = mapped_column(Integer, nullable=False)
    failure_reason: Mapped[str | None] = mapped_column(String)
    details: Mapped[dict | None] = mapped_column(JSONB)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    pc: Mapped["PC"] = relationship(back_populates="health_checks")

    __table_args__ = (Index("idx_health_checks_pc_time", "pc_id", checked_at.desc()),)
