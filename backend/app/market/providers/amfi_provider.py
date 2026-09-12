"""
AMFI India Mutual Fund NAV Provider.
Authoritative source for Net Asset Values (NAV) across all registered Indian mutual fund schemes.
Fetches daily semicolon-delimited publication from AMFI (Association of Mutual Funds in India).
"""

import asyncio
from datetime import datetime, date
from typing import Dict, Optional
import httpx

from backend.app.market.models import NAVData
from backend.app.core.logging import logger


class AMFIProvider:
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        self.nav_url = self.config.get("nav_text_url", "https://www.amfiindia.com/spages/NAVAll.txt")
        self._cache: Dict[str, NAVData] = {}
        self._last_fetched: Optional[datetime] = None

    async def _refresh_cache_if_needed(self):
        # Refresh cache if empty or older than 12 hours
        now = datetime.utcnow()
        if self._cache and self._last_fetched and (now - self._last_fetched).total_seconds() < 43200:
            return

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(self.nav_url)
                if res.status_code == 200:
                    lines = res.text.splitlines()
                    new_cache = {}
                    for line in lines:
                        parts = line.strip().split(";")
                        if len(parts) >= 6:
                            code = parts[0].strip()
                            name = parts[3].strip()
                            nav_str = parts[4].strip()
                            date_str = parts[5].strip()
                            try:
                                nav_val = float(nav_str)
                                # parse date dd-Mon-yyyy
                                dt = datetime.strptime(date_str, "%d-%b-%Y").date()
                                new_cache[code] = NAVData(
                                    amfi_code=code,
                                    fund_name=name,
                                    nav=nav_val,
                                    nav_date=dt,
                                    source="amfi",
                                )
                            except Exception:
                                continue
                    if new_cache:
                        self._cache = new_cache
                        self._last_fetched = now
                        logger.info(f"AMFI NAV cache populated with {len(self._cache)} funds.")
        except Exception as e:
            logger.warning(f"Failed to fetch AMFI NAV data: {e}")

    async def get_nav(self, amfi_code: str) -> Optional[NAVData]:
        await self._refresh_cache_if_needed()
        code_str = str(amfi_code).strip()
        if code_str in self._cache:
            return self._cache[code_str]

        # Search by fund name substring if code not found
        for nav_item in self._cache.values():
            if code_str.lower() in nav_item.fund_name.lower():
                return nav_item
        return None
