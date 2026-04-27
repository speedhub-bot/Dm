from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.account import InstagramAccount
from app.models.campaign import Campaign, CampaignStatus
from app.models.contact import Contact
from app.models.event import Event
from app.models.message import Message, MessageDirection, MessageStatus, Thread
from app.models.user import User
from app.schemas.analytics import (
    KPI,
    DashboardData,
    EventOut,
    TimeseriesPoint,
    TopAccount,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _user_account_ids(db: Session, user_id: int) -> list[int]:
    return [
        i for (i,) in db.query(InstagramAccount.id).filter(InstagramAccount.owner_id == user_id).all()
    ]


@router.get("/dashboard", response_model=DashboardData)
def dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DashboardData:
    account_ids = _user_account_ids(db, user.id)

    accounts = len(account_ids)
    contacts = db.query(func.count(Contact.id)).filter(Contact.owner_id == user.id).scalar() or 0
    campaigns_active = (
        db.query(func.count(Campaign.id))
        .filter(
            Campaign.owner_id == user.id,
            Campaign.status.in_([CampaignStatus.running, CampaignStatus.scheduled]),
        )
        .scalar()
        or 0
    )

    base_q = (
        db.query(Message)
        .join(Thread, Thread.id == Message.thread_id)
        .filter(Thread.account_id.in_(account_ids) if account_ids else False)
    )

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    sent_today = (
        base_q.filter(
            Message.direction == MessageDirection.outbound,
            Message.status == MessageStatus.sent,
            Message.created_at >= today_start,
        ).count()
        if account_ids
        else 0
    )

    sent_total = (
        base_q.filter(
            Message.direction == MessageDirection.outbound,
            Message.status == MessageStatus.sent,
        ).count()
        if account_ids
        else 0
    )

    failed_total = (
        base_q.filter(
            Message.direction == MessageDirection.outbound,
            Message.status == MessageStatus.failed,
        ).count()
        if account_ids
        else 0
    )

    replied_total = (
        base_q.filter(Message.direction == MessageDirection.inbound).count()
        if account_ids
        else 0
    )
    reply_rate = (replied_total / sent_total) if sent_total else 0.0

    kpi = KPI(
        accounts=int(accounts),
        contacts=int(contacts),
        campaigns_active=int(campaigns_active),
        sent_today=int(sent_today),
        sent_total=int(sent_total),
        replied_total=int(replied_total),
        reply_rate=round(reply_rate, 4),
        failed_total=int(failed_total),
    )

    # Timeseries last 14 days
    timeseries: list[TimeseriesPoint] = []
    if account_ids:
        since = datetime.utcnow() - timedelta(days=14)
        rows = (
            db.query(
                func.date(Message.created_at).label("d"),
                func.sum(
                    case(
                        (
                            (Message.direction == MessageDirection.outbound)
                            & (Message.status == MessageStatus.sent),
                            1,
                        ),
                        else_=0,
                    )
                ).label("sent"),
                func.sum(
                    case(
                        (Message.direction == MessageDirection.inbound, 1),
                        else_=0,
                    )
                ).label("replied"),
                func.sum(
                    case(
                        (
                            (Message.direction == MessageDirection.outbound)
                            & (Message.status == MessageStatus.failed),
                            1,
                        ),
                        else_=0,
                    )
                ).label("failed"),
            )
            .join(Thread, Thread.id == Message.thread_id)
            .filter(Thread.account_id.in_(account_ids), Message.created_at >= since)
            .group_by(func.date(Message.created_at))
            .order_by(func.date(Message.created_at))
            .all()
        )
        for d, sent, replied, failed in rows:
            timeseries.append(
                TimeseriesPoint(
                    date=str(d),
                    sent=int(sent or 0),
                    replied=int(replied or 0),
                    failed=int(failed or 0),
                )
            )

    # Top accounts by sent
    top_accounts: list[TopAccount] = []
    if account_ids:
        rows = (
            db.query(
                InstagramAccount.id,
                InstagramAccount.username,
                func.count(Message.id).label("sent"),
            )
            .join(Thread, Thread.account_id == InstagramAccount.id)
            .join(Message, Message.thread_id == Thread.id)
            .filter(
                InstagramAccount.id.in_(account_ids),
                Message.direction == MessageDirection.outbound,
                Message.status == MessageStatus.sent,
            )
            .group_by(InstagramAccount.id, InstagramAccount.username)
            .order_by(func.count(Message.id).desc())
            .limit(5)
            .all()
        )
        for aid, uname, sent in rows:
            top_accounts.append(TopAccount(account_id=int(aid), username=uname, sent=int(sent)))

    recent_events_rows = (
        db.query(Event)
        .filter(Event.owner_id == user.id)
        .order_by(Event.created_at.desc())
        .limit(20)
        .all()
    )
    recent_events = [EventOut.model_validate(e) for e in recent_events_rows]

    return DashboardData(
        kpi=kpi,
        timeseries=timeseries,
        top_accounts=top_accounts,
        recent_events=recent_events,
    )
