from __future__ import annotations

from fastapi import APIRouter

from app.api import accounts, analytics, auth, campaigns, contacts, inbox, templates

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(accounts.router)
api_router.include_router(contacts.router)
api_router.include_router(contacts.lists_router)
api_router.include_router(templates.router)
api_router.include_router(campaigns.router)
api_router.include_router(inbox.router)
api_router.include_router(analytics.router)
