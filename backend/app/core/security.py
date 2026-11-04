"""Authentication: verify Supabase JWTs and expose FastAPI dependencies."""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwk, jwt
from jose.exceptions import JOSEError

from app.core.config import settings

bearer = HTTPBearer(auto_error=False)

_JWKS_CACHE: dict[str, tuple[float, dict]] = {}
JWKS_TTL = 3600


def _jwks() -> dict:
    """Fetch and cache the project JWKS for asymmetric JWT verification."""
    base = settings.SUPABASE_URL.rstrip("/")
    url = f"{base}/auth/v1/.well-known/jwks.json"
    key = "jwks"
    cached = _JWKS_CACHE.get(key)
    now = time.time()
    if cached and cached[0] > now:
        return cached[1]
    with httpx.Client(timeout=15) as client:
        res = client.get(url)
        res.raise_for_status()
        payload = res.json()
    _JWKS_CACHE[key] = (now + JWKS_TTL, payload)
    return payload


@dataclass
class AuthUser:
    id: str
    email: str | None
    claims: dict


def verify_token(token: str) -> dict:
    """Verify a Supabase access token. Prefers JWKS; falls back to HS256 secret.

    Any malformed, forged or expired token is a 401 (never a 500). If the
    JWKS endpoint itself cannot be reached the backend answers 503.
    """
    try:
        header = jwt.get_unverified_header(token)
    except JOSEError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    if settings.SUPABASE_JWT_SECRET and header.get("alg") == "HS256":
        try:
            return jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_aud": False},
            )
        except JOSEError as exc:
            raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc

    kid = header.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="Invalid token header")
    try:
        keys = _jwks().get("keys", [])
        key_data = next((k for k in keys if k.get("kid") == kid), None)
        if key_data is None:
            # Refresh cache once on unknown kid (key rotation).
            _JWKS_CACHE.pop("jwks", None)
            keys = _jwks().get("keys", [])
            key_data = next((k for k in keys if k.get("kid") == kid), None)
        if key_data is None:
            raise HTTPException(status_code=401, detail="Signing key not found")
        public_key = jwk.construct(key_data)
        return jwt.decode(
            token,
            public_key,
            algorithms=[key_data.get("alg", "RS256")],
            audience="authenticated",
            options={"verify_aud": False},
        )
    except HTTPException:
        raise
    except JOSEError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503,
            detail="Cannot verify sign-in: the auth signing keys (SUPABASE_URL JWKS) are unreachable.",
        ) from exc


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> AuthUser:
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    claims = verify_token(credentials.credentials)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject")
    return AuthUser(id=user_id, email=claims.get("email"), claims=claims)


def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> AuthUser | None:
    """Public endpoints: the verified user when a valid token is sent, else None.

    A missing, malformed, forged or expired token means "guest" (None), never
    an error — guests only ever get public data. If the signing keys cannot be
    reached (503) the error is still raised so it is visible.
    """
    if credentials is None or not credentials.credentials:
        return None
    try:
        claims = verify_token(credentials.credentials)
    except HTTPException as exc:
        if exc.status_code == 401:
            return None
        raise
    user_id = claims.get("sub")
    if not user_id:
        return None
    return AuthUser(id=user_id, email=claims.get("email"), claims=claims)


def is_admin(user: AuthUser) -> bool:
    """Check the user_roles table for an admin/moderator role.

    Runs through a RLS-respecting session; falls back to a direct check when
    the caller is a service connection.
    """
    from sqlalchemy import text

    from app.db import SessionLocal

    with SessionLocal() as session:
        session.execute(
            text("select set_config('request.jwt.claims', :claims, true)"),
            {"claims": f'{{"sub": "{user.id}", "role": "authenticated"}}'},
        )
        row = session.execute(
            text("select exists (select 1 from public.user_roles ur where ur.user_id = :uid and ur.role in ('admin','moderator'))"),
            {"uid": user.id},
        ).scalar()
        return bool(row)


def require_admin(user: Annotated[AuthUser, Depends(get_current_user)]) -> AuthUser:
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


# Type aliases for route dependencies. get_db/get_admin_db live in app.db to
# avoid an import cycle (app.db imports AuthUser from here).
CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
AdminUser = Annotated[AuthUser, Depends(require_admin)]
OptionalUser = Annotated[AuthUser | None, Depends(get_optional_user)]


def not_found(detail: str = "Not found") -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
