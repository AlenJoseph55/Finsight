"""
Unit tests for SIPMathEngine and deterministic compound projections.
"""

import pytest
from backend.app.services.math_engine import SIPInput, SIPMathEngine


def test_calculate_sip_fv_exact():
    # 10,000/mo at 12% annual rate for 10 years (120 months)
    # i = 0.01, n = 120
    # Expected FV ~= 23,23,390.76
    fv = SIPMathEngine.calculate_sip_fv(monthly_amount=10000.0, annual_rate=0.12, years=10)
    assert 2320000.0 < fv < 2330000.0
    assert isinstance(fv, float)


def test_calculate_sip_fv_zero():
    assert SIPMathEngine.calculate_sip_fv(monthly_amount=0.0, annual_rate=0.12, years=10) == 0.0
    assert SIPMathEngine.calculate_sip_fv(monthly_amount=5000.0, annual_rate=0.12, years=0) == 0.0


def test_sip_math_engine_empty():
    result = SIPMathEngine.compute([])
    assert result.total_monthly_outflow == 0.0
    assert result.active_sips_count == 0
    assert result.is_concentrated is False
    assert len(result.calculated_plans) == 0
    assert len(result.projections) == 0


def test_sip_math_engine_diversified():
    sips = [
        SIPInput(
            fund_name="Parag Parikh Flexi Cap",
            sector="Diversified",
            monthly_amount=10000.0,
        ),
        SIPInput(
            fund_name="HDFC Bank Stock SIP",
            sector="Financial Services",
            monthly_amount=8000.0,
        ),
        SIPInput(
            fund_name="TCS Stock SIP",
            sector="Information Technology",
            monthly_amount=6000.0,
        ),
        SIPInput(
            fund_name="Tata Motors Stock SIP",
            sector="Automobile",
            monthly_amount=6000.0,
        ),
    ]

    result = SIPMathEngine.compute(sips, concentration_threshold_pct=40.0)

    # Total monthly = 10000 + 8000 + 6000 + 6000 = 30000
    assert result.total_monthly_outflow == 30000.0
    assert result.active_sips_count == 4
    # Max sector is Diversified (10000 / 30000 = 33.33% < 40%)
    assert result.is_concentrated is False
    assert "well-diversified" in result.concentration_summary.lower()

    # Verify projections are generated for all 6 horizons
    assert len(result.projections) == 6
    years = [p.year for p in result.projections]
    assert years == [1, 3, 5, 10, 15, 20]

    for p in result.projections:
        assert p.conservative < p.moderate < p.optimistic
        assert p.total_invested == 30000.0 * p.year * 12


def test_sip_math_engine_concentration_flag():
    sips = [
        SIPInput(
            fund_name="ICICI Prudential Technology Fund",
            sector="Information Technology",
            monthly_amount=15000.0,
        ),
        SIPInput(
            fund_name="Tata Digital India Fund",
            sector="Information Technology",
            monthly_amount=10000.0,
        ),
        SIPInput(
            fund_name="HDFC Top 100 Fund",
            sector="Diversified",
            monthly_amount=5000.0,
        ),
    ]

    # Total = 30,000. IT sector = 25,000 (83.33%) -> exceeds 40%
    result = SIPMathEngine.compute(sips, concentration_threshold_pct=40.0)
    assert result.is_concentrated is True
    assert "Information Technology" in result.concentration_summary
    assert "High sector concentration" in result.concentration_summary


def test_sip_math_engine_quarterly_frequency():
    sips = [
        SIPInput(
            fund_name="Mirae Asset Large Cap",
            sector="Diversified",
            monthly_amount=30000.0,
            frequency="QUARTERLY",
        ),
    ]
    # Quarterly 30,000 should normalize to 10,000/mo
    result = SIPMathEngine.compute(sips)
    assert result.total_monthly_outflow == 10000.0
    assert result.calculated_plans[0].monthly_amount == 10000.0
