"""initial schema

Revision ID: f25fcaff9537
Revises:
Create Date: 2026-06-10 10:49:39.648304
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f25fcaff9537'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "aw_monitor"


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="USER"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("must_change_pw", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        schema=SCHEMA,
    )

    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("refresh_token", sa.String(), nullable=False),
        sa.Column("device_info", sa.String(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("refresh_token"),
        sa.ForeignKeyConstraint(["user_id"], [f"{SCHEMA}.users.id"], ondelete="CASCADE"),
        schema=SCHEMA,
    )

    op.create_table(
        "password_history",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], [f"{SCHEMA}.users.id"], ondelete="CASCADE"),
        schema=SCHEMA,
    )
    op.create_index("ix_password_history_user_id", "password_history", ["user_id"], schema=SCHEMA)

    op.create_table(
        "audit_log",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("resource", sa.String(), nullable=True),
        sa.Column("details", postgresql.JSONB(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], [f"{SCHEMA}.users.id"], ondelete="SET NULL"),
        schema=SCHEMA,
    )
    op.create_index("idx_audit_log_user", "audit_log", ["user_id"], schema=SCHEMA)
    op.create_index("idx_audit_log_created", "audit_log", ["created_at"], schema=SCHEMA)

    op.create_table(
        "config_entries",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("namespace", sa.String(), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("is_sensitive", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("namespace", "key", name="uq_config_ns_key"),
        sa.ForeignKeyConstraint(["updated_by"], [f"{SCHEMA}.users.id"]),
        schema=SCHEMA,
    )

    op.create_table(
        "pcs",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("ip_address", sa.String(), nullable=False),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("is_monitored", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )

    op.create_table(
        "health_checks",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("pc_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("ping_ms", sa.REAL(), nullable=True),
        sa.Column("tier_reached", sa.Integer(), nullable=False),
        sa.Column("failure_reason", sa.String(), nullable=True),
        sa.Column("details", postgresql.JSONB(), nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["pc_id"], [f"{SCHEMA}.pcs.id"], ondelete="CASCADE"),
        schema=SCHEMA,
    )
    op.create_index("idx_health_checks_pc_time", "health_checks", ["pc_id", sa.text("checked_at DESC")], schema=SCHEMA)

    op.create_table(
        "scan_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("total_files", sa.Integer(), nullable=False),
        sa.Column("new_files", sa.Integer(), nullable=False),
        sa.Column("files_by_type", postgresql.JSONB(), nullable=True),
        sa.Column("storage_total", sa.String(), nullable=True),
        sa.Column("storage_avg", sa.String(), nullable=True),
        sa.Column("source_api_url", sa.String(), nullable=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )

    op.create_table(
        "backup_runs",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("files_copied", sa.Integer(), nullable=False),
        sa.Column("files_skipped", sa.Integer(), nullable=False),
        sa.Column("duplicates", sa.Integer(), nullable=False),
        sa.Column("total_size_mb", sa.REAL(), nullable=False),
        sa.Column("duration_seconds", sa.REAL(), nullable=False),
        sa.Column("pcs_scanned", sa.Integer(), nullable=False),
        sa.Column("pcs_failed", postgresql.JSONB(), nullable=True),
        sa.Column("date_folder", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_table("backup_runs", schema=SCHEMA)
    op.drop_table("scan_snapshots", schema=SCHEMA)
    op.drop_index("idx_health_checks_pc_time", table_name="health_checks", schema=SCHEMA)
    op.drop_table("health_checks", schema=SCHEMA)
    op.drop_table("pcs", schema=SCHEMA)
    op.drop_table("config_entries", schema=SCHEMA)
    op.drop_index("idx_audit_log_created", table_name="audit_log", schema=SCHEMA)
    op.drop_index("idx_audit_log_user", table_name="audit_log", schema=SCHEMA)
    op.drop_table("audit_log", schema=SCHEMA)
    op.drop_index("ix_password_history_user_id", table_name="password_history", schema=SCHEMA)
    op.drop_table("password_history", schema=SCHEMA)
    op.drop_table("sessions", schema=SCHEMA)
    op.drop_table("users", schema=SCHEMA)
    op.execute(f"DROP SCHEMA IF EXISTS {SCHEMA}")
