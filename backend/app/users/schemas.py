import uuid
from datetime import datetime

from pydantic import BaseModel


class CreateUserRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    role: str = "USER"


class UpdateUserRequest(BaseModel):
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    is_active: bool | None = None


class UpdateRoleRequest(BaseModel):
    role: str


class UserListResponse(BaseModel):
    users: list["UserRead"]
    total: int


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
