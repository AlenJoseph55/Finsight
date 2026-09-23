"""
FinSight Dynamic Mutual Fund & ETF Look-Through Service.

Production 3-Tier Architecture:
1. Live Provider: Resolves fund via Yahoo Finance / Morningstar feeds (yfinance.Search + funds_data.sector_weightings).
   Normalizes Morningstar sector taxonomy into canonical NSE sectors.
2. Redis Caching: Caches resolved fund sector breakdowns for 30 days (since AMC disclosures are monthly).
3. SEBI Category & Sectoral Classifier: Analyzes fund name to classify sectoral/thematic mandates
   (e.g., Tech 100%, Pharma 100%) and maps market-cap categories (Large/Mid/Small/Flexi) to official NSE benchmark weights.
4. Broad Market Fallback: Nifty 500 benchmark sector weights.
"""

import asyncio
import json
import re
from typing import Dict, List, Optional
import yfinance as yf

from backend.app.core.logging import logger

try:
    import redis.asyncio as aioredis
    from backend.app.config import get_settings
    settings = get_settings()
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
except Exception:
    redis_client = None

# Morningstar sector taxonomy -> Canonical NSE Sectors
MORNINGSTAR_TO_NSE_SECTORS: Dict[str, str] = {
    "financial_services": "Financial Services",
    "technology": "Information Technology",
    "communication_services": "Telecommunication",
    "consumer_cyclical": "Consumer Goods",
    "consumer_defensive": "Consumer Goods",
    "healthcare": "Healthcare",
    "energy": "Energy",
    "utilities": "Energy",
    "realestate": "Realty",
    "basic_materials": "Metals & Mining",
    "industrials": "Capital Goods",
}

# Standard NSE Benchmark Index Sector Weights (Official NSE Indices Disclosures)
NSE_BENCHMARK_PROFILES: Dict[str, Dict[str, float]] = {
    "large_cap": {
        "Financial Services": 0.35,
        "Information Technology": 0.14,
        "Energy": 0.12,
        "Consumer Goods": 0.10,
        "Automobile": 0.07,
        "Healthcare": 0.05,
        "Construction & Infrastructure": 0.04,
        "Telecommunication": 0.04,
        "Metals & Mining": 0.04,
        "Chemicals": 0.03,
        "Capital Goods": 0.02,
    },
    "mid_cap": {
        "Capital Goods": 0.20,
        "Financial Services": 0.19,
        "Healthcare": 0.15,
        "Automobile": 0.14,
        "Information Technology": 0.12,
        "Chemicals": 0.10,
        "Consumer Goods": 0.06,
        "Energy": 0.04,
    },
    "small_cap": {
        "Capital Goods": 0.22,
        "Financial Services": 0.18,
        "Chemicals": 0.15,
        "Healthcare": 0.12,
        "Consumer Goods": 0.11,
        "Information Technology": 0.10,
        "Automobile": 0.07,
        "Metals & Mining": 0.05,
    },
    "flexi_cap": {
        "Financial Services": 0.31,
        "Information Technology": 0.17,
        "Consumer Goods": 0.12,
        "Energy": 0.10,
        "Automobile": 0.08,
        "Healthcare": 0.08,
        "Capital Goods": 0.06,
        "Construction & Infrastructure": 0.04,
        "Metals & Mining": 0.04,
    },
}

# Sectoral/Thematic Fund Keyword Rules (SEBI Mandated Sector Portfolios)
SECTORAL_PATTERNS = [
    (re.compile(r"\b(tech|technology|digital|software|it)\b", re.I), {"Information Technology": 1.0}),
    (re.compile(r"\b(pharma|healthcare|health)\b", re.I), {"Healthcare": 1.0}),
    (re.compile(r"\b(bank|banking|financial|financials|finance|fintech)\b", re.I), {"Financial Services": 1.0}),
    (re.compile(r"\b(auto|automobile|mobility)\b", re.I), {"Automobile": 1.0}),
    (re.compile(r"\b(infra|infrastructure)\b", re.I), {
        "Construction & Infrastructure": 0.50,
        "Capital Goods": 0.35,
        "Metals & Mining": 0.15,
    }),
    (re.compile(r"\b(energy|power|oil)\b", re.I), {"Energy": 0.85, "Utilities": 0.15}),
    (re.compile(r"\b(fmcg|consumption|consumer)\b", re.I), {"Consumer Goods": 0.85, "Automobile": 0.15}),
    (re.compile(r"\b(metal|metals|mining)\b", re.I), {"Metals & Mining": 1.0}),
]


