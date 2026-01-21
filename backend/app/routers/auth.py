"""Simple password authentication router."""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Response, Cookie
from pydantic import BaseModel
import hashlib
import secrets

from app.config import settings

router = APIRouter()

# Simple token storage (in-memory, resets on server restart)
valid_tokens: dict[str, datetime] = {}

TOKEN_EXPIRE_DAYS = 30


def generate_token() -> str:
    """Generate a secure random token."""
    return secrets.token_urlsafe(32)


def hash_password(password: str) -> str:
    """Simple password hash for comparison."""
    return hashlib.sha256(password.encode()).hexdigest()


class LoginRequest(BaseModel):
    password: str


class AuthStatus(BaseModel):
    authenticated: bool


@router.post("/login")
def login(request: LoginRequest, response: Response):
    """Verify password and set auth cookie."""
    if request.password == settings.auth_password:
        token = generate_token()
        valid_tokens[token] = datetime.now() + timedelta(days=TOKEN_EXPIRE_DAYS)

        response.set_cookie(
            key="auth_token",
            value=token,
            httponly=True,
            max_age=TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
            samesite="lax",
        )
        return {"success": True}

    raise HTTPException(status_code=401, detail="密码错误")


@router.post("/logout")
def logout(response: Response, auth_token: Optional[str] = Cookie(None)):
    """Clear auth cookie."""
    if auth_token and auth_token in valid_tokens:
        del valid_tokens[auth_token]

    response.delete_cookie(key="auth_token")
    return {"success": True}


@router.get("/check", response_model=AuthStatus)
def check_auth(auth_token: Optional[str] = Cookie(None)):
    """Check if user is authenticated."""
    if not auth_token:
        return AuthStatus(authenticated=False)

    if auth_token not in valid_tokens:
        return AuthStatus(authenticated=False)

    # Check if token is expired
    if datetime.now() > valid_tokens[auth_token]:
        del valid_tokens[auth_token]
        return AuthStatus(authenticated=False)

    return AuthStatus(authenticated=True)
