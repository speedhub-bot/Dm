from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.template import Template
from app.models.user import User
from app.schemas.template import TemplateCreate, TemplateOut, TemplateUpdate
from app.services.templating import render

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[TemplateOut])
def list_templates(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[TemplateOut]:
    rows = (
        db.query(Template)
        .filter(Template.owner_id == user.id)
        .order_by(Template.created_at.desc())
        .all()
    )
    return [TemplateOut.model_validate(r) for r in rows]


@router.post("", response_model=TemplateOut)
def create_template(
    payload: TemplateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TemplateOut:
    t = Template(owner_id=user.id, **payload.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return TemplateOut.model_validate(t)


@router.patch("/{tid}", response_model=TemplateOut)
def update_template(
    tid: int,
    payload: TemplateUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TemplateOut:
    t = (
        db.query(Template)
        .filter(Template.id == tid, Template.owner_id == user.id)
        .first()
    )
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return TemplateOut.model_validate(t)


@router.delete("/{tid}")
def delete_template(
    tid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, bool]:
    t = (
        db.query(Template)
        .filter(Template.id == tid, Template.owner_id == user.id)
        .first()
    )
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    db.delete(t)
    db.commit()
    return {"ok": True}


@router.post("/{tid}/preview")
def preview_template(
    tid: int,
    ctx: dict[str, str] | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    t = (
        db.query(Template)
        .filter(Template.id == tid, Template.owner_id == user.id)
        .first()
    )
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    sample = ctx or {"username": "alex.smith", "full_name": "Alex Smith"}
    return {"rendered": render(t.body, t.variants, sample)}
