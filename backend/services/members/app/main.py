"""members-service 엔트리포인트."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from labmate_common.db import Base, engine
from labmate_common.migrate import rename_columns

from . import models  # noqa: F401  (모델 등록)
from labmate_common.audit import make_audit_router
from labmate_common.tenancy import OrgMiddleware
from labmate_common.dataadmin import make_data_admin_router
from .routers import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 개발 편의: 테이블 자동 생성. 운영 마이그레이션은 Alembic 사용(docs §5).
    Base.metadata.create_all(bind=engine)
    rename_columns(engine, [
        ("users", "student_no", "researcher_no"),   # 학번 오인 → 과기인번호 명확화
        ("users", "account", "bank_account"),        # 계정 오인 → 계좌
        ("users", "joined", "join_date"),            # 동사형 → _date 일관
        ("users", "rank", "position"),               # 직위(예약어 rank) → position
    ])
    from .seed import ensure_admin                     # 첫 배포 자동 관리자 시드(.env)
    ensure_admin()
    yield


app = FastAPI(title="LabMate Members Service", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(OrgMiddleware)


@app.get("/health")
def health():
    return {"status": "ok", "service": "members"}


app.include_router(router)
app.include_router(make_data_admin_router("members"))
app.include_router(make_audit_router("members"))
