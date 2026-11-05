"""Manage application users (there is no public sign-up).

python -m scripts.users create alice              # prompts for password
python -m scripts.users create alice --password secret123
python -m scripts.users set-password alice        # also logs the user out everywhere
python -m scripts.users deactivate alice
python -m scripts.users activate alice
python -m scripts.users list
"""

import argparse
import getpass
import sys

from sqlalchemy import select

from app.db import SessionLocal, User, init_db
from app.services import users


def _read_password(given: str | None) -> str:
    if given is not None:
        return given
    password = getpass.getpass("Password: ")
    if password != getpass.getpass("Repeat password: "):
        raise ValueError("passwords do not match")
    return password


def _get_user(db, username: str) -> User:
    user = users.get_by_username(db, username)
    if user is None:
        raise ValueError(f"user {username!r} not found")
    return user


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)

    for name in ("create", "set-password"):
        p = sub.add_parser(name)
        p.add_argument("username")
        p.add_argument("--password", help="non-interactive; prefer the prompt")
    for name in ("activate", "deactivate"):
        sub.add_parser(name).add_argument("username")
    sub.add_parser("list")

    args = parser.parse_args()
    init_db()

    with SessionLocal() as db:
        try:
            match args.command:
                case "create":
                    user = users.create_user(db, args.username, _read_password(args.password))
                    print(f"created user {user.username!r} (id={user.id})")
                case "set-password":
                    user = _get_user(db, args.username)
                    users.set_password(db, user, _read_password(args.password))
                    print(f"password updated for {user.username!r}")
                case "activate" | "deactivate":
                    user = _get_user(db, args.username)
                    user.is_active = args.command == "activate"
                    user.token_version += 1
                    db.commit()
                    print(f"user {user.username!r} {args.command}d")
                case "list":
                    for u in db.scalars(select(User).order_by(User.id)):
                        state = "active" if u.is_active else "inactive"
                        print(f"{u.id:>4}  {u.username:<32} {state:<8} {u.created_at:%Y-%m-%d}")
        except ValueError as e:
            sys.exit(f"error: {e}")


if __name__ == "__main__":
    main()
