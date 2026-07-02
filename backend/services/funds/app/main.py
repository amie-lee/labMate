from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text

from labmate_common.db import Base, engine
from labmate_common.migrate import rename_columns

from . import models  # noqa: F401
from labmate_common.configstore import make_config_router

from .masters import DEFAULTS
from labmate_common.audit import make_audit_router
from labmate_common.tenancy import OrgMiddleware
from labmate_common.dataadmin import make_data_admin_router
from .routers import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    rename_columns(engine, [
        ("budgets", "cat", "category"),
        ("budgets", "alloc", "allocated"),
        ("budget_logs", "cat", "category"),
        ("expenses", "cat", "category"),
        ("expenses", "use", "subcategory"),
        ("expenses", "ev_checked", "evidence_checked"),
        ("participations", "ratio", "rate_pct"),
    ])
    # 참여율 소수 허용: rate_pct double
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE participations ALTER COLUMN rate_pct TYPE double precision"))
    yield


app = FastAPI(title="LabMate Funds Service", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(OrgMiddleware)


@app.get("/health")
def health():
    return {"status": "ok", "service": "funds"}


app.include_router(router)
app.include_router(make_data_admin_router("funds"))
app.include_router(make_audit_router("funds"))
app.include_router(make_config_router(DEFAULTS))
