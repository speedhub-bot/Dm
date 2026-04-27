"""Instagram service layer.

Wraps `instagrapi` for real network access, but also supports a `demo_mode`
that simulates all interactions so the app can be developed and demoed
without real Instagram credentials.
"""
from __future__ import annotations

import json
import logging
import random
import time
from dataclasses import dataclass
from typing import Any

from app.core.config import settings
from app.core.security import decrypt_blob, encrypt_blob

logger = logging.getLogger(__name__)


class InstagramAuthError(Exception):
    pass


class InstagramTwoFactorRequired(InstagramAuthError):
    pass


class InstagramChallengeRequired(InstagramAuthError):
    pass


class InstagramRateLimited(Exception):
    pass


@dataclass
class IGUser:
    pk: str
    username: str
    full_name: str | None
    profile_pic_url: str | None


@dataclass
class IGSendResult:
    item_id: str | None
    thread_id: str | None
    ok: bool
    error: str | None = None


def _import_client():
    """Import instagrapi lazily so demo mode works without the dep."""
    try:
        from instagrapi import Client  # type: ignore
        from instagrapi.exceptions import (  # type: ignore
            BadPassword,
            ChallengeRequired,
            LoginRequired,
            TwoFactorRequired,
        )

        return Client, BadPassword, ChallengeRequired, LoginRequired, TwoFactorRequired
    except Exception as exc:  # pragma: no cover - optional in demo
        logger.warning("instagrapi unavailable: %s", exc)
        return None, None, None, None, None


def _new_client(settings_blob: str | None = None):
    Client, *_ = _import_client()
    if Client is None:
        return None
    cl = Client()
    cl.delay_range = [1, 3]
    if settings_blob:
        try:
            cl.set_settings(json.loads(settings_blob))
        except Exception:  # noqa: BLE001
            pass
    return cl


def login(
    username: str,
    password: str,
    verification_code: str | None = None,
    existing_session: str | None = None,
) -> tuple[IGUser, str]:
    """Login to Instagram, return (IGUser, encrypted_session_blob).

    Raises InstagramTwoFactorRequired / InstagramChallengeRequired / InstagramAuthError.
    """
    if settings.demo_mode:
        # Simulate a successful login. Encode a fake session blob.
        fake_session = {"username": username, "demo": True, "ts": time.time()}
        blob = encrypt_blob(json.dumps(fake_session))
        return (
            IGUser(
                pk=str(abs(hash(username)) % 10**12),
                username=username,
                full_name=username.replace(".", " ").replace("_", " ").title(),
                profile_pic_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={username}",
            ),
            blob,
        )

    Client, BadPassword, ChallengeRequired, LoginRequired, TwoFactorRequired = _import_client()
    if Client is None:
        raise InstagramAuthError("instagrapi not installed and demo_mode is off")

    cl = _new_client(decrypt_blob(existing_session) if existing_session else None)
    try:
        if verification_code:
            cl.login(username, password, verification_code=verification_code)
        else:
            cl.login(username, password)
    except TwoFactorRequired as exc:
        raise InstagramTwoFactorRequired(str(exc)) from exc
    except ChallengeRequired as exc:
        raise InstagramChallengeRequired(str(exc)) from exc
    except BadPassword as exc:
        raise InstagramAuthError(f"Bad password: {exc}") from exc
    except Exception as exc:
        raise InstagramAuthError(f"Login failed: {exc}") from exc

    info = cl.account_info()
    settings_dict: dict[str, Any] = cl.get_settings()
    blob = encrypt_blob(json.dumps(settings_dict))
    return (
        IGUser(
            pk=str(info.pk),
            username=info.username,
            full_name=info.full_name,
            profile_pic_url=str(info.profile_pic_url) if info.profile_pic_url else None,
        ),
        blob,
    )


