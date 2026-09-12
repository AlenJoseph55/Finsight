"""
FinSight Normalized Financial Market Data Models.

All timestamps are stored as UTC-aware datetimes using now_utc().
The deprecated datetime.utcnow() is explicitly avoided — it returns
a naive datetime with no tzinfo, which causes silent comparison bugs
against database rows that have timezone=True (stored as UTC).

Exchange timestamps from providers (yfinance returns IST for NSE, ET for NYSE)
are normalized to UTC before being stored in these models.
"""

from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel, Field

from backend.app.core.timezone import now_utc


class Quote(BaseModel):
    symbol: str
    exchange: str = "NSE"
    price: float
    change_pct: float = 0.0
    volume: int = 0
    currency: str = "INR"
    # Always UTC — providers normalize exchange-local time before setting this
    timestamp: datetime = Field(default_factory=now_utc)
    market_open: bool = False   # Is the exchange currently trading?
    source: str = "yfinance"


class NewsItem(BaseModel):
    headline: str
    summary: str
    url: Optional[str] = None
    published_at: datetime      # UTC-aware — normalized from provider's Unix timestamp
    sectors: List[str] = Field(default_factory=list)
    sentiment: str = "NEUTRAL"  # POSITIVE | NEUTRAL | NEGATIVE
    source: str = "finnhub"


class NAVData(BaseModel):
    amfi_code: str
    fund_name: str
    nav: float
    # Date-only (no time component) — AMFI publishes daily business day dates in IST.
    # Intentionally NOT a datetime to avoid any timezone conversion ambiguity.
    nav_date: date
    source: str = "amfi"


class HistoricalBar(BaseModel):
    date: str           # ISO date string "YYYY-MM-DD" in exchange-local calendar day
    open: float
    high: float
    low: float
    close: float
    volume: int
