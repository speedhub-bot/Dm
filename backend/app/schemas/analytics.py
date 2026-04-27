from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class KPI(BaseModel):
    accounts: int
    contacts: int
    campaigns_active: int
    sent_today: int
    sent_total: int
    replied_total: int
    reply_rate: float
    failed_total: int


class TimeseriesPoint(BaseModel):
    date: str
    sent: int
    replied: int
    failed: int


class TopAccount(BaseModel):
    account_id: int
    username: str
    sent: int


class EventOut(BaseModel):
    id: int
    type: str
    message: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DashboardData(BaseModel):
    kpi: KPI
    timeseries: list[TimeseriesPoint]
    top_accounts: list[TopAccount]
    recent_events: list[EventOut]
