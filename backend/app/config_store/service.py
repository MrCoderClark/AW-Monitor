import logging
import uuid
from typing import Any

from cryptography.fernet import InvalidToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config_store.encryption import decrypt_value, encrypt_value
from app.config_store.models import ConfigEntry

logger = logging.getLogger(__name__)

_cache: dict[str, Any] = {}
MASKED = "••••••••"


def _cache_key(namespace: str, key: str) -> str:
    return f"{namespace}.{key}"


async def load_cache(db: AsyncSession) -> None:
    result = await db.execute(select(ConfigEntry))
    entries = result.scalars().all()
    for entry in entries:
        ck = _cache_key(entry.namespace, entry.key)
        if entry.is_sensitive and entry.value:
            try:
                _cache[ck] = decrypt_value(entry.value)
            except InvalidToken:
                logger.warning("Config %s.%s has a corrupted value — skipping, re-set via UI", entry.namespace, entry.key)
                _cache[ck] = None
        else:
            _cache[ck] = entry.value


def get_cached(namespace: str, key: str) -> Any:
    return _cache.get(_cache_key(namespace, key))


def get_cached_int(namespace: str, key: str, default: int = 0) -> int:
    val = get_cached(namespace, key)
    if val is None:
        return default
    return int(val)


async def list_entries(db: AsyncSession, namespace: str | None = None) -> list[ConfigEntry]:
    query = select(ConfigEntry).order_by(ConfigEntry.namespace, ConfigEntry.key)
    if namespace:
        query = query.where(ConfigEntry.namespace == namespace)
    result = await db.execute(query)
    return result.scalars().all()


async def get_entry(db: AsyncSession, namespace: str, key: str) -> ConfigEntry | None:
    result = await db.execute(
        select(ConfigEntry).where(ConfigEntry.namespace == namespace, ConfigEntry.key == key)
    )
    return result.scalar_one_or_none()


async def upsert_entry(
    db: AsyncSession,
    namespace: str,
    key: str,
    value: str,
    updated_by: uuid.UUID | None = None,
) -> ConfigEntry:
    entry = await get_entry(db, namespace, key)
    if entry is None:
        raise ValueError(f"Config entry {namespace}.{key} not found")

    if entry.is_sensitive:
        entry.value = encrypt_value(value)
    else:
        entry.value = value
    entry.updated_by = updated_by
    await db.flush()
    await db.refresh(entry)

    _cache[_cache_key(namespace, key)] = value
    return entry


async def reveal_entry(db: AsyncSession, namespace: str, key: str) -> str | None:
    entry = await get_entry(db, namespace, key)
    if entry is None or not entry.is_sensitive or entry.value is None:
        return None
    return decrypt_value(entry.value)


def mask_entry_value(entry: ConfigEntry) -> str | None:
    if entry.is_sensitive:
        return MASKED if entry.value else None
    return entry.value
