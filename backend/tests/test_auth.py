from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.db import SessionLocal, User
from app.main import app
from app.services import users

PASSWORD = "correct-horse"


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:  # runs lifespan -> creates tables
        yield c


@pytest.fixture
def user(client: TestClient) -> Iterator[User]:
    with SessionLocal() as db:
        u = users.create_user(db, "Alice", PASSWORD)
    yield u
    with SessionLocal() as db:
        db.delete(db.get(User, u.id))
        db.commit()


def login(client: TestClient, username: str = "alice", password: str = PASSWORD):
    return client.post("/api/auth/login", data={"username": username, "password": password})


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_login_and_me(client: TestClient, user: User) -> None:
    res = login(client, username=" ALICE ")
    assert res.status_code == 200
    body = res.json()
    assert body["token_type"] == "bearer"
    assert "refresh_token" in res.cookies

    me = client.get("/api/auth/me", headers=auth_header(body["access_token"]))
    assert me.status_code == 200
    assert me.json() == {"id": user.id, "username": "alice"}


@pytest.mark.parametrize(("username", "password"), [("alice", "wrong-pass"), ("bob", PASSWORD)])
def test_login_rejects_bad_credentials(
    client: TestClient, user: User, username: str, password: str
) -> None:
    assert login(client, username, password).status_code == 401


def test_me_requires_token(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers=auth_header("garbage")).status_code == 401


def test_refresh_token_is_not_access_token(client: TestClient, user: User) -> None:
    refresh = login(client).cookies["refresh_token"]
    assert client.get("/api/auth/me", headers=auth_header(refresh)).status_code == 401


def test_refresh_issues_new_access_token(client: TestClient, user: User) -> None:
    login(client)
    res = client.post("/api/auth/refresh")
    assert res.status_code == 200
    me = client.get("/api/auth/me", headers=auth_header(res.json()["access_token"]))
    assert me.status_code == 200


def test_refresh_without_cookie(client: TestClient) -> None:
    assert client.post("/api/auth/refresh").status_code == 401


def test_logout_revokes_tokens(client: TestClient, user: User) -> None:
    access = login(client).json()["access_token"]
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me", headers=auth_header(access)).status_code == 401
    assert client.post("/api/auth/refresh").status_code == 401


def test_inactive_user_cannot_login(client: TestClient, user: User) -> None:
    with SessionLocal() as db:
        db.get(User, user.id).is_active = False
        db.commit()
    assert login(client).status_code == 401


def test_set_password_revokes_sessions(client: TestClient, user: User) -> None:
    access = login(client).json()["access_token"]
    with SessionLocal() as db:
        users.set_password(db, db.get(User, user.id), "new-password")
    assert client.get("/api/auth/me", headers=auth_header(access)).status_code == 401
    assert login(client, password="new-password").status_code == 200


def test_password_is_hashed(user: User) -> None:
    assert user.password_hash != PASSWORD
    assert user.password_hash.startswith("$argon2")
