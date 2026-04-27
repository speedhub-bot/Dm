from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AccountLogin(BaseModel):
    username: str
    password: str
    verification_code: str | None = None  # 2FA TOTP


class AccountUpdate(BaseModel):
    min_delay_sec: int | None = None
    max_delay_sec: int | None = None
    daily_cap: int | None = None
    hourly_cap: int | None = None
    work_hours_start: int | None = None
    work_hours_end: int | None = None
    notes: str | None = None


class AccountOut(BaseModel):
    id: int
    username: str
    display_name: str | None
    profile_pic_url: str | None
    is_connected: bool
    last_login_at: datetime | None
    min_delay_sec: int
    max_delay_sec: int
    daily_cap: int
    hourly_cap: int
    work_hours_start: int
    work_hours_end: int
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
