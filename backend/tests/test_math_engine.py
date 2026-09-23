"""
Unit Tests for the Deterministic Financial Math Engine.

Ensures that financial arithmetic, percentage weights, returns, and concentration
thresholds are 100% exact and never hallucinated.
"""

from backend.app.services.math_engine import FinancialMathEngine, HoldingInput


def test_empty_portfolio():
    result = FinancialMathEngine.compute([])
    assert result.total_invested == 0.0
    assert result.current_value == 0.0
    assert result.absolute_return_pct == 0.0
    assert result.is_concentrated is False
    assert len(result.holdings) == 0


def test_user_screenshot_portfolio_math():
    """
    Tests the exact portfolio from the user's uploaded spec:
    Invested: ₹8,40,000 | Current: ₹9,76,000 | Return: 16.19% (~16.2%)
    """
    sample_holdings = [
        # Mutual Funds
        HoldingInput(name="Parag Parikh Flexi Cap", sector="Multi-Cap", invested_amount=200000.0, current_value=245000.0),
        HoldingInput(name="HDFC Mid Cap", sector="Mid-Cap", invested_amount=150000.0, current_value=180000.0),
        HoldingInput(name="Motilal Oswal Nasdaq 100", sector="US Tech", invested_amount=100000.0, current_value=122000.0),
        # Direct Stocks
        HoldingInput(name="HDFC Bank", sector="Financials", invested_amount=160000.0, current_value=175000.0),
        HoldingInput(name="Reliance", sector="Energy", invested_amount=120000.0, current_value=134000.0),
        HoldingInput(name="TCS", sector="Technology", invested_amount=110000.0, current_value=120000.0),
    ]

    result = FinancialMathEngine.compute(sample_holdings, concentration_threshold_pct=30.0)

    # Assert exact sums
    assert result.total_invested == 840000.0
    assert result.current_value == 976000.0
    
    # Assert return calculation
    # (976000 - 840000) / 840000 * 100 = 16.1904... -> 16.19%
    assert result.absolute_return_pct == 16.19

    # Assert sum of holding allocations equals 100%
    total_alloc_pct = sum(h.allocation_pct for h in result.holdings)
    assert abs(total_alloc_pct - 100.0) < 0.2

    # Assert audit trail is present and explainable
    assert len(result.audit_trail) > 0
    assert any("Computed total_invested" in log for log in result.audit_trail)


def test_concentration_risk_detection():
    """
    Tests that concentration warning triggers when a single specific sector exceeds threshold.
    """
    skewed_holdings = [
        HoldingInput(name="HDFC Bank", sector="Financials", invested_amount=300000.0, current_value=350000.0),
        HoldingInput(name="ICICI Bank", sector="Financials", invested_amount=200000.0, current_value=250000.0),
        HoldingInput(name="TCS", sector="Technology", invested_amount=100000.0, current_value=100000.0),
    ]

    # Total = 700,000. Financials = 600,000 / 700,000 = 85.7% (Exceeds 40% threshold)
    result = FinancialMathEngine.compute(skewed_holdings, concentration_threshold_pct=40.0)

    assert result.is_concentrated is True
    assert "Financials" in result.concentration_summary
    assert result.sector_allocations["Financials"] > 80.0


def test_diversified_sector_does_not_trigger_false_concentration():
    """
    Tests that broad diversified mutual funds and index funds (e.g. 'Diversified')
    do not trigger a false single-sector concentration warning even if > 30%.
    """
    holdings = [
        HoldingInput(name="Nifty 50 Index Fund", sector="Diversified", invested_amount=400000.0, current_value=450000.0),
        HoldingInput(name="Parag Parikh Flexi Cap", sector="Diversified", invested_amount=300000.0, current_value=350000.0),
        HoldingInput(name="TCS", sector="Technology", invested_amount=150000.0, current_value=200000.0),
    ]
    # Total = 1,000,000. Diversified = 800,000 (80.0%). Tech = 200,000 (20.0%).
    result = FinancialMathEngine.compute(holdings, concentration_threshold_pct=30.0)
    assert result.is_concentrated is False
    assert "well diversified" in result.concentration_summary.lower()
