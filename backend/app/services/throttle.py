"""Throttling and anti-ban rate-limit helpers."""
from __future__ import annotations

import random
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.account import InstagramAccount
from app.models.message import Message, MessageDirection, MessageStatus, Thread


def within_work_hours(account: InstagramAccount, now: datetime | None = None) -> bool:
    now = now or datetime.utcnow()
    h = now.hour
    if account.work_hours_start <= account.work_hours_end:
        return account.work_hours_start <= h < account.work_hours_end
    # Wraps midnight
    return h >= account.work_hours_start or h < account.work_hours_end


def sent_in_window(db: Session, account_id: int, since: datetime) -> int:
    return (
        db.query(func.count(Message.id))
        .join(Thread, Message.thread_id == Thread.id)
        .filter(
            Thread.account_id == account_id,
            Message.direction == MessageDirection.outbound,
            Message.status.in_([MessageStatus.sent, MessageStatus.delivered, MessageStatus.read]),
            Message.created_at >= since,
        )
        .scalar()
        or 0
    )


def can_send_now(db: Session, account: InstagramAccount, now: datetime | None = None) -> tuple[bool, str | None]:
    now = now or datetime.utcnow()
    if not within_work_hours(account, now):
        return False, "outside_work_hours"
    day_count = sent_in_window(db, account.id, now - timedelta(hours=24))
    if day_count >= account.daily_cap:
        return False, "daily_cap_reached"
    hour_count = sent_in_window(db, account.id, now - timedelta(hours=1))
    if hour_count >= account.hourly_cap:
        return False, "hourly_cap_reached"
    if account.last_action_at is not None:
        next_ok = account.last_action_at + timedelta(seconds=account.min_delay_sec)
        if now < next_ok:
            return False, "cooldown"
    return True, None


def random_delay_sec(account: InstagramAccount) -> int:
    lo = max(1, account.min_delay_sec)
    hi = max(lo, account.max_delay_sec)
    return random.randint(lo, hi)
