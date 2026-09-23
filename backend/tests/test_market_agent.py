"""
Unit tests for MarketMonitorAgent (Agent 3) and alerts correlation.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from backend.app.agents.market_agent import MarketMonitorAgent
from backend.app.llm.providers.base import LLMResponse
from backend.app.models.schema import Alert, Holding, MarketEvent, Portfolio, SectorAllocation, SipPlan, User
from backend.app.schemas.alert import NewsClassification


def test_news_classification_schema():
    data = {
        "sectors_affected": ["Financial Services", "Banking"],
        "severity": "WARNING",
        "sentiment": "NEGATIVE",
        "one_line_summary": "RBI rate hike impacts retail lending margins.",
        "is_portfolio_relevant": True,
    }
    obj = NewsClassification.model_validate(data)
    assert obj.severity == "WARNING"
    assert "Financial Services" in obj.sectors_affected
    assert obj.is_portfolio_relevant is True


@pytest.mark.asyncio
async def test_market_agent_classify_headline_with_llm():
    mock_classification = NewsClassification(
        sectors_affected=["Financial Services"],
        severity="WARNING",
        sentiment="NEGATIVE",
        one_line_summary="RBI signals elevated risk weights.",
        is_portfolio_relevant=True,
    )

    mock_router = MagicMock()
    mock_router.complete = AsyncMock(
        return_value=LLMResponse(
            content="{}",
            parsed=mock_classification,
            provider="groq",
            model="llama-3.3-70b-versatile",
            prompt_tokens=100,
            completion_tokens=40,
            cost_usd=0.0001,
            latency_ms=120.0,
            fallback_used=False,
        )
    )

    agent = MarketMonitorAgent(router=mock_router)
    result = await agent.classify_headline("RBI signals liquidity tightening", "Details here")
    assert result is not None
    assert result.severity == "WARNING"
    assert "Financial Services" in result.sectors_affected
    assert mock_router.complete.called


@pytest.mark.asyncio
async def test_correlate_event_matching_portfolio():
    agent = MarketMonitorAgent()

    mock_db = MagicMock()
    user = User(id=1, email_hash="hash1")
    portfolio = Portfolio(id=10, user_id=1)
    holding1 = Holding(id=101, portfolio_id=10, name="HDFC Bank Ltd", sector="Financial Services")
    holding2 = Holding(id=102, portfolio_id=10, name="TCS", sector="Information Technology")
    portfolio.holdings = [holding1, holding2]
    sa1 = SectorAllocation(portfolio_id=10, sector="Financial Services", allocation_pct=25.0, total_value=50000.0)
    portfolio.sector_allocations = [sa1]

    # Mock user query
    user_res_mock = MagicMock()
    user_res_mock.scalars.return_value.all.return_value = [user]

    # Mock portfolio query
    port_res_mock = MagicMock()
    port_res_mock.scalars.return_value.first.return_value = portfolio

    # Mock sip query
    sip_res_mock = MagicMock()
    sip_res_mock.scalars.return_value.all.return_value = []

    mock_db.execute = AsyncMock(side_effect=[user_res_mock, port_res_mock, sip_res_mock])
    mock_db.add = MagicMock()

    event = MarketEvent(
        id=5,
        headline="RBI Hikes Repo Rate",
        summary="Borrowing costs set to increase.",
        sectors_affected=["Financial Services"],
        severity="WARNING",
    )

    alerts = await agent.correlate_event_with_users(mock_db, event)
    assert len(alerts) == 1
    assert alerts[0].user_id == 1
    assert alerts[0].event_id == 5
    assert "Financial Services" in alerts[0].title
    assert "HDFC Bank Ltd" in alerts[0].message
    assert "25.0%" in alerts[0].message


@pytest.mark.asyncio
async def test_correlate_event_no_match():
    agent = MarketMonitorAgent()

    mock_db = MagicMock()
    user = User(id=1, email_hash="hash1")
    portfolio = Portfolio(id=10, user_id=1)
    holding1 = Holding(id=101, portfolio_id=10, name="TCS", sector="Information Technology")
    portfolio.holdings = [holding1]
    portfolio.sector_allocations = []

    user_res_mock = MagicMock()
    user_res_mock.scalars.return_value.all.return_value = [user]

    port_res_mock = MagicMock()
    port_res_mock.scalars.return_value.first.return_value = portfolio

    sip_res_mock = MagicMock()
    sip_res_mock.scalars.return_value.all.return_value = []

    mock_db.execute = AsyncMock(side_effect=[user_res_mock, port_res_mock, sip_res_mock])
    mock_db.add = MagicMock()

    # Event affects Realty only
    event = MarketEvent(
        id=6,
        headline="Commercial Real Estate Slump",
        summary="Vacancy rates climb.",
        sectors_affected=["Realty"],
        severity="WARNING",
    )

    alerts = await agent.correlate_event_with_users(mock_db, event)
    assert len(alerts) == 0
    assert not mock_db.add.called


def test_news_classification_with_stocks_affected():
    from backend.app.schemas.alert import StockImpact

    stock = StockImpact(
        ticker="ONGC",
        name="Oil & Natural Gas Corp",
        impact_pct="+4.2%",
        sentiment="BULLISH",
        rationale="Brent crude rally",
        is_in_portfolio=True,
    )
    assert stock.ticker == "ONGC"
    assert stock.sentiment == "BULLISH"
    assert stock.is_in_portfolio is True

    classification = NewsClassification(
        sectors_affected=["Energy"],
        topic_tag="IRAN-US ESCALATION",
        action_advice="Oil & Defence rally. Trim aviation.",
        stocks_affected=[stock],
        severity="WARNING",
        sentiment="NEGATIVE",
        one_line_summary="Crude oil surges past $90.",
        is_portfolio_relevant=True,
    )
    assert classification.topic_tag == "IRAN-US ESCALATION"
    assert len(classification.stocks_affected) == 1
    assert classification.stocks_affected[0].ticker == "ONGC"


def test_heuristic_classify_stocks_affected():
    agent = MarketMonitorAgent()
    classification = agent._heuristic_classify(
        headline="Middle East Escalation: Crude Oil Surges Past $90",
        summary="Brent spikes amid Iran conflict tensions.",
    )
    assert classification.topic_tag == "IRAN-US ESCALATION"
    assert "Energy" in classification.sectors_affected
    tickers = [s.ticker for s in classification.stocks_affected]
    assert "ONGC" in tickers
    assert "HAL" in tickers
    assert "INDIGO" in tickers
    # Verify ONGC is bullish and INDIGO is bearish
    ongc = next(s for s in classification.stocks_affected if s.ticker == "ONGC")
    indigo = next(s for s in classification.stocks_affected if s.ticker == "INDIGO")
    assert ongc.sentiment == "BULLISH"
    assert indigo.sentiment == "BEARISH"


@pytest.mark.asyncio
async def test_correlate_event_annotates_stocks_in_portfolio():
    agent = MarketMonitorAgent()

    mock_db = MagicMock()
    user = User(id=1, email_hash="hash1")
    portfolio = Portfolio(id=10, user_id=1)
    holding1 = Holding(id=101, portfolio_id=10, name="InterGlobe Aviation Ltd", sector="Automobile")
    portfolio.holdings = [holding1]
    portfolio.sector_allocations = []

    user_res_mock = MagicMock()
    user_res_mock.scalars.return_value.all.return_value = [user]

    port_res_mock = MagicMock()
    port_res_mock.scalars.return_value.first.return_value = portfolio

    sip_res_mock = MagicMock()
    sip_res_mock.scalars.return_value.all.return_value = []

    mock_db.execute = AsyncMock(side_effect=[user_res_mock, port_res_mock, sip_res_mock])
    mock_db.add = MagicMock()

    event = MarketEvent(
        id=7,
        headline="Middle East Escalation Drives Brent Crude Surge Past $90/bbl",
        summary="Aviation under pressure as fuel costs spike.",
        sectors_affected=["Energy"],
        topic_tag="IRAN-US ESCALATION",
        action_advice="Reduce aviation exposure.",
        stocks_affected=[
            {"ticker": "ONGC", "name": "Oil & Natural Gas Corp", "impact_pct": "+4.2%", "sentiment": "BULLISH"},
            {"ticker": "INDIGO", "name": "InterGlobe Aviation", "impact_pct": "-3.8%", "sentiment": "BEARISH"},
        ],
        severity="WARNING",
    )

    alerts = await agent.correlate_event_with_users(mock_db, event)
    assert len(alerts) == 1
    alert = alerts[0]
    assert alert.topic_tag == "IRAN-US ESCALATION"
    assert alert.action_advice == "Reduce aviation exposure."
    # Verify stock-level matching
    assert len(alert.stocks_affected) == 2
    indigo_stock = next(s for s in alert.stocks_affected if s["ticker"] == "INDIGO")
    ongc_stock = next(s for s in alert.stocks_affected if s["ticker"] == "ONGC")
    assert indigo_stock["is_in_portfolio"] is True
    assert ongc_stock["is_in_portfolio"] is False
    assert "InterGlobe Aviation Ltd" in alert.message

