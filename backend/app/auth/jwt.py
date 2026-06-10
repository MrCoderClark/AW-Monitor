import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

from jose import JWTError, jwt

from app.core.config import settings

_private_key: str | None = None
_public_key: str | None = None

ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
ALGORITHM = "RS256"


def _load_private_key() -> str:
    global _private_key
    if _private_key is None:
        _private_key = Path(settings.jwt_private_key_path).read_text()
    return _private_key


def _load_public_key() -> str:
    global _public_key
    if _public_key is None:
        _public_key = Path(settings.jwt_public_key_path).read_text()
    return _public_key


def create_access_token(user_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, _load_private_key(), algorithm=ALGORITHM)


def create_refresh_token() -> str:
    return secrets.token_urlsafe(64)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, _load_public_key(), algorithms=[ALGORITHM])
    except JWTError:
        return None
