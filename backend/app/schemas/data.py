from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class ImpressionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reg_time: datetime
    uid: str
    fc_imp_chk: int
    fc_time_chk: int
    utmtr: int
    mm_dma: int
    os_name: str | None
    model: str | None
    hardware: str | None
    site_id: str
    events: list[str] = []


class EventRead(BaseModel):
    id: int
    uid: str
    tag: str
    # From the impression with the same uid; None for events without one
    reg_time: datetime | None
    site_id: str | None


class DataSourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    table: str
    file_name: str
    rows: int
    synced_at: datetime


class TagCount(BaseModel):
    tag: str
    count: int


class ValueCount(BaseModel):
    value: str
    count: int


class DatasetSummary(BaseModel):
    sources: list[DataSourceRead]
    event_tags: list[TagCount]
    # Distinct values of low-cardinality impression columns, e.g. {"os_name": [...]}
    impression_facets: dict[str, list[ValueCount]]
