import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.db import SessionLocal, User
from app.main import app
from app.services import users
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


@pytest.fixture(scope="module")
def headers(client: TestClient) -> Iterator[dict[str, str]]:
    with SessionLocal() as db:
        user = users.create_user(db, "data-reader", "data-reader-pass")
    token = client.post(
        "/api/auth/login", data={"username": "data-reader", "password": "data-reader-pass"}
    ).json()["access_token"]
    yield {"Authorization": f"Bearer {token}"}
    with SessionLocal() as db:
        db.delete(db.get(User, user.id))
        db.commit()


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


def test_summary(client: TestClient, headers: dict[str, str]) -> None:
    body = client.get("/api/summary", headers=headers).json()
    assert {s["table"]: s["rows"] for s in body["sources"]} == {"events": 4, "impressions": 4}
    assert {"tag": "fclick", "count": 2} in body["event_tags"]


def test_impressions_pagination(client: TestClient, headers: dict[str, str]) -> None:
    body = client.get("/api/impressions?page=2&page_size=3", headers=headers).json()
    assert body["total"] == 4
    assert [i["uid"] for i in body["items"]] == ["ccc-1"]
    assert body["items"][0]["os_name"] is None


@pytest.mark.parametrize(
    ("q", "uids"),
    [
        ("forbes", ["aaa-2", "bbb-1"]),  # site substring
        ("AAA", ["aaa-1", "aaa-2"]),  # uid prefix, case-insensitive
        ("phone xr", ["aaa-1"]),  # device model substring
        ("%", []),  # LIKE wildcards are literal
        ("nothing", []),
    ],
)
def test_impressions_search(
    client: TestClient, headers: dict[str, str], q: str, uids: list[str]
) -> None:
    body = client.get("/api/impressions", params={"q": q}, headers=headers).json()
    assert [i["uid"] for i in body["items"]] == uids
    assert body["total"] == len(uids)


def test_impressions_include_events(client: TestClient, headers: dict[str, str]) -> None:
    items = client.get("/api/impressions", params={"q": "aaa-2"}, headers=headers).json()["items"]
    assert items[0]["events"] == ["fclick", "registration"]


def test_events_filter_and_join(client: TestClient, headers: dict[str, str]) -> None:
    body = client.get("/api/events", params={"tag": "fclick"}, headers=headers).json()
    assert body["total"] == 2
    by_uid = {e["uid"]: e for e in body["items"]}
    assert by_uid["aaa-2"]["site_id"] == "www.forbes.com"
    assert by_uid["zzz-9"]["site_id"] is None  # event without an impression

    body = client.get("/api/events", params={"q": "bbb"}, headers=headers).json()
    assert [e["tag"] for e in body["items"]] == ["vcontent"]


def test_page_size_is_limited(client: TestClient, headers: dict[str, str]) -> None:
    assert client.get("/api/impressions?page_size=1000", headers=headers).status_code == 422
