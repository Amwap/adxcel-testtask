"""Per-column filters and sorting for paginated tables.

A table declares its fields; the kind of a field sets the query parameters it accepts:

- `text`: `<field>=<substring>`, case-insensitive
- `prefix`: `<field>=<prefix>`, case-insensitive
- `number`: `<field>_min`, `<field>_max`, both inclusive
- `datetime`: `<field>_from`, `<field>_to`, ISO dates or datetimes; `to` covers its whole
  last unit, so `_to=2021-07-28` includes that day and `_to=2021-07-28T10:30` that minute
- `enum`: `<field>=<value>`, repeatable, matches any of the values

Sorting: `sort=<field>` and `order=asc|desc`.
"""

import math
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Literal, Protocol

from sqlalchemy import ColumnElement

Kind = Literal["text", "prefix", "number", "datetime", "enum"]

MAX_TEXT = 100
MAX_VALUES = 50


class TableQueryError(ValueError):
    """A filter or sort parameter is malformed."""


class QueryParams(Protocol):
    def get(self, key: str, default: Any = None) -> Any: ...
    def getlist(self, key: str) -> list[str]: ...


@dataclass(frozen=True)
class Field:
    kind: Kind
    column: ColumnElement[Any]
    """Compared by the default filters and used for sorting."""
    where: Callable[[Any], ColumnElement[bool]] | None = None
    """Custom condition: gets the text for `text`/`prefix`, the list of values for `enum`."""
    sort_by: ColumnElement[Any] | None = None
    cast: Callable[[str], Any] = str
    """Converts `enum` values before they are compared with `column`."""


@dataclass(frozen=True)
class TableQuery:
    conditions: list[ColumnElement[bool]]
    order_by: list[ColumnElement[Any]]
    """Empty when no sort was requested; the caller picks its default order."""


def like_pattern(q: str, *, prefix: bool = False) -> str:
    """`%q%` (or `q%`) with LIKE wildcards escaped by backslash."""
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"{escaped}%" if prefix else f"%{escaped}%"


def _number(name: str, raw: str) -> float:
    try:
        value = float(raw)
    except ValueError:
        raise TableQueryError(f"{name}: not a number") from None
    if not math.isfinite(value):
        raise TableQueryError(f"{name}: not a number")
    return value


def _datetime(name: str, raw: str, *, upper: bool) -> tuple[datetime, bool]:
    """The bound and whether it is exclusive (an upper bound of a date or a minute)."""
    try:
        value = datetime.fromisoformat(raw).replace(tzinfo=None)
    except ValueError:
        raise TableQueryError(f"{name}: not an ISO date") from None
    if not upper:
        return value, False
    step = {10: timedelta(days=1), 13: timedelta(hours=1), 16: timedelta(minutes=1)}.get(len(raw))
    return (value + step, True) if step else (value, False)


def _range(name: str, field: Field, params: QueryParams) -> list[ColumnElement[bool]]:
    low_key, high_key = ("_min", "_max") if field.kind == "number" else ("_from", "_to")
    low_raw = (params.get(name + low_key) or "").strip()
    high_raw = (params.get(name + high_key) or "").strip()
    col = field.column
    conditions = []
    if field.kind == "number":
        if low_raw:
            conditions.append(col >= _number(name + low_key, low_raw))
        if high_raw:
            conditions.append(col <= _number(name + high_key, high_raw))
        return conditions
    if low_raw:
        conditions.append(col >= _datetime(name + low_key, low_raw, upper=False)[0])
    if high_raw:
        bound, exclusive = _datetime(name + high_key, high_raw, upper=True)
        conditions.append(col < bound if exclusive else col <= bound)
    return conditions


def _condition(name: str, field: Field, params: QueryParams) -> list[ColumnElement[bool]]:
    if field.kind in ("number", "datetime"):
        return _range(name, field, params)

    if field.kind == "enum":
        values = list(dict.fromkeys(v for v in params.getlist(name) if v))
        if not values:
            return []
        if len(values) > MAX_VALUES:
            raise TableQueryError(f"{name}: at most {MAX_VALUES} values")
        if field.where:
            return [field.where(values)]
        try:
            return [field.column.in_([field.cast(v) for v in values])]
        except ValueError:
            raise TableQueryError(f"{name}: unknown value") from None

    text = (params.get(name) or "").strip()
    if not text:
        return []
    if len(text) > MAX_TEXT:
        raise TableQueryError(f"{name}: at most {MAX_TEXT} characters")
    if field.where:
        return [field.where(text)]
    return [field.column.like(like_pattern(text, prefix=field.kind == "prefix"), escape="\\")]


def parse(params: QueryParams, fields: Mapping[str, Field]) -> TableQuery:
    conditions = [c for name, f in fields.items() for c in _condition(name, f, params)]

    order_by: list[ColumnElement[Any]] = []
    sort = params.get("sort")
    if sort:
        if sort not in fields:
            raise TableQueryError(f"sort: unknown field {sort!r}")
        order = params.get("order") or "asc"
        if order not in ("asc", "desc"):
            raise TableQueryError("order: expected asc or desc")
        field = fields[sort]
        col = field.sort_by if field.sort_by is not None else field.column
        order_by.append(col.desc() if order == "desc" else col.asc())
    return TableQuery(conditions=conditions, order_by=order_by)
