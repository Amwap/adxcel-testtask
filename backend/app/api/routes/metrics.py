from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.api.deps import CurrentUser, DbSession, table_query
from app.schemas.metrics import (
    Dimension,
    EventTypes,
    Granularity,
    MetricPage,
    Mode,
    TimeSeries,
)
from app.services import metrics

router = APIRouter(prefix="/metrics", tags=["metrics"])

Tag = Annotated[str, Query(max_length=32, description="Event type without the `v` prefix")]
ModeParam = Annotated[
    Mode,
    Query(description="Duplicate uids: attribute events to the `first` impression or to `all`"),
]


@router.get("/event-types")
def event_types(db: DbSession, _user: CurrentUser) -> EventTypes:
    return metrics.event_types(db)


@router.get("/timeseries")
def timeseries(
    db: DbSession,
    _user: CurrentUser,
    tag: Annotated[
        list[str] | None,
        Query(max_length=16, description="Event types for EvPM, repeatable"),
    ] = None,
    mode: ModeParam = "first",
    granularity: Granularity = "hour",
) -> TimeSeries:
    """CTR (by fclick) and EvPM of each `tag` per hour or day."""
    tags = list(dict.fromkeys(t.strip() for t in tag or [metrics.CLICK_TAG] if t.strip()))
    if any(len(t) > 32 for t in tags):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Event type is too long")
    return metrics.timeseries(db, tags, mode, granularity)


@router.get("/aggregates/{dimension}")
def aggregates(
    dimension: Dimension,
    request: Request,
    db: DbSession,
    _user: CurrentUser,
    tag: Tag = metrics.CLICK_TAG,
    mode: ModeParam = "first",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
) -> MetricPage:
    """Impressions, CTR and EvPM per `mm_dma` or `site_id`, by impressions descending.

    Filter and sort by any column (see `app.services.table` for the parameters):
    `key` (number for DMA, text for site), `impressions`, `clicks`, `events`, `ctr`, `evpm`.
    """
    query = table_query(request, metrics.AGGREGATE_FIELDS[dimension])
    return metrics.aggregate(db, dimension, tag, mode, query, page=page, page_size=page_size)
