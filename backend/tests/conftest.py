import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

# Must be set before `app` is imported: settings and the engine are created at import time.
_tmp = Path(tempfile.mkdtemp())
os.environ["DB_PATH"] = str(_tmp / "test.db")
os.environ["JWT_SECRET"] = "test-secret-" + "x" * 32


import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="module")
def auth_headers(client: TestClient) -> Iterator[dict[str, str]]:
    """Authorization header of a throwaway user; needs a module-level `client` fixture."""
    from app.db import SessionLocal, User
    from app.services import users

    username, password = "fixture-reader", "fixture-reader-pass"
    with SessionLocal() as db:
        user = users.create_user(db, username, password)
    res = client.post("/api/auth/login", data={"username": username, "password": password})
    yield {"Authorization": f"Bearer {res.json()['access_token']}"}
    with SessionLocal() as db:
        db.delete(db.get(User, user.id))
        db.commit()
