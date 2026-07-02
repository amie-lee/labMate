"""경량 컬럼 마이그레이션 — create_all이 못 바꾸는 기존 테이블 컬럼을 멱등 RENAME/ADD."""
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


def add_columns(engine: Engine, cols: list[tuple[str, str, str]]) -> None:
    """cols: [(table, column, coldef), ...]. 없을 때만 ADD COLUMN(멱등). 예: ('posts','min_role',"VARCHAR(20) DEFAULT ''")."""
    with engine.begin() as conn:
        for table, column, coldef in cols:
            conn.execute(text(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS "{column}" {coldef};'))


def rename_json_list_keys(engine: Engine, table: str, json_col: str, key_map: dict[str, str]) -> None:
    """table.json_col(리스트[dict])의 각 원소 키를 key_map대로 변경(멱등)."""
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
