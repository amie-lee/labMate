"""소통(boards) 도메인 마스터데이터 기본값."""
from __future__ import annotations

from typing import Any

DEFAULTS: dict[str, Any] = {
    # 결재 문서유형: prefix=문서번호 접두어
    "approval_types": [
        {"name": "주간보고", "prefix": "RPT"},
        {"name": "월간보고", "prefix": "RPT"},
        {"name": "일반보고", "prefix": "RPT"},
        {"name": "사유서", "prefix": "SOR"},
    ],
    # 결재 문서양식: 유형명 → 기안 본문 템플릿(HTML)
    "approval_templates": {
        "주간보고": "<h3>주간 업무 보고</h3><ul><li>금주 추진 업무</li><ul><li>업무내용 (진행상황)</li><ul><li>설명</li></ul></ul><li>차주 계획</li><ul><li>업무내용 (목표일정)</li><ul><li>설명</li></ul></ul></ul>",
        "월간보고": "<h3>월간 업무 보고</h3><ul><li>주요 업무 추진 실적</li><ul><li>업무내용 (목표 / 실적 / 달성률)</li><ul><li>설명</li></ul></ul><li>미달성 업무 및 사유</li><ul><li>업무내용</li><ul><li>미달성 사유</li><li>향후 조치 계획</li></ul></ul><li>다음 달 계획</li><ul><li>업무내용 (목표일정)<br></li><ul><li>설명</li></ul></ul></ul>",
        "일반보고": "<h3>보고</h3><p></p><ul><li>보고 목적</li><ul><li>내용</li></ul><li>주요 내용</li><ul><li>내용</li><li>내용</li><li>내용</li></ul><li>검토 의견/결론</li><ul><li>내용</li></ul><li>향후 계획 및 조치사항</li><ul><li>조치 내용 (일정)</li></ul></ul><p></p>",
        "사유서": "<div><h3>사유서</h3></div><ul><li>발생 일시 및 장소</li><ul><li>일시: YYYY년 MM월 DD일</li><li>장소: 장소 (선택)</li></ul><li>사유 내용</li><ul><li>내용</li></ul><li>향후 재발 방지 대책</li><ul><li>내용</li></ul></ul><div></div>",
    },
    # 게시판 분류
    "post_types": ["정보공유", "논문리뷰", "자유게시판"],
    # 일정 구분
    "event_types": ["업무", "회의", "마감", "출장", "개인", "기타"],
    # 브랜딩 — 상단 바 로고(이미지 URL, 비면 기본 (L)LabMate) / 연구실 이름(비면 '연구실 그룹웨어')
    "brand_logo": "",
    "lab_name": "",
    # 로그인 화면 — 전용 로고(비면 기본 (L)LabMate) / 부제(비면 '연구실 그룹웨어')
    "login_logo": "",
    "login_subtitle": "",
    # 도메인 — 설정 시 업로드 이미지·파일 경로를 이 도메인으로 생성(비면 상대경로=현재 IP)
    "base_url": "",
}
