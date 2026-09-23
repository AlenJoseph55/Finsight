"""
Unit tests for PortfolioIntelligenceAgent and extraction pipeline.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from backend.app.agents.portfolio_agent import PortfolioIntelligenceAgent
from backend.app.core.exceptions import ErrorCode, FinSightException
from backend.app.llm.providers.base import LLMResponse
from backend.app.schemas.document import ExtractedHolding, ExtractedStatement
from backend.app.services.crypto import decrypt_text


@pytest.fixture
def mock_extracted_statement():
    return ExtractedStatement(
        investor_name="Alen FinSight User",
        statement_period="Jan 2026 - Mar 2026",
        currency="INR",
        holdings=[
            ExtractedHolding(
                name="HDFC Bank Limited",
                symbol="HDFCBANK.NS",
                instrument_type="STOCK",
                sector="Banking",  # Should be normalized to Financial Services
                invested_amount=50000.0,
                current_value=60000.0,
            ),
            ExtractedHolding(
                name="Infosys Limited",
                symbol="INFY.NS",
                instrument_type="STOCK",
                sector="IT",  # Should be normalized to Information Technology
                invested_amount=40000.0,
                current_value=45000.0,
            ),
        ],
        extraction_notes=None,
    )


@pytest.mark.asyncio
async def test_agent_process_document_success(mock_extracted_statement):
    mock_router = MagicMock()
    mock_router.complete = AsyncMock(return_value=LLMResponse(
        content="{}",
        parsed=mock_extracted_statement,
        provider="gemini",
        model="gemini-1.5-flash",
        prompt_tokens=100,
        completion_tokens=50,
        cost_usd=0.001,
        latency_ms=200.0,
        fallback_used=False,
    ))
    mock_router.embed = AsyncMock(return_value=[[0.1] * 768])

    agent = PortfolioIntelligenceAgent(router=mock_router)

    # Mock DB session
    mock_db = MagicMock()
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()

    # Mock execute for refreshed portfolio
    mock_portfolio = MagicMock()
    mock_portfolio.id = 42
    mock_portfolio.investor_name_encrypted = "cipher_text"
    mock_portfolio.extraction_status = "complete"

    mock_result = MagicMock()
    mock_result.scalar_one.return_value = mock_portfolio
    mock_db.execute = AsyncMock(return_value=mock_result)

    csv_data = b"dummy,csv,data\n1,2,3"
    portfolio = await agent.process_document(
        file_bytes=csv_data,
        filename="test.csv",
        user_id=1,
        db=mock_db,
    )

    assert portfolio is not None
    assert mock_router.complete.called
    assert mock_db.commit.called


def test_extraction_quality_assessment():
    # 1. Complete statement
    complete_stmt = ExtractedStatement(
        holdings=[
            ExtractedHolding(name="Stock A", invested_amount=100.0, current_value=120.0),
            ExtractedHolding(name="Stock B", invested_amount=200.0, current_value=220.0),
        ]
    )
    status, note = PortfolioIntelligenceAgent._assess_extraction_quality(complete_stmt)
    assert status == "complete"
    assert note is None

    # 2. Partial statement (zero values)
    partial_stmt = ExtractedStatement(
        holdings=[
            ExtractedHolding(name="Stock A", invested_amount=0.0, current_value=0.0),
        ]
    )
    status, note = PortfolioIntelligenceAgent._assess_extraction_quality(partial_stmt)
    assert status == "partial"
    assert "Stock A" in note

    # 3. Failed statement (0 holdings)
    empty_stmt = ExtractedStatement(holdings=[])
    status, note = PortfolioIntelligenceAgent._assess_extraction_quality(empty_stmt)
    assert status == "failed"


def test_holdings_matching_logic():
    from backend.app.agents.portfolio_agent import _holdings_match

    # Exact match
    assert _holdings_match("HDFC Bank Limited", "HDFC Bank Limited") is True
    # Stop words / punctuation normalization
    assert _holdings_match("Parag Parikh Flexi Cap Fund Direct Growth", "Parag Parikh Flexi Cap Fund - Direct Plan - Growth") is True
    assert _holdings_match("HDFC Bank Ltd", "HDFC Bank Limited") is True
    # Symbol match
    assert _holdings_match("Tata Consultancy", "TCS", symbol1="TCS.NS", symbol2="TCS.NS") is True
    # Different funds should NOT match
    assert _holdings_match("Nippon India Small Cap Fund", "Nippon India Large Cap Fund") is False
    assert _holdings_match("HDFC Bank", "ICICI Bank") is False


@pytest.mark.asyncio
async def test_agent_process_document_additive(mock_extracted_statement):
    """
    Test that uploading a new document adds new holdings to an existing portfolio
    instead of overwriting them.
    """
    from backend.app.models.schema import Portfolio, Holding, SectorAllocation
    from backend.app.core.timezone import now_utc

    mock_router = MagicMock()
    # Mock statement contains: Reliance (new) and HDFC Bank (overlap/existing)
    second_statement = ExtractedStatement(
        investor_name="Alen FinSight User",
        statement_period="Jan 2026",
        currency="INR",
        holdings=[
            ExtractedHolding(
                name="Reliance Industries Limited",
                symbol="RELIANCE.NS",
                instrument_type="STOCK",
                sector="Energy",
                invested_amount=60000.0,
                current_value=75000.0,
            ),
            ExtractedHolding(
                name="HDFC Bank Limited",
                symbol="HDFCBANK.NS",
                instrument_type="STOCK",
                sector="Banking",
                invested_amount=50000.0,
                current_value=60000.0,  # Same values -> overlap duplicate
            ),
        ],
    )
    mock_router.complete = AsyncMock(return_value=LLMResponse(
        content="{}",
        parsed=second_statement,
        provider="gemini",
        model="gemini-1.5-flash",
        prompt_tokens=100,
        completion_tokens=50,
        cost_usd=0.001,
        latency_ms=200.0,
        fallback_used=False,
    ))
    mock_router.embed = AsyncMock(return_value=[[0.1] * 768])

    agent = PortfolioIntelligenceAgent(router=mock_router)

    # Existing portfolio with HDFC Bank and Infosys
    existing_h1 = Holding(
        id=1,
        portfolio_id=10,
        name="HDFC Bank Limited",
        symbol="HDFCBANK.NS",
        instrument_type="STOCK",
        sector="Financial Services",
        invested_amount=50000.0,
        current_value=60000.0,
        allocation_pct=57.14,
    )
    existing_h2 = Holding(
        id=2,
        portfolio_id=10,
        name="Infosys Limited",
        symbol="INFY.NS",
        instrument_type="STOCK",
        sector="Information Technology",
        invested_amount=40000.0,
        current_value=45000.0,
        allocation_pct=42.86,
    )
    existing_portfolio = Portfolio(
        id=10,
        user_id=1,
        source_file_name="first_screenshot.png",
        total_invested=90000.0,
        current_value=105000.0,
        absolute_return_pct=16.67,
        holdings=[existing_h1, existing_h2],
        sector_allocations=[],
        created_at=now_utc(),
    )

    mock_db = MagicMock()
    mock_db.add = MagicMock(side_effect=lambda obj: existing_portfolio.holdings.append(obj) if isinstance(obj, Holding) else None)
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.delete = AsyncMock()

    # When querying existing portfolio, return existing_portfolio
    mock_query_res = MagicMock()
    mock_query_res.scalars.return_value.first.return_value = existing_portfolio
    mock_query_res.scalar_one.return_value = existing_portfolio

    mock_db.execute = AsyncMock(return_value=mock_query_res)

    res = await agent.process_document(
        file_bytes=b"Company,Amount\nReliance,60000\nHDFC,50000",
        filename="second_statement.csv",
        user_id=1,
        db=mock_db,
    )

    assert res is not None
    # All 3 holdings should now be present (HDFC Bank, Infosys, and newly added Reliance)
    holding_names = [h.name for h in existing_portfolio.holdings]
    assert "Reliance Industries Limited" in holding_names
    assert "Infosys Limited" in holding_names
    assert "HDFC Bank Limited" in holding_names
    assert len(existing_portfolio.holdings) == 3

    # Total invested should be sum: 50000 + 40000 + 60000 = 150000
    assert existing_portfolio.total_invested == 150000.0
    # Current value: 60000 + 45000 + 75000 = 180000
    assert existing_portfolio.current_value == 180000.0
    # Both sources should be tracked in source_file_name
    assert "first_screenshot.png" in existing_portfolio.source_file_name
    assert "second_statement.csv" in existing_portfolio.source_file_name
