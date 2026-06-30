"""관리자 편집형 마스터데이터(설정) 공통 저장소.

각 서비스가 자기 도메인의 드롭다운/규칙 마스터(비목·휴가종류·결재 문서유형·예약자원·
등급단가 등)를 코드 상수가 아니라 DB에 보관하고 관리자 API로 편집할 수 있게 한다.

사용법(서비스 main.py):
    from labmate_common.configstore import make_config_router
    app.include_router(make_config_router(DEFAULTS))

`DEFAULTS`는 {키: 기본값} 딕셔너리. 미설정 키는 기본값으로 응답하므로
프론트는 항상 완전한 마스터셋을 받는다(빈 DB에서도 동작).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import JSON, DateTime, String, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .audit import record
from .db import Base, get_db
from .deps import CurrentUser, get_current_user, require_roles


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[Any] = mapped_column(JSON)
    updated_by: Mapped[str] = mapped_column(String(32), default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ConfigIn(BaseModel):
    value: Any


def get_setting(db: Session, key: str, default: Any) -> Any:
    row = db.get(Setting, key)
    return row.value if row is not None else default


def get_all_settings(db: Session, defaults: dict[str, Any]) -> dict[str, Any]:
    rows = {s.key: s.value for s in db.scalars(select(Setting)).all()}
    return {k: rows.get(k, v) for k, v in defaults.items()}


def make_config_router(defaults: dict[str, Any]) -> APIRouter:
    """도메인 기본값을 받아 /config GET·PUT 라우터를 생성한다."""
    r = APIRouter(prefix="/config", tags=["config"])

    @r.get("")
    def list_config(
        db: Session = Depends(get_db),
        _: CurrentUser = Depends(get_current_user),
    ) -> dict[str, Any]:
        return get_all_settings(db, defaults)

    @r.put("/{key}")
    def set_config(
        key: str,
        body: ConfigIn,
        user: CurrentUser = Depends(require_roles("admin")),
        db: Session = Depends(get_db),
    ) -> dict[str, Any]:
        if key not in defaults:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "알 수 없는 설정 키")
        row = db.get(Setting, key)
        if row is not None:
            row.value = body.value
            row.updated_by = user.id
        else:
            db.add(Setting(key=key, value=body.value, updated_by=user.id))
        record(db, user, "설정 변경", key, str(body.value)[:160])
        db.commit()
        return {"key": key, "value": body.value}

    @r.post("/reset/{key}")
    def reset_config(
        key: str,
        user: CurrentUser = Depends(require_roles("admin")),
        db: Session = Depends(get_db),
    ) -> dict[str, Any]:
        if key not in defaults:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "알 수 없는 설정 키")
        row = db.get(Setting, key)
        if row is not None:
            db.delete(row)
            db.commit()
        return {"key": key, "value": defaults[key]}

    return r
