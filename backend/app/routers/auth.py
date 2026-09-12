"""
Authentication Router.

Privacy-First Design:
- We never store plaintext email addresses in the user table.
- We hash the email with a secret salt using SHA-256 (`hash_identifier`).
- When a user logs in (or uses Google OAuth), we compute the hash, look up or create
  the pseudonymous user ID, and sign a standard JWT access token.

User Preferences:
- On first registration, default UserPreferences are seeded into `preferences_json`.
- Users can update their timezone, locale, currency, and market focus via PATCH /preferences.
- Preferences are stored as validated JSONB (Pydantic → dict → Postgres JSON column).
"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt

from backend.app.database import get_db
from backend.app.config import get_settings
from backend.app.models.schema import User
from backend.app.services.crypto import hash_identifier
from backend.app.schemas.auth import TokenResponse, DemoLoginRequest, GoogleAuthRequest
from backend.app.schemas.user_prefs import UserPreferences, UserPreferencesPatch
from backend.app.core.timezone import now_utc
from backend.app.core.responses import success_response

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


def create_access_token(user_id: int, expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT with user_id as the subject."""
    expire = now_utc() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "iat": now_utc(),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _get_default_preferences() -> dict:
    """Returns a serialized default UserPreferences dict for new user registration."""
    return UserPreferences().model_dump()


@router.post("/login", response_model=TokenResponse)
async def login_or_register(payload: DemoLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Privacy-First Login / Onboarding.
    1. Computes SHA-256 hash of email.
    2. Finds or creates user record with zero plaintext personal data.
    3. Seeds default UserPreferences for new registrations.
    4. Issues JWT bearer token.
    """
    hashed = hash_identifier(payload.email)

    # Query user by hash
    stmt = select(User).where(User.email_hash == hashed)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email_hash=hashed,
            auth_method="jwt",
            preferences_json=_get_default_preferences(),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/google", response_model=TokenResponse)
async def google_oauth_login(payload: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """
    Google OAuth Token Verification.
    Verifies the Google ID token and creates/authenticates the pseudonymous account.
    Seeds default UserPreferences for new OAuth registrations.
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
        hashed = hash_identifier(email) if email else hash_identifier(user_sub)

        stmt = select(User).where(User.oauth_sub == user_sub)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            user = User(
                email_hash=hashed,
                auth_method="google_oauth",
                oauth_sub=user_sub,
                preferences_json=_get_default_preferences(),
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

        token = create_access_token(user.id)
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
        )


@router.patch("/preferences")
async def update_preferences(
    patch: UserPreferencesPatch,
    db: AsyncSession = Depends(get_db),
    # TODO: Replace with real JWT dependency once auth middleware is wired
    user_id: int = 1,
):
    """
    Update user display preferences (timezone, locale, currency, market_focus).
    Performs a partial merge — only provided fields are updated.
    All other existing preferences are preserved.

    Example request body:
        {"timezone": "America/New_York", "currency": "USD", "market_focus": "US"}
    """
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Load current preferences (or seed defaults if missing)
    current_prefs = UserPreferences(**(user.preferences_json or {}))

    # Merge only non-None fields from the patch
    patch_data = patch.model_dump(exclude_none=True)
    updated_prefs = current_prefs.model_copy(update=patch_data)

    user.preferences_json = updated_prefs.model_dump()
    await db.commit()

    return success_response(
        data={"preferences": user.preferences_json},
        message="Preferences updated successfully",
    )


@router.get("/preferences")
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    user_id: int = 1,
):
    """
    Returns the current user's preferences.
    Used on app load to configure timezone display and market focus.
    """
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    prefs = UserPreferences(**(user.preferences_json or {}))
    return success_response(data={"preferences": prefs.model_dump()})
