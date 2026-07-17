import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import CurrentUser, bearer, get_current_user
from app.config import Settings, get_settings
from app.schemas import AuthTokens, AuthUser, LoginRequest, RefreshTokenRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_headers(settings: Settings) -> dict[str, str]:
    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase Cloud is not configured",
        )
    return {
        "apikey": settings.supabase_publishable_key,
        "Content-Type": "application/json",
    }


def _tokens(payload: dict) -> AuthTokens:
    return AuthTokens(
        access_token=payload["access_token"],
        refresh_token=payload["refresh_token"],
        expires_in=payload["expires_in"],
        expires_at=payload.get("expires_at"),
    )


@router.post("/login", response_model=AuthTokens)
def login(payload: LoginRequest, settings: Settings = Depends(get_settings)):
    try:
        response = httpx.post(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/token",
            params={"grant_type": "password"},
            headers=_auth_headers(settings),
            json={"email": payload.email, "password": payload.password},
            timeout=10.0,
        )
        if response.status_code in {400, 401}:
            raise HTTPException(status_code=401, detail="Email or password is incorrect")
        response.raise_for_status()
        return _tokens(response.json())
    except HTTPException:
        raise
    except (httpx.HTTPError, KeyError, ValueError):
        raise HTTPException(status_code=502, detail="Supabase Auth is unavailable") from None


@router.post("/refresh", response_model=AuthTokens)
def refresh(payload: RefreshTokenRequest, settings: Settings = Depends(get_settings)):
    try:
        response = httpx.post(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/token",
            params={"grant_type": "refresh_token"},
            headers=_auth_headers(settings),
            json={"refresh_token": payload.refresh_token},
            timeout=10.0,
        )
        if response.status_code in {400, 401}:
            raise HTTPException(status_code=401, detail="Refresh token is invalid or expired")
        response.raise_for_status()
        return _tokens(response.json())
    except HTTPException:
        raise
    except (httpx.HTTPError, KeyError, ValueError):
        raise HTTPException(status_code=502, detail="Supabase Auth is unavailable") from None


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing access token")
    try:
        response = httpx.post(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/logout",
            headers={
                **_auth_headers(settings),
                "Authorization": f"Bearer {credentials.credentials}",
            },
            timeout=10.0,
        )
        if response.status_code == 401:
            raise HTTPException(status_code=401, detail="Access token is invalid or expired")
        response.raise_for_status()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Supabase Auth is unavailable") from None


@router.get("/me", response_model=AuthUser)
def me(user: CurrentUser = Depends(get_current_user)):
    return {"id": user.id, "email": user.email}
