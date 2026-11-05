from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.data_sync import sync

# uid "b" has two impressions; "zzz" has none. vregistration counts as registration.
X_CSV = """reg_time,uid,fc_imp_chk,fc_time_chk,utmtr,mm_dma,osName,model,hardware,site_id
2021-07-21 10:05:00,a,0,7,3,500,iOS,iPhone,Mobile Phone,s1.com
2021-07-21 10:30:00,b,0,7,3,500,iOS,iPhone,Mobile Phone,s2.com
2021-07-21 11:10:00,b,1,2,3,600,iOS,iPhone,Mobile Phone,s2.com
2021-07-22 09:00:00,c,0,7,2,600,iOS,iPhone,Mobile Phone,s1.com
"""
Y_CSV = """uid,tag
a,fclick
a,registration
b,fclick
b,vregistration
zzz,fclick
"""


@pytest.fixture(scope="module")
def client(tmp_path_factory: pytest.TempPathFactory) -> Iterator[TestClient]:
    d = tmp_path_factory.mktemp("metrics")
    (d / "x.csv").write_text(X_CSV)
    (d / "y.csv").write_text(Y_CSV)
    with TestClient(app) as c:
        sync(d / "x.csv", d / "y.csv", force=True)
        yield c


def get(client: TestClient, headers: dict[str, str], path: str, **params) -> dict:
    res = client.get(f"/api/metrics{path}", params=params, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def test_requires_auth(client: TestClient) -> None:
    assert client.get("/api/metrics/timeseries").status_code == 401


def test_event_types_merge_view_through(client: TestClient, auth_headers: dict) -> None:
    body = get(client, auth_headers, "/event-types")
    assert body == {"tags": ["fclick", "registration"], "click_tag": "fclick"}


@pytest.mark.parametrize(
    ("mode", "clicks", "events"),
    [("first", [2, 0, 0], [2, 0, 0]), ("all", [2, 1, 0], [2, 1, 0])],
)
def test_timeseries_hourly(
    client: TestClient, auth_headers: dict, mode: str, clicks: list[int], events: list[int]
) -> None:
    body = get(client, auth_headers, "/timeseries", tag="registration", mode=mode)
    points = body["points"]
    assert [p["ts"] for p in points] == [
        "2021-07-21T10:00:00",
        "2021-07-21T11:00:00",
        "2021-07-22T09:00:00",
    ]
    assert [p["impressions"] for p in points] == [2, 1, 1]
    assert [p["clicks"] for p in points] == clicks
    assert [p["events"] for p in points] == events
    assert points[0]["ctr"] == 100.0
    assert points[0]["evpm"] == 1000.0


def test_timeseries_daily_totals(client: TestClient, auth_headers: dict) -> None:
    first = get(client, auth_headers, "/timeseries", tag="registration", granularity="day")
    assert [(p["ts"], p["impressions"]) for p in first["points"]] == [
        ("2021-07-21T00:00:00", 3),
        ("2021-07-22T00:00:00", 1),
    ]
    # The orphan "zzz" click is not counted
    assert first["totals"] == {
        "impressions": 4,
        "clicks": 2,
        "events": 2,
        "ctr": 50.0,
        "evpm": 500.0,
    }
    every = get(client, auth_headers, "/timeseries", tag="registration", mode="all")
    assert every["totals"]["ctr"] == 75.0
    assert every["totals"]["evpm"] == 750.0


def test_aggregate_by_dma(client: TestClient, auth_headers: dict) -> None:
    body = get(client, auth_headers, "/aggregates/mm_dma", mode="all", sort="key", order="asc")
    assert [(r["key"], r["impressions"], r["clicks"], r["ctr"]) for r in body["items"]] == [
        ("500", 2, 2, 100.0),
        ("600", 2, 1, 50.0),
    ]
    assert body["total"] == 2
    assert body["totals"]["clicks"] == 3


def test_aggregate_sort_search_and_paging(client: TestClient, auth_headers: dict) -> None:
    # mode=all: s1.com 1/2 clicks (50%), s2.com 2/2 (100%)
    body = get(
        client,
        auth_headers,
        "/aggregates/site_id",
        mode="all",
        sort="ctr",
        order="asc",
        page_size=1,
    )
    assert [r["key"] for r in body["items"]] == ["s1.com"]
    assert body["total"] == 2
    body = get(
        client, auth_headers, "/aggregates/site_id", mode="all", sort="ctr", page=2, page_size=1
    )
    assert [r["key"] for r in body["items"]] == ["s1.com"]

    body = get(client, auth_headers, "/aggregates/site_id", q="s1")
    assert [r["key"] for r in body["items"]] == ["s1.com"]
    assert body["totals"]["impressions"] == 2

    body = get(client, auth_headers, "/aggregates/site_id", min_impressions=3)
    assert body["items"] == []


def test_aggregate_rejects_unknown_dimension(client: TestClient, auth_headers: dict) -> None:
    res = client.get("/api/metrics/aggregates/os_name", headers=auth_headers)
    assert res.status_code == 422
