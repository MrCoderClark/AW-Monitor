import uuid
from datetime import datetime

from pydantic import BaseModel


class ConfigEntryRead(BaseModel):
    id: uuid.UUID
    namespace: str
    key: str
    value: str | None
    type: str
    description: str | None
    is_sensitive: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConfigEntryUpdate(BaseModel):
    value: str


class ConfigRevealRequest(BaseModel):
    password: str
