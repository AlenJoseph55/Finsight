"""
Unit Tests for Dynamic MutualFundDataService & Deterministic XIRR Engine.
"""

from datetime import date
import pytest

from backend.app.services.fund_service import MutualFundDataService
from backend.app.services.math_engine import FinancialMathEngine, HoldingInput


def test_sebi_sectoral_thematic_classifier():
    # Sectoral Technology
    res_tech = MutualFundDataService.classify_by_sebi_category("Tata Digital India Fund")
    assert res_tech == {"Information Technology": 1.0}

    # Sectoral Pharma / Healthcare
    res_pharma = MutualFundDataService.classify_by_sebi_category("Nippon India Pharma Fund")
    assert res_pharma == {"Healthcare": 1.0}

    # Sectoral Banking
    res_bank = MutualFundDataService.classify_by_sebi_category("ICICI Prudential Banking & Financial Services Fund")
    assert res_bank == {"Financial Services": 1.0}

    # Sectoral Auto
    res_auto = MutualFundDataService.classify_by_sebi_category("UTI Transportation and Logistics Fund - Auto")
    assert res_auto == {"Automobile": 1.0}


def test_sebi_market_cap_benchmark_mapping():
    # Small Cap
    res_small = MutualFundDataService.classify_by_sebi_category("Nippon India Small Cap Fund Direct-Growth")
    assert res_small["Capital Goods"] > 0.15
    assert res_small["Financial Services"] > 0.10

    # Mid Cap
    res_mid = MutualFundDataService.classify_by_sebi_category("Kotak Emerging Equity Midcap Fund")
    assert res_mid["Healthcare"] > 0.10
    assert res_mid["Capital Goods"] > 0.15

    # Large Cap / Bluechip
    res_large = MutualFundDataService.classify_by_sebi_category("Axis Bluechip Large Cap Fund")
    assert res_large["Financial Services"] > 0.30


def test_calculate_xirr_exact_reference_case():
    # Standard 1-year investment with 15% return:
    # Invested ₹100,000 on 2023-01-01, current value ₹115,000 on 2024-01-01
    flows = [
        (date(2023, 1, 1), -100000.0),
        (date(2024, 1, 1), 115000.0),
    ]
    xirr = FinancialMathEngine.calculate_xirr(flows)
    assert xirr is not None
    assert abs(xirr - 15.0) < 0.2


def test_calculate_xirr_multi_period_sip():
    # Monthly SIP of ₹10,000 for 3 months with positive growth
    flows = [
        (date(2024, 1, 1), -10000.0),
        (date(2024, 2, 1), -10000.0),
        (date(2024, 3, 1), -10000.0),
        (date(2024, 4, 1), 31500.0),
    ]
    xirr = FinancialMathEngine.calculate_xirr(flows)
    assert xirr is not None
    assert xirr > 0.0


@pytest.mark.asyncio
async def test_fund_service_async_lookup():
    # Test lookup of Parag Parikh Flexi Cap
    weights = await MutualFundDataService.get_fund_sector_weights("Parag Parikh Flexi Cap Fund")
    assert isinstance(weights, dict)
    assert len(weights) > 0
    assert sum(weights.values()) > 0.95
    # Should have financial services and technology
    assert "Financial Services" in weights
