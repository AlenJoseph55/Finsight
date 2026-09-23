"""
Unit tests for SIPIntelligenceAgent.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from backend.app.agents.sip_agent import SIPIntelligenceAgent
from backend.app.llm.providers.base import LLMResponse
from backend.app.schemas.document import ExtractedSIP, ExtractedSIPStatement


@pytest.fixture
def mock_extracted_sip_statement():
    return ExtractedSIPStatement(
        investor_name="Rahul Sharma",
        sips=[
            ExtractedSIP(
                fund_name="Parag Parikh Flexi Cap Fund",
                monthly_amount=10000.0,
                frequency="MONTHLY",
                sector="Diversified",
                instrument_type="MUTUAL_FUND",
                start_date_str="2023-01-10",
                folio_number="PPFAS-1234",
            ),
            ExtractedSIP(
                fund_name="ICICI Prudential Technology Fund",
                monthly_amount=5000.0,
                frequency="MONTHLY",
                sector="IT",  # Should normalize to Information Technology
                instrument_type="MUTUAL_FUND",
                start_date_str="2023-05-15",
                folio_number="ICICI-5678",
            ),
        ],
        extraction_notes=None,
    )


@pytest.mark.asyncio
async def test_sip_agent_process_document_success(mock_extracted_sip_statement):
    mock_router = MagicMock()
    mock_router.complete = AsyncMock(
        return_value=LLMResponse(
            content="{}",
            parsed=mock_extracted_sip_statement,
            provider="gemini",
            model="gemini-1.5-flash",
            prompt_tokens=120,
            completion_tokens=60,
            cost_usd=0.001,
            latency_ms=250.0,
            fallback_used=False,
        )
    )

    agent = SIPIntelligenceAgent(router=mock_router)

    mock_db = MagicMock()
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    # Create dummy text bytes for a CSV/PDF
    csv_bytes = b"Fund,Amount,Frequency\nParag Parikh,10000,Monthly\nICICI Tech,5000,Monthly"

    result = await agent.process_document(
        file_bytes=csv_bytes,
        filename="groww_sips.csv",
        user_id=1,
        db=mock_db,
    )

    assert result.total_monthly_outflow == 15000.0
    assert result.active_sips_count == 2
    assert len(result.sip_plans) == 2
    assert len(result.projections) == 6

    # Verify sector normalization
    sectors = [p.fund_sector for p in result.sip_plans]
    assert "Information Technology" in sectors
    assert "Diversified" in sectors
