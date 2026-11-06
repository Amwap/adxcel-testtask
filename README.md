# Campaign analytics

- `backend/` — FastAPI (Python 3.14), SQLite (`backend/data/app.db`)
- `frontend/` — React + Vite + TypeScript + Tailwind CSS v4

Спецификация сервисов (API, метрики, аутентификация) и разработка — в [SPEC.md](SPEC.md).

## Развёртывание

Нужны только Docker и Docker Compose.

```bash
# Секреты бекенда: скопировать и заменить JWT_SECRET на вывод `openssl rand -hex 32`
cp backend/.env.example backend/.env

# Собрать и поднять стек (backend, frontend, nginx)
docker compose up --build -d
```

Приложение — http://localhost:8080, документация API — http://localhost:8080/api/docs.
Логи: `docker compose logs -f`, остановка: `docker compose down`.

## Загрузка данных

Положите `interview.X.csv` и `interview.y.csv` в `backend/data/` (в git не попадают) и залейте их в SQLite:

```bash
docker compose exec backend python -m scripts.sync_data
```

Повторный запуск перезагружает только изменившиеся файлы, `--force` перезаливает всё.

## Пользователи

Регистрации нет — пользователей заводит администратор:

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

Ежедневный бекап в 03:00 — добавить в `crontab -e` (пути — к своему репозиторию):

```
0 3 * * * /path/to/repo/backup_db.sh >> /path/to/repo/backend/logs/backup.log 2>&1
```

Разовый бекап: `./backup_db.sh` (или `BACKUP_KEEP=30 ./backup_db.sh`).

Восстановление:

```bash
docker compose stop backend
rm -f backend/data/app.db-wal backend/data/app.db-shm
gunzip -c backend/backups/app-20261106-030000.db.gz > backend/data/app.db
docker compose start backend
```
