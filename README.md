# Campaign analytics

- `backend/` — FastAPI (Python 3.11)
- `frontend/` — React + Vite + TypeScript

Файлы данных `interview.X.csv` и `interview.y.csv` кладутся в `backend/data/` (в git не попадают).
Бекенд работает с SQLite (`backend/data/app.db`) через SQLAlchemy 2.0.

## Загрузка данных в SQLite

Скрипт пересоздаёт таблицы `impressions` и `events` и заливает в них CSV (~20 с):

```bash
cd backend
python -m scripts.load_data                                   # из backend/data/
python -m scripts.load_data --x path/to/interview.X.csv --y path/to/interview.y.csv
```

В Docker: `docker compose run --rm backend python -m scripts.load_data`.

Особенности данных: `uid` в логе показов не уникален (261 повтор), часть событий
(~0.8%) ссылается на отсутствующие показы, поэтому в таблицах суррогатный `id`, а `uid` — индекс без FK.

## Локальная разработка

Backend:

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows; на Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
fastapi dev app/main.py       # http://localhost:8000/api/docs
pytest
ruff check . && ruff format --check .
```

Frontend:

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173, /api проксируется на :8000
npm run lint
npm run build
```

## Docker

```bash
docker compose up --build     # http://localhost:8080
```

nginx во фронтенд-контейнере отдаёт статику и проксирует `/api` на backend.
