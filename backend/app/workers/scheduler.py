"""Background scheduler that runs running campaigns and ticks the send queue."""
from __future__ import annotations

import logging
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.account import InstagramAccount
from app.models.campaign import Campaign, CampaignContact, CampaignStatus
from app.models.contact import Contact
from app.models.event import Event
from app.models.message import Message, MessageDirection, MessageStatus, Thread
from app.models.template import Template
from app.services.instagram import send_dm
from app.services.templating import render
from app.services.throttle import can_send_now

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _process_campaign(db: Session, campaign: Campaign) -> int:
    """Send up to N messages for this campaign respecting throttling. Returns # sent."""
    acct: InstagramAccount | None = db.get(InstagramAccount, campaign.account_id)
    if not acct or not acct.is_connected or not acct.encrypted_session:
        return 0
    template: Template | None = db.get(Template, campaign.template_id)
    if not template:
        return 0

    sent_now = 0
    # Process at most 5 contacts per tick to keep the loop responsive.
    pending = (
        db.query(CampaignContact)
        .filter(CampaignContact.campaign_id == campaign.id, CampaignContact.status == "pending")
        .order_by(CampaignContact.id.asc())
        .limit(5)
        .all()
    )
    for cc in pending:
        ok, reason = can_send_now(db, acct)
        if not ok:
            logger.debug("throttled: %s", reason)
            return sent_now

        contact: Contact | None = db.get(Contact, cc.contact_id)
        if not contact:
            cc.status = "failed"
            cc.error = "contact missing"
            db.commit()
            continue

        ctx = {
            "username": contact.username,
            "full_name": contact.full_name or contact.username,
            "first_name": (contact.full_name or contact.username).split()[0],
        }
        body = render(template.body, template.variants, ctx)

        result = send_dm(acct.encrypted_session, contact.username, body)

        # Find or create thread
        thread = (
            db.query(Thread)
            .filter(Thread.account_id == acct.id, Thread.contact_id == contact.id)
            .first()
        )
        if not thread:
            thread = Thread(
                account_id=acct.id,
                contact_id=contact.id,
                ig_thread_id=result.thread_id,
                title=contact.username,
                last_message_at=datetime.utcnow(),
            )
            db.add(thread)
            db.commit()
            db.refresh(thread)

        msg = Message(
            thread_id=thread.id,
            direction=MessageDirection.outbound,
            status=MessageStatus.sent if result.ok else MessageStatus.failed,
            body=body,
            campaign_id=campaign.id,
            error=result.error,
            ig_item_id=result.item_id,
        )
        db.add(msg)
        thread.last_message_at = datetime.utcnow()

        cc.status = "sent" if result.ok else "failed"
        cc.error = result.error
        cc.sent_at = datetime.utcnow() if result.ok else None
        cc.rendered_body = body

        if result.ok:
            sent_now += 1
            acct.last_action_at = datetime.utcnow()
        db.commit()

    return sent_now


def tick() -> None:
    db = SessionLocal()
    try:
        running = (
            db.query(Campaign)
            .filter(Campaign.status == CampaignStatus.running)
            .all()
        )
        # Auto-start scheduled campaigns whose time has come.
        scheduled = (
            db.query(Campaign)
            .filter(
                Campaign.status == CampaignStatus.scheduled,
                Campaign.start_at.isnot(None),
                Campaign.start_at <= datetime.utcnow(),
            )
            .all()
        )
        for c in scheduled:
            c.status = CampaignStatus.running
            db.add(
                Event(
                    owner_id=c.owner_id,
                    type="campaign.auto_started",
                    message=f"Auto-started scheduled campaign '{c.name}'",
                )
            )
        db.commit()

        for campaign in running:
            sent = _process_campaign(db, campaign)
            # Check completion
            remaining = (
                db.query(CampaignContact)
                .filter(
                    CampaignContact.campaign_id == campaign.id,
                    CampaignContact.status == "pending",
                )
                .count()
            )
            if remaining == 0:
                campaign.status = CampaignStatus.completed
                db.add(
                    Event(
                        owner_id=campaign.owner_id,
                        type="campaign.completed",
                        message=f"Campaign '{campaign.name}' completed",
                    )
                )
                db.commit()
            if sent:
                logger.info("campaign %s: sent %d this tick", campaign.id, sent)
    except Exception as exc:  # noqa: BLE001
        logger.exception("scheduler tick error: %s", exc)
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler:
        return _scheduler
    sched = BackgroundScheduler(daemon=True)
    sched.add_job(tick, "interval", seconds=settings.scheduler_interval_sec, id="dm_tick")
    sched.start()
    _scheduler = sched
    logger.info("Scheduler started (interval=%ss)", settings.scheduler_interval_sec)
    return sched


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
