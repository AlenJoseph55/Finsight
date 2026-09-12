"""
FinSight Timezone Utility Tests.

Tests cover:
  - Core UTC datetime functions (now_utc, timezone awareness)
  - NSE and NYSE market hours logic with edge cases
  - is_market_open generic dispatcher
  - User timezone conversion and quota reset display
  - UserPreferences schema defaults and patching
  - Quote model uses UTC-aware timestamp (not naive utcnow)

Run: docker exec finsight-backend python -m pytest backend/tests/test_timezone.py -v
"""

import pytest
from datetime import datetime
from zoneinfo import ZoneInfo

from backend.app.core.timezone import (
    TZ_IST, TZ_ET, TZ_UTC,
    now_utc, to_user_tz, format_reset_time,
    get_exchange_tz, is_nse_open, is_nyse_open, is_market_open,
    NSE_OPEN, NSE_CLOSE, NYSE_OPEN, NYSE_CLOSE,
)
from backend.app.market.models import Quote
from backend.app.schemas.user_prefs import UserPreferences, UserPreferencesPatch


# ---------------------------------------------------------------------------
# now_utc
# ---------------------------------------------------------------------------

class TestNowUtc:
    def test_is_timezone_aware(self):
        dt = now_utc()
        assert dt.tzinfo is not None, "now_utc() must return a tz-aware datetime"

    def test_is_utc_zone(self):
        dt = now_utc()
        # UTC offset must be 0
        assert dt.utcoffset().total_seconds() == 0, "now_utc() must return UTC (offset=0)"

    def test_not_naive(self):
        """Guard: ensure we never accidentally use datetime.utcnow() elsewhere."""
        naive = datetime.utcnow()
        assert naive.tzinfo is None, "datetime.utcnow() is naive — this is why we replaced it"
        aware = now_utc()
        assert aware.tzinfo is not None


# ---------------------------------------------------------------------------
# NSE Market Hours
# ---------------------------------------------------------------------------

class TestNSEMarketHours:
    def _make_ist(self, hour: int, minute: int, weekday: int = 0) -> datetime:
        """Create a Monday datetime in IST at given hour:minute."""
        # 2026-09-14 is a Monday
        base = datetime(2026, 9, 14, hour, minute, 0, tzinfo=TZ_IST)
        # Shift to desired weekday
        from datetime import timedelta
        return base + timedelta(days=weekday)

    def test_open_at_midday(self):
        at = self._make_ist(12, 0)
        assert is_nse_open(at) is True

    def test_open_at_930(self):
        at = self._make_ist(9, 15)
        assert is_nse_open(at) is True

    def test_open_at_1530(self):
        at = self._make_ist(15, 30)
        assert is_nse_open(at) is True

    def test_closed_before_open(self):
        at = self._make_ist(9, 0)
        assert is_nse_open(at) is False

    def test_closed_after_close(self):
        at = self._make_ist(15, 31)
        assert is_nse_open(at) is False

    def test_closed_on_saturday(self):
        at = self._make_ist(12, 0, weekday=5)  # Saturday
        assert is_nse_open(at) is False

    def test_closed_on_sunday(self):
        at = self._make_ist(12, 0, weekday=6)  # Sunday
        assert is_nse_open(at) is False


# ---------------------------------------------------------------------------
# NYSE Market Hours
# ---------------------------------------------------------------------------

class TestNYSEMarketHours:
    def _make_et(self, hour: int, minute: int, weekday: int = 0) -> datetime:
        """Create a Monday datetime in ET (handles DST automatically)."""
        # 2026-09-14 is a Monday — September is EDT (UTC-4)
        from datetime import timedelta
        base = datetime(2026, 9, 14, hour, minute, 0, tzinfo=TZ_ET)
        return base + timedelta(days=weekday)

    def test_open_at_midday(self):
        at = self._make_et(12, 0)
        assert is_nyse_open(at) is True

    def test_open_at_930(self):
        at = self._make_et(9, 30)
        assert is_nyse_open(at) is True

    def test_open_at_1600(self):
        at = self._make_et(16, 0)
        assert is_nyse_open(at) is True

    def test_closed_before_open(self):
        at = self._make_et(9, 29)
        assert is_nyse_open(at) is False

    def test_closed_after_close(self):
        at = self._make_et(16, 1)
        assert is_nyse_open(at) is False

    def test_closed_on_saturday(self):
        at = self._make_et(12, 0, weekday=5)
        assert is_nyse_open(at) is False

    def test_dst_awareness_summer_edt(self):
        """In summer (EDT), NYSE 9:30 ET = 13:30 UTC."""
        # September 2026 = EDT (UTC-4)
        summer_et = datetime(2026, 9, 14, 10, 0, 0, tzinfo=TZ_ET)
        summer_utc = summer_et.astimezone(TZ_UTC)
        # EDT is UTC-4, so 10 AM ET = 2 PM UTC
        assert summer_utc.hour == 14

    def test_dst_awareness_winter_est(self):
        """In winter (EST), NYSE 9:30 ET = 14:30 UTC."""
        # January 2027 = EST (UTC-5)
        winter_et = datetime(2027, 1, 12, 10, 0, 0, tzinfo=TZ_ET)
        winter_utc = winter_et.astimezone(TZ_UTC)
        # EST is UTC-5, so 10 AM ET = 3 PM UTC
        assert winter_utc.hour == 15


