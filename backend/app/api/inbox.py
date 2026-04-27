from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.account import InstagramAccount
from app.models.contact import Contact
from app.models.event import Event
from app.models.message import Message, MessageDirection, MessageStatus, Thread
from app.models.user import User
from app.schemas.inbox import MessageOut, ReplyIn, ThreadDetail, ThreadOut
from app.services.instagram import fetch_inbox, send_dm

router = APIRouter(prefix="/inbox", tags=["inbox"])


@router.get("/threads", response_model=list[ThreadOut])
def list_threads(
    account_id: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ThreadOut]:
    q = (
        db.query(Thread)
        .join(InstagramAccount, InstagramAccount.id == Thread.account_id)
        .filter(InstagramAccount.owner_id == user.id)
    )
    if account_id is not None:
        q = q.filter(Thread.account_id == account_id)
    rows = q.order_by(desc(Thread.last_message_at)).limit(200).all()
    out: list[ThreadOut] = []
    for t in rows:
        last = (
            db.query(Message)
            .filter(Message.thread_id == t.id)
            .order_by(desc(Message.created_at))
            .first()
        )
        contact_username = None
        if t.contact_id:
            c = db.get(Contact, t.contact_id)
            contact_username = c.username if c else None
        item = ThreadOut.model_validate(t)
        item.contact_username = contact_username
        item.last_snippet = (last.body[:120] + ("…" if last and len(last.body) > 120 else "")) if last else None
        out.append(item)
    return out


@router.get("/threads/{tid}", response_model=ThreadDetail)
def get_thread(
    tid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ThreadDetail:
    t = (
        db.query(Thread)
        .join(InstagramAccount, InstagramAccount.id == Thread.account_id)
        .filter(Thread.id == tid, InstagramAccount.owner_id == user.id)
        .first()
    )
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Thread not found")
    msgs = (
        db.query(Message)
        .filter(Message.thread_id == tid)
        .order_by(Message.created_at.asc())
        .all()
    )
    contact_username = None
    if t.contact_id:
        c = db.get(Contact, t.contact_id)
        contact_username = c.username if c else None

    detail = ThreadDetail.model_validate(t)
    detail.contact_username = contact_username
    detail.last_snippet = msgs[-1].body if msgs else None
    detail.messages = [MessageOut.model_validate(m) for m in msgs]

    if t.unread_count:
        t.unread_count = 0
        db.commit()
    return detail


@router.post("/threads/{tid}/reply", response_model=MessageOut)
def reply_to_thread(
    tid: int,
    payload: ReplyIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageOut:
    t = (
        db.query(Thread)
        .join(InstagramAccount, InstagramAccount.id == Thread.account_id)
        .filter(Thread.id == tid, InstagramAccount.owner_id == user.id)
        .first()
    )
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Thread not found")
    acct = db.get(InstagramAccount, t.account_id)
    if not acct or not acct.encrypted_session:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Account not connected")
    contact = db.get(Contact, t.contact_id) if t.contact_id else None
    recipient = contact.username if contact else (t.title or "")
    if not recipient:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No recipient")

    result = send_dm(acct.encrypted_session, recipient, payload.body)
    msg = Message(
        thread_id=t.id,
        direction=MessageDirection.outbound,
        status=MessageStatus.sent if result.ok else MessageStatus.failed,
        body=payload.body,
        error=result.error,
        ig_item_id=result.item_id,
    )
    db.add(msg)
    t.last_message_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)
    return MessageOut.model_validate(msg)


@router.post("/sync")
def sync_inbox(
    account_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, int]:
    acct = (
        db.query(InstagramAccount)
        .filter(InstagramAccount.id == account_id, InstagramAccount.owner_id == user.id)
        .first()
    )
    if not acct or not acct.encrypted_session:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Account not connected")
    threads = fetch_inbox(acct.encrypted_session, limit=20)
    new_threads = 0
    new_msgs = 0
    for t in threads:
        existing = (
            db.query(Thread)
            .filter(Thread.account_id == acct.id, Thread.ig_thread_id == t["thread_id"])
            .first()
        )
        contact: Contact | None = None
        if t.get("username"):
            contact = (
                db.query(Contact)
                .filter(Contact.owner_id == user.id, Contact.username == t["username"])
                .first()
            )
            if not contact:
                contact = Contact(
                    owner_id=user.id,
                    username=t["username"],
                    full_name=t.get("full_name"),
                )
                db.add(contact)
                db.commit()
                db.refresh(contact)
        if not existing:
            existing = Thread(
                account_id=acct.id,
                contact_id=contact.id if contact else None,
                ig_thread_id=t["thread_id"],
                title=t.get("username"),
                last_message_at=datetime.utcnow(),
                unread_count=t.get("unread", 0),
            )
            db.add(existing)
            db.commit()
            db.refresh(existing)
            new_threads += 1
        if t.get("snippet"):
            already = (
                db.query(Message)
                .filter(Message.thread_id == existing.id, Message.body == t["snippet"])
                .first()
            )
            if not already:
                db.add(
                    Message(
                        thread_id=existing.id,
                        direction=MessageDirection.inbound,
                        status=MessageStatus.delivered,
                        body=t["snippet"],
                    )
                )
                existing.last_message_at = datetime.utcnow()
                if t.get("unread"):
                    existing.unread_count = (existing.unread_count or 0) + 1
                new_msgs += 1
    db.commit()
    if new_threads or new_msgs:
        db.add(
            Event(
                owner_id=user.id,
                type="inbox.synced",
                message=f"Inbox sync for @{acct.username}: {new_threads} new threads, {new_msgs} new messages",
            )
        )
        db.commit()
    return {"new_threads": new_threads, "new_messages": new_msgs}
