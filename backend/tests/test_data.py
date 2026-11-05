import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.data_sync import sync

X_CSV = """reg_time,uid,fc_imp_chk,fc_time_chk,utmtr,mm_dma,osName,model,hardware,site_id
2021-07-21 19:25:47,aaa-1,0,7,6,530,iOS,iPhone XR,Mobile Phone,soaps.sheknows.com
2021-07-21 19:25:51,aaa-2,0,7,6,612,iOS,iPhone,Mobile Phone,www.forbes.com
2021-07-21 19:26:00,bbb-1,1,2,6,612,Android,SM-G960U,Mobile Phone,www.forbes.com
2021-07-21 19:27:00,ccc-1,-1,-1,-1,501,,,,news.example.org
"""
Y_CSV = """uid,tag
aaa-2,fclick
aaa-2,registration
bbb-1,vcontent
zzz-9,fclick
"""


@pytest.fixture(scope="module")
def csv_files(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path]:
    d = tmp_path_factory.mktemp("csv")
    (d / "interview.X.csv").write_text(X_CSV)
    (d / "interview.y.csv").write_text(Y_CSV)
    return d / "interview.X.csv", d / "interview.y.csv"


@pytest.fixture(scope="module")
def client(csv_files: tuple[Path, Path]) -> Iterator[TestClient]:
    with TestClient(app) as c:
        sync(*csv_files, force=True)
        yield c


def test_sync_skips_unchanged_files(client: TestClient, csv_files: tuple[Path, Path]) -> None:
    assert all(r.skipped for r in sync(*csv_files))

    x, y = csv_files
    os.utime(y, ns=(0, y.stat().st_mtime_ns + 1_000_000))
    results = {r.table: r for r in sync(x, y)}
    assert results["impressions"].skipped
    assert not results["events"].skipped
    assert results["events"].rows == 4


def test_data_requires_auth(client: TestClient) -> None:
    for path in ("/api/summary", "/api/impressions", "/api/events"):
        assert client.get(path).status_code == 401


def test_summary(client: TestClient, auth_headers: dict[str, str]) -> None:
    body = client.get("/api/summary", headers=auth_headers).json()
    assert {s["table"]: s["rows"] for s in body["sources"]} == {"events": 4, "impressions": 4}
    assert {"tag": "fclick", "count": 2} in body["event_tags"]


def test_impressions_pagination(client: TestClient, auth_headers: dict[str, str]) -> None:
    body = client.get("/api/impressions?page=2&page_size=3", headers=auth_headers).json()
    assert body["total"] == 4
    assert [i["uid"] for i in body["items"]] == ["ccc-1"]
    assert body["items"][0]["os_name"] is None


def get_uids(client: TestClient, headers: dict[str, str], path: str, **params) -> list[str]:
    res = client.get(f"/api/{path}", params=params, headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == len(body["items"])
    return [i["uid"] for i in body["items"]]


@pytest.mark.parametrize(
    ("params", "uids"),
    [
        ({"site_id": "forbes"}, ["aaa-2", "bbb-1"]),  # substring
        ({"uid": "AAA"}, ["aaa-1", "aaa-2"]),  # prefix, case-insensitive
        ({"uid": "-1"}, []),  # prefix only
        ({"model": "phone xr"}, ["aaa-1"]),
        ({"site_id": "%"}, []),  # LIKE wildcards are literal
        ({"mm_dma_min": 600, "mm_dma_max": 612}, ["aaa-2", "bbb-1"]),
        (
            {"reg_time_from": "2021-07-21T19:25:50", "reg_time_to": "2021-07-21T19:26"},
            ["aaa-2", "bbb-1"],
        ),
        ({"reg_time_to": "2021-07-20"}, []),
        ({"os_name": ["Android", "Symbian"]}, ["bbb-1"]),
        ({"fc_imp_chk": ["-1", "1"]}, ["bbb-1", "ccc-1"]),
        ({"events": "vcontent"}, ["bbb-1"]),
        ({"events": ["fclick", "vcontent"]}, ["aaa-2", "bbb-1"]),
        ({"site_id": "forbes", "os_name": "iOS"}, ["aaa-2"]),  # conditions combine
    ],
)
def test_impressions_filters(
    client: TestClient, auth_headers: dict[str, str], params: dict, uids: list[str]
) -> None:
    assert get_uids(client, auth_headers, "impressions", **params) == uids


@pytest.mark.parametrize(
    ("params", "uids"),
    [
        ({"sort": "mm_dma"}, ["ccc-1", "aaa-1", "aaa-2", "bbb-1"]),  # ties keep log order
        ({"sort": "mm_dma", "order": "desc"}, ["aaa-2", "bbb-1", "aaa-1", "ccc-1"]),
        ({"sort": "events", "order": "desc"}, ["aaa-2", "bbb-1", "aaa-1", "ccc-1"]),
        ({"sort": "site_id", "os_name": "iOS"}, ["aaa-1", "aaa-2"]),
    ],
)
def test_impressions_sort(
    client: TestClient, auth_headers: dict[str, str], params: dict, uids: list[str]
) -> None:
    assert get_uids(client, auth_headers, "impressions", **params) == uids


@pytest.mark.parametrize(
    "params",
    [
        {"mm_dma_min": "abc"},
        {"mm_dma_max": "inf"},
        {"reg_time_from": "yesterday"},
        {"fc_imp_chk": "x"},
        {"sort": "password"},
        {"sort": "uid", "order": "up"},
        {"site_id": "x" * 101},
    ],
)
def test_impressions_reject_bad_filters(
    client: TestClient, auth_headers: dict[str, str], params: dict
) -> None:
    res = client.get("/api/impressions", params=params, headers=auth_headers)
    assert res.status_code == 422


def test_impressions_include_events(client: TestClient, auth_headers: dict[str, str]) -> None:
    res = client.get("/api/impressions", params={"uid": "aaa-2"}, headers=auth_headers)
    assert res.json()["items"][0]["events"] == ["fclick", "registration"]


def test_events_filter_and_join(client: TestClient, auth_headers: dict[str, str]) -> None:
    body = client.get("/api/events", params={"tag": "fclick"}, headers=auth_headers).json()
    assert body["total"] == 2
    by_uid = {e["uid"]: e for e in body["items"]}
    assert by_uid["aaa-2"]["site_id"] == "www.forbes.com"
    assert by_uid["zzz-9"]["site_id"] is None  # event without an impression

    assert get_uids(client, auth_headers, "events", uid="bbb") == ["bbb-1"]
    assert get_uids(client, auth_headers, "events", site_id="FORBES", tag="vcontent") == ["bbb-1"]
    assert get_uids(
        client, auth_headers, "events", reg_time_from="2021-07-21T19:26", sort="uid"
    ) == ["bbb-1"]
    # Events without an impression have no time and come last in descending order
    assert get_uids(client, auth_headers, "events", sort="reg_time", order="desc") == [
        "bbb-1",
        "aaa-2",
        "aaa-2",
        "zzz-9",
    ]


def test_summary_facets(client: TestClient, auth_headers: dict[str, str]) -> None:
    facets = client.get("/api/summary", headers=auth_headers).json()["impression_facets"]
    assert facets["os_name"] == [{"value": "iOS", "count": 2}, {"value": "Android", "count": 1}]
    assert facets["hardware"] == [{"value": "Mobile Phone", "count": 3}]


def test_page_size_is_limited(client: TestClient, auth_headers: dict[str, str]) -> None:
    assert client.get("/api/impressions?page_size=1000", headers=auth_headers).status_code == 422
