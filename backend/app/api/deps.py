from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import TokenError, decode_token
from app.db import User, get_db
from app.services import table

DbSession = Annotated[Session, Depends(get_db)]

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{get_settings().api_prefix}/auth/login")


def get_current_user(db: DbSession, token: Annotated[str, Depends(oauth2_scheme)]) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token, "access")
    except TokenError:
        raise credentials_error from None
    user = db.get(User, payload.user_id)
    if user is None or not user.is_active or user.token_version != payload.version:
        raise credentials_error
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def table_query(request: Request, fields: dict[str, table.Field]) -> table.TableQuery:
    """Column filters and sorting of a table endpoint, see `app.services.table`."""
    try:
        return table.parse(request.query_params, fields)
    except table.TableQueryError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(e)) from None
