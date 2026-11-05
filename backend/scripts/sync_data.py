"""Sync interview CSV data into SQLite.

A table is reloaded only when its source file changed since the last sync (size/mtime).

    python -m scripts.sync_data
    python -m scripts.sync_data --force
    python -m scripts.sync_data --x path/to/interview.X.csv --y path/to/interview.y.csv
"""

import argparse
import logging
import time
from pathlib import Path

from app.config import get_settings
from app.services.data_sync import sync

log = logging.getLogger("sync_data")


def main() -> None:
    data_dir = get_settings().data_dir
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--x", type=Path, default=data_dir / "interview.X.csv")
    parser.add_argument("--y", type=Path, default=data_dir / "interview.y.csv")
    parser.add_argument("--force", action="store_true", help="reload even if files are unchanged")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    started = time.perf_counter()
    for r in sync(args.x, args.y, force=args.force):
        log.info("%s: %d rows%s", r.table, r.rows, " (unchanged, skipped)" if r.skipped else "")
    log.info("done in %.1fs", time.perf_counter() - started)


if __name__ == "__main__":
    main()
