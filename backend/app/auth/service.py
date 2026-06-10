from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token, create_refresh_token
from app.auth.models import PasswordHistory, Session, User
from app.auth.passwords import hash_password, verify_password, validate_password_strength
from app.auth.schemas import TokenResponse

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
REFRESH_TOKEN_DAYS = 7
PASSWORD_HISTORY_LIMIT = 5


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        return None

    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        return None

    if not verify_password(password, user.password_hash):
        user.failed_attempts += 1
        if user.failed_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
        await db.flush()
        return None

    user.failed_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    await db.flush()
    return user


async def create_session(
    db: AsyncSession,
    user: User,
    ip_address: str | None = None,
    device_info: str | None = None,
) -> TokenResponse:
    access_token = create_access_token(user_id=str(user.id), role=user.role)
    refresh_token = create_refresh_token()

    session = Session(
        user_id=user.id,
        refresh_token=refresh_token,
        device_info=device_info,
        ip_address=ip_address,
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS),
    )
    db.add(session)
    await db.flush()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


async def refresh_session(
    db: AsyncSession,
    refresh_token: str,
    ip_address: str | None = None,
) -> TokenResponse | None:
    result = await db.execute(select(Session).where(Session.refresh_token == refresh_token))
    session = result.scalar_one_or_none()

    if session is None:
        return None
    expires = session.expires_at if session.expires_at.tzinfo else session.expires_at.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        return None

    result = await db.execute(select(User).where(User.id == session.user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return None

    await db.delete(session)

    return await create_session(db, user, ip_address=ip_address, device_info=session.device_info)


async def revoke_session(db: AsyncSession, refresh_token: str) -> bool:
    result = await db.execute(select(Session).where(Session.refresh_token == refresh_token))
    session = result.scalar_one_or_none()
    if session is None:
        return False
    await db.delete(session)
    await db.flush()
    return True


async def change_password(db: AsyncSession, user: User, current_password: str, new_password: str) -> list[str]:
    if not verify_password(current_password, user.password_hash):
        return ["Current password is incorrect"]

    errors = validate_password_strength(new_password)
    if errors:
        return errors

    result = await db.execute(
        select(PasswordHistory)
        .where(PasswordHistory.user_id == user.id)
        .order_by(PasswordHistory.created_at.desc())
        .limit(PASSWORD_HISTORY_LIMIT)
    )
    history = result.scalars().all()
    for entry in history:
        if verify_password(new_password, entry.password_hash):
            return [f"Cannot reuse any of your last {PASSWORD_HISTORY_LIMIT} passwords"]

    db.add(PasswordHistory(user_id=user.id, password_hash=user.password_hash))
    user.password_hash = hash_password(new_password)
    user.must_change_pw = False
    await db.flush()
    return []
