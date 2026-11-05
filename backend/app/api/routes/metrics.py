from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.api.deps import CurrentUser, DbSession, table_query
from app.schemas.metrics import (
    Dimension,
    DmaRegion,
    EventTypes,
    Granularity,
    MetricPage,
    Mode,
    SegmentOption,
    TimeSeries,
)
from app.services import metrics

router = APIRouter(prefix="/metrics", tags=["metrics"])

Tag = Annotated[str, Query(max_length=32, description="Event type without the `v` prefix")]
ModeParam = Annotated[
    Mode,
    Query(description="Duplicate uids: attribute events to the `first` impression or to `all`"),
]


@router.get("/dma-regions")
def dma_regions(_user: CurrentUser) -> list[DmaRegion]:
    """Nielsen DMA names by code; code 0 is an unknown region."""
    return metrics.dma_regions()


@router.get("/segments/{dimension}")
def segments(
    dimension: Dimension,
    db: DbSession,
    _user: CurrentUser,
    q: Annotated[str, Query(max_length=100)] = "",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    min_impressions: Annotated[int, Query(ge=0)] = 0,
) -> list[SegmentOption]:
    """Options of DMA and site pickers, by impressions descending.

    `q` matches a part of the site domain, or a part of the DMA name or a DMA code prefix.
    """
    return metrics.segment_options(db, dimension, q, limit=limit, min_impressions=min_impressions)


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
    mm_dma: Annotated[int | None, Query(description="Only impressions of this DMA")] = None,
    site_id: Annotated[
        str | None, Query(max_length=256, description="Only impressions of this site")
    ] = None,
    exclude_mm_dma: Annotated[
        list[int] | None, Query(max_length=50, description="Without these DMAs, repeatable")
    ] = None,
    exclude_site_id: Annotated[
        list[str] | None, Query(max_length=50, description="Without these sites, repeatable")
    ] = None,
) -> TimeSeries:
    """CTR (by fclick) and EvPM of each `tag` per hour or day, campaign-wide or for one segment.

    `exclude_mm_dma` and `exclude_site_id` drop impressions of those DMAs and sites, also
    together (`exclude_mm_dma=501&exclude_site_id=nypost.com`); with `mm_dma` only sites can
    be excluded, with `site_id` only DMAs.
    """
    tags = list(dict.fromkeys(t.strip() for t in tag or [metrics.CLICK_TAG] if t.strip()))
    if any(len(t) > 32 for t in tags):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Event type is too long")
    if mm_dma is not None and site_id is not None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Filter by either mm_dma or site_id, not both"
        )
    if (mm_dma is not None and exclude_mm_dma) or (site_id is not None and exclude_site_id):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Exclude segments of the other dimension than the selected one",
        )
    if any(len(s) > 256 for s in exclude_site_id or []):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Site is too long")
    segment: tuple[Dimension, str] | None = None
    if mm_dma is not None:
        segment = ("mm_dma", str(mm_dma))
    elif site_id is not None:
        segment = ("site_id", site_id)
    exclude: dict[Dimension, list[str]] = {
        "mm_dma": [str(k) for k in exclude_mm_dma or []],
        "site_id": exclude_site_id or [],
    }
    return metrics.timeseries(db, tags, mode, granularity, segment, exclude)


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
    `key`, `impressions`, `clicks`, `events`, `ctr`, `evpm`; for DMAs also `name`.
    `key` takes exact values, repeatable (`key=501&key=524`), as picked from `/segments`;
    `sort=key` orders DMAs by name.
    """
    query = table_query(request, metrics.AGGREGATE_FIELDS[dimension])
    return metrics.aggregate(db, dimension, tag, mode, query, page=page, page_size=page_size)
