import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.routers.auth import create_access_token
from backend.app.models.schema import User, Portfolio, Holding, SectorAllocation
from backend.app.database import AsyncSessionLocal
from sqlalchemy import select


@pytest.mark.asyncio
async def test_update_and_delete_holding():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create test user
        user_id = 999
        token = create_access_token(user_id)
        headers = {"Authorization": f"Bearer {token}"}

        # Setup test portfolio in DB
        async with AsyncSessionLocal() as db:
            # Clean any old test records
            stmt = select(Portfolio).where(Portfolio.user_id == user_id)
            res = await db.execute(stmt)
            for p in res.scalars().all():
                await db.delete(p)
            await db.commit()

            # Ensure user exists
            u_stmt = select(User).where(User.id == user_id)
            u_res = await db.execute(u_stmt)
            user = u_res.scalar_one_or_none()
            if not user:
                user = User(id=user_id, email_hash="test_user_hash_999", role="investor")
                db.add(user)
                await db.commit()

            portfolio = Portfolio(
                user_id=user_id,
                source_file_name="test.pdf",
                total_invested=100000.0,
                current_value=120000.0,
                absolute_return_pct=20.0,
            )
            db.add(portfolio)
            await db.flush()

            h1 = Holding(
                portfolio_id=portfolio.id,
                name="TCS Ltd",
                sector="Information Technology",
                invested_amount=40000.0,
                current_value=50000.0,
                allocation_pct=41.67,
                instrument_type="STOCK",
            )
            h2 = Holding(
                portfolio_id=portfolio.id,
                name="HDFC Bank",
                sector="Financial Services",
                invested_amount=60000.0,
                current_value=70000.0,
                allocation_pct=58.33,
                instrument_type="STOCK",
            )
            db.add(h1)
            db.add(h2)
            await db.commit()
            holding1_id = h1.id
            holding2_id = h2.id

        # 1. Update Holding 1
        update_resp = await client.put(
            f"/portfolio/holdings/{holding1_id}",
            json={
                "current_value": 80000.0,
                "invested_amount": 50000.0,
                "sector": "Information Technology",
            },
            headers=headers,
        )
        assert update_resp.status_code == 200
        data = update_resp.json()["data"]
        # Total invested should be 50000 + 60000 = 110000
        # Total current value should be 80000 + 70000 = 150000
        assert data["total_invested"] == 110000.0
        assert data["current_value"] == 150000.0
        assert data["absolute_return_pct"] > 0

        # 2. Delete Holding 2
        del_resp = await client.delete(
            f"/portfolio/holdings/{holding2_id}",
            headers=headers,
        )
        assert del_resp.status_code == 200
        del_data = del_resp.json()["data"]
        # Only holding 1 remains
        assert len(del_data["holdings"]) == 1
        assert del_data["current_value"] == 80000.0
        assert del_data["total_invested"] == 50000.0

        # 3. Flush portfolio data
        flush_resp = await client.delete(
            "/portfolio/flush",
            headers=headers,
        )
        assert flush_resp.status_code == 200
        flush_data = flush_resp.json()["data"]
        assert flush_data["deleted_portfolios"] >= 1

        # 4. Verify portfolio summary is now 404
        summary_resp = await client.get(
            "/portfolio/summary",
            headers=headers,
        )
        assert summary_resp.status_code == 404
