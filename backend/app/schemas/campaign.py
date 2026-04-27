from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.models.campaign import CampaignStatus


class CampaignCreate(BaseModel):
    name: str
    account_id: int
    template_id: int
    list_id: int | None = None
    contact_ids: list[int] | None = None
    start_at: datetime | None = None
    notes: str | None = None


class CampaignUpdate(BaseModel):
    name: str | None = None
    status: CampaignStatus | None = None
    start_at: datetime | None = None
    notes: str | None = None


class CampaignContactOut(BaseModel):
    id: int
    contact_id: int
    contact_username: str | None = None
    status: str
    sent_at: datetime | None
    error: str | None
    rendered_body: str | None

    model_config = {"from_attributes": True}


class CampaignOut(BaseModel):
    id: int
    name: str
    account_id: int
    template_id: int
    list_id: int | None
    status: CampaignStatus
    start_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    total: int = 0
    sent: int = 0
    failed: int = 0
    replied: int = 0
    pending: int = 0

    model_config = {"from_attributes": True}


class CampaignDetail(CampaignOut):
    items: list[CampaignContactOut] = []
