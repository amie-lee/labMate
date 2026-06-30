"""경량 컬럼 리네이밍 마이그레이션 — create_all 후 lifespan에서 호출.

create_all 은 기존 테이블 컬럼을 변경하지 못하므로, 코드상 컬럼명을 바꿀 때
이미 생성된 테이블의 컬럼을 idempotent 하게 RENAME 한다.
"""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Engine


def rename_columns(engine: Engine, renames: list[tuple[str, str, str]]) -> None:
    """renames: [(table, old_col, new_col), ...]. old가 있고 new가 없을 때만 RENAME."""
    with engine.begin() as conn:
        for table, old, new in renames:
            conn.execute(text(f"""
                DO $$ BEGIN
                  IF EXISTS (SELECT 1 FROM information_schema.columns
                             WHERE table_name='{table}' AND column_name='{old}')
                     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                             WHERE table_name='{table}' AND column_name='{new}') THEN
                    ALTER TABLE {table} RENAME COLUMN "{old}" TO "{new}";
                  END IF;
                END $$;
            """))


def rename_json_list_keys(engine: Engine, table: str, json_col: str, key_map: dict[str, str]) -> None:
    """table.json_col(=리스트[dict])의 각 원소 딕셔너리 키를 key_map대로 변경(멱등).

    예: 회의록 actions=[{task,who,...}] → [{title,assignee_id,...}].
    이미 새 키가 있는 원소는 건드리지 않는다.
    """
    import json as _json
    with engine.begin() as conn:
        rows = conn.execute(text(f"SELECT id, {json_col} FROM {table}")).fetchall()
        for rid, items in rows:
            if not items:
                continue
            changed = False
            new_items = []
            for it in items:
                if isinstance(it, dict) and any(old in it for old in key_map):
                    it = dict(it)
                    for old, new in key_map.items():
                        if old in it:
                            it.setdefault(new, it.pop(old))
                    changed = True
                new_items.append(it)
            if changed:
                conn.execute(
                    text(f"UPDATE {table} SET {json_col} = CAST(:v AS json) WHERE id = :id"),
                    {"v": _json.dumps(new_items, ensure_ascii=False), "id": rid},
                )
