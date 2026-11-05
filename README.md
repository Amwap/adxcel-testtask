# Campaign analytics

- `backend/` — FastAPI (Python 3.11)
- `frontend/` — React + Vite + TypeScript + Tailwind CSS v4

Файлы данных `interview.X.csv` и `interview.y.csv` кладутся в `backend/data/` (в git не попадают).
Бекенд работает с SQLite (`backend/data/app.db`) через SQLAlchemy 2.0.

## Загрузка данных в SQLite

Скрипт пересоздаёт таблицы `impressions` и `events` и заливает в них CSV (~20 с):

```bash
docker compose exec backend python -m scripts.load_data       # из backend/data/
docker compose exec backend python -m scripts.load_data --x data/interview.X.csv --y data/interview.y.csv
```

Особенности данных: `uid` в логе показов не уникален (261 повтор), часть событий
(~0.8%) ссылается на отсутствующие показы, поэтому в таблицах суррогатный `id`, а `uid` — индекс без FK.

## Аутентификация

JWT без регистрации и восстановления пароля — пользователей заводит администратор командой.
Пароли хешируются argon2id (`pwdlib`).

- `POST /api/auth/login` (form: `username`, `password`) → access-токен (15 мин) в теле
  + refresh-токен (7 дней) в httpOnly-cookie на пути `/api/auth`
- `POST /api/auth/refresh` → новый access-токен по cookie
- `POST /api/auth/logout` → отзывает все токены пользователя
- `GET /api/auth/me` → текущий пользователь

Защищённый роут: добавьте параметр `user: CurrentUser` (из `app.api.deps`).
У каждого пользователя есть `token_version`, зашитый в JWT; logout, смена пароля и деактивация
его увеличивают, поэтому все ранее выданные токены перестают работать.

Секрет `JWT_SECRET` (≥ 32 символа) обязателен и хранится в `backend/.env`
(скопируйте из `backend/.env.example`). Docker compose подключает этот же файл через `env_file`,
пути и CORS для контейнера переопределяются в `environment`.

```bash
docker compose exec backend python -m scripts.users create alice          # пароль спросит интерактивно
docker compose exec backend python -m scripts.users set-password alice
docker compose exec backend python -m scripts.users deactivate alice      # / activate
docker compose exec backend python -m scripts.users list
```

## Git

После клонирования включите хуки (pre-commit не даёт закоммитить файлы > 50 МБ):

```bash
git config core.hooksPath .githooks
```

## Запуск и разработка

Всё запускается только в Docker, локальные venv / `npm install` не нужны.

```bash
cp backend/.env.example backend/.env    # и заменить JWT_SECRET на вывод команды
docker compose up --build               # http://localhost:8080, API docs: /api/docs
```

Тесты и линтеры (при запущенном стеке):

```bash
docker compose exec backend pytest
docker compose exec backend ruff check .
docker compose exec backend ruff format --check .
docker compose exec frontend npm run lint
docker compose exec frontend npm run build
```

Оба приложения работают с hot reload: исходники смонтированы в контейнеры.

- `backend` — `uvicorn --reload`, перезапускается при изменениях в `backend/app/`
- `frontend` — Vite dev server с HMR
- `nginx` — единственный конфиг `nginx/nginx.conf`: `/api` проксирует на backend,
  остальное (включая websocket HMR) — на Vite. После правки: `docker compose restart nginx`.

Файловые события с Windows/macOS в контейнер доходят ненадёжно, поэтому слежение
работает через polling (`WATCHFILES_FORCE_POLLING`, `VITE_WATCH_POLLING`).
После изменения зависимостей пересоберите образ: `docker compose up --build`
(`node_modules` фронтенда живёт в анонимном томе — при необходимости добавьте `-V`).
