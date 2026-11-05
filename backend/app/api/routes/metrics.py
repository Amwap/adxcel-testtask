from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.metrics import (
    Dimension,
    EventTypes,
    Granularity,
    MetricPage,
    Mode,
    SortField,
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
    db: DbSession,
    _user: CurrentUser,
    tag: Tag = metrics.CLICK_TAG,
    mode: ModeParam = "first",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    q: Annotated[str, Query(max_length=100)] = "",
    min_impressions: Annotated[int, Query(ge=0)] = 0,
    sort: SortField = "impressions",
    order: Literal["asc", "desc"] = "desc",
) -> MetricPage:
    """Impressions, CTR and EvPM per `mm_dma` or `site_id`. `q` filters by substring."""
    return metrics.aggregate(
        db,
        dimension,
        tag,
        mode,
        page=page,
        page_size=page_size,
        q=q.strip(),
        min_impressions=min_impressions,
        sort=sort,
        descending=order == "desc",
    )
