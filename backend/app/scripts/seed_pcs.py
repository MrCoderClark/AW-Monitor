"""Seed lab PCs into the database. Run with: uv run python -m app.scripts.seed_pcs"""

import asyncio

from sqlalchemy import select, text

from app.core.database import SCHEMA, async_session_factory, engine
from app.monitoring.models import PC

PCS = [
    {"name": "CPC7HH2", "ip_address": "192.168.72.172"},
    {"name": "7164GK2", "ip_address": "192.168.72.209"},
    {"name": "FJX0HQ2", "ip_address": "192.168.72.25"},
    {"name": "7191GK2", "ip_address": "192.168.72.42"},
    {"name": "41QC8M2", "ip_address": "192.168.72.102"},
    {"name": "CPBBHH2", "ip_address": "192.168.72.152"},
    {"name": "CPF8HH2", "ip_address": "192.168.72.229"},
    {"name": "BFGHVD3", "ip_address": "192.168.72.146"},
    {"name": "9RPDVD3", "ip_address": "192.168.72.235"},
    {"name": "9RRHVD3", "ip_address": "192.168.72.199"},
    {"name": "BFJHVD3", "ip_address": "192.168.72.182"},
    {"name": "9RVHVD3", "ip_address": "192.168.70.124"},
]


async def main():
    async with engine.begin() as conn:
        await conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))

    async with async_session_factory() as db:
        existing = await db.execute(select(PC.name))
        existing_names = {row[0] for row in existing}

        added = 0
        for pc_data in PCS:
            if pc_data["name"] in existing_names:
                print(f"  Skipping {pc_data['name']} (already exists)")
                continue
            db.add(PC(**pc_data))
            added += 1

        await db.commit()
        print(f"Seeded {added} PCs ({len(existing_names)} already existed)")


if __name__ == "__main__":
    asyncio.run(main())
