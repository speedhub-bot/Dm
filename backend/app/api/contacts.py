from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.account import InstagramAccount
from app.models.contact import Contact, ContactList, ContactListMember
from app.models.event import Event
from app.models.user import User
from app.schemas.contact import (
    ContactBulkAdd,
    ContactCreate,
    ContactListCreate,
    ContactListOut,
    ContactOut,
    ContactUpdate,
    ScrapeRequest,
)
from app.services.instagram import fetch_followers, fetch_following

router = APIRouter(prefix="/contacts", tags=["contacts"])


def _upsert_contact(db: Session, owner_id: int, **kwargs) -> Contact:
    username = kwargs["username"].lstrip("@").strip().lower()
    if not username:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "username required")
    existing = (
        db.query(Contact)
        .filter(Contact.owner_id == owner_id, Contact.username == username)
        .first()
    )
    if existing:
        for k, v in kwargs.items():
            if v is not None and k != "username":
                setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        return existing
    c = Contact(owner_id=owner_id, **{**kwargs, "username": username})
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("", response_model=list[ContactOut])
def list_contacts(
    q: str | None = None,
    list_id: int | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ContactOut]:
    query = db.query(Contact).filter(Contact.owner_id == user.id)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            (Contact.username.ilike(like)) | (Contact.full_name.ilike(like))
        )
    if list_id:
        query = query.join(ContactListMember, ContactListMember.contact_id == Contact.id).filter(
            ContactListMember.list_id == list_id
        )
    rows = query.order_by(Contact.created_at.desc()).limit(limit).all()
    return [ContactOut.model_validate(r) for r in rows]


@router.post("", response_model=ContactOut)
def create_contact(
    payload: ContactCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContactOut:
    c = _upsert_contact(db, user.id, **payload.model_dump())
    return ContactOut.model_validate(c)


@router.post("/bulk", response_model=list[ContactOut])
def bulk_add_contacts(
    payload: ContactBulkAdd,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ContactOut]:
    out = []
    for u in payload.usernames:
        u = u.strip()
        if not u:
            continue
        out.append(_upsert_contact(db, user.id, username=u))
    return [ContactOut.model_validate(c) for c in out]


@router.post("/import-csv", response_model=list[ContactOut])
async def import_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ContactOut]:
    raw = await file.read()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    reader = csv.DictReader(io.StringIO(text))
    out: list[Contact] = []
    for row in reader:
        username = (row.get("username") or row.get("handle") or "").strip()
        if not username:
            continue
        c = _upsert_contact(
            db,
            user.id,
            username=username,
            full_name=row.get("full_name") or row.get("name"),
            notes=row.get("notes"),
            tags=row.get("tags"),
        )
        out.append(c)
    return [ContactOut.model_validate(c) for c in out]


@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(
    contact_id: int,
    payload: ContactUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContactOut:
    c = (
        db.query(Contact)
        .filter(Contact.id == contact_id, Contact.owner_id == user.id)
        .first()
    )
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contact not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return ContactOut.model_validate(c)


@router.delete("/{contact_id}")
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, bool]:
    c = (
        db.query(Contact)
        .filter(Contact.id == contact_id, Contact.owner_id == user.id)
        .first()
    )
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contact not found")
    db.delete(c)
    db.commit()
    return {"ok": True}


@router.post("/scrape", response_model=list[ContactOut])
def scrape_followers(
    payload: ScrapeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ContactOut]:
    acct = (
        db.query(InstagramAccount)
        .filter(InstagramAccount.id == payload.account_id, InstagramAccount.owner_id == user.id)
        .first()
    )
    if not acct or not acct.encrypted_session:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Account not connected")

    fn = fetch_followers if payload.source == "followers" else fetch_following
    users = fn(acct.encrypted_session, payload.target_username, payload.limit)

    target_list: ContactList | None = None
    if payload.list_id:
        target_list = (
            db.query(ContactList)
            .filter(ContactList.id == payload.list_id, ContactList.owner_id == user.id)
            .first()
        )
        if not target_list:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "List not found")

    created: list[Contact] = []
    for u in users:
        c = _upsert_contact(
            db,
            user.id,
            username=u.username,
            full_name=u.full_name,
            pk=u.pk,
            profile_pic_url=u.profile_pic_url,
        )
        created.append(c)
        if target_list:
            exists = (
                db.query(ContactListMember)
                .filter(
                    ContactListMember.list_id == target_list.id,
                    ContactListMember.contact_id == c.id,
                )
                .first()
            )
            if not exists:
                db.add(ContactListMember(list_id=target_list.id, contact_id=c.id))
    db.commit()

    db.add(
        Event(
            owner_id=user.id,
            type="contacts.scraped",
            message=f"Imported {len(created)} contacts from @{payload.target_username} ({payload.source})",
        )
    )
    db.commit()
    return [ContactOut.model_validate(c) for c in created]


# --- Lists -----------------------------------------------------------------

lists_router = APIRouter(prefix="/contact-lists", tags=["contact-lists"])


@lists_router.get("", response_model=list[ContactListOut])
def list_lists(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ContactListOut]:
    rows = (
        db.query(
            ContactList,
            func.count(ContactListMember.id).label("member_count"),
        )
        .outerjoin(ContactListMember, ContactListMember.list_id == ContactList.id)
        .filter(ContactList.owner_id == user.id)
        .group_by(ContactList.id)
        .order_by(ContactList.created_at.desc())
        .all()
    )
    out = []
    for cl, count in rows:
        item = ContactListOut.model_validate(cl)
        item.member_count = int(count or 0)
        out.append(item)
    return out


@lists_router.post("", response_model=ContactListOut)
def create_list(
    payload: ContactListCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContactListOut:
    cl = ContactList(owner_id=user.id, **payload.model_dump())
    db.add(cl)
    db.commit()
    db.refresh(cl)
    return ContactListOut.model_validate(cl)


@lists_router.delete("/{list_id}")
def delete_list(
    list_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, bool]:
    cl = (
        db.query(ContactList)
        .filter(ContactList.id == list_id, ContactList.owner_id == user.id)
        .first()
    )
    if not cl:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "List not found")
    db.delete(cl)
    db.commit()
    return {"ok": True}


@lists_router.post("/{list_id}/add-contacts", response_model=ContactListOut)
def add_contacts_to_list(
    list_id: int,
    contact_ids: list[int],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContactListOut:
    cl = (
        db.query(ContactList)
        .filter(ContactList.id == list_id, ContactList.owner_id == user.id)
        .first()
    )
    if not cl:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "List not found")
    for cid in contact_ids:
        c = (
            db.query(Contact)
            .filter(Contact.id == cid, Contact.owner_id == user.id)
            .first()
        )
        if not c:
            continue
        exists = (
            db.query(ContactListMember)
            .filter(ContactListMember.list_id == list_id, ContactListMember.contact_id == cid)
            .first()
        )
        if not exists:
            db.add(ContactListMember(list_id=list_id, contact_id=cid))
    db.commit()
    member_count = (
        db.query(func.count(ContactListMember.id))
        .filter(ContactListMember.list_id == list_id)
        .scalar()
        or 0
    )
    out = ContactListOut.model_validate(cl)
    out.member_count = int(member_count)
    return out
