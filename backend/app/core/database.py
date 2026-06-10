from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

SCHEMA = "aw_monitor"

engine = create_async_engine(
    settings.database_url,
    echo=False,
    connect_args={"statement_cache_size": 0},
)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    metadata = MetaData(schema=SCHEMA)


async def get_db():
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
