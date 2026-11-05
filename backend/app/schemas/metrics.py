from typing import Literal

from pydantic import BaseModel

from app.schemas.data import Page

Mode = Literal["first", "all"]
Granularity = Literal["hour", "day"]
Dimension = Literal["mm_dma", "site_id"]
SortField = Literal["key", "impressions", "clicks", "events", "ctr", "evpm"]


class Metrics(BaseModel):
    impressions: int
    clicks: int  # fclick events, the CTR numerator
    events: int  # events of the requested type, the EvPM numerator
    ctr: float  # % = 100 * clicks / impressions
    evpm: float  # per mille = 1000 * events / impressions


class TimePoint(Metrics):
    ts: str  # bucket start, naive ISO datetime


class TimeSeries(BaseModel):
    tag: str
    mode: Mode
    granularity: Granularity
    points: list[TimePoint]
    totals: Metrics


class MetricRow(Metrics):
    key: str


class MetricPage(Page[MetricRow]):
    totals: Metrics


class EventTypes(BaseModel):
    """Event types with the view-through `v` prefix merged into the base type."""

    tags: list[str]
    click_tag: str
