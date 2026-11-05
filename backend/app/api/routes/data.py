from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.api.deps import CurrentUser, DbSession, table_query
from app.schemas.data import DatasetSummary, EventRead, ImpressionRead, Page
from app.services import data

router = APIRouter(tags=["data"])

PageNumber = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=100)]


@router.get("/summary")
def summary(db: DbSession, _user: CurrentUser) -> DatasetSummary:
    return data.summary(db)


@router.get("/impressions")
def list_impressions(
    request: Request,
    db: DbSession,
    _user: CurrentUser,
    page: PageNumber = 1,
    page_size: PageSize = 25,
) -> Page[ImpressionRead]:
    """Filter and sort by any column (see `app.services.table` for the parameters).

    Fields: `reg_time` datetime, `uid` prefix, `site_id` and `model` text, `mm_dma` number;
    enums `os_name`, `hardware`, `fc_imp_chk`, `fc_time_chk`, `utmtr` (codes) and
    `events` (has an event of the type; sorts by the number of events).
    """
    return data.list_impressions(db, page, page_size, table_query(request, data.IMPRESSION_FIELDS))


@router.get("/events")
def list_events(
    request: Request,
    db: DbSession,
    _user: CurrentUser,
    page: PageNumber = 1,
    page_size: PageSize = 25,
) -> Page[EventRead]:
    """Filter and sort by any column (see `app.services.table` for the parameters).

    Fields: `tag` enum, `uid` prefix, and from the earliest impression with the uid:
    `reg_time` datetime, `site_id` text.
    """
    return data.list_events(db, page, page_size, table_query(request, data.EVENT_FIELDS))