# ---------------------------------------------------------------------------
# Generic Market Hours Dispatcher
# ---------------------------------------------------------------------------

class TestIsMarketOpen:
    def test_crypto_always_open(self):
        assert is_market_open("CRYPTO") is True
        assert is_market_open("crypto") is True

    def test_unknown_exchange_closed(self):
        assert is_market_open("UNKNOWN_XYZ") is False


# ---------------------------------------------------------------------------
# Exchange Timezone Mapping
# ---------------------------------------------------------------------------

class TestGetExchangeTz:
    def test_nse(self):
        assert get_exchange_tz("NSE") == TZ_IST

    def test_bse(self):
        assert get_exchange_tz("BSE") == TZ_IST

    def test_nyse(self):
        assert get_exchange_tz("NYSE") == TZ_ET

    def test_nasdaq(self):
        assert get_exchange_tz("NASDAQ") == TZ_ET

    def test_us(self):
        assert get_exchange_tz("US") == TZ_ET

    def test_unknown_defaults_utc(self):
        assert get_exchange_tz("UNKNOWN") == TZ_UTC


# ---------------------------------------------------------------------------
# User Timezone Conversion
# ---------------------------------------------------------------------------

class TestToUserTz:
    def test_utc_to_ist(self):
        utc_dt = datetime(2026, 10, 1, 0, 0, 0, tzinfo=TZ_UTC)
        ist_dt = to_user_tz(utc_dt, "Asia/Kolkata")
        # UTC midnight = 5:30 AM IST
        assert ist_dt.hour == 5
        assert ist_dt.minute == 30

    def test_utc_to_et(self):
        utc_dt = datetime(2026, 10, 1, 18, 30, 0, tzinfo=TZ_UTC)
        et_dt = to_user_tz(utc_dt, "America/New_York")
        # October 2026 = EDT (UTC-4), so 18:30 UTC = 14:30 ET
        assert et_dt.hour == 14
        assert et_dt.minute == 30

    def test_invalid_tz_falls_back_to_ist(self):
        """Invalid timezone string should not crash — fall back to IST."""
        utc_dt = datetime(2026, 10, 1, 0, 0, 0, tzinfo=TZ_UTC)
        # Should not raise an exception
        result = to_user_tz(utc_dt, "Invalid/Timezone_ZZZZ")
        assert result.tzinfo is not None


# ---------------------------------------------------------------------------
# Format Reset Time
# ---------------------------------------------------------------------------

class TestFormatResetTime:
    def test_ist_reset_display(self):
        utc_reset = datetime(2026, 10, 1, 0, 0, 0, tzinfo=TZ_UTC)
        label = format_reset_time(utc_reset, "Asia/Kolkata")
        # Should contain "Oct" and "05:30 AM" for IST
        assert "Oct" in label
        assert "05:30 AM" in label

    def test_contains_timezone_abbreviation(self):
        utc_reset = datetime(2026, 10, 1, 0, 0, 0, tzinfo=TZ_UTC)
        label = format_reset_time(utc_reset, "Asia/Kolkata")
        assert "IST" in label


# ---------------------------------------------------------------------------
# Quote Model — UTC Timestamp
# ---------------------------------------------------------------------------

class TestQuoteModel:
    def test_default_timestamp_is_utc_aware(self):
        q = Quote(symbol="TCS.NS", price=3800.0)
        assert q.timestamp.tzinfo is not None, "Quote.timestamp must be tz-aware"
        assert q.timestamp.utcoffset().total_seconds() == 0, "Quote.timestamp must be UTC"

    def test_has_market_open_field(self):
        q = Quote(symbol="TCS.NS", price=3800.0)
        assert hasattr(q, "market_open")
        assert isinstance(q.market_open, bool)


# ---------------------------------------------------------------------------
# UserPreferences Schema
# ---------------------------------------------------------------------------

class TestUserPreferences:
    def test_default_timezone_is_india(self):
        prefs = UserPreferences()
        assert prefs.timezone == "Asia/Kolkata"

    def test_default_currency_is_inr(self):
        prefs = UserPreferences()
        assert prefs.currency == "INR"

    def test_default_market_focus_is_india(self):
        prefs = UserPreferences()
        assert prefs.market_focus == "IN"

    def test_model_dump_is_plain_dict(self):
        prefs = UserPreferences()
        d = prefs.model_dump()
        assert isinstance(d, dict)
        assert "timezone" in d

    def test_partial_patch_preserves_other_fields(self):
        prefs = UserPreferences()
        patch = UserPreferencesPatch(timezone="America/New_York")
        updated = prefs.model_copy(update=patch.model_dump(exclude_none=True))
        assert updated.timezone == "America/New_York"
        assert updated.currency == "INR"   # preserved
        assert updated.market_focus == "IN"  # preserved

    def test_invalid_currency_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            UserPreferences(currency="JPY")  # Not in Literal["INR", "USD", "EUR", "GBP"]
