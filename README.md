# Campaign analytics

- `backend/` — FastAPI (Python 3.11)
- `frontend/` — React + Vite + TypeScript + Tailwind CSS v4

Файлы данных `interview.X.csv` и `interview.y.csv` кладутся в `backend/data/` (в git не попадают).
Бекенд работает с SQLite (`backend/data/app.db`) через SQLAlchemy 2.0.

## Синхронизация данных в SQLite

Скрипт заливает CSV в таблицы `impressions` и `events`. Для каждой таблицы запоминается
размер и mtime исходного файла (`data_sources`), поэтому повторный запуск перезагружает только
изменившиеся файлы. `--force` перезаливает всё (нужно и после изменения схемы этих таблиц):

```bash
docker compose exec backend python -m scripts.sync_data
docker compose exec backend python -m scripts.sync_data --force
docker compose exec backend python -m scripts.sync_data --x data/interview.X.csv --y data/interview.y.csv
```

Особенности данных: `uid` в логе показов не уникален (261 повтор), часть событий
(~0.8%) ссылается на отсутствующие показы, поэтому в таблицах суррогатный `id`, а `uid` — индекс без FK.

Вместе с показами пересобираются справочники `sites` и `device_models` (уникальные значения
с числом показов): поиск по подстроке идёт по ним (~11k и ~1.5k строк), а не сканом ~1M показов.

## API данных

Все роуты требуют access-токен.

- `GET /api/summary` — что и когда синхронизировано, число событий по типам
- `GET /api/impressions?page=&page_size=&q=` — показы с тегами их событий;
  `q` — префикс uid или подстрока сайта / модели устройства
- `GET /api/events?page=&page_size=&q=&tag=` — события с сайтом и временем показа;
  `q` — префикс uid, `tag` — тип события

`page_size` ≤ 100. Ответ: `{items, total, page, page_size}`.

## Метрики кампании

- **CTR** = 100 · `fclick` / показы, %
- **EvPM** = 1000 · события типа / показы, ‰; view-through склеивается с базовым типом
  (`registration` + `vregistration`)
- События, `uid` которых нет в логе показов, в метрики не попадают
- `mode` — как считать событие, если у его `uid` несколько показов:
  `first` — только для самого раннего показа, `all` — для каждого из них

На странице Trends графики CTR и EvPM идут друг под другом с общим курсором, под ними —
объём показов. По умолчанию каждая точка — скользящее окно за 24 часа (метрика считается
как сумма событий / сумма показов в окне, а не среднее процентов), есть режимы «по часам» и
«по дням». Бакеты с малым числом показов (по умолчанию < 100) не рисуются: именно они давали
пики вроде CTR 33% на трёх показах. Если выбросы всё же остаются, ось Y обрезается по 98-му
перцентилю, а точки за шкалой отмечаются ▲. EvPM можно строить сразу для нескольких типов
событий (чекбоксы); все типы приходят одним запросом, переключение мгновенное.
Период выбирается полями дат (сохраняется в URL),
плитки с итогами считаются за выбранный период.

Метрики читаются из предрасчитанных таблиц `rollup_impressions` / `rollup_events`
(показы и события по часу, `mm_dma`, `site_id` × тип × режим), которые `sync_data`
пересобирает при любой перезагрузке данных (~30 с). Поэтому графики и агрегаты
отвечают за миллисекунды и не сканируют миллион показов.

- `GET /api/metrics/event-types` — типы событий (без префикса `v`)
- `GET /api/metrics/timeseries?tag=&tag=…&mode=&granularity=hour|day` — ряд CTR и EvPM
  по каждому из типов (`tag` повторяется, до 16), счётчики и итоги
- `GET /api/metrics/aggregates/{mm_dma|site_id}?tag=&mode=&page=&page_size=&q=&min_impressions=&sort=&order=`
  — таблица агрегатов с поиском по подстроке, сортировкой и строкой итогов (`totals`)

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
