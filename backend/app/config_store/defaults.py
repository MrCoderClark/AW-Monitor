import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config_store.encryption import encrypt_value
from app.config_store.models import ConfigEntry

DEFAULT_ENTRIES = [
    ("smb", "username", None, "secret", "SMB admin share username", True),
    ("smb", "password", None, "secret", "SMB admin share password", True),
    ("smb", "domain", None, "string", "SMB domain (e.g., WORKGROUP)", False),
    ("health", "interval_minutes", "10", "number", "Minutes between health checks", False),
    ("health", "ping_timeout_ms", "2000", "number", "Ping timeout in milliseconds", False),
    ("health", "smb_timeout_ms", "3000", "number", "SMB port check timeout in milliseconds", False),
    ("health", "retention_days", "90", "number", "Days to retain health check records", False),
    ("express_api", "base_url", None, "string", "Base URL of the existing Express API", False),
    ("express_api", "poll_minutes", "30", "number", "Minutes between Express API polls", False),
    ("webhook", "secret", None, "secret", "Shared secret for webhook authentication", True),
    ("notifications", "enabled", "false", "boolean", "Enable email notifications", False),
    ("notifications", "smtp_host", None, "string", "SMTP server host", False),
    ("notifications", "smtp_port", "587", "number", "SMTP server port", False),
    ("notifications", "smtp_user", None, "secret", "SMTP username", True),
    ("notifications", "smtp_pass", None, "secret", "SMTP password", True),
    ("notifications", "recipients", "[]", "json", "Notification recipients (JSON array)", False),
]


async def seed_defaults(db: AsyncSession) -> int:
    created = 0
    for namespace, key, value, entry_type, description, is_sensitive in DEFAULT_ENTRIES:
        existing = await db.execute(
            select(ConfigEntry).where(ConfigEntry.namespace == namespace, ConfigEntry.key == key)
        )
        if existing.scalar_one_or_none() is not None:
            continue

        actual_value = value
        if namespace == "webhook" and key == "secret" and value is None:
            actual_value = encrypt_value(secrets.token_urlsafe(32))
        elif is_sensitive and actual_value is not None:
            actual_value = encrypt_value(actual_value)

        entry = ConfigEntry(
            namespace=namespace,
            key=key,
            value=actual_value,
            type=entry_type,
            description=description,
            is_sensitive=is_sensitive,
        )
        db.add(entry)
        created += 1

    await db.flush()
    return created
