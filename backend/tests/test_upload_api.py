"""
API integration tests for /portfolio/upload endpoint.
"""
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.models.schema import Portfolio, Holding, SectorAllocation
from backend.app.database import get_db
from backend.app.core.timezone import now_utc



@pytest.fixture(autouse=True)
def override_db(monkeypatch):
    from backend.app.config import get_settings
    settings = get_settings()
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    mock_session.close = AsyncMock()

    async def _mock_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = _mock_get_db
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_upload_file_size_header_guard():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        oversized = 16 * 1024 * 1024
        # Sending header content-length exceeding 15MB
        response = await client.post(
            "/portfolio/upload",
            headers={"content-length": str(oversized)},
            files={"file": ("test.pdf", b"fake content", "application/pdf")},
        )
        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "FS_FILE_4001"


@pytest.mark.asyncio
async def test_upload_disallowed_extension():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/portfolio/upload",
            files={"file": ("malicious.exe", b"binary content", "application/octet-stream")},
        )
        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "FS_FILE_4000"


@pytest.mark.asyncio
async def test_upload_success_with_mocked_agent():
    mock_portfolio = Portfolio(
        id=999,
        user_id=1,
        source_file_name="sample.csv",
        total_invested=100000.0,
        current_value=120000.0,
        absolute_return_pct=20.0,
        xirr_pct=15.0,
        is_concentrated=False,
        concentration_summary="Healthy diversification",
        extraction_status="complete",
        extraction_note=None,
        created_at=now_utc(),
        holdings=[
            Holding(
                id=1,
                portfolio_id=999,
                name="HDFC Bank",
                instrument_type="STOCK",
                sector="Financial Services",
                invested_amount=50000.0,
                current_value=60000.0,
                allocation_pct=50.0,
                created_at=now_utc(),
            ),
            Holding(
                id=2,
                portfolio_id=999,
                name="TCS",
                instrument_type="STOCK",
                sector="Information Technology",
                invested_amount=50000.0,
                current_value=60000.0,
                allocation_pct=50.0,
                created_at=now_utc(),
            ),
        ],
        sector_allocations=[
            SectorAllocation(
                id=1,
                portfolio_id=999,
                sector="Financial Services",
                allocation_pct=50.0,
                total_value=60000.0,
                computed_at=now_utc(),
            ),
            SectorAllocation(
                id=2,
                portfolio_id=999,
                sector="Information Technology",
                allocation_pct=50.0,
                total_value=60000.0,
                computed_at=now_utc(),
            ),
        ],
    )

    with patch("backend.app.routers.portfolio.FeatureService.enforce", new=AsyncMock()), \
         patch("backend.app.routers.portfolio.QuotaService.enforce", new=AsyncMock()), \
         patch("backend.app.routers.portfolio.QuotaService.record", new=AsyncMock()), \
         patch("backend.app.routers.portfolio.PortfolioIntelligenceAgent.process_document", new=AsyncMock(return_value=mock_portfolio)):

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            csv_content = b"name,sector,invested_amount,current_value\nHDFC Bank,Banking,50000,60000\nTCS,IT,50000,60000"
            response = await client.post(
                "/portfolio/upload",
                files={"file": ("holdings.csv", csv_content, "text/csv")},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["data"]["id"] == 999
            assert data["data"]["total_invested"] == 100000.0
            assert data["data"]["extraction_status"] == "complete"
            assert len(data["data"]["holdings"]) == 2
