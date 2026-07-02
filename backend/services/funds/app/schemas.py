from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class BudgetSetIn(BaseModel):
    project_id: str
    category: str
    allocated: int = 0
    reason: str = ""


class ParticipationSetIn(BaseModel):
    uid: str
    project_id: str
    month: str            # YYYY-MM
    rate_pct: float = 0
    amount: int = 0


class BudgetIn(BaseModel):
    project_id: str
    category: str
    allocated: int = 0
    spent: int = 0
    reason: str = ""        # 편성액 변경 사유(수정 시)


class BudgetOut(BaseModel):
    id: str
    project_id: str
    category: str
    allocated: int
    spent: int
    model_config = {"from_attributes": True}


class BudgetLogOut(BaseModel):
    id: str
    budget_id: str
    project_id: str
    category: str
    before: int
    after: int
    reason: str
    by_id: str
    model_config = {"from_attributes": True}


class ExpenseIn(BaseModel):
    project_id: str
    category: str
    subcategory: str = ""
    title: str
    claim_date: date | None = None
    amount: int = 0
    evidence: str = ""
    evidence_checked: list[str] = Field(default_factory=list)
    body: str = ""
    files: list[dict] = Field(default_factory=list)


class ExpenseOut(ExpenseIn):
    id: str
    by_id: str
    status: str
    model_config = {"from_attributes": True}


class ParticipationIn(BaseModel):
    uid: str
    project_id: str
    rate_pct: float
    month: str


class PayslipOut(BaseModel):
    id: str
    uid: str
    project_id: str
    month: str
    amount: int
    status: str
    model_config = {"from_attributes": True}


class MatrixRow(BaseModel):
    uid: str
    grade: str = ""
    ratios: dict[str, float] = Field(default_factory=dict)  # project_id -> rate_pct


class MatrixSaveIn(BaseModel):
    month: str
    rows: list[MatrixRow]
    grade_rates: dict[str, int] = Field(default_factory=dict)  # grade -> 월단가


class YearMatrixRow(BaseModel):
    uid: str
    grade: str = ""
    monthly: dict[str, float] = Field(default_factory=dict)  # "01".."12" -> rate_pct
    grades: dict[str, str] = Field(default_factory=dict)     # "01".."12" -> 등급(진급 반영), 없으면 grade


class YearMatrixSaveIn(BaseModel):
    year: str
    project_id: str
    rows: list[YearMatrixRow]
    grade_rates: dict[str, int] = Field(default_factory=dict)
