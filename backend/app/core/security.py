from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Literal

import jwt
from pwdlib import PasswordHash

from app.config import get_settings

TokenType = Literal["access", "refresh"]

_password_hash = PasswordHash.recommended()  # argon2id


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)


@lru_cache
def _dummy_hash() -> str:
    return hash_password("dummy-password-for-timing")


def burn_password_check(password: str) -> None:
    """Spend the same time as a real check, so unknown usernames aren't revealed by timing."""
    _password_hash.verify(password, _dummy_hash())


class TokenError(Exception):
    pass


@dataclass(frozen=True)
class TokenPayload:
    user_id: int
    version: int


def token_ttl(token_type: TokenType) -> timedelta:
    settings = get_settings()
    if token_type == "access":
        return timedelta(minutes=settings.access_token_ttl_minutes)
    return timedelta(days=settings.refresh_token_ttl_days)


def create_token(user_id: int, token_version: int, token_type: TokenType) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "ver": token_version,
        "type": token_type,
        "iat": now,
        "exp": now + token_ttl(token_type),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str, expected_type: TokenType) -> TokenPayload:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub", "type", "ver"]},
        )
        if payload["type"] != expected_type:
            raise TokenError("unexpected token type")
        return TokenPayload(user_id=int(payload["sub"]), version=int(payload["ver"]))
    except (jwt.PyJWTError, ValueError, TypeError) as e:
        raise TokenError(str(e)) from e
