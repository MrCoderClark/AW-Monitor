import uuid
from datetime import datetime

from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str
    device_info: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    must_change_pw: bool
    last_login_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionRead(BaseModel):
    id: uuid.UUID
    device_info: str | None
    ip_address: str | None
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
