"""Read access to synced impressions and events (paginated, searchable)."""

from collections import defaultdict

from sqlalchemy import ColumnElement, and_, func, or_, select
from sqlalchemy.orm import Session

from app.db import DataSource, DeviceModel, Event, Impression, Site
from app.schemas.data import (
    DatasetSummary,
    DataSourceRead,
    EventRead,
    ImpressionRead,
    Page,
    TagCount,
)


def _like_pattern(q: str) -> str:
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _starts_with(column, prefix: str) -> ColumnElement[bool]:
    # Range instead of LIKE 'x%': SQLite only uses an index for LIKE on NOCASE columns
    return and_(column >= prefix, column < prefix + "￿")


def _impression_search(q: str) -> ColumnElement[bool]:
    """uid prefix, or substring of site / device model.

    Substrings are matched against the small lookup tables, then resolved through indexes,
    so a search never scans the whole impressions table.
    """
    pattern = _like_pattern(q)
    return or_(
        _starts_with(Impression.uid, q.lower()),
        Impression.site_id.in_(select(Site.site_id).where(Site.site_id.like(pattern, escape="\\"))),
        Impression.model.in_(
            select(DeviceModel.model).where(DeviceModel.model.like(pattern, escape="\\"))
        ),
    )


def _synced_rows(db: Session, table: str) -> int | None:
    return db.scalar(select(DataSource.rows).where(DataSource.table == table))


def list_impressions(db: Session, page: int, page_size: int, q: str = "") -> Page[ImpressionRead]:
    stmt = select(Impression)
    if q:
        stmt = stmt.where(_impression_search(q))
        total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    else:
        # COUNT(*) over ~1M rows is slow; the row count is known from the last sync
        total = _synced_rows(db, Impression.__tablename__)
        if total is None:
            total = db.scalar(select(func.count()).select_from(Impression)) or 0

    rows = db.scalars(stmt.order_by(Impression.id).offset((page - 1) * page_size).limit(page_size))
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


def list_events(
    db: Session, page: int, page_size: int, q: str = "", tag: str | None = None
) -> Page[EventRead]:
    stmt = select(Event)
    if q:
        stmt = stmt.where(_starts_with(Event.uid, q.lower()))
    if tag:
        stmt = stmt.where(Event.tag == tag)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    events = db.scalars(stmt.order_by(Event.id).offset((page - 1) * page_size).limit(page_size))
    events = list(events)

    # uid is not unique in the impression log: take the first impression per uid
    impressions: dict[str, Impression] = {}
    uids = {e.uid for e in events}
    if uids:
        for imp in db.scalars(
            select(Impression).where(Impression.uid.in_(uids)).order_by(Impression.id.desc())
        ):
            impressions[imp.uid] = imp

    items = []
    for e in events:
        imp = impressions.get(e.uid)
        items.append(
            EventRead(
                id=e.id,
                uid=e.uid,
                tag=e.tag,
                reg_time=imp.reg_time if imp else None,
                site_id=imp.site_id if imp else None,
            )
        )
    return Page(items=items, total=total, page=page, page_size=page_size)


def summary(db: Session) -> DatasetSummary:
    sources = db.scalars(select(DataSource).order_by(DataSource.table))
    tag_counts = db.execute(select(Event.tag, func.count()).group_by(Event.tag).order_by(Event.tag))
    return DatasetSummary(
        sources=[DataSourceRead.model_validate(s) for s in sources],
        event_tags=[TagCount(tag=t, count=n) for t, n in tag_counts],
    )
