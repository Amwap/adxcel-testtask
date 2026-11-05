from typing import Literal

from pydantic import BaseModel

from app.schemas.data import Page

Mode = Literal["first", "all"]
Granularity = Literal["hour", "day"]
Dimension = Literal["mm_dma", "site_id"]


class Metrics(BaseModel):
    impressions: int
    clicks: int  # fclick events, the CTR numerator
    events: int  # events of the requested type, the EvPM numerator
    ctr: float  # % = 100 * clicks / impressions
    evpm: float  # per mille = 1000 * events / impressions


class SeriesMetrics(BaseModel):
    """Like `Metrics`, but with an EvPM numerator per requested event type."""

    impressions: int
    clicks: int
    ctr: float
    events: dict[str, int]
    evpm: dict[str, float]


class TimePoint(SeriesMetrics):
    ts: str  # bucket start, naive ISO datetime


class TimeSeries(BaseModel):
    tags: list[str]
    mode: Mode
    granularity: Granularity
    points: list[TimePoint]
    totals: SeriesMetrics


class MetricRow(Metrics):
    key: str
    name: str | None = None  # DMA name; None for sites and unlisted DMA codes


class MetricPage(Page[MetricRow]):
    totals: Metrics


class SegmentOption(BaseModel):
    """A DMA or site for a picker."""

    key: str  # DMA code or site domain
    name: str | None  # DMA name; None for sites
    impressions: int


class DmaRegion(BaseModel):
    code: int
    name: str


class EventTypes(BaseModel):
    """Event types with the view-through `v` prefix merged into the base type."""

    tags: list[str]
    click_tag: str
