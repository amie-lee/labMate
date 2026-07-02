"""근태 도메인 — 출퇴근·휴가."""
from __future__ import annotations

import uuid
from datetime import date as date_t
from datetime import datetime

from sqlalchemy import JSON, Date, DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from labmate_common.db import Base
from labmate_common.tenancy import OrgScoped, SoftDelete


def _uuid() -> str:
    return uuid.uuid4().hex


class Attendance(OrgScoped, SoftDelete, Base):
    __tablename__ = "attendance"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    uid: Mapped[str] = mapped_column(String(32), index=True)
    date: Mapped[date_t] = mapped_column(Date, index=True)
    check_in: Mapped[str] = mapped_column(String(5), default="")    # 최초 출근 HH:MM
    check_out: Mapped[str] = mapped_column(String(5), default="")   # 최종 퇴근 HH:MM
    status: Mapped[str] = mapped_column(String(20), default="업무 중")  # 업무 중/외근/출장/휴가/퇴근
    note: Mapped[str] = mapped_column(String(200), default="")
    work_min: Mapped[int] = mapped_column(default=0)                # 실제 근무 분(세션별 누적, 휴게 제외)
    session_start: Mapped[str] = mapped_column(String(5), default="")  # 현재 근무 세션 시작 HH:MM(퇴근 시 해제)
    corrected: Mapped[bool] = mapped_column(default=False)
    corrected_by: Mapped[str] = mapped_column(String(32), default="")
    corrected_at: Mapped[str] = mapped_column(String(20), default="")
    corrected_reason: Mapped[str] = mapped_column(String(200), default="")


class AttLog(OrgScoped, SoftDelete, Base):
    """근태 보정 이력."""
    __tablename__ = "att_logs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    att_id: Mapped[str] = mapped_column(String(32), index=True)
    target_uid: Mapped[str] = mapped_column(String(32), index=True)
    by_id: Mapped[str] = mapped_column(String(32))
    before: Mapped[dict] = mapped_column(JSON, default=dict)
    after: Mapped[dict] = mapped_column(JSON, default=dict)
    reason: Mapped[str] = mapped_column(String(200), default="")
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CorrectionReq(OrgScoped, SoftDelete, Base):
    """본인 출퇴근 시간 정정 요청 — 관리자 승인 시 보정 적용."""
    __tablename__ = "att_correction_reqs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    uid: Mapped[str] = mapped_column(String(32), index=True)
    date: Mapped[date_t] = mapped_column(Date, index=True)
    check_in: Mapped[str] = mapped_column(String(5), default="")
    check_out: Mapped[str] = mapped_column(String(5), default="")
    requested_status: Mapped[str] = mapped_column(String(20), default="업무 중")
    reason: Mapped[str] = mapped_column(String(200), default="")
    status: Mapped[str] = mapped_column(String(10), default="대기")   # 대기/승인/반려
    decided_by: Mapped[str] = mapped_column(String(32), default="")
    decided_at: Mapped[str] = mapped_column(String(20), default="")
    decide_note: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Leave(OrgScoped, SoftDelete, Base):
    __tablename__ = "leaves"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    uid: Mapped[str] = mapped_column(String(32), index=True)
    type: Mapped[str] = mapped_column(String(20), default="연차")    # 연차/반차/병가/공가/학회/출장
    start_date: Mapped[date_t] = mapped_column(Date)
    end_date: Mapped[date_t] = mapped_column(Date)
    days: Mapped[float] = mapped_column(Float, default=1)
    reason: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(10), default="대기")   # 대기/승인/반려
    approver_id: Mapped[str] = mapped_column(String(32), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LeaveBalance(OrgScoped, SoftDelete, Base):
    __tablename__ = "leave_balances"
    uid: Mapped[str] = mapped_column(String(32), primary_key=True)
    granted: Mapped[int] = mapped_column(Integer, default=15)
    used: Mapped[float] = mapped_column(Float, default=0)
