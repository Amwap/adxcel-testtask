"""Sync the analysts' CSV exports into SQLite.

Each table remembers the size and mtime of the file it was loaded from (`DataSource`);
a table is reloaded only when its file changed, or when forced.
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
from sqlalchemy import Table, delete, func, insert, inspect, literal, select, text, update
from sqlalchemy.engine import Connection

from app.config import get_settings
from app.db import (
    Base,
    DataSource,
    DeviceModel,
    Event,
    EventRollup,
    Impression,
    ImpressionFacet,
    ImpressionRollup,
    Site,
    engine,
)

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

# Rollup dimensions: SQL expressions over `impressions i` that give the segment and the key
_HOUR = "strftime(:hour_format, i.reg_time)"
_DMA = "CAST(i.mm_dma AS TEXT)"
_SITE = "i.site_id"
ROLLUP_DIMENSIONS = {
    "hour": ("''", _HOUR),
    "mm_dma": ("''", _DMA),
    "site_id": ("''", _SITE),
    # Hourly series of each DMA and site, for trends of one segment
    "hour:mm_dma": (_DMA, _HOUR),
    "hour:site_id": (_SITE, _HOUR),
    # ... and of each (DMA, site) pair as `501|nypost.com`, to exclude DMAs and sites together
    "hour:dma_site": (f"{_DMA} || '|' || {_SITE}", _HOUR),
}
HOUR_FORMAT = "%Y-%m-%dT%H:00:00"

# Impression columns with few distinct values, offered as filter options
FACET_COLUMNS = (Impression.os_name, Impression.hardware)


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
    conn.execute(delete(ImpressionFacet))
    for column in FACET_COLUMNS:
        conn.execute(
            insert(ImpressionFacet).from_select(
                ["field", "value", "impressions"],
                select(literal(column.key), column, func.count())
                .where(column.is_not(None))
                .group_by(column),
            )
        )


def _link_events(conn: Connection) -> None:
    """Fill `Impression.event_count` and the impression columns of `Event` across the logs."""
    conn.execute(update(Impression).where(Impression.event_count > 0).values(event_count=0))
    conn.execute(
        text("""
            UPDATE impressions
            SET event_count = (SELECT count(*) FROM events e WHERE e.uid = impressions.uid)
            WHERE uid IN (SELECT uid FROM events)
        """)
    )
    conn.execute(update(Event).values(reg_time=None, site_id=None))
    conn.execute(
        text("""
            UPDATE events
            SET reg_time = i.reg_time, site_id = i.site_id
            FROM impressions i
            WHERE i.id = (SELECT min(id) FROM impressions WHERE uid = events.uid)
        """)
    )


def _rebuild_rollups(conn: Connection) -> None:
    """Recompute impression and event counts per dimension value (see `EventRollup`)."""
    tables = [ImpressionRollup.__table__, EventRollup.__table__]
    Base.metadata.drop_all(conn, tables=tables)
    Base.metadata.create_all(conn, tables=tables)

    conn.execute(text("DROP TABLE IF EXISTS temp.event_impressions"))
    # One row per (impression, event type) with the number of such events of its uid;
    # `is_first` marks the earliest impression of the uid. The inner join drops orphan events.
    conn.execute(
        text("""
            CREATE TEMP TABLE event_impressions AS
            WITH uid_tags AS (
                SELECT uid,
                       CASE WHEN tag LIKE 'v%' THEN substr(tag, 2) ELSE tag END AS tag,
                       count(*) AS n
                FROM events
                GROUP BY 1, 2
            )
            SELECT i.id AS impression_id, t.tag, t.n,
                   i.id = (SELECT min(id) FROM impressions WHERE uid = t.uid) AS is_first
            FROM uid_tags t
            JOIN impressions i ON i.uid = t.uid
        """)
    )
    params = {"hour_format": HOUR_FORMAT}
    for dimension, (segment, key) in ROLLUP_DIMENSIONS.items():
        conn.execute(
            text(f"""
                INSERT INTO rollup_impressions (dimension, segment, key, impressions)
                SELECT :dimension, {segment}, {key}, count(*) FROM impressions i GROUP BY 2, 3
            """),
            {**params, "dimension": dimension},
        )
        for mode, where in (("all", "1"), ("first", "e.is_first")):
            conn.execute(
                text(f"""
                    INSERT INTO rollup_events (dimension, segment, key, tag, mode, events)
                    SELECT :dimension, {segment}, {key}, e.tag, :mode, sum(e.n)
                    FROM event_impressions e
                    JOIN impressions i ON i.id = e.impression_id
                    WHERE {where}
                    GROUP BY 2, 3, 4
                """),
                {**params, "dimension": dimension, "mode": mode},
            )
        log.info("rollups: %s", dimension)
    conn.execute(text("DROP TABLE temp.event_impressions"))


def _is_fresh(conn: Connection, table: Table, path: Path) -> bool:
    """Loaded from this very file, with the current set of columns."""
    stat = path.stat()
    source = conn.execute(select(DataSource).where(DataSource.table == table.name)).first()
    stored = {c["name"] for c in inspect(conn).get_columns(table.name)}
    return (
        source is not None
        and stored == set(table.columns.keys())
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
    Base.metadata.create_all(
        engine, tables=[DataSource.__table__, ImpressionRollup.__table__, EventRollup.__table__]
    )

    plan = [
        (Impression.__table__, x_path, IMPRESSION_COLUMNS, ["reg_time"]),
        (Event.__table__, y_path, EVENT_COLUMNS, []),
    ]
    results: list[SyncResult] = []
    with engine.begin() as conn:
        conn.execute(text("PRAGMA synchronous=OFF"))
        for table, path, columns, parse_dates in plan:
            if not force and _is_fresh(conn, table, path):
                rows = conn.scalar(select(DataSource.rows).where(DataSource.table == table.name))
                results.append(SyncResult(table.name, rows or 0, skipped=True))
                continue
            # Recreate rather than truncate, so schema changes (e.g. new indexes) apply too
            Base.metadata.drop_all(conn, tables=[table])
            Base.metadata.create_all(conn, tables=[table])
            rows = _insert_csv(conn, table, path, columns, parse_dates)
            if table is Impression.__table__:
                Base.metadata.create_all(
                    conn,
                    tables=[Site.__table__, DeviceModel.__table__, ImpressionFacet.__table__],
                )
                _rebuild_lookups(conn)
            _save_source(conn, table.name, path, rows)
            results.append(SyncResult(table.name, rows, skipped=False))

        # Rollups are derived data: an older schema is rebuilt without reloading the CSVs
        rollup = ImpressionRollup.__table__
        rollups_missing = any(
            {c["name"] for c in inspect(conn).get_columns(t.name)} != set(t.columns.keys())
            for t in (rollup, EventRollup.__table__)
        ) or set(conn.scalars(select(rollup.c.dimension).distinct())) != set(ROLLUP_DIMENSIONS)
        if rollups_missing or not all(r.skipped for r in results):
            _link_events(conn)
            _rebuild_rollups(conn)

    if rollups_missing or not all(r.skipped for r in results):
        with engine.connect() as conn:
            conn.execute(text("ANALYZE"))
            conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
    return results
