from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.account import InstagramAccount
from app.models.campaign import Campaign, CampaignContact, CampaignStatus
from app.models.contact import Contact, ContactListMember
from app.models.event import Event
from app.models.template import Template
from app.models.user import User
from app.schemas.campaign import (
    CampaignContactOut,
    CampaignCreate,
    CampaignDetail,
    CampaignOut,
    CampaignUpdate,
)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def _stats_for_campaign(db: Session, c: Campaign) -> dict[str, int]:
    counts = dict(
        db.query(CampaignContact.status, func.count(CampaignContact.id))
        .filter(CampaignContact.campaign_id == c.id)
        .group_by(CampaignContact.status)
        .all()
    )
    total = sum(counts.values())
    return {
        "total": total,
        "pending": int(counts.get("pending", 0)),
        "sent": int(counts.get("sent", 0)),
        "failed": int(counts.get("failed", 0)),
        "replied": int(counts.get("replied", 0)),
    }


def _to_out(db: Session, c: Campaign) -> CampaignOut:
    out = CampaignOut.model_validate(c)
    s = _stats_for_campaign(db, c)
    out.total = s["total"]
    out.pending = s["pending"]
    out.sent = s["sent"]
    out.failed = s["failed"]
    out.replied = s["replied"]
    return out


@router.get("", response_model=list[CampaignOut])
def list_campaigns(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[CampaignOut]:
    rows = (
        db.query(Campaign)
        .filter(Campaign.owner_id == user.id)
        .order_by(Campaign.created_at.desc())
        .all()
    )
    return [_to_out(db, c) for c in rows]


@router.post("", response_model=CampaignDetail)
def create_campaign(
    payload: CampaignCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CampaignDetail:
    acct = (
        db.query(InstagramAccount)
        .filter(InstagramAccount.id == payload.account_id, InstagramAccount.owner_id == user.id)
        .first()
    )
    if not acct:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    tmpl = (
        db.query(Template)
        .filter(Template.id == payload.template_id, Template.owner_id == user.id)
        .first()
    )
    if not tmpl:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")

    c = Campaign(
        owner_id=user.id,
        account_id=payload.account_id,
        template_id=payload.template_id,
        list_id=payload.list_id,
        name=payload.name,
        start_at=payload.start_at,
        notes=payload.notes,
        status=CampaignStatus.draft,
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    contact_ids: set[int] = set()
    if payload.contact_ids:
        contact_ids.update(payload.contact_ids)
    if payload.list_id:
        ids = (
            db.query(ContactListMember.contact_id)
            .filter(ContactListMember.list_id == payload.list_id)
            .all()
        )
        contact_ids.update([i for (i,) in ids])

    for cid in contact_ids:
        contact = (
            db.query(Contact)
            .filter(Contact.id == cid, Contact.owner_id == user.id)
            .first()
        )
        if not contact:
            continue
        db.add(CampaignContact(campaign_id=c.id, contact_id=contact.id, status="pending"))
    db.commit()
    db.refresh(c)

    detail = CampaignDetail.model_validate(c)
    s = _stats_for_campaign(db, c)
    for k, v in s.items():
        setattr(detail, k, v)
    detail.items = []
    return detail


@router.get("/{cid}", response_model=CampaignDetail)
def get_campaign(
    cid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CampaignDetail:
    c = (
        db.query(Campaign)
        .filter(Campaign.id == cid, Campaign.owner_id == user.id)
        .first()
    )
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")

    items_raw = (
        db.query(CampaignContact, Contact.username)
        .join(Contact, Contact.id == CampaignContact.contact_id)
        .filter(CampaignContact.campaign_id == cid)
        .order_by(CampaignContact.id.asc())
        .limit(500)
        .all()
    )
    items = []
    for cc, uname in items_raw:
        item = CampaignContactOut.model_validate(cc)
        item.contact_username = uname
        items.append(item)

    detail = CampaignDetail.model_validate(c)
    s = _stats_for_campaign(db, c)
    for k, v in s.items():
        setattr(detail, k, v)
    detail.items = items
    return detail


@router.patch("/{cid}", response_model=CampaignOut)
def update_campaign(
    cid: int,
    payload: CampaignUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CampaignOut:
    c = (
        db.query(Campaign)
        .filter(Campaign.id == cid, Campaign.owner_id == user.id)
        .first()
    )
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return _to_out(db, c)


@router.post("/{cid}/start", response_model=CampaignOut)
def start_campaign(
    cid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CampaignOut:
    c = (
        db.query(Campaign)
        .filter(Campaign.id == cid, Campaign.owner_id == user.id)
        .first()
    )
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    if c.status in (CampaignStatus.completed, CampaignStatus.failed):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Campaign already finished")
    c.status = CampaignStatus.running
    if c.start_at is None:
        c.start_at = datetime.utcnow()
    db.commit()
    db.refresh(c)
    db.add(
        Event(
            owner_id=user.id,
            type="campaign.started",
            message=f"Campaign '{c.name}' started",
        )
    )
    db.commit()
    return _to_out(db, c)


@router.post("/{cid}/pause", response_model=CampaignOut)
def pause_campaign(
    cid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CampaignOut:
    c = (
        db.query(Campaign)
        .filter(Campaign.id == cid, Campaign.owner_id == user.id)
        .first()
    )
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    c.status = CampaignStatus.paused
    db.commit()
    db.refresh(c)
    db.add(
        Event(
            owner_id=user.id,
            type="campaign.paused",
            message=f"Campaign '{c.name}' paused",
        )
    )
    db.commit()
    return _to_out(db, c)


@router.delete("/{cid}")
def delete_campaign(
    cid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, bool]:
    c = (
        db.query(Campaign)
        .filter(Campaign.id == cid, Campaign.owner_id == user.id)
        .first()
    )
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    db.delete(c)
    db.commit()
    return {"ok": True}
