from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class TemplateCreate(BaseModel):
    name: str
    body: str
    variants: str | None = None


class TemplateUpdate(BaseModel):
    name: str | None = None
    body: str | None = None
    variants: str | None = None


class TemplateOut(BaseModel):
    id: int
    name: str
    body: str
    variants: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
