"""
Authentication Router.

Privacy-First Design:
- We never store plaintext email addresses in the user table.
- We hash the email with a secret salt using SHA-256 (`hash_identifier`).
- When a user logs in (or uses Google OAuth), we compute the hash, look up or create
  the pseudonymous user ID, and sign a standard JWT access token.

Environment Guardrails:
- In production (ENVIRONMENT=production):
  * Direct demo logins (/auth/login) are strictly disabled (403 Forbidden).
  * Dev OAuth simulator (/auth/dev-oauth) is strictly disabled (403 Forbidden).
  * Bearer token is strictly required for protected operations; unauthenticated access returns 401.
- In development (ENVIRONMENT=development):
  * Unauthenticated requests transparently fall back to demo investor (id=1).
  * Demo login and Dev OAuth simulator are enabled for seamless local testing.
"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError

from backend.app.database import get_db
from backend.app.config import get_settings
from backend.app.models.schema import User
from backend.app.services.crypto import hash_identifier
from backend.app.schemas.auth import (
    TokenResponse,
    DemoLoginRequest,
    GoogleAuthRequest,
    DevOAuthRequest,
    UserOut,
)
from backend.app.schemas.user_prefs import UserPreferences, UserPreferencesPatch
from backend.app.core.timezone import now_utc
from backend.app.core.responses import success_response
from backend.app.core.logging import logger

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()
security = HTTPBearer(auto_error=False)



def create_access_token(
    user_id: int,
    role: str = "investor",
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Creates a signed JWT with user_id as the subject and role claim."""
    expire = now_utc() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
        "iat": now_utc(),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _get_default_preferences() -> dict:
    """Returns a serialized default UserPreferences dict for new user registration."""
    return UserPreferences().model_dump()


def _user_to_out(user: User) -> UserOut:
    """Converts ORM User model to UserOut schema."""
    return UserOut(
        id=user.id,
        email_hash=user.email_hash,
        display_name=user.display_name or ("Demo Investor" if user.is_demo else "Investor"),
        auth_method=user.auth_method or "jwt",
        role=user.role or "investor",
        is_demo=bool(user.is_demo),
        preferences=user.preferences_json or _get_default_preferences(),
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency to extract and verify the current authenticated user.
    - If Bearer token is provided, validates signature and loads user from DB.
    - If no Bearer token is provided:
        * In development: falls back to the demo investor account (user_id=1).
        * In production: raises 401 Unauthorized.
    """
    if credentials and credentials.credentials:
        token = credentials.credentials
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
            user_id_str = payload.get("sub")
            if not user_id_str:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload: missing subject identifier",
                )
            user_id = int(user_id_str)
        except JWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Could not validate credentials: {str(e)}",
            )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Malformed user ID in token",
            )

        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account associated with this token not found",
            )
        return user

    # No token provided: check environment guardrails
    if settings.ENVIRONMENT.lower() == "production":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # In development mode: auto-fallback to demo investor account (id=1)
    stmt = select(User).where(User.id == 1)
    result = await db.execute(stmt)
    demo_user = result.scalar_one_or_none()
    if not isinstance(demo_user, User):
        demo_user = User(
            id=1,
            email_hash=hash_identifier("demo.investor@finsight.dev"),
            auth_method="jwt",
            is_demo=True,
            display_name="Demo Investor",
            role="investor",
            preferences_json=_get_default_preferences(),
        )
        try:
            db.add(demo_user)
            await db.commit()
            await db.refresh(demo_user)
        except Exception:
            pass
    elif getattr(demo_user, "is_demo", False) is False:
        demo_user.is_demo = True
        if not getattr(demo_user, "display_name", None):
            demo_user.display_name = "Demo Investor"
        try:
            await db.commit()
            await db.refresh(demo_user)
        except Exception:
            pass

    return demo_user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    FastAPI dependency to ensure the requester has super-admin privileges.
    - If user has role="super_admin": allowed.
    - In development mode: if DEV_ADMIN_BYPASS is active, allows demo access.
    - Otherwise raises 403 Forbidden.
    """
    if current_user.role == "super_admin":
        return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Super-admin privileges required to access this administrative resource.",
    )




