from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings, get_settings

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None
    display_name: str | None = None
    role: str = "DOCTOR"
    active: bool = True


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing access token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or not settings.supabase_publishable_key:
        raise unauthorized
    try:
        response = httpx.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={
                "apikey": settings.supabase_publishable_key,
                "Authorization": f"Bearer {credentials.credentials}",
            },
            timeout=5.0,
        )
        response.raise_for_status()
        payload = response.json()
        metadata = payload.get("user_metadata") or {}
        return CurrentUser(
            id=payload["id"],
            email=payload.get("email"),
            display_name=metadata.get("full_name") or metadata.get("name"),
        )
    except (httpx.HTTPError, KeyError, ValueError):
        raise unauthorized from None


def require_active_user(
    user: CurrentUser = Depends(get_current_user),
):
    from app.database import get_admin_client

    rows = get_admin_client().table("profiles").select("role,active").eq("id", user.id).limit(1).execute().data
    if not rows or not rows[0]["active"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
    return CurrentUser(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=rows[0]["role"],
        active=True,
    )


def require_admin(user: CurrentUser = Depends(require_active_user)) -> CurrentUser:
    if user.role not in {"ADMIN", "SUPER_ADMIN"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required")
    return user
