"""연구비(funds) 도메인 관리자 편집형 마스터데이터 기본값."""
from __future__ import annotations

from typing import Any

DEFAULTS: dict[str, Any] = {
    # 비목(name) + 세목(subs). 예산 표준 7비목 — 예산·인건비·연구비집행 공용.
    "budget_types": [
        {"name": "인건비", "subs": []},
        {"name": "학생인건비", "subs": []},
        {"name": "장비비", "subs": []},
        {"name": "재료비", "subs": []},
        {"name": "연구활동비", "subs": ["국내여비", "국외여비", "회의비", "학회/세미나참가비", "소프트웨어활용비", "연구환경유지비", "논문게재료", "인쇄비"]},
        {"name": "연구수당", "subs": []},
        {"name": "간접비", "subs": []},
    ],
    # 학력등급별 월 기준단가(원)
    "grade_rates": {"교수": 0, "박사과정": 3000000, "석사과정": 2200000, "학사과정": 1300000},
}
