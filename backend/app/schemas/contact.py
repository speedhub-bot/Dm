from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ContactCreate(BaseModel):
    username: str
    full_name: str | None = None
    pk: str | None = None
    profile_pic_url: str | None = None
    notes: str | None = None
    tags: str | None = None


class ContactUpdate(BaseModel):
    full_name: str | None = None
    notes: str | None = None
    tags: str | None = None


class ContactOut(BaseModel):
    id: int
    username: str
    full_name: str | None
    pk: str | None
    profile_pic_url: str | None
    notes: str | None
    tags: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ContactListCreate(BaseModel):
    name: str
    description: str | None = None


class ContactListOut(BaseModel):
    id: int
    name: str
    description: str | None
    created_at: datetime
    member_count: int = 0

    model_config = {"from_attributes": True}


class ContactBulkAdd(BaseModel):
    usernames: list[str]


class ScrapeRequest(BaseModel):
    account_id: int
    target_username: str
    source: str = "followers"  # followers | following
    limit: int = 50
    list_id: int | None = None
