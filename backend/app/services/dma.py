"""Nielsen DMA (designated market area) names, from the static `app/data/dma.csv`.

The list is the 210 Nielsen DMAs (from github.com/simzou/nielsen-dma, plus the four Alaska and
Hawaii DMAs it lacks); code 0 in the impression log means the region is unknown.
"""

import csv
from functools import cache
from pathlib import Path

from sqlalchemy import CTE, Integer, String, column, values

CSV_PATH = Path(__file__).resolve().parent.parent / "data" / "dma.csv"
UNKNOWN = "Unknown"


@cache
def names() -> dict[int, str]:
    with CSV_PATH.open(encoding="utf-8", newline="") as f:
        return {0: UNKNOWN} | {int(r["code"]): r["name"] for r in csv.DictReader(f)}


def search(q: str) -> list[int]:
    """Codes that start with `q` or whose name contains it, ignoring case."""
    q = q.strip().lower()
    return [code for code, name in names().items() if str(code).startswith(q) or q in name.lower()]


def table() -> CTE:
    """The names as an inline `(code, name)` table to join in queries.

    A CTE: SQLite has no syntax for naming the columns of a `VALUES` subquery.
    """
    rows = values(column("code", Integer), column("name", String), name="dma_values")
    return rows.data(list(names().items())).cte("dma")
