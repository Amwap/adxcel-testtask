from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Impression(Base):
    """Impression log row (interview.X.csv).

    `uid` is not unique in the source data, so rows get a surrogate key.
    """

    __tablename__ = "impressions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reg_time: Mapped[datetime] = mapped_column(DateTime, index=True)
    uid: Mapped[str] = mapped_column(String(36), index=True)
    fc_imp_chk: Mapped[int]
    fc_time_chk: Mapped[int]
    utmtr: Mapped[int]
    mm_dma: Mapped[int] = mapped_column(index=True)
    os_name: Mapped[str | None] = mapped_column(String)
    model: Mapped[str | None] = mapped_column(String)
    hardware: Mapped[str | None] = mapped_column(String)
    site_id: Mapped[str] = mapped_column(String, index=True)


class Event(Base):
    """Event log row (interview.y.csv).

    Some events reference uids missing from the impression log, so there is no FK.
    """

    __tablename__ = "events"
    __table_args__ = (Index("ix_events_tag_uid", "tag", "uid"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    uid: Mapped[str] = mapped_column(String(36), index=True)
    tag: Mapped[str] = mapped_column(String(32))
