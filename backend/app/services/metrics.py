"""Campaign metrics (CTR, EvPM) read from the rollup tables built on sync."""

from collections import defaultdict

from sqlalchemy import Integer, String, and_, cast, column, func, null, select
from sqlalchemy.orm import Session, aliased

from app.db import EventRollup, ImpressionRollup
from app.schemas.metrics import (
    Dimension,
    DmaRegion,
    EventTypes,
    Granularity,
    MetricPage,
    MetricRow,
    Metrics,
    Mode,
    SegmentOption,
    SeriesMetrics,
    TimePoint,
    TimeSeries,
)
from app.services import dma
from app.services.table import Field, TableQuery, like_pattern

CLICK_TAG = "fclick"

# Columns of `_rollup_query`, filtered and sorted after it is wrapped in a subquery
_METRIC_FIELDS = {
    name: Field("number", column(name))
    for name in ("impressions", "clicks", "events", "ctr", "evpm")
}

# `key` filters take exact values, picked from `segment_options`
AGGREGATE_FIELDS: dict[Dimension, dict[str, Field]] = {
    # DMA codes are stored as text keys; shown as "(code) name", so sorted by the code
    "mm_dma": {
        "key": Field("enum", column("key"), sort_by=cast(column("key"), Integer)),
        "name": Field("text", column("name")),
        **_METRIC_FIELDS,
    },
    "site_id": {"key": Field("enum", column("key")), **_METRIC_FIELDS},
}


def _metrics(impressions: int, clicks: int, events: int) -> dict[str, int | float]:
    return {
        "impressions": impressions,
        "clicks": clicks,
        "events": events,
        "ctr": 100 * clicks / impressions if impressions else 0.0,
        "evpm": 1000 * events / impressions if impressions else 0.0,
    }


def _rollup_query(dimension: str, tag: str, mode: Mode):
    """Rows of (key, name, impressions, clicks, events, ctr, evpm) for every value of `dimension`.

    `name` is the DMA name, NULL for sites.
    """
    imp = ImpressionRollup
    names = dma.table()
    clicks = aliased(EventRollup)
    events = aliased(EventRollup)

    def matches(rollup, event_tag: str):
        return and_(
            rollup.dimension == imp.dimension,
            rollup.segment == imp.segment,
            rollup.key == imp.key,
            rollup.tag == event_tag,
            rollup.mode == mode,
        )

    n_clicks = func.coalesce(clicks.events, 0)
    n_events = func.coalesce(events.events, 0)
    name = names.c.name if dimension == "mm_dma" else cast(null(), String)
    stmt = (
        select(
            imp.key,
            name.label("name"),
            imp.impressions,
            n_clicks.label("clicks"),
            n_events.label("events"),
            (100.0 * n_clicks / imp.impressions).label("ctr"),
            (1000.0 * n_events / imp.impressions).label("evpm"),
        )
        .select_from(imp)
        .outerjoin(clicks, matches(clicks, CLICK_TAG))
        .outerjoin(events, matches(events, tag))
        .where(imp.dimension == dimension, imp.segment == "")
    )
    if dimension == "mm_dma":
        stmt = stmt.outerjoin(names, names.c.code == cast(imp.key, Integer))
    return stmt


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


def dma_regions() -> list[DmaRegion]:
    return [DmaRegion(code=code, name=name) for code, name in dma.names().items()]


def segment_options(
    db: Session, dimension: Dimension, q: str, *, limit: int, min_impressions: int = 0
) -> list[SegmentOption]:
    """DMAs or sites matching `q`, by impressions descending, for searchable pickers.

    A site matches by a part of its domain, a DMA by a part of its name or a code prefix.
    """
    imp = ImpressionRollup
    stmt = select(imp.key, imp.impressions).where(
        imp.dimension == dimension, imp.segment == "", imp.impressions >= min_impressions
    )
    q = q.strip()
    if q and dimension == "mm_dma":
        stmt = stmt.where(imp.key.in_([str(code) for code in dma.search(q)]))
    elif q:
        stmt = stmt.where(imp.key.like(like_pattern(q), escape="\\"))
    rows = db.execute(stmt.order_by(imp.impressions.desc(), imp.key).limit(limit))
    names = dma.names() if dimension == "mm_dma" else {}
    return [
        SegmentOption(key=key, name=names.get(int(key)) if names else None, impressions=n)
        for key, n in rows
    ]


