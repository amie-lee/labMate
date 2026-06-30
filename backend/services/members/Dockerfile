# build context = ./backend (docker-compose 참조)
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# 공통 라이브러리 먼저 설치(레이어 캐시)
COPY libs/common /libs/common
RUN pip install /libs/common

COPY services/members/requirements.txt .
RUN pip install -r requirements.txt

COPY services/members/app ./app
COPY services/members/alembic.ini ./alembic.ini
COPY services/members/alembic ./alembic

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