@router.post("/login", response_model=TokenResponse)
async def login_or_register(payload: DemoLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Demo Login / Onboarding.
    Restricted strictly to non-production environments.
    """
    if settings.ENVIRONMENT.lower() == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Direct demo logins are restricted in production. Please use OAuth login.",
        )

    hashed = hash_identifier(payload.email)

    # Query user by hash
    stmt = select(User).where(User.email_hash == hashed)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        name_part = payload.email.split("@")[0].replace(".", " ").title()
        user = User(
            email_hash=hashed,
            auth_method="jwt",
            is_demo=True,
            display_name=f"{name_part} (Demo)",
            role="investor",
            preferences_json=_get_default_preferences(),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Demo logins are strictly investor sessions; never issue super_admin tokens
    token = create_access_token(user.id, role="investor")
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=_user_to_out(user),
    )


@router.post("/dev-oauth", response_model=TokenResponse)
async def dev_oauth_login(payload: DevOAuthRequest, db: AsyncSession = Depends(get_db)):
    """
    Development OAuth Simulator.
    Simulates Google OAuth sign-in flow for testing without GCP credentials.
    Strictly restricted to non-production environments.
    """
    if settings.ENVIRONMENT.lower() == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev OAuth simulator is disabled in production.",
        )

    hashed = hash_identifier(payload.email)
    oauth_sub = f"dev_google_{hashed[:16]}"

    stmt = select(User).where(User.email_hash == hashed)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email_hash=hashed,
            auth_method="google_oauth",
            oauth_sub=oauth_sub,
            display_name=payload.display_name or "Dev Investor",
            role=payload.role or "investor",
            is_demo=False,
            preferences_json=_get_default_preferences(),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        if payload.display_name:
            user.display_name = payload.display_name
        if payload.role:
            user.role = payload.role
        user.is_demo = False
        await db.commit()
        await db.refresh(user)

    token = create_access_token(user.id, role=user.role or "investor")
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=_user_to_out(user),
    )


@router.post("/google", response_model=TokenResponse)
async def google_oauth_login(payload: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """
    Google OAuth Token Verification.
    Verifies the Google ID token and creates/authenticates the pseudonymous account.
    """
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests

        # Verify token with Google's public keys
        id_info = id_token.verify_oauth2_token(
            payload.id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )

        user_sub = id_info.get("sub")
        email = id_info.get("email", "")
        name = id_info.get("name")
        hashed = hash_identifier(email) if email else hash_identifier(user_sub)

        stmt = select(User).where(User.oauth_sub == user_sub)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user and email:
            # Also check by email_hash
            stmt_hash = select(User).where(User.email_hash == hashed)
            res_hash = await db.execute(stmt_hash)
            user = res_hash.scalar_one_or_none()

        user_role = "super_admin" if (email and email.lower() in settings.admin_emails_list) else "investor"

        if not user:
            user = User(
                email_hash=hashed,
                auth_method="google_oauth",
                oauth_sub=user_sub,
                display_name=name or (email.split("@")[0] if email else "Google Investor"),
                role=user_role,
                is_demo=False,
                preferences_json=_get_default_preferences(),
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        else:
            if not user.oauth_sub:
                user.oauth_sub = user_sub
            if name and not user.display_name:
                user.display_name = name
            # Synchronize role according to current ADMIN_EMAILS allowlist
            user.role = user_role
            user.is_demo = False
            await db.commit()
            await db.refresh(user)

        token = create_access_token(user.id, role=user.role or "investor")
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=_user_to_out(user),
        )
    except Exception as e:
        logger.error(f"Google OAuth verification failure: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
        )


@router.get("/me")
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    """
    Returns current authenticated user profile, permissions, and environment.
    """
    return success_response(
        data={
            "user": _user_to_out(current_user).model_dump(),
            "environment": settings.ENVIRONMENT,
            "is_demo_allowed": settings.ENVIRONMENT.lower() != "production",
        },
        message="User profile retrieved successfully",
    )


@router.patch("/preferences")
async def update_preferences(
    patch: UserPreferencesPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update user display preferences (timezone, locale, currency, market_focus).
    Performs a partial merge — only provided fields are updated.
    """
    current_prefs = UserPreferences(**(current_user.preferences_json or {}))

    patch_data = patch.model_dump(exclude_none=True)
    updated_prefs = current_prefs.model_copy(update=patch_data)

    current_user.preferences_json = updated_prefs.model_dump()
    await db.commit()

    return success_response(
        data={"preferences": current_user.preferences_json},
        message="Preferences updated successfully",
    )


@router.get("/preferences")
async def get_preferences(
    current_user: User = Depends(get_current_user),
):
    """
    Returns the current user's preferences.
    """
    prefs = UserPreferences(**(current_user.preferences_json or {}))
    return success_response(data={"preferences": prefs.model_dump()})
