from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.models.message import MessageDirection, MessageStatus


class MessageOut(BaseModel):
    id: int
    direction: MessageDirection
    status: MessageStatus
    body: str
    error: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ThreadOut(BaseModel):
    id: int
    account_id: int
    contact_id: int | None
    contact_username: str | None = None
    title: str | None
    last_message_at: datetime | None
    unread_count: int
    last_snippet: str | None = None

    model_config = {"from_attributes": True}


class ThreadDetail(ThreadOut):
    messages: list[MessageOut] = []


class ReplyIn(BaseModel):
    body: str
