"""
NSE Standard Sector Taxonomy.
Single source of truth for all sector labels used across extraction,
concentration risk analysis, and market event matching.
"""
from typing import Literal

NSE_SECTORS = [
    "Financial Services",
    "Information Technology",
    "Consumer Goods",
    "Healthcare",
    "Automobile",
    "Energy",
    "Metals & Mining",
    "Construction & Infrastructure",
    "Chemicals",
    "Telecommunication",
    "Media & Entertainment",
    "Realty",
    "Capital Goods",
    "FMCG",
    "Diversified",  # catch-all / multi-sector funds
]

NSESector = Literal[
    "Financial Services",
    "Information Technology",
    "Consumer Goods",
    "Healthcare",
    "Automobile",
    "Energy",
    "Metals & Mining",
    "Construction & Infrastructure",
    "Chemicals",
    "Telecommunication",
    "Media & Entertainment",
    "Realty",
    "Capital Goods",
    "FMCG",
    "Diversified",
]

# Common synonym -> canonical mapping for quick deterministic lookup
# before sending to LLM classification
SECTOR_ALIASES: dict[str, NSESector] = {
    "banking": "Financial Services",
    "financials": "Financial Services",
    "financial services": "Financial Services",
    "nbfc": "Financial Services",
    "insurance": "Financial Services",
    "it": "Information Technology",
    "technology": "Information Technology",
    "information technology": "Information Technology",
    "software": "Information Technology",
    "tech": "Information Technology",
    "pharma": "Healthcare",
    "pharmaceuticals": "Healthcare",
    "healthcare": "Healthcare",
    "health care": "Healthcare",
    "fmcg": "FMCG",
    "consumer staples": "FMCG",
    "fast moving consumer goods": "FMCG",
    "consumer goods": "Consumer Goods",
    "consumer discretionary": "Consumer Goods",
    "auto": "Automobile",
    "automobile": "Automobile",
    "automotive": "Automobile",
    "oil & gas": "Energy",
    "power": "Energy",
    "energy": "Energy",
    "utilities": "Energy",
    "metals": "Metals & Mining",
    "steel": "Metals & Mining",
    "mining": "Metals & Mining",
    "metals & mining": "Metals & Mining",
    "infrastructure": "Construction & Infrastructure",
    "construction": "Construction & Infrastructure",
    "construction & infrastructure": "Construction & Infrastructure",
    "chemicals": "Chemicals",
    "specialty chemicals": "Chemicals",
    "real estate": "Realty",
    "realty": "Realty",
    "telecom": "Telecommunication",
    "telecommunication": "Telecommunication",
    "telecommunications": "Telecommunication",
    "media": "Media & Entertainment",
    "media & entertainment": "Media & Entertainment",
    "entertainment": "Media & Entertainment",
    "capital goods": "Capital Goods",
    "engineering": "Capital Goods",
    "industrial": "Capital Goods",
    "industrials": "Capital Goods",
    "diversified": "Diversified",
    "diversified / multi-sector": "Diversified",
    "multi-sector": "Diversified",
    "us technology": "Information Technology",
    "others": "Diversified",
    "other": "Diversified",
}


def normalize_sector(raw: str | None) -> NSESector:
    """Maps any raw LLM sector string or alias to the canonical NSE taxonomy entry."""
    if not raw or not raw.strip():
        return "Diversified"

    key = raw.strip().lower()
    if key in SECTOR_ALIASES:
        return SECTOR_ALIASES[key]

    # Check if raw is already a valid sector (case-insensitive)
    for s in NSE_SECTORS:
        if s.lower() == key:
            return s  # type: ignore[return-value]

    # Partial / substring matching fallback for composite names
    for alias, canonical in SECTOR_ALIASES.items():
        if alias in key:
            return canonical

    return "Diversified"  # safe fallback
