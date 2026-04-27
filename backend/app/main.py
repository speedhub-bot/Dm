"""FastAPI entrypoint."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models import user as user_model  # noqa: F401  (ensure models are imported)
from app.models.user import User
from app.workers.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def init_db() -> None:
    # Make sure all model modules are imported so tables register.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            db.add(
                User(
                    email=settings.first_admin_email,
                    full_name="Admin",
                    hashed_password=hash_password(settings.first_admin_password),
                    is_admin=True,
                )
            )
            db.commit()
            logger.info("Seeded admin user %s", settings.first_admin_email)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health")
def health() -> dict[str, object]:
    return {"ok": True, "demo_mode": settings.demo_mode, "name": settings.app_name}


@app.get("/")
def root() -> dict[str, str]:
    return {"name": settings.app_name, "docs": "/api/docs"}
