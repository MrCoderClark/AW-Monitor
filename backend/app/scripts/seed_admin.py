"""Create initial SUPER_ADMIN user. Run with: uv run python -m app.scripts.seed_admin"""

import asyncio

from sqlalchemy import select, text

from app.auth.models import User
from app.auth.passwords import hash_password
from app.core.database import SCHEMA, async_session_factory, engine


async def main():
    async with engine.begin() as conn:
        await conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))

    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.email == "admin@americaworks.com"))
        if result.scalar_one_or_none():
            print("Admin user already exists.")
            return

        user = User(
            email="admin@americaworks.com",
            password_hash=hash_password("Admin123!"),
            first_name="Admin",
            last_name="User",
            role="SUPER_ADMIN",
        )
        db.add(user)
        await db.commit()
        print("Created SUPER_ADMIN: admin@americaworks.com / Admin123!")


if __name__ == "__main__":
    asyncio.run(main())