def event_types(db: Session) -> EventTypes:
    tags = db.scalars(select(EventRollup.tag).distinct().order_by(EventRollup.tag))
    return EventTypes(tags=list(tags), click_tag=CLICK_TAG)


def _series_metrics(impressions: int, events: dict[str, int], tags: list[str]) -> dict:
    clicks = events.get(CLICK_TAG, 0)
    counts = {t: events.get(t, 0) for t in tags}
    return {
        "impressions": impressions,
        "clicks": clicks,
        "ctr": 100 * clicks / impressions if impressions else 0.0,
        "events": counts,
        "evpm": {t: 1000 * n / impressions if impressions else 0.0 for t, n in counts.items()},
    }


def timeseries(
    db: Session,
    tags: list[str],
    mode: Mode,
    granularity: Granularity,
    segment: tuple[Dimension, str] | None = None,
) -> TimeSeries:
    """CTR and EvPM of each of `tags` per hour or day, in one pass over the hourly rollups.

    `segment` narrows the series to one DMA or site, e.g. `("mm_dma", "501")`.
    """
    dimension, segment_key = ("hour", "") if segment is None else (f"hour:{segment[0]}", segment[1])

    def bucket(key: str) -> str:
        return key if granularity == "hour" else f"{key[:10]}T00:00:00"

    impressions: dict[str, int] = defaultdict(int)
    for k, n in db.execute(
        select(ImpressionRollup.key, ImpressionRollup.impressions)
        .where(ImpressionRollup.dimension == dimension, ImpressionRollup.segment == segment_key)
        .order_by(ImpressionRollup.key)
    ):
        impressions[bucket(k)] += n

    events: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    totals: dict[str, int] = defaultdict(int)
    for k, tag, n in db.execute(
        select(EventRollup.key, EventRollup.tag, EventRollup.events).where(
            EventRollup.dimension == dimension,
            EventRollup.segment == segment_key,
            EventRollup.mode == mode,
            EventRollup.tag.in_({CLICK_TAG, *tags}),
        )
    ):
        events[bucket(k)][tag] += n
        totals[tag] += n

    points = [
        TimePoint(ts=ts, **_series_metrics(n, events.get(ts, {}), tags))
        for ts, n in impressions.items()
    ]
    return TimeSeries(
        tags=tags,
        mode=mode,
        granularity=granularity,
        points=points,
        totals=SeriesMetrics(**_series_metrics(sum(impressions.values()), totals, tags)),
    )


def aggregate(
    db: Session,
    dimension: Dimension,
    tag: str,
    mode: Mode,
    query: TableQuery,
    *,
    page: int,
    page_size: int,
) -> MetricPage:
    """`query` holds conditions and ordering over `AGGREGATE_FIELDS[dimension]`."""
    stmt = select(_rollup_query(dimension, tag, mode).subquery()).where(*query.conditions)
    sub = stmt.subquery()
    total = db.scalar(select(func.count()).select_from(sub)) or 0
    totals = _totals(db, stmt)

    order_by = query.order_by or [column("impressions").desc()]
    rows = db.execute(
        stmt.order_by(*order_by, column("key")).offset((page - 1) * page_size).limit(page_size)
    )
    items = [
        MetricRow(key=r.key, name=r.name, **_metrics(r.impressions, r.clicks, r.events))
        for r in rows
    ]
    return MetricPage(items=items, total=total, page=page, page_size=page_size, totals=totals)
