"""
FinSight User Preferences Schema.

Defines a typed, validated schema for the `preferences_json` JSONB column on the User model.
This schema is persisted as a plain Python dict in Postgres (via SQLAlchemy's JSON column).

Design:
  - All defaults are India-first (IST, INR, en-IN).
  - `timezone` uses IANA timezone strings compatible with Python's `zoneinfo` module.
  - `market_focus` drives which data providers and exchanges are prioritized in the UI.

Usage:
    # On registration (seed defaults):
    user.preferences_json = UserPreferences().model_dump()

    # On update (merge, preserve existing keys):
    prefs = UserPreferences(**(user.preferences_json or {}))
    updated = prefs.model_copy(update=patch.model_dump(exclude_none=True))
    user.preferences_json = updated.model_dump()

    # In services (read user timezone):
    user_tz = (user.preferences_json or {}).get("timezone", "Asia/Kolkata")
"""

from typing import Literal
from pydantic import BaseModel, Field


class UserPreferences(BaseModel):
    """
    Validated user preference settings stored as JSONB in the users table.
    All fields have safe defaults aligned with India-first product strategy.
    """
    # IANA timezone string — used by zoneinfo to display times in user's local time
    # Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
    timezone: str = Field(
        default="Asia/Kolkata",
        description="IANA timezone string (e.g. 'Asia/Kolkata', 'America/New_York')",
    )

    # BCP 47 locale for number/date formatting on the frontend
    locale: str = Field(
        default="en-IN",
        description="BCP 47 locale string for frontend number and date formatting",
    )

    # ISO 4217 currency code for portfolio display
    currency: Literal["INR", "USD", "EUR", "GBP"] = Field(
        default="INR",
        description="Preferred display currency for portfolio values",
    )

    # Market focus drives default exchange tabs and provider priority
    market_focus: Literal["IN", "US", "GLOBAL"] = Field(
        default="IN",
        description="Primary market interest: IN=NSE/BSE, US=NYSE/NASDAQ, GLOBAL=both",
    )

    # Whether to receive email digest (placeholder for Phase 4 notifications)
    email_digest: bool = Field(
        default=False,
        description="Whether to receive weekly email portfolio summary",
    )


class UserPreferencesPatch(BaseModel):
    """
    Partial update schema for PATCH /auth/preferences.
    All fields are optional — only provided fields are updated.
    """
    timezone: str | None = None
    locale: str | None = None
    currency: Literal["INR", "USD", "EUR", "GBP"] | None = None
    market_focus: Literal["IN", "US", "GLOBAL"] | None = None
    email_digest: bool | None = None
