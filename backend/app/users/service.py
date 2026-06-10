from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.passwords import hash_password, validate_password_strength
from app.auth.rbac import ROLE_HIERARCHY
from app.users.schemas import CreateUserRequest, UpdateUserRequest


async def list_users(db: AsyncSession, skip: int = 0, limit: int = 50) -> tuple[list[User], int]:
    total_result = await db.execute(select(func.count(User.id)))
    total = total_result.scalar_one()
    result = await db.execute(select(User).offset(skip).limit(limit).order_by(User.created_at.desc()))
    return result.scalars().all(), total


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, data: CreateUserRequest) -> tuple[User | None, list[str]]:
    if data.role not in ROLE_HIERARCHY:
        return None, [f"Invalid role: {data.role}"]

    errors = validate_password_strength(data.password)
    if errors:
        return None, errors

    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        return None, ["Email already registered"]

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role=data.role,
        must_change_pw=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user, []


async def update_user(db: AsyncSession, user: User, data: UpdateUserRequest) -> User:
    if data.email is not None:
        user.email = data.email
    if data.first_name is not None:
        user.first_name = data.first_name
    if data.last_name is not None:
        user.last_name = data.last_name
    if data.is_active is not None:
        user.is_active = data.is_active
    await db.flush()
    await db.refresh(user)
    return user


async def update_role(db: AsyncSession, user: User, new_role: str) -> tuple[User | None, str | None]:
    if new_role not in ROLE_HIERARCHY:
        return None, f"Invalid role: {new_role}"
    user.role = new_role
    await db.flush()
    await db.refresh(user)
    return user, None


async def delete_user(db: AsyncSession, user: User) -> None:
    await db.delete(user)
    await db.flush()
