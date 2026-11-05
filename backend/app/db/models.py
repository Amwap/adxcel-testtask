from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    """Application user. Created via `python -m scripts.users`, there is no sign-up.

    `token_version` is embedded in every JWT; bumping it revokes all issued tokens.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True)
    token_version: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


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
    model: Mapped[str | None] = mapped_column(String, index=True)
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


class Site(Base):
    """Distinct `site_id` values with impression counts, rebuilt on every impressions sync.

    Lets substring search run over ~11k sites instead of scanning ~1M impressions.
    """

    __tablename__ = "sites"

    site_id: Mapped[str] = mapped_column(String, primary_key=True)
    impressions: Mapped[int]


class DeviceModel(Base):
    """Distinct device `model` values with impression counts, rebuilt with `Site`."""

    __tablename__ = "device_models"

    model: Mapped[str] = mapped_column(String, primary_key=True)
    impressions: Mapped[int]


class DataSource(Base):
    """Fingerprint of the CSV a table was last synced from; unchanged files are not reloaded."""

    __tablename__ = "data_sources"

    table: Mapped[str] = mapped_column(String(32), primary_key=True)
    file_name: Mapped[str] = mapped_column(String)
    file_size: Mapped[int]
    file_mtime_ns: Mapped[int]
    rows: Mapped[int]
    synced_at: Mapped[datetime] = mapped_column(DateTime)
