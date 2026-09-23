"""
Unit tests for NSE Sector Taxonomy and normalization.
"""
import pytest
from backend.app.core.sectors import NSE_SECTORS, normalize_sector


def test_nse_sectors_count():
    assert len(NSE_SECTORS) == 15
    assert "Diversified" in NSE_SECTORS
    assert "Financial Services" in NSE_SECTORS
    assert "Information Technology" in NSE_SECTORS


def test_canonical_sectors_pass_through():
    for sector in NSE_SECTORS:
        assert normalize_sector(sector) == sector
        assert normalize_sector(sector.lower()) == sector
        assert normalize_sector(f"  {sector}  ") == sector


def test_common_aliases_mapping():
    assert normalize_sector("Banking") == "Financial Services"
    assert normalize_sector("financials") == "Financial Services"
    assert normalize_sector("NBFC") == "Financial Services"
    assert normalize_sector("IT") == "Information Technology"
    assert normalize_sector("Software") == "Information Technology"
    assert normalize_sector("Pharma") == "Healthcare"
    assert normalize_sector("Pharmaceuticals") == "Healthcare"
    assert normalize_sector("Auto") == "Automobile"
    assert normalize_sector("Automotive") == "Automobile"
    assert normalize_sector("Oil & Gas") == "Energy"
    assert normalize_sector("Power") == "Energy"
    assert normalize_sector("Steel") == "Metals & Mining"
    assert normalize_sector("Infrastructure") == "Construction & Infrastructure"
    assert normalize_sector("Real Estate") == "Realty"
    assert normalize_sector("Telecom") == "Telecommunication"


def test_fallback_to_diversified():
    assert normalize_sector("Cryptocurrency") == "Diversified"
    assert normalize_sector("Unknown Sector 123") == "Diversified"
    assert normalize_sector("") == "Diversified"
    assert normalize_sector(None) == "Diversified"
    assert normalize_sector("   ") == "Diversified"
