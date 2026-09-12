"""
Automated Test Suite for FinSight SaaS Infrastructure:
1. IP Anonymization (DPDP/GDPR compliance).
2. Standard Response & Error Envelopes with ErrorCode enum.
3. LLM Router Configuration & Route Chains.
4. Market Data Service & Normalization Models.
"""

import pytest
from backend.app.core.logging import anonymize_ip
from backend.app.core.exceptions import ErrorCode, FinSightException, QuotaExceededException, FeatureDisabledException
from backend.app.core.responses import SuccessResponse, ErrorResponse, ErrorDetail
from backend.app.llm.router import LLMRouter
from backend.app.market.models import Quote, NewsItem, NAVData
from backend.app.market.service import MarketDataService


def test_ip_anonymization():
    # IPv4 masking
    assert anonymize_ip("192.168.1.100") == "192.168.1.x"
    assert anonymize_ip("103.21.244.15") == "103.21.244.x"
    assert anonymize_ip("10.0.0.1") == "10.0.0.x"
    # Unknown or internal client
    assert anonymize_ip("unknown") == "unknown"
    assert anonymize_ip("testclient") == "testclient"
    assert anonymize_ip("") == "unknown"


def test_response_envelope_structures():
    success = SuccessResponse(
        request_id="req_test_123",
        path="/test",
        data={"holdings_count": 6},
    )
    assert success.success is True
    assert success.request_id == "req_test_123"
    assert success.data["holdings_count"] == 6
    assert success.error is None

    err = ErrorResponse(
        request_id="req_test_456",
        path="/upload",
        error=ErrorDetail(
            code=ErrorCode.FS_QUOTA_4290.value,
            http_status=429,
            message="Monthly limit reached",
            details={"used": 2, "limit": 2},
        ),
    )
    assert err.success is False
    assert err.error.code == "FS_QUOTA_4290"
    assert err.error.http_status == 429
    assert err.error.details["used"] == 2


def test_exception_properties():
    quota_exc = QuotaExceededException(quota_key="document_uploads", used=2, limit=2)
    assert quota_exc.code == ErrorCode.FS_QUOTA_4290
    assert quota_exc.http_status == 429
    assert quota_exc.details["used"] == 2
    assert quota_exc.details["limit"] == 2

    feat_exc = FeatureDisabledException(feature_key="market_alerts_news")
    assert feat_exc.code == ErrorCode.FS_FEATURE_4031
    assert feat_exc.http_status == 403
    assert feat_exc.details["feature_key"] == "market_alerts_news"


def test_llm_router_yaml_configs():
    router = LLMRouter()
    # Check loaded providers
    assert "gemini" in router.providers
    assert "groq" in router.providers
    assert "openai" in router.providers

    # Check route chains
    extraction_chain = router.get_route_chain("extraction")
    assert extraction_chain[0] == "gemini"
    assert "groq" in extraction_chain

    research_chain = router.get_route_chain("research")
    assert research_chain[0] == "groq"
    assert "gemini" in research_chain


def test_market_data_models():
    quote = Quote(
        symbol="HDFCBANK.NS",
        exchange="NSE",
        price=1650.50,
        change_pct=1.2,
        volume=10000,
        source="yfinance",
    )
    assert quote.symbol == "HDFCBANK.NS"
    assert quote.currency == "INR"
    assert quote.price == 1650.50

    news = NewsItem(
        headline="RBI keeps repo rate unchanged at 6.5%",
        summary="Monetary Policy Committee retains status quo.",
        published_at="2026-09-12T10:00:00Z",
        sectors=["Financials", "Banking"],
        source="finnhub",
    )
    assert news.sectors == ["Financials", "Banking"]
    assert news.source == "finnhub"
