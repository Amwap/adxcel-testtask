from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import burn_password_check, hash_password, verify_password
from app.db.models import User

MIN_PASSWORD_LENGTH = 8


def normalize_username(username: str) -> str:
    return username.strip().lower()


def get_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == normalize_username(username)))


def authenticate(db: Session, username: str, password: str) -> User | None:
    user = get_by_username(db, username)
    if user is None:
        burn_password_check(password)
        return None
    if not verify_password(password, user.password_hash) or not user.is_active:
        return None
    return user


def validate_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"password must be at least {MIN_PASSWORD_LENGTH} characters")


def create_user(db: Session, username: str, password: str) -> User:
    username = normalize_username(username)
    if not username:
        raise ValueError("username must not be empty")
    if get_by_username(db, username) is not None:
        raise ValueError(f"user {username!r} already exists")
    validate_password(password)
    user = User(username=username, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    return user


def set_password(db: Session, user: User, password: str) -> None:
    """Change password and revoke all sessions of the user."""
    validate_password(password)
    user.password_hash = hash_password(password)
    user.token_version += 1
    db.commit()


def revoke_tokens(db: Session, user: User) -> None:
    user.token_version += 1
    db.commit()
