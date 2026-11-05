"""Read access to synced impressions and events (paginated, filterable by every column)."""

from collections import defaultdict

from sqlalchemy import ColumnElement, and_, func, select
from sqlalchemy.orm import Session

from app.db import DataSource, DeviceModel, Event, Impression, ImpressionFacet, Site
from app.schemas.data import (
    DatasetSummary,
    DataSourceRead,
    EventRead,
    ImpressionRead,
    Page,
    TagCount,
    ValueCount,
)
from app.services.table import Field, TableQuery, like_pattern


def _starts_with(column, prefix: str) -> ColumnElement[bool]:
    # Range instead of LIKE 'x%': SQLite only uses an index for LIKE on NOCASE columns
    prefix = prefix.lower()
    return and_(column >= prefix, column < prefix + "￿")


def _via_lookup(column, lookup_column):
    """Substring match against a small lookup table, resolved through the column's index,
    so it never scans the whole impressions table."""
    return lambda q: column.in_(
        select(lookup_column).where(lookup_column.like(like_pattern(q), escape="\\"))
    )


IMPRESSION_FIELDS: dict[str, Field] = {
    "reg_time": Field("datetime", Impression.reg_time),
    "uid": Field("prefix", Impression.uid, where=lambda q: _starts_with(Impression.uid, q)),
    "site_id": Field(
        "text", Impression.site_id, where=_via_lookup(Impression.site_id, Site.site_id)
    ),
    "mm_dma": Field("number", Impression.mm_dma),
    "model": Field(
        "text", Impression.model, where=_via_lookup(Impression.model, DeviceModel.model)
    ),
    "os_name": Field("enum", Impression.os_name),
    "hardware": Field("enum", Impression.hardware),
    "fc_imp_chk": Field("enum", Impression.fc_imp_chk, cast=int),
    "fc_time_chk": Field("enum", Impression.fc_time_chk, cast=int),
    "utmtr": Field("enum", Impression.utmtr, cast=int),
    # Filter: has an event of any of the types; sort: by the number of events
    "events": Field(
        "enum",
        Impression.event_count,
        where=lambda tags: Impression.uid.in_(select(Event.uid).where(Event.tag.in_(tags))),
    ),
}

# `reg_time` and `site_id` come from the earliest impression with the event's uid
EVENT_FIELDS: dict[str, Field] = {
    "tag": Field("enum", Event.tag),
    "uid": Field("prefix", Event.uid, where=lambda q: _starts_with(Event.uid, q)),
    "reg_time": Field("datetime", Impression.reg_time),
    "site_id": Field("text", Impression.site_id),
}


def _synced_rows(db: Session, table: str) -> int | None:
    return db.scalar(select(DataSource.rows).where(DataSource.table == table))


def list_impressions(
    db: Session, page: int, page_size: int, query: TableQuery
) -> Page[ImpressionRead]:
    stmt = select(Impression).where(*query.conditions)
    if query.conditions:
        total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    else:
        # COUNT(*) over ~1M rows is slow; the row count is known from the last sync
        total = _synced_rows(db, Impression.__tablename__)
        if total is None:
            total = db.scalar(select(func.count()).select_from(Impression)) or 0

    stmt = stmt.order_by(*query.order_by, Impression.id)
    rows = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))
    items = [ImpressionRead.model_validate(r) for r in rows]

    tags: dict[str, list[str]] = defaultdict(list)
    uids = {i.uid for i in items}
    if uids:
        for uid, tag in db.execute(
            select(Event.uid, Event.tag).where(Event.uid.in_(uids)).order_by(Event.id)
        ):
            tags[uid].append(tag)
    for item in items:
        item.events = tags[item.uid]
    return Page(items=items, total=total, page=page, page_size=page_size)


def list_events(db: Session, page: int, page_size: int, query: TableQuery) -> Page[EventRead]:
    stmt = (
        select(Event.id, Event.uid, Event.tag, Impression.reg_time, Impression.site_id)
        .outerjoin(Impression, Impression.id == Event.impression_id)
        .where(*query.conditions)
    )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.execute(
        stmt.order_by(*query.order_by, Event.id).offset((page - 1) * page_size).limit(page_size)
    )
    items = [EventRead.model_validate(r, from_attributes=True) for r in rows]
    return Page(items=items, total=total, page=page, page_size=page_size)


def summary(db: Session) -> DatasetSummary:
    sources = db.scalars(select(DataSource).order_by(DataSource.table))
    tag_counts = db.execute(select(Event.tag, func.count()).group_by(Event.tag).order_by(Event.tag))
    facets: dict[str, list[ValueCount]] = defaultdict(list)
    for f in db.scalars(
        select(ImpressionFacet).order_by(ImpressionFacet.field, ImpressionFacet.impressions.desc())
    ):
        facets[f.field].append(ValueCount(value=f.value, count=f.impressions))
    return DatasetSummary(
        sources=[DataSourceRead.model_validate(s) for s in sources],
        event_tags=[TagCount(tag=t, count=n) for t, n in tag_counts],
        impression_facets=facets,
    )
