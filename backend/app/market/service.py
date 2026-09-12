"""
FinSight Market Data Orchestrator & Unified Service.

Features:
- Config-driven routing by data type (quote -> yfinance, news -> finnhub, nav -> amfi).
- Seamless fallback chain if a market provider is unavailable or fails.
- Completely decouples AI agents from concrete vendor APIs.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional
import yaml

from backend.app.market.models import Quote, NewsItem, NAVData, HistoricalBar
from backend.app.market.providers.yfinance_provider import YFinanceProvider
from backend.app.market.providers.finnhub_provider import FinnhubProvider
from backend.app.market.providers.amfi_provider import AMFIProvider
from backend.app.core.logging import logger


class MarketDataService:
    def __init__(self, config_dir: Optional[Path] = None):
        if config_dir is None:
            self.config_dir = Path(__file__).resolve().parent.parent.parent / "config" / "market"
        else:
            self.config_dir = config_dir

        self.configs: Dict[str, Dict[str, Any]] = {}
        self.routes: Dict[str, Dict[str, Any]] = {}
        self.providers: Dict[str, Any] = {}
        self.reload_configs()

    def reload_configs(self):
        if not self.config_dir.exists():
            logger.warning(f"Market config directory not found at {self.config_dir}")
            return

        for yaml_file in self.config_dir.glob("*.yaml"):
            if yaml_file.name == "active.yaml":
                continue
            try:
                with open(yaml_file, "r") as f:
                    cfg = yaml.safe_load(f)
                    if cfg and isinstance(cfg, dict) and cfg.get("provider"):
                        self.configs[cfg["provider"]] = cfg
            except Exception as e:
                logger.error(f"Failed to load market config {yaml_file}: {e}")

        active_path = self.config_dir / "active.yaml"
        if active_path.exists():
            try:
                with open(active_path, "r") as f:
                    active_cfg = yaml.safe_load(f)
                    if active_cfg and "routes" in active_cfg:
                        self.routes = active_cfg["routes"]
            except Exception as e:
                logger.error(f"Failed to load active market routes: {e}")

        # Instantiate provider adapters
        self.providers["yfinance"] = YFinanceProvider(self.configs.get("yfinance"))
        self.providers["finnhub"] = FinnhubProvider(self.configs.get("finnhub"))
        self.providers["amfi"] = AMFIProvider(self.configs.get("amfi"))

    def get_route_chain(self, data_type: str) -> List[str]:
        route = self.routes.get(data_type, {})
        primary = route.get("primary")
        fallbacks = route.get("fallback", [])
        chain = []
        if primary:
            chain.append(primary)
        chain.extend(f for f in fallbacks if f not in chain)
        return chain

    async def get_quote(self, symbol: str, exchange: str = "NSE") -> Optional[Quote]:
        chain = self.get_route_chain("quote") or ["yfinance", "finnhub"]
        for p_name in chain:
            provider = self.providers.get(p_name)
            if provider and hasattr(provider, "get_quote"):
                res = await provider.get_quote(symbol, exchange=exchange)
                if res is not None:
                    return res
        return None

    async def get_news(self, category: str = "general") -> List[NewsItem]:
        chain = self.get_route_chain("news") or ["finnhub"]
        for p_name in chain:
            provider = self.providers.get(p_name)
            if provider and hasattr(provider, "get_news"):
                items = await provider.get_news(category=category)
                if items:
                    return items
        return []

    async def get_nav(self, amfi_code: str) -> Optional[NAVData]:
        amfi_p = self.providers.get("amfi")
        if amfi_p and hasattr(amfi_p, "get_nav"):
            return await amfi_p.get_nav(amfi_code)
        return None

    async def get_historical(self, symbol: str, period: str = "1mo", exchange: str = "NSE") -> List[HistoricalBar]:
        chain = self.get_route_chain("historical") or ["yfinance"]
        for p_name in chain:
            provider = self.providers.get(p_name)
            if provider and hasattr(provider, "get_historical"):
                bars = await provider.get_historical(symbol, period=period, exchange=exchange)
                if bars:
                    return bars
        return []


# Global singleton market data service instance
market_data = MarketDataService()
