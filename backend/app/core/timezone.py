"""
FinSight Timezone Utility Module.

Design:
- Single source of truth for all timezone constants across the system.
- Uses Python's built-in `zoneinfo` (Python 3.9+, zero extra packages).
- `tzdata` pip package required in Docker (Linux images don't ship IANA timezone DB by default).

Exchange Coverage:
  - NSE / BSE → Asia/Kolkata (IST, UTC+5:30, permanently — India has NO daylight saving)
  - NYSE / NASDAQ → America/New_York (EST UTC-5 in winter, EDT UTC-4 in summer — DST-aware)
  - Crypto → UTC (24/7, no timezone concept)

NOTE: Market holiday calendars (NSE/NYSE) are deferred to Phase 3 (Agent 3 Market Monitor).
Currently only weekday checks are performed.
"""

from datetime import datetime, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Optional


# ---------------------------------------------------------------------------
# Exchange Timezone Constants
# ---------------------------------------------------------------------------
TZ_IST = ZoneInfo("Asia/Kolkata")       # India Standard Time — NSE, BSE (no DST, always UTC+5:30)
TZ_ET  = ZoneInfo("America/New_York")   # Eastern Time — NYSE, NASDAQ (EST/EDT, DST-aware automatically)
TZ_UTC = ZoneInfo("UTC")


# ---------------------------------------------------------------------------
# Market Trading Hours (local exchange time)
# ---------------------------------------------------------------------------
NSE_OPEN   = time(9, 15)    # 09:15 IST
NSE_CLOSE  = time(15, 30)   # 15:30 IST

NYSE_OPEN  = time(9, 30)    # 09:30 ET
NYSE_CLOSE = time(16, 0)    # 16:00 ET


# ---------------------------------------------------------------------------
# Core Datetime Utilities
# ---------------------------------------------------------------------------

def now_utc() -> datetime:
    """
    Returns the current datetime as a timezone-aware UTC datetime.
    Replaces all uses of the deprecated `datetime.utcnow()` which returns
    a naive datetime (no tzinfo) and causes comparison bugs with tz-aware datetimes.
    """
    return datetime.now(TZ_UTC)


def to_user_tz(dt: datetime, user_tz: str = "Asia/Kolkata") -> datetime:
    """
    Converts any timezone-aware datetime to the user's local timezone for display.

    Args:
        dt: A timezone-aware datetime (should be UTC from the database).
        user_tz: IANA timezone string from user preferences (e.g. "Asia/Kolkata", "America/New_York").

    Returns:
        A timezone-aware datetime in the user's local timezone.
    """
    try:
        tz = ZoneInfo(user_tz)
    except (ZoneInfoNotFoundError, KeyError):
        tz = TZ_IST  # Fallback to India (default market)
    return dt.astimezone(tz)


def format_reset_time(dt: datetime, user_tz: str = "Asia/Kolkata") -> str:
    """
    Returns a human-readable quota reset timestamp in the user's local timezone.

    Example outputs:
        "01 Oct 2026, 05:30 AM IST"   (Indian user — UTC midnight = 5:30 AM IST)
        "01 Oct 2026, 12:00 AM EDT"   (US Eastern user)
    """
    local_dt = to_user_tz(dt, user_tz)
    return local_dt.strftime("%d %b %Y, %I:%M %p %Z")


def get_exchange_tz(exchange: str) -> ZoneInfo:
    """
    Maps a market exchange code to its local timezone.

    Args:
        exchange: Exchange identifier ("NSE", "BSE", "NYSE", "NASDAQ", "US").

    Returns:
        The ZoneInfo object for that exchange.
    """
    exchange_map = {
        "NSE": TZ_IST,
        "BSE": TZ_IST,
        "NYSE": TZ_ET,
        "NASDAQ": TZ_ET,
        "US": TZ_ET,
    }
    return exchange_map.get(exchange.upper(), TZ_UTC)


# ---------------------------------------------------------------------------
# Market Hours Checks
# ---------------------------------------------------------------------------

def is_nse_open(at: Optional[datetime] = None) -> bool:
    """
    Returns True if NSE is currently within normal trading hours.
    Checks: Monday–Friday, 09:15–15:30 IST.

    NOTE: Does not check Indian public holidays (Phase 3 addition).

    Args:
        at: Optional datetime to check. Defaults to now in IST.
    """
    now_ist = (at or datetime.now(TZ_IST)).astimezone(TZ_IST)
    if now_ist.weekday() >= 5:  # 5=Saturday, 6=Sunday
        return False
    return NSE_OPEN <= now_ist.time() <= NSE_CLOSE


def is_nyse_open(at: Optional[datetime] = None) -> bool:
    """
    Returns True if NYSE/NASDAQ is within normal trading hours.
    Checks: Monday–Friday, 09:30–16:00 ET.
    Handles US Daylight Saving Time automatically via zoneinfo (no hardcoded offsets).

    NOTE: Does not check US federal holidays (Phase 3 addition).

    Args:
        at: Optional datetime to check. Defaults to now in ET.
    """
    now_et = (at or datetime.now(TZ_ET)).astimezone(TZ_ET)
    if now_et.weekday() >= 5:
        return False
    return NYSE_OPEN <= now_et.time() <= NYSE_CLOSE


def is_market_open(exchange: str, at: Optional[datetime] = None) -> bool:
    """
    Generic market hours check by exchange code.
    Crypto always returns True (24/7).

    Args:
        exchange: "NSE", "BSE", "NYSE", "NASDAQ", "CRYPTO"
        at: Optional datetime to check.
    """
    exchange_upper = exchange.upper()
    if exchange_upper == "CRYPTO":
        return True
    if exchange_upper in ("NSE", "BSE"):
        return is_nse_open(at)
    if exchange_upper in ("NYSE", "NASDAQ", "US"):
        return is_nyse_open(at)
    return False  # Unknown exchange — assume closed for safety
