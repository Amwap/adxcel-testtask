"""Campaign metrics (CTR, EvPM) read from the rollup tables built on sync."""

from collections import defaultdict

from sqlalchemy import Integer, and_, cast, func, select
from sqlalchemy.orm import Session, aliased

from app.db import EventRollup, ImpressionRollup
from app.schemas.metrics import (
    Dimension,
    EventTypes,
    Granularity,
    MetricPage,
    MetricRow,
    Metrics,
    Mode,
    SortField,
    TimePoint,
    TimeSeries,
)
from app.services.data import like_pattern

CLICK_TAG = "fclick"


def _metrics(impressions: int, clicks: int, events: int) -> dict[str, int | float]:
    return {
        "impressions": impressions,
        "clicks": clicks,
        "events": events,
        "ctr": 100 * clicks / impressions if impressions else 0.0,
        "evpm": 1000 * events / impressions if impressions else 0.0,
    }


def _rollup_query(dimension: str, tag: str, mode: Mode):
    """Rows of (key, impressions, clicks, events, ctr, evpm) for every value of `dimension`."""
    imp = ImpressionRollup
    clicks = aliased(EventRollup)
    events = aliased(EventRollup)

    def matches(rollup, event_tag: str):
        return and_(
            rollup.dimension == imp.dimension,
            rollup.key == imp.key,
            rollup.tag == event_tag,
            rollup.mode == mode,
        )

    n_clicks = func.coalesce(clicks.events, 0)
    n_events = func.coalesce(events.events, 0)
    return (
        select(
            imp.key,
            imp.impressions,
            n_clicks.label("clicks"),
            n_events.label("events"),
            (100.0 * n_clicks / imp.impressions).label("ctr"),
            (1000.0 * n_events / imp.impressions).label("evpm"),
        )
        .select_from(imp)
        .outerjoin(clicks, matches(clicks, CLICK_TAG))
        .outerjoin(events, matches(events, tag))
        .where(imp.dimension == dimension)
    )


def _totals(db: Session, stmt) -> Metrics:
    sub = stmt.subquery()
    row = db.execute(
        select(
            func.coalesce(func.sum(sub.c.impressions), 0),
            func.coalesce(func.sum(sub.c.clicks), 0),
            func.coalesce(func.sum(sub.c.events), 0),
        )
    ).one()
    return Metrics(**_metrics(*row))


def event_types(db: Session) -> EventTypes:
    tags = db.scalars(select(EventRollup.tag).distinct().order_by(EventRollup.tag))
    return EventTypes(tags=list(tags), click_tag=CLICK_TAG)


def timeseries(db: Session, tag: str, mode: Mode, granularity: Granularity) -> TimeSeries:
    rows = db.execute(_rollup_query("hour", tag, mode).order_by(ImpressionRollup.key))

    buckets: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0])
    for r in rows:
        ts = r.key if granularity == "hour" else f"{r.key[:10]}T00:00:00"
        b = buckets[ts]
        b[0] += r.impressions
        b[1] += r.clicks
        b[2] += r.events

    points = [TimePoint(ts=ts, **_metrics(*b)) for ts, b in buckets.items()]
    totals = Metrics(**_metrics(*(sum(b[i] for b in buckets.values()) for i in range(3))))
    return TimeSeries(tag=tag, mode=mode, granularity=granularity, points=points, totals=totals)


def aggregate(
    db: Session,
    dimension: Dimension,
    tag: str,
    mode: Mode,
    *,
    page: int,
    page_size: int,
    q: str = "",
    min_impressions: int = 0,
    sort: SortField = "impressions",
    descending: bool = True,
) -> MetricPage:
    stmt = _rollup_query(dimension, tag, mode)
    if q:
        stmt = stmt.where(ImpressionRollup.key.like(like_pattern(q), escape="\\"))
    if min_impressions:
        stmt = stmt.where(ImpressionRollup.impressions >= min_impressions)

    sub = stmt.subquery()
    total = db.scalar(select(func.count()).select_from(sub)) or 0
    totals = _totals(db, stmt)

    column = sub.c[sort]
    if sort == "key" and dimension == "mm_dma":
        column = cast(column, Integer)
    order = column.desc() if descending else column.asc()
    rows = db.execute(
        select(sub).order_by(order, sub.c.key).offset((page - 1) * page_size).limit(page_size)
    )
    items = [MetricRow(key=r.key, **_metrics(r.impressions, r.clicks, r.events)) for r in rows]
    return MetricPage(items=items, total=total, page=page, page_size=page_size, totals=totals)
