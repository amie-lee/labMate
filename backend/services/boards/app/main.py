from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from labmate_common.db import Base, engine
from labmate_common.migrate import rename_columns, rename_json_list_keys

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
        ("approvals", "doc", "content"),                 # 본문(doc_no와 혼동 방지)
        ("approvals", "line", "steps"),                  # 결재선
        ("approvals", "ref", "source_ref"),              # 외부 연결
        ("approvals", "category", "deduct_account"),     # 차감 비목
        ("notices", "acks", "acked_user_ids"),           # 확인자
        ("notices", "targets", "target_user_ids"),       # 대상자
    ])
    rename_json_list_keys(engine, "meetings", "actions", {"task": "title", "who": "assignee_id"})
    yield


app = FastAPI(title="LabMate Boards Service", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(OrgMiddleware)


@app.get("/health")
def health():
    return {"status": "ok", "service": "boards"}


app.include_router(router)
app.include_router(make_data_admin_router("boards"))
app.include_router(make_audit_router("boards"))
app.include_router(make_config_router(DEFAULTS))
