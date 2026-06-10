"""One-off script to re-encrypt corrupted config entries."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import select

from app.config_store.encryption import encrypt_value
from app.config_store.models import ConfigEntry
from app.core.database import async_engine, async_session_factory


async def fix_corrupted_entries():
    async with async_session_factory() as db:
        result = await db.execute(
            select(ConfigEntry).where(ConfigEntry.is_sensitive == True)
        )
        entries = result.scalars().all()
        fixed = []
        for entry in entries:
            if entry.value and not entry.value.startswith("gAAAAA"):
                entry.value = None
                fixed.append(f"{entry.namespace}.{entry.key}")
        if fixed:
            await db.commit()
            print(f"Cleared corrupted values: {', '.join(fixed)}")
        else:
            print("No corrupted entries found")

    await async_engine.dispose()


if __name__ == "__main__":
    asyncio.run(fix_corrupted_entries())