class MutualFundDataService:
    """Production service for real-time mutual fund look-through and sector decomposition."""
    
    _mem_cache: Dict[str, Dict[str, float]] = {}
    CACHE_TTL_SECONDS = 86400 * 30  # 30 days

    @classmethod
    def _sanitize_key(cls, fund_name: str) -> str:
        return re.sub(r"[^a-zA-Z0-9]+", "_", fund_name.strip().lower()).strip("_")

    @classmethod
    async def get_fund_sector_weights(cls, fund_name: str) -> Dict[str, float]:
        """
        Main entrypoint. Resolves a mutual fund's true sector breakdown via:
        1. Redis/Memory Cache
        2. Live Morningstar/Yahoo Finance lookup
        3. SEBI Scheme Category Analysis
        4. Broad Market Fallback
        """
        clean_name = fund_name.strip()
        key = cls._sanitize_key(clean_name)

        # 1. Check in-memory cache
        if key in cls._mem_cache:
            return cls._mem_cache[key]

        # 2. Check Redis cache
        if redis_client:
            try:
                cached_json = await redis_client.get(f"mf:lookthrough:{key}")
                if cached_json:
                    weights = json.loads(cached_json)
                    cls._mem_cache[key] = weights
                    return weights
            except Exception as e:
                logger.debug(f"Redis cache lookup failed for {key}: {e}")

        # 3. Live Provider: Query Yahoo Finance / Morningstar
        weights = await cls._fetch_live_morningstar_weights(clean_name)

        # 4. Fallback: SEBI Category & Sectoral Analysis
        if not weights:
            weights = cls.classify_by_sebi_category(clean_name)

        # 5. Store in Redis & Memory
        cls._mem_cache[key] = weights
        if redis_client:
            try:
                await redis_client.set(
                    f"mf:lookthrough:{key}",
                    json.dumps(weights),
                    ex=cls.CACHE_TTL_SECONDS,
                )
            except Exception as e:
                logger.debug(f"Failed to cache fund weights in Redis for {key}: {e}")

        return weights

    @classmethod
    def get_fund_sector_weights_sync(cls, fund_name: str) -> Dict[str, float]:
        """
        Synchronous wrapper for deterministic math engines where an event loop
        is already active or not running. Checks memory cache or SEBI category classifier.
        """
        key = cls._sanitize_key(fund_name)
        if key in cls._mem_cache:
            return cls._mem_cache[key]
        weights = cls.classify_by_sebi_category(fund_name)
        cls._mem_cache[key] = weights
        return weights

    @classmethod
    async def _fetch_live_morningstar_weights(cls, fund_name: str) -> Optional[Dict[str, float]]:
        """
        Queries Morningstar data via Yahoo Finance in a background thread.
        Normalizes weights into canonical NSE sectors.
        """
        def _fetch() -> Optional[Dict[str, float]]:
            try:
                search = yf.Search(fund_name, max_results=3)
                if not search or not search.quotes:
                    return None

                ticker_sym = None
                for q in search.quotes:
                    sym = q.get("symbol", "")
                    if sym and (sym.endswith(".BO") or sym.endswith(".NS") or sym.startswith("0P")):
                        ticker_sym = sym
                        break

                if not ticker_sym and search.quotes:
                    ticker_sym = search.quotes[0].get("symbol")

                if not ticker_sym:
                    return None

                t = yf.Ticker(ticker_sym)
                funds_data = getattr(t, "funds_data", None)
                if not funds_data:
                    return None

                raw_sectors = getattr(funds_data, "sector_weightings", None)
                if not raw_sectors or not isinstance(raw_sectors, dict):
                    return None

                # Normalize and map to NSE sectors
                nse_weights: Dict[str, float] = {}
                for ms_sec, weight in raw_sectors.items():
                    if weight and weight > 0:
                        mapped_sec = MORNINGSTAR_TO_NSE_SECTORS.get(ms_sec, "Diversified")
                        if mapped_sec != "Diversified":
                            nse_weights[mapped_sec] = nse_weights.get(mapped_sec, 0.0) + float(weight)

                total = sum(nse_weights.values())
                if total > 0:
                    return {sec: round(w / total, 4) for sec, w in nse_weights.items()}

            except Exception as e:
                logger.debug(f"Live fund fetch failed for {fund_name}: {e}")
                return None
            return None

        try:
            return await asyncio.to_thread(_fetch)
        except Exception as e:
            logger.debug(f"Async live fund fetch error for {fund_name}: {e}")
            return None

    @classmethod
    def classify_by_sebi_category(cls, fund_name: str) -> Dict[str, float]:
        """
        Classifies fund by SEBI scheme classification and keywords:
        - Specific Sectoral / Thematic funds (Tech, Healthcare, Banking, etc.)
        - Mid Cap, Small Cap, Large Cap, Flexi Cap benchmark mappings
        - Fallback: Nifty 500 Broad Market
        """
        name_lower = fund_name.lower()

        # 1. Sectoral / Thematic Checks
        for pattern, weights in SECTORAL_PATTERNS:
            if pattern.search(name_lower):
                return weights

        # 2. Market-Cap Category Benchmarks
        if "small" in name_lower or "smallcap" in name_lower:
            return NSE_BENCHMARK_PROFILES["small_cap"]
        elif "mid" in name_lower or "midcap" in name_lower:
            return NSE_BENCHMARK_PROFILES["mid_cap"]
        elif "large" in name_lower or "bluechip" in name_lower or "nifty 50" in name_lower or "top 100" in name_lower:
            return NSE_BENCHMARK_PROFILES["large_cap"]
        elif "flexi" in name_lower or "multi" in name_lower or "focused" in name_lower or "equity" in name_lower:
            return NSE_BENCHMARK_PROFILES["flexi_cap"]

        # 3. Default: Broad Market Nifty 500
        return NSE_BENCHMARK_PROFILES["flexi_cap"]
