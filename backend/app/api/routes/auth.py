from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import CurrentUser, DbSession
from app.config import get_settings
from app.core.security import TokenError, create_token, decode_token, token_ttl
from app.db import User
from app.schemas.auth import TokenResponse, UserRead
from app.services import users

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"


def _cookie_path() -> str:
    return f"{get_settings().api_prefix}/auth"


def _issue_tokens(response: Response, user: User) -> TokenResponse:
    """Access token goes into the body, refresh token into an httpOnly cookie."""
    response.set_cookie(
        REFRESH_COOKIE,
        create_token(user.id, user.token_version, "refresh"),
        max_age=int(token_ttl("refresh").total_seconds()),
        path=_cookie_path(),
        httponly=True,
        secure=get_settings().cookie_secure,
        samesite="strict",
    )
    return TokenResponse(
        access_token=create_token(user.id, user.token_version, "access"),
        expires_in=int(token_ttl("access").total_seconds()),
    )


def _user_from_refresh_cookie(request: Request, db: DbSession) -> User | None:
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        return None
    try:
        payload = decode_token(token, "refresh")
    except TokenError:
        return None
    user = db.get(User, payload.user_id)
    if user is None or not user.is_active or user.token_version != payload.version:
        return None
    return user


@router.post("/login")
def login(
    response: Response,
    db: DbSession,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> TokenResponse:
    user = users.authenticate(db, form.username, form.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _issue_tokens(response, user)


@router.post("/refresh")
def refresh(request: Request, response: Response, db: DbSession) -> TokenResponse:
    user = _user_from_refresh_cookie(request, db)
    if user is None:
        response.delete_cookie(REFRESH_COOKIE, path=_cookie_path())
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    return _issue_tokens(response, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: DbSession) -> None:
    user = _user_from_refresh_cookie(request, db)
    if user is not None:
        users.revoke_tokens(db, user)
    response.delete_cookie(REFRESH_COOKIE, path=_cookie_path())


@router.get("/me")
def me(user: CurrentUser) -> UserRead:
    return UserRead(id=user.id, username=user.username)
