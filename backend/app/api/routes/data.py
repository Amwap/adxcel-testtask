from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.data import DatasetSummary, EventRead, ImpressionRead, Page
from app.services import data

router = APIRouter(tags=["data"])

PageNumber = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=100)]
Search = Annotated[str, Query(max_length=100)]


@router.get("/summary")
def summary(db: DbSession, _user: CurrentUser) -> DatasetSummary:
    return data.summary(db)


@router.get("/impressions")
def list_impressions(
    db: DbSession,
    _user: CurrentUser,
    page: PageNumber = 1,
    page_size: PageSize = 25,
    q: Search = "",
) -> Page[ImpressionRead]:
    """Search matches a uid prefix or a substring of site / device model."""
    return data.list_impressions(db, page, page_size, q.strip())


@router.get("/events")
def list_events(
    db: DbSession,
    _user: CurrentUser,
    page: PageNumber = 1,
    page_size: PageSize = 25,
    q: Search = "",
    tag: Annotated[str | None, Query(max_length=32)] = None,
) -> Page[EventRead]:
    """Search matches a uid prefix."""
    return data.list_events(db, page, page_size, q.strip(), tag)
