"""Sync the analysts' CSV exports into SQLite.

Each table remembers the size and mtime of the file it was loaded from (`DataSource`);
a table is reloaded only when its file changed, or when forced.
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
from sqlalchemy import Table, delete, func, insert, select, text
from sqlalchemy.engine import Connection

from app.config import get_settings
from app.db import Base, DataSource, DeviceModel, Event, Impression, Site, engine

log = logging.getLogger(__name__)

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


@dataclass(frozen=True)
class SyncResult:
    table: str
    rows: int
    skipped: bool


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


def _rebuild_lookups(conn: Connection) -> None:
    """Refill search lookup tables from `impressions`."""
    for model, column in ((Site, Impression.site_id), (DeviceModel, Impression.model)):
        conn.execute(delete(model))
        conn.execute(
            insert(model).from_select(
                [column.key, "impressions"],
                select(column, func.count()).where(column.is_not(None)).group_by(column),
            )
        )


def _is_fresh(conn: Connection, table: str, path: Path) -> bool:
    stat = path.stat()
    source = conn.execute(select(DataSource).where(DataSource.table == table)).first()
    return (
        source is not None
        and source.file_name == path.name
        and source.file_size == stat.st_size
        and source.file_mtime_ns == stat.st_mtime_ns
    )


def _save_source(conn: Connection, table: str, path: Path, rows: int) -> None:
    stat = path.stat()
    conn.execute(delete(DataSource).where(DataSource.table == table))
    conn.execute(
        insert(DataSource).values(
            table=table,
            file_name=path.name,
            file_size=stat.st_size,
            file_mtime_ns=stat.st_mtime_ns,
            rows=rows,
            synced_at=datetime.now(UTC).replace(tzinfo=None),
        )
    )


def sync(x_path: Path, y_path: Path, *, force: bool = False) -> list[SyncResult]:
    """Load `interview.X.csv` into `impressions` and `interview.y.csv` into `events`."""
    for p in (x_path, y_path):
        if not p.is_file():
            raise FileNotFoundError(p)

    get_settings().db_path.parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine, tables=[DataSource.__table__])

    plan = [
        (Impression.__table__, x_path, IMPRESSION_COLUMNS, ["reg_time"]),
        (Event.__table__, y_path, EVENT_COLUMNS, []),
    ]
    results: list[SyncResult] = []
    with engine.begin() as conn:
        conn.execute(text("PRAGMA synchronous=OFF"))
        for table, path, columns, parse_dates in plan:
            if not force and _is_fresh(conn, table.name, path):
                rows = conn.scalar(select(DataSource.rows).where(DataSource.table == table.name))
                results.append(SyncResult(table.name, rows or 0, skipped=True))
                continue
            # Recreate rather than truncate, so schema changes (e.g. new indexes) apply too
            Base.metadata.drop_all(conn, tables=[table])
            Base.metadata.create_all(conn, tables=[table])
            rows = _insert_csv(conn, table, path, columns, parse_dates)
            if table is Impression.__table__:
                Base.metadata.create_all(conn, tables=[Site.__table__, DeviceModel.__table__])
                _rebuild_lookups(conn)
            _save_source(conn, table.name, path, rows)
            results.append(SyncResult(table.name, rows, skipped=False))

    if not all(r.skipped for r in results):
        with engine.connect() as conn:
            conn.execute(text("ANALYZE"))
            conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
    return results
