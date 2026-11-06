# Campaign analytics

- `backend/` — FastAPI (Python 3.14), SQLite (`backend/data/app.db`)
- `frontend/` — React + Vite + TypeScript + Tailwind CSS v4

Спецификация сервисов (API, метрики, аутентификация) и разработка — в [SPEC.md](SPEC.md).

## Развёртывание на adxcel.amwap.dev

Ветка `live` — продакшен на http://adxcel.amwap.dev (SSL пока нет). На сервере нужны Docker
с Compose, git, nginx и cron; пользователь деплоя — в группе `docker` и с доступом к репозиторию
по SSH (deploy key).

Стек из двух контейнеров, порты опубликованы только на `127.0.0.1`:

- `backend` — uvicorn, `127.0.0.1:8341`; `backend/data/` (CSV и SQLite) и `backend/backups/`
  смонтированы с хоста
- `frontend` — собранный SPA через `vite preview`, `127.0.0.1:8340`

Единственный nginx-конфиг — `nginx/nginx.conf`: server-блок для nginx хоста (`/api` → backend,
остальное → frontend). Он подключается симлинком, поэтому обновляется вместе с репозиторием.

`deploy.sh` и разворачивает проект с нуля, и обновляет его, повторный запуск безопасен:

1. клонирует ветку `live` в `APP_DIR` (по умолчанию `~/adxcel`) или переключает рабочую копию
   на `origin/live` (локальные правки отслеживаемых файлов сбрасываются);
2. при первом запуске создаёт `backend/.env` из `backend/.env.example` со свежим `JWT_SECRET`;
3. `docker compose up -d --build --wait`;
4. запускает `sync_data`, если в `backend/data/` лежат CSV (неизменённые файлы пропускаются);
5. добавляет в crontab пользователя ежедневный бекап БД (один раз);
6. подсказывает команду для симлинка nginx, а при изменении `nginx/nginx.conf` перезагружает
   nginx хоста (`sudo -n`; без sudo без пароля — выводит команду).

Первый деплой:

```bash
ssh user@server 'bash -s' < deploy.sh             # или APP_DIR=/srv/adxcel bash -s
scp interview.X.csv interview.y.csv user@server:adxcel/backend/data/
ssh user@server 'bash -s' < deploy.sh             # повтор зальёт данные
# на сервере:
sudo ln -s ~/adxcel/nginx/nginx.conf /etc/nginx/sites-enabled/adxcel.amwap.dev.conf
sudo nginx -t && sudo systemctl reload nginx
cd ~/adxcel && docker compose exec -it backend python -m scripts.users create admin
```

Обновление — тот же `deploy.sh` (или `./deploy.sh` в `APP_DIR` на сервере).
Логи: `docker compose logs -f` в `APP_DIR`, остановка: `docker compose down`.

### CI/CD

`.github/workflows/deploy.yml`: на каждый push в `live` (и вручную, «Run workflow») GitHub
Actions заходит на сервер по SSH и выполняет там `deploy.sh`. Деплои идут строго по одному.
Секреты репозитория (Settings → Secrets and variables → Actions):

| Секрет | Значение |
|---|---|
| `DEPLOY_HOST` | адрес сервера |
| `DEPLOY_USER` | пользователь деплоя |
| `DEPLOY_SSH_KEY` | приватный ключ, публичный — в `~/.ssh/authorized_keys` этого пользователя (`ssh-keygen -t ed25519 -N '' -f deploy_key`) |
| `DEPLOY_KNOWN_HOSTS` | вывод `ssh-keyscan -p <порт> <сервер>` |
| `DEPLOY_PORT` | порт SSH, необязательно (22) |

Переменная `DEPLOY_APP_DIR` (необязательно) — каталог проекта на сервере, по умолчанию `~/adxcel`.

Когда появится SSL: добавить в `nginx/nginx.conf` блок `listen 443 ssl` с сертификатом,
поставить `COOKIE_SECURE=true` в `backend/.env` на сервере и закоммитить конфиг в `live`
(правки прямо на сервере следующий деплой сбросит).

## Загрузка данных

Положите `interview.X.csv` и `interview.y.csv` в `~/adxcel/backend/data/` (в git не попадают)
и перезапустите `deploy.sh` или залейте вручную:

```bash
docker compose exec backend python -m scripts.sync_data
```

Повторный запуск перезагружает только изменившиеся файлы, `--force` перезаливает всё.

## Пользователи

Регистрации нет — пользователей заводит администратор (команды — в `APP_DIR` на сервере):

```bash
docker compose exec -it backend python -m scripts.users create admin   # пароль спросит интерактивно
docker compose exec -it backend python -m scripts.users set-password admin
docker compose exec backend python -m scripts.users deactivate admin   # / activate
docker compose exec backend python -m scripts.users list
```

## Автоматические бекапы

`backup_db.sh` делает копию БД из запущенного контейнера (приложение не
останавливается) в `backend/backups/app-<UTC-время>.db.gz` и хранит последние `BACKUP_KEEP`
архивов (по умолчанию 14).

`deploy.sh` сам добавляет в crontab пользователя деплоя ежедневный бекап в 03:00:

```
0 3 * * * /home/<user>/adxcel/backup_db.sh >> /home/<user>/adxcel/backend/logs/backup.log 2>&1
```

Проверить: `crontab -l`. Разовый бекап: `./backup_db.sh` (или `BACKUP_KEEP=30 ./backup_db.sh`).

Восстановление (файлы БД принадлежат root контейнера, поэтому распаковка — тоже в контейнере):

```bash
docker compose stop backend
docker compose run --rm --no-deps backend sh -c \
  'rm -f data/app.db-wal data/app.db-shm && gunzip -c backups/app-20261106-030000.db.gz > data/app.db'
docker compose start backend
```
