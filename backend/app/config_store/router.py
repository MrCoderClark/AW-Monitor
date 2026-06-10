from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.passwords import verify_password
from app.config_store.defaults import seed_defaults
from app.config_store.schemas import ConfigEntryRead, ConfigEntryUpdate, ConfigRevealRequest
from app.config_store.service import get_entry, list_entries, mask_entry_value, reveal_entry, upsert_entry
from app.core.database import get_db
from app.dependencies import require_role

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("", response_model=list[ConfigEntryRead])
async def get_all_config(
    namespace: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    entries = await list_entries(db, namespace)
    for entry in entries:
        entry.value = mask_entry_value(entry)
    return entries


@router.get("/{namespace}/{key}", response_model=ConfigEntryRead)
async def get_config_entry(
    namespace: str,
    key: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    entry = await get_entry(db, namespace, key)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config entry not found")
    entry.value = mask_entry_value(entry)
    return entry


@router.put("/{namespace}/{key}", response_model=ConfigEntryRead)
async def update_config_entry(
    namespace: str,
    key: str,
    body: ConfigEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    entry = await get_entry(db, namespace, key)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config entry not found")

    if entry.is_sensitive and current_user.role != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only SUPER_ADMIN can modify secrets")

    updated = await upsert_entry(db, namespace, key, body.value, updated_by=current_user.id)
    updated.value = mask_entry_value(updated)
    return updated


@router.post("/{namespace}/{key}/reveal")
async def reveal_config_secret(
    namespace: str,
    key: str,
    body: ConfigRevealRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("SUPER_ADMIN")),
):
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Password verification failed")

    value = await reveal_entry(db, namespace, key)
    if value is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Secret not found")
    return {"value": value}


@router.post("/seed")
async def seed_config(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("SUPER_ADMIN")),
):
    created = await seed_defaults(db)
    return {"message": f"Seeded {created} config entries"}
