#!/bin/bash
# 서비스별 데이터베이스를 생성한다. 단일 PostgreSQL 인스턴스 안에서 DB로 격리.
# LABMATE_DATABASES 환경변수(콤마 구분)를 읽는다.
set -euo pipefail

DBS="${LABMATE_DATABASES:-}"
if [ -z "$DBS" ]; then
  echo "LABMATE_DATABASES not set; skipping"
  exit 0
fi

IFS=',' read -ra LIST <<< "$DBS"
for db in "${LIST[@]}"; do
  db_trimmed="$(echo "$db" | xargs)"
  [ -z "$db_trimmed" ] && continue
  echo "Creating database: $db_trimmed"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    SELECT 'CREATE DATABASE $db_trimmed'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db_trimmed')\gexec
EOSQL
done
