"""관리자 데이터 백업/복구 — 서비스 DB 전체를 JSON으로 내보내고(export) 되돌린다(import).

각 서비스가 자기 DB의 모든 테이블을 덤프/복원한다. 프론트(관리자 화면)가 6개 서비스의
export 를 모아 하나의 백업 파일로 저장하고, import 시 서비스별로 분배해 호출한다.
"""
from __future__ import annotations

import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import Date, DateTime, delete, select
from sqlalchemy.orm import Session

from .audit import record
from .db import Base, get_db
from .deps import CurrentUser, require_roles


def _ser(v: Any) -> Any:
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.isoformat()
    return v


def _coerce(table, row: dict) -> dict:
    """JSON 문자열 날짜를 컬럼 타입에 맞게 date/datetime 으로 복원."""
    out: dict = {}
    for col in table.columns:
        if col.name not in row:
            continue
        v = row[col.name]
        if isinstance(v, str) and v:
            if isinstance(col.type, DateTime):
                v = datetime.datetime.fromisoformat(v)
            elif isinstance(col.type, Date):
                v = datetime.date.fromisoformat(v)
        out[col.name] = v
    return out


def make_data_admin_router(service_name: str) -> APIRouter:
    r = APIRouter(prefix="/admin/data", tags=["admin-data"])

    @r.get("/export")
    def export_data(_: CurrentUser = Depends(require_roles("admin")), db: Session = Depends(get_db)) -> dict:
        out: dict = {"service": service_name, "tables": {}}
        for t in Base.metadata.sorted_tables:
            rows = [dict(row._mapping) for row in db.execute(select(t))]
            out["tables"][t.name] = [{k: _ser(v) for k, v in row.items()} for row in rows]
        return out

    @r.post("/import")
    def import_data(payload: dict, _: CurrentUser = Depends(require_roles("admin")), db: Session = Depends(get_db)) -> dict:
        tables = payload.get("tables")
        if not isinstance(tables, dict):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "백업 형식이 올바르지 않습니다(tables 누락)")
        known = {t.name: t for t in Base.metadata.sorted_tables}
        unknown = [n for n in tables if n not in known]
        if unknown:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"알 수 없는 테이블: {unknown}")
        try:
            # FK 역순으로 비우고, 정순으로 채운다.
            for t in reversed(Base.metadata.sorted_tables):
                if t.name in tables:
                    db.execute(delete(t))
            for t in Base.metadata.sorted_tables:
                rows = tables.get(t.name)
                if rows:
                    db.execute(t.insert(), [_coerce(t, row) for row in rows])
            record(db, _, "데이터 복구", service_name, f"{sum(len(v) for v in tables.values())}건")
            db.commit()
        except Exception as e:  # noqa: BLE001
            db.rollback()
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"복구 실패: {e}")
        return {"detail": f"{service_name} 복구 완료", "restored": {n: len(v) for n, v in tables.items()}}

    return r