def get_user_info(session_blob: str, username: str) -> IGUser | None:
    if settings.demo_mode:
        return IGUser(
            pk=str(abs(hash(username)) % 10**12),
            username=username,
            full_name=username.replace(".", " ").replace("_", " ").title(),
            profile_pic_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={username}",
        )
    cl = _new_client(decrypt_blob(session_blob))
    if cl is None:
        return None
    try:
        u = cl.user_info_by_username(username)
        return IGUser(
            pk=str(u.pk),
            username=u.username,
            full_name=u.full_name,
            profile_pic_url=str(u.profile_pic_url) if u.profile_pic_url else None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("user_info_by_username(%s) failed: %s", username, exc)
        return None


def fetch_followers(session_blob: str, target_username: str, limit: int = 50) -> list[IGUser]:
    """Fetch followers of `target_username`. Demo mode returns synthetic users."""
    if settings.demo_mode:
        rng = random.Random(target_username)
        first_names = ["alex", "sam", "jordan", "taylor", "casey", "morgan", "jamie", "riley"]
        last_names = ["lee", "park", "smith", "ngo", "khan", "rossi", "ali", "patel"]
        out: list[IGUser] = []
        for i in range(limit):
            uname = f"{rng.choice(first_names)}.{rng.choice(last_names)}{rng.randint(10, 9999)}"
            out.append(
                IGUser(
                    pk=str(rng.randint(10**9, 10**12)),
                    username=uname,
                    full_name=uname.replace(".", " ").title(),
                    profile_pic_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={uname}",
                )
            )
        return out

    cl = _new_client(decrypt_blob(session_blob))
    if cl is None:
        return []
    try:
        target = cl.user_info_by_username(target_username)
        users = cl.user_followers(target.pk, amount=limit)
        return [
            IGUser(
                pk=str(u.pk),
                username=u.username,
                full_name=u.full_name,
                profile_pic_url=str(u.profile_pic_url) if u.profile_pic_url else None,
            )
            for u in users.values()
        ]
    except Exception as exc:  # noqa: BLE001
        logger.warning("fetch_followers(%s) failed: %s", target_username, exc)
        return []


def fetch_following(session_blob: str, target_username: str, limit: int = 50) -> list[IGUser]:
    if settings.demo_mode:
        return fetch_followers(session_blob, "f-" + target_username, limit)
    cl = _new_client(decrypt_blob(session_blob))
    if cl is None:
        return []
    try:
        target = cl.user_info_by_username(target_username)
        users = cl.user_following(target.pk, amount=limit)
        return [
            IGUser(
                pk=str(u.pk),
                username=u.username,
                full_name=u.full_name,
                profile_pic_url=str(u.profile_pic_url) if u.profile_pic_url else None,
            )
            for u in users.values()
        ]
    except Exception as exc:  # noqa: BLE001
        logger.warning("fetch_following(%s) failed: %s", target_username, exc)
        return []


def send_dm(session_blob: str, recipient_username: str, body: str) -> IGSendResult:
    """Send a DM. Returns IGSendResult (ok/false + ids)."""
    if settings.demo_mode:
        # 95% success rate in demo to make analytics interesting.
        ok = random.random() > 0.05
        if not ok:
            return IGSendResult(item_id=None, thread_id=None, ok=False, error="Demo simulated failure")
        return IGSendResult(
            item_id=f"item_{random.randint(10**9, 10**12)}",
            thread_id=f"thr_{abs(hash(recipient_username)) % 10**10}",
            ok=True,
        )

    cl = _new_client(decrypt_blob(session_blob))
    if cl is None:
        return IGSendResult(None, None, False, "instagrapi not installed")
    try:
        user = cl.user_info_by_username(recipient_username)
        result = cl.direct_send(body, user_ids=[user.pk])
        return IGSendResult(
            item_id=str(getattr(result, "id", "") or ""),
            thread_id=str(getattr(result, "thread_id", "") or ""),
            ok=True,
        )
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        if "feedback_required" in msg or "rate" in msg.lower():
            raise InstagramRateLimited(msg) from exc
        return IGSendResult(None, None, False, msg)


def fetch_inbox(session_blob: str, limit: int = 20) -> list[dict[str, Any]]:
    """Return list of recent threads (as plain dicts)."""
    if settings.demo_mode:
        rng = random.Random()
        first_names = ["alex", "sam", "jordan", "taylor", "casey", "morgan"]
        last_names = ["lee", "park", "smith", "ngo", "khan"]
        out: list[dict[str, Any]] = []
        for i in range(min(limit, 6)):
            uname = f"{rng.choice(first_names)}.{rng.choice(last_names)}{rng.randint(10, 999)}"
            out.append(
                {
                    "thread_id": f"thr_{abs(hash(uname)) % 10**10}",
                    "username": uname,
                    "full_name": uname.replace(".", " ").title(),
                    "snippet": rng.choice(
                        [
                            "Hey, thanks for reaching out!",
                            "Sounds interesting, tell me more.",
                            "Sure, what's the link?",
                            "Not interested, please remove me.",
                            "👋",
                        ]
                    ),
                    "unread": rng.choice([0, 0, 0, 1]),
                }
            )
        return out

    cl = _new_client(decrypt_blob(session_blob))
    if cl is None:
        return []
    try:
        threads = cl.direct_threads(amount=limit)
        out = []
        for t in threads:
            users = getattr(t, "users", []) or []
            user = users[0] if users else None
            last = getattr(t, "messages", []) or []
            snippet = getattr(last[0], "text", None) if last else None
            out.append(
                {
                    "thread_id": str(t.id),
                    "username": user.username if user else None,
                    "full_name": user.full_name if user else None,
                    "snippet": snippet,
                    "unread": 1 if not getattr(t, "is_seen", True) else 0,
                }
            )
        return out
    except Exception as exc:  # noqa: BLE001
        logger.warning("fetch_inbox failed: %s", exc)
        return []
