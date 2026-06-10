import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import Session, User
from app.auth.rbac import ROLE_HIERARCHY
from app.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    SessionRead,
    TokenResponse,
    UserRead,
)
from app.auth.service import authenticate_user, change_password, create_session, refresh_session, revoke_session
from app.core.database import get_db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, body.email, body.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return await create_session(db, user, ip_address=request.client.host, device_info=body.device_info)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)):
    tokens = await refresh_session(db, body.refresh_token, ip_address=request.client.host)
    if tokens is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    await revoke_session(db, body.refresh_token)


@router.get("/me", response_model=UserRead)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/change-password")
async def change_pw(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    errors = await change_password(db, current_user, body.current_password, body.new_password)
    if errors:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=errors)
    return {"message": "Password changed successfully"}


@router.get("/sessions", response_model=list[SessionRead])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Session).where(Session.user_id == current_user.id))
    return result.scalars().all()


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Session).where(Session.id == _uuid.UUID(session_id)))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.user_id != current_user.id and ROLE_HIERARCHY.get(current_user.role, 0) < ROLE_HIERARCHY["ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot revoke another user's session")
    await db.delete(session)
