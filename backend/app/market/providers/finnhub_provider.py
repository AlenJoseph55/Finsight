"""
Finnhub Market Data & Financial News Provider.
Provides financial news feeds, headlines, and sentiment signals.
"""

import os
from datetime import datetime, timezone
from typing import List, Optional
import httpx

from backend.app.market.models import NewsItem, Quote
from backend.app.core.logging import logger


class FinnhubProvider:
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        self.base_url = self.config.get("base_url", "https://finnhub.io/api/v1")
        api_key_env = self.config.get("api_key_env", "FINNHUB_API_KEY")
        self.api_key = os.environ.get(api_key_env, "")

    async def get_quote(self, symbol: str, exchange: str = "US") -> Optional[Quote]:
        if not self.api_key:
            return None
        url = f"{self.base_url}/quote"
        params = {"symbol": symbol, "token": self.api_key}
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    data = res.json()
                    current = data.get("c", 0.0)
                    prev = data.get("pc", 0.0)
                    change = data.get("dp", 0.0)
                    if current > 0:
                        return Quote(
                            symbol=symbol,
                            exchange=exchange,
                            price=float(current),
                            change_pct=float(change),
                            volume=0,
                            currency="USD",
                            source="finnhub",
                        )
        except Exception as e:
            logger.warning(f"Finnhub quote lookup failed for {symbol}: {e}")
        return None

    async def get_news(self, category: str = "general") -> List[NewsItem]:
        if not self.api_key:
            return []
        url = f"{self.base_url}/news"
        params = {"category": category, "token": self.api_key}
        items = []
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    raw_news = res.json()
                    for entry in raw_news[:20]:
                        pub_ts = entry.get("datetime")
                        pub_dt = (
                            datetime.fromtimestamp(pub_ts, tz=timezone.utc)
                            if pub_ts
                            else datetime.now(timezone.utc)
                        )
                        items.append(
                            NewsItem(
                                headline=entry.get("headline", ""),
                                summary=entry.get("summary", ""),
                                url=entry.get("url"),
                                published_at=pub_dt,
                                sectors=[entry.get("category", "general")],
                                source="finnhub",
                            )
                        )
        except Exception as e:
            logger.warning(f"Finnhub news fetch failed: {e}")
        return items
