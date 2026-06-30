"""연구(projects) 도메인 관리자 편집형 마스터데이터 기본값."""
from __future__ import annotations

from typing import Any

DEFAULTS: dict[str, Any] = {
    "project_types": ["과제", "연구", "세미나", "기타"],
    "agencies": ["NRF", "IITP", "교내", "기타"],
    "pub_types": ["국제논문지", "국내논문지", "국제학술대회", "국내학술대회", "국제특허", "국내특허", "기타"],
    "pub_index": ["SCI(E)", "KCI", "기타"],
    "pub_roles": ["제1저자", "교신저자", "공동저자", "참여저자"],
    "conf_scopes": ["국내", "국외"],
    "patent_types": ["출원", "등록", "공개"],
    "pub_statuses": ["준비중", "투고", "심사중", "게재확정", "게재완료", "등록완료"],
}
