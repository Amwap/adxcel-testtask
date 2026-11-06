#!/usr/bin/env bash
# Back up the SQLite database into backend/backups/ as app-<UTC timestamp>.db.gz.
#
# Runs on the host (from cron) and does the work inside the running backend container,
# using SQLite's online backup API, so the copy is consistent even while the app writes.
# Only the newest BACKUP_KEEP archives are kept (default 14).
#
#   ./backup_db.sh
#   BACKUP_KEEP=30 ./backup_db.sh
#
# crontab (daily at 03:00):
#   0 3 * * * /path/to/repo/backup_db.sh >> /path/to/repo/backend/logs/backup.log 2>&1
set -euo pipefail

keep="${BACKUP_KEEP:-14}"

# docker compose looks for docker-compose.yml in the current directory (repo root, next to this script)
cd "$(dirname "$(readlink -f "$0")")"

echo "$(date -u '+%Y-%m-%d %H:%M:%S') backup started"
docker compose exec -T backend python - "$keep" <<'PY'
import gzip
import shutil
import sqlite3
import sys
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

from app.config import get_settings

keep = int(sys.argv[1])
src_path = get_settings().db_path
if not src_path.exists():
    sys.exit(f"database {src_path} not found")

out = Path("backups")
out.mkdir(exist_ok=True)
stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
raw = out / f"app-{stamp}.db.tmp"
part = out / f"app-{stamp}.db.gz.part"
dst = out / f"app-{stamp}.db.gz"

try:
    with closing(sqlite3.connect(src_path)) as src, closing(sqlite3.connect(raw)) as copy:
        src.backup(copy)
    with raw.open("rb") as f, gzip.open(part, "wb", compresslevel=6) as gz:
        shutil.copyfileobj(f, gz, 1 << 20)
    part.rename(dst)
finally:
    raw.unlink(missing_ok=True)
    part.unlink(missing_ok=True)

print(f"created {dst} ({dst.stat().st_size / 1024 / 1024:.1f} MB)")

for old in sorted(out.glob("app-*.db.gz"))[:-keep]:
    old.unlink()
    print(f"removed {old}")
PY
echo "$(date -u '+%Y-%m-%d %H:%M:%S') backup finished"
