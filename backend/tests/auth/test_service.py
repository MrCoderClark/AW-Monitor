import pytest
import pytest_asyncio
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base
from app.auth.models import User
from app.auth.passwords import hash_password
from app.auth.service import authenticate_user, create_session, refresh_session, revoke_session


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    original_schema = Base.metadata.schema
    Base.metadata.schema = None
    original_types = {}
    for table in Base.metadata.tables.values():
        table.schema = None
        for col in table.columns:
            if isinstance(col.type, JSONB):
                original_types[(table.key, col.key)] = col.type
                col.type = JSON()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
    Base.metadata.schema = original_schema
    for table in Base.metadata.tables.values():
        table.schema = original_schema
        for col in table.columns:
            key = (table.key, col.key)
            if key in original_types:
                col.type = original_types[key]
    await engine.dispose()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession):
    user = User(
        email="test@example.com",
        password_hash=hash_password("ValidPass123!"),
        first_name="Test",
        last_name="User",
        role="USER",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_authenticate_valid(db_session, test_user):
    user = await authenticate_user(db_session, "test@example.com", "ValidPass123!")
    assert user is not None
    assert user.email == "test@example.com"


@pytest.mark.asyncio
async def test_authenticate_wrong_password(db_session, test_user):
    user = await authenticate_user(db_session, "test@example.com", "WrongPass123!")
    assert user is None


@pytest.mark.asyncio
async def test_authenticate_nonexistent_email(db_session):
    user = await authenticate_user(db_session, "nobody@example.com", "ValidPass123!")
    assert user is None


@pytest.mark.asyncio
async def test_create_and_refresh_session(db_session, test_user):
    tokens = await create_session(db_session, test_user, ip_address="127.0.0.1")
    assert tokens.access_token
    assert tokens.refresh_token

    new_tokens = await refresh_session(db_session, tokens.refresh_token, ip_address="127.0.0.1")
    assert new_tokens is not None
    assert new_tokens.refresh_token != tokens.refresh_token


@pytest.mark.asyncio
async def test_refresh_invalid_token(db_session):
    result = await refresh_session(db_session, "invalid-token", ip_address="127.0.0.1")
    assert result is None


@pytest.mark.asyncio
async def test_revoke_session(db_session, test_user):
    tokens = await create_session(db_session, test_user, ip_address="127.0.0.1")
    revoked = await revoke_session(db_session, tokens.refresh_token)
    assert revoked is True

    result = await refresh_session(db_session, tokens.refresh_token, ip_address="127.0.0.1")
    assert result is None
