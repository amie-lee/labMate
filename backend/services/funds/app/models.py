"""연구비 도메인 — 예산·연구비집행·인건비(월별)."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from labmate_common.db import Base
from labmate_common.tenancy import OrgScoped, SoftDelete


def _uuid() -> str:
    return uuid.uuid4().hex


class Budget(OrgScoped, SoftDelete, Base):
    __tablename__ = "budgets"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String(32), index=True)
    category: Mapped[str] = mapped_column(String(40))           # 비목
    allocated: Mapped[int] = mapped_column(Integer, default=0)  # 편성액
    spent: Mapped[int] = mapped_column(Integer, default=0)  # 집행액


class Expense(OrgScoped, SoftDelete, Base):
    __tablename__ = "expenses"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String(32), index=True)
    category: Mapped[str] = mapped_column(String(40))            # 비목
    subcategory: Mapped[str] = mapped_column(String(80), default="")  # 세목
    title: Mapped[str] = mapped_column(String(200))
    claim_date: Mapped[date | None] = mapped_column(Date, nullable=True)   # 청구일자
    amount: Mapped[int] = mapped_column(Integer, default=0)
    by_id: Mapped[str] = mapped_column(String(32), index=True)  # 청구자
    evidence: Mapped[str] = mapped_column(String(60), default="")
    evidence_checked: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="작성중")  # 작성중/상신/승인/지급/반려
    body: Mapped[str] = mapped_column(Text, default="")
    files: Mapped[list] = mapped_column(JSON, default=list)   # 증빙 첨부 [{name,url}]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BudgetLog(OrgScoped, SoftDelete, Base):
    """예산 편성 변경 이력."""
    __tablename__ = "budget_logs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    budget_id: Mapped[str] = mapped_column(String(32), index=True)
    project_id: Mapped[str] = mapped_column(String(32))
    category: Mapped[str] = mapped_column(String(40))
    before: Mapped[int] = mapped_column(Integer, default=0)
    after: Mapped[int] = mapped_column(Integer, default=0)
    reason: Mapped[str] = mapped_column(String(200), default="")
    by_id: Mapped[str] = mapped_column(String(32))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Participation(OrgScoped, SoftDelete, Base):
    __tablename__ = "participations"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    uid: Mapped[str] = mapped_column(String(32), index=True)
    project_id: Mapped[str] = mapped_column(String(32))
    rate_pct: Mapped[float] = mapped_column(Float, default=0)   # 참여율(%) — 소수 허용
    month: Mapped[str] = mapped_column(String(7), index=True)   # YYYY-MM


class Payslip(OrgScoped, SoftDelete, Base):
    __tablename__ = "payslips"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    uid: Mapped[str] = mapped_column(String(32), index=True)
    project_id: Mapped[str] = mapped_column(String(32))
    month: Mapped[str] = mapped_column(String(7), index=True)
    amount: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(10), default="예정")  # 예정/지급
