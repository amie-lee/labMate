from __future__ import annotations

from datetime import date
from pydantic import BaseModel, Field


class ProjectIn(BaseModel):
    kind: str = "grant"           # grant(연구과제)/activity(프로젝트)
    code: str
    name: str
    category: str = "과제"
    status: str = "진행 중"
    agency: str = ""
    program: str = ""
    agreement_no: str = ""
    lead_id: str = ""
    pm_id: str = ""
    members: list[str] = Field(default_factory=list)
    goals: dict[str, int] = Field(default_factory=dict)
    start: date | None = None
    end: date | None = None
    desc: str = ""
    meta: dict = Field(default_factory=dict)


class ProjectOut(ProjectIn):
    id: str
    model_config = {"from_attributes": True}


class TaskIn(BaseModel):
    title: str
    assignee_id: str = ""
    status: str = "예정"
    start: date | None = None
    due: date | None = None
    body: str = ""
    link: str = ""
    files: list[dict] = Field(default_factory=list)


class TaskOut(TaskIn):
    id: str
    project_id: str
    by_id: str = ""
    model_config = {"from_attributes": True}


class MilestoneIn(BaseModel):
    name: str
    due: date | None = None
    done: bool = False


class MilestoneOut(MilestoneIn):
    id: str
    project_id: str
    model_config = {"from_attributes": True}


class PublicationIn(BaseModel):
    kind: str
    title: str
    project_id: str = ""
    scope: str = "국외"
    index_type: str = ""
    index_grade: str = ""
    authors: str = ""
    funding: str = ""
    status: str = "작성중"
    pub_date: date | None = None
    abstract: str = ""
    meta: dict = Field(default_factory=dict)
    files: list[dict] = Field(default_factory=list)


class PublicationOut(PublicationIn):
    id: str
    model_config = {"from_attributes": True}
