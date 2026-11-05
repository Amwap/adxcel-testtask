"""Reload interview CSV data into SQLite.

Drops and recreates the `impressions` and `events` tables, then bulk-inserts the files.

    python -m scripts.load_data
    python -m scripts.load_data --x path/to/interview.X.csv --y path/to/interview.y.csv
"""

import argparse
import logging
import time
from pathlib import Path

import pandas as pd
from sqlalchemy import Table, insert, text
from sqlalchemy.engine import Connection

from app.config import get_settings
from app.db import Base, Event, Impression, engine

log = logging.getLogger("load_data")

CHUNK_SIZE = 100_000

IMPRESSION_COLUMNS = {
    "reg_time": "reg_time",
    "uid": "uid",
    "fc_imp_chk": "fc_imp_chk",
    "fc_time_chk": "fc_time_chk",
    "utmtr": "utmtr",
    "mm_dma": "mm_dma",
    "osName": "os_name",
    "model": "model",
    "hardware": "hardware",
    "site_id": "site_id",
}
EVENT_COLUMNS = {"uid": "uid", "tag": "tag"}


def _insert_csv(
    conn: Connection, table: Table, path: Path, columns: dict[str, str], parse_dates: list[str]
) -> int:
    total = 0
    reader = pd.read_csv(
        path,
        usecols=list(columns),
        parse_dates=parse_dates,
        dtype={"uid": str},
        chunksize=CHUNK_SIZE,
    )
    for chunk in reader:
        chunk = chunk.rename(columns=columns)
        chunk = chunk.astype(object).where(chunk.notna(), None)
        conn.execute(insert(table), chunk.to_dict("records"))
        total += len(chunk)
        log.info("%s: %d rows", table.name, total)
    return total


def load(x_path: Path, y_path: Path) -> None:
    for p in (x_path, y_path):
        if not p.is_file():
            raise FileNotFoundError(p)

    get_settings().db_path.parent.mkdir(parents=True, exist_ok=True)
    tables = [Impression.__table__, Event.__table__]
    started = time.perf_counter()

    with engine.begin() as conn:
        conn.execute(text("PRAGMA synchronous=OFF"))
        Base.metadata.drop_all(conn, tables=tables)
        Base.metadata.create_all(conn, tables=tables)
        n_imp = _insert_csv(conn, Impression.__table__, x_path, IMPRESSION_COLUMNS, ["reg_time"])
        n_ev = _insert_csv(conn, Event.__table__, y_path, EVENT_COLUMNS, [])

    with engine.connect() as conn:
        conn.execute(text("ANALYZE"))
        conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))

    log.info(
        "done: %d impressions, %d events in %.1fs",
        n_imp,
        n_ev,
        time.perf_counter() - started,
    )


def main() -> None:
    data_dir = get_settings().data_dir
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--x", type=Path, default=data_dir / "interview.X.csv")
    parser.add_argument("--y", type=Path, default=data_dir / "interview.y.csv")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    load(args.x, args.y)


if __name__ == "__main__":
    main()
