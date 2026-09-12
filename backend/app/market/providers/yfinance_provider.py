"""
Yahoo Finance Market Data Provider.
Fetches real-time prices and historical series for Indian (NSE/BSE) and US equities.

Timezone Handling:
  yfinance returns exchange-local timestamps:
    - NSE/BSE tickers (.NS/.BO) → timestamps in IST (Asia/Kolkata)
    - US tickers → timestamps in ET (America/New_York)
  All timestamps are normalized to UTC before returning, consistent with the
  rest of FinSight's UTC-everywhere database strategy.
"""

import asyncio
from datetime import datetime
from typing import List, Optional

import yfinance as yf

from backend.app.market.models import Quote, HistoricalBar
from backend.app.core.logging import logger
from backend.app.core.timezone import TZ_UTC, get_exchange_tz, is_market_open, now_utc


class YFinanceProvider:
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        self.exchange_suffix_map: dict = self.config.get("exchange_suffix_map", {
            "NSE": ".NS",
            "BSE": ".BO",
            "US": "",
        })

    def _normalize_symbol(self, symbol: str, exchange: str = "NSE") -> str:
        s = symbol.strip().upper()
        suffix = self.exchange_suffix_map.get(exchange.upper(), "")
        if suffix and not s.endswith(suffix):
            return f"{s}{suffix}"
        return s

    async def get_quote(self, symbol: str, exchange: str = "NSE") -> Optional[Quote]:
        """
        Fetches the latest price quote for a symbol.
        Runs yfinance I/O in a thread pool to avoid blocking the async event loop.
        Normalizes the timestamp to UTC using the exchange's local timezone.
        """
        norm_sym = self._normalize_symbol(symbol, exchange)
        exchange_tz = get_exchange_tz(exchange)

        def _fetch():
            try:
                ticker = yf.Ticker(norm_sym)
                info = ticker.fast_info
                price = getattr(info, "last_price", None) or getattr(info, "previous_close", None)
                if price is None or price <= 0:
                    return None
                prev = getattr(info, "previous_close", price)
                change_pct = round(((price - prev) / prev) * 100, 2) if prev else 0.0
                volume = getattr(info, "last_volume", 0) or 0

                # Normalize to UTC: yfinance timestamp is in exchange-local time
                quote_time_utc = datetime.now(exchange_tz).astimezone(TZ_UTC)

                return Quote(
                    symbol=norm_sym,
                    exchange=exchange,
                    price=float(price),
                    change_pct=float(change_pct),
                    volume=int(volume),
                    currency="INR" if exchange in ("NSE", "BSE") else "USD",
                    timestamp=quote_time_utc,
                    market_open=is_market_open(exchange),
                    source="yfinance",
                )
            except Exception as e:
                logger.warning(f"yfinance quote failed for {norm_sym}: {e}")
                return None

        return await asyncio.to_thread(_fetch)

    async def get_historical(self, symbol: str, period: str = "1mo", exchange: str = "NSE") -> List[HistoricalBar]:
        """
        Fetches OHLCV historical bar data.
        Dates are kept as ISO date strings (YYYY-MM-DD) in the exchange's calendar day,
        which is the standard convention for financial historical data.
        """
        norm_sym = self._normalize_symbol(symbol, exchange)

        def _fetch():
            try:
                ticker = yf.Ticker(norm_sym)
                hist = ticker.history(period=period)
                bars = []
                for index, row in hist.iterrows():
                    # index is tz-aware (exchange local) — convert to UTC date string
                    date_str = index.astimezone(TZ_UTC).strftime("%Y-%m-%d")
                    bars.append(HistoricalBar(
                        date=date_str,
                        open=round(float(row["Open"]), 2),
                        high=round(float(row["High"]), 2),
                        low=round(float(row["Low"]), 2),
                        close=round(float(row["Close"]), 2),
                        volume=int(row["Volume"]),
                    ))
                return bars
            except Exception as e:
                logger.warning(f"yfinance historical failed for {norm_sym}: {e}")
                return []

        return await asyncio.to_thread(_fetch)
