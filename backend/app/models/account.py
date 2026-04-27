from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class InstagramAccount(Base):
    __tablename__ = "instagram_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    username: Mapped[str] = mapped_column(String(255), index=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    profile_pic_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Encrypted instagrapi session blob (settings json)
    encrypted_session: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Encrypted password (kept for re-login on session expiry)
    encrypted_password: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Throttle config
    min_delay_sec: Mapped[int] = mapped_column(Integer, default=45)
    max_delay_sec: Mapped[int] = mapped_column(Integer, default=120)
    daily_cap: Mapped[int] = mapped_column(Integer, default=50)
    hourly_cap: Mapped[int] = mapped_column(Integer, default=12)
    work_hours_start: Mapped[int] = mapped_column(Integer, default=9)   # 24h
    work_hours_end: Mapped[int] = mapped_column(Integer, default=21)    # 24h

    last_action_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="accounts")
    campaigns = relationship("Campaign", back_populates="account")
    threads = relationship("Thread", back_populates="account", cascade="all, delete-orphan")
