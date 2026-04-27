from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import encrypt_blob
from app.models.account import InstagramAccount
from app.models.event import Event
from app.models.user import User
from app.schemas.account import AccountLogin, AccountOut, AccountUpdate
from app.services.instagram import (
    InstagramAuthError,
    InstagramChallengeRequired,
    InstagramTwoFactorRequired,
)
from app.services.instagram import (
    login as ig_login,
)

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountOut])
def list_accounts(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[AccountOut]:
    rows = db.query(InstagramAccount).filter(InstagramAccount.owner_id == user.id).all()
    return [AccountOut.model_validate(r) for r in rows]


@router.post("/connect", response_model=AccountOut)
def connect_account(
    payload: AccountLogin,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountOut:
    try:
        ig_user, session_blob = ig_login(
            payload.username, payload.password, payload.verification_code
        )
    except InstagramTwoFactorRequired as exc:
        raise HTTPException(status.HTTP_428_PRECONDITION_REQUIRED, f"2FA required: {exc}") from exc
    except InstagramChallengeRequired as exc:
        raise HTTPException(
            status.HTTP_428_PRECONDITION_REQUIRED, f"Challenge required: {exc}"
        ) from exc
    except InstagramAuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc

    acct = (
        db.query(InstagramAccount)
        .filter(InstagramAccount.owner_id == user.id, InstagramAccount.username == ig_user.username)
        .first()
    )
    if not acct:
        acct = InstagramAccount(owner_id=user.id, username=ig_user.username)
        db.add(acct)
    acct.display_name = ig_user.full_name
    acct.profile_pic_url = ig_user.profile_pic_url
    acct.is_connected = True
    acct.last_login_at = datetime.utcnow()
    acct.encrypted_session = session_blob
    acct.encrypted_password = encrypt_blob(payload.password)
    db.commit()
    db.refresh(acct)

    db.add(
        Event(
            owner_id=user.id,
            type="account.connected",
            message=f"Connected Instagram account @{acct.username}",
        )
    )
    db.commit()
    return AccountOut.model_validate(acct)


@router.patch("/{account_id}", response_model=AccountOut)
def update_account(
    account_id: int,
    payload: AccountUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountOut:
    acct = (
        db.query(InstagramAccount)
        .filter(InstagramAccount.id == account_id, InstagramAccount.owner_id == user.id)
        .first()
    )
    if not acct:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(acct, k, v)
    db.commit()
    db.refresh(acct)
    return AccountOut.model_validate(acct)


@router.post("/{account_id}/disconnect", response_model=AccountOut)
def disconnect_account(
    account_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountOut:
    acct = (
        db.query(InstagramAccount)
        .filter(InstagramAccount.id == account_id, InstagramAccount.owner_id == user.id)
        .first()
    )
    if not acct:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    acct.is_connected = False
    acct.encrypted_session = None
    db.commit()
    db.refresh(acct)
    db.add(
        Event(
            owner_id=user.id,
            type="account.disconnected",
            message=f"Disconnected Instagram account @{acct.username}",
        )
    )
    db.commit()
    return AccountOut.model_validate(acct)


@router.delete("/{account_id}")
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, bool]:
    acct = (
        db.query(InstagramAccount)
        .filter(InstagramAccount.id == account_id, InstagramAccount.owner_id == user.id)
        .first()
    )
    if not acct:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    db.delete(acct)
    db.commit()
    return {"ok": True}
