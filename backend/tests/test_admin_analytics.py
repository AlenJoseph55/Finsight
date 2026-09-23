"""
Unit tests for Super-Admin Analytics & Web Behavior Ingestion Endpoints.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app


@pytest.mark.asyncio
async def test_admin_analytics_full_suite(monkeypatch):
    from backend.app.config import get_settings
    settings = get_settings()
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Collect Pageview
        res_pv = await client.post(
            "/analytics/collect",
            json={
                "type": "pageview",
                "path": "/dashboard",
                "title": "FinSight Terminal",
                "referrer": "https://google.com",
                "duration_seconds": 35,
            },
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"},
        )
        assert res_pv.status_code == 200
        data_pv = res_pv.json()
        assert data_pv["success"] is True
        assert "session_id" in data_pv["data"]

        session_id = data_pv["data"]["session_id"]

        # 2. Collect Behavioral Event
        res_ev = await client.post(
            "/analytics/collect",
            json={
                "type": "event",
                "session_id": session_id,
                "category": "feature_use",
                "action": "scrub_wealth_graph",
                "label": "15_years",
                "value": 15.0,
            },
        )
        assert res_ev.status_code == 200
        assert res_ev.json()["success"] is True

        # 3. Overview Analytics (requires super_admin privileges)
        res_adm = await client.post(
            "/auth/dev-oauth",
            json={
                "email": "analytics.admin@example.com",
                "display_name": "Analytics Admin",
                "role": "super_admin",
            },
        )
        assert res_adm.status_code == 200
        admin_token = res_adm.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        res_ov = await client.get("/admin/analytics/overview", headers=admin_headers)
        assert res_ov.status_code == 200
        data_ov = res_ov.json()["data"]
        assert "users" in data_ov
        assert "financials" in data_ov
        assert "subscriptions" in data_ov
        assert "ai_economics" in data_ov
        assert "document_pipeline" in data_ov
        assert "web_traffic" in data_ov
        assert "system_health" in data_ov

        # 4. Web Analytics
        res_web = await client.get("/admin/analytics/web?days=14", headers=admin_headers)
        assert res_web.status_code == 200
        data_web = res_web.json()["data"]
        assert "total_pageviews" in data_web
        assert "unique_visitors" in data_web
        assert "daily_trend" in data_web
        assert "top_pages" in data_web
        assert "devices" in data_web
        assert "browsers" in data_web

        # 5. Behavioral Analytics
        res_beh = await client.get("/admin/analytics/behavior", headers=admin_headers)
        assert res_beh.status_code == 200
        data_beh = res_beh.json()["data"]
        assert "exploration_funnel" in data_beh
        assert "feature_leaderboard" in data_beh

        # 6. LLM Analytics
        res_llm = await client.get("/admin/analytics/llm", headers=admin_headers)
        assert res_llm.status_code == 200
        data_llm = res_llm.json()["data"]
        assert "total_tokens" in data_llm
        assert "cost_usd" in data_llm
        assert "cost_inr" in data_llm
        assert "by_provider" in data_llm

        # 7. Document Analytics
        res_doc = await client.get("/admin/analytics/documents", headers=admin_headers)
        assert res_doc.status_code == 200
        data_doc = res_doc.json()["data"]
        assert "total_vector_chunks" in data_doc

        # 8. User Directory
        res_usr = await client.get("/admin/users", headers=admin_headers)
        assert res_usr.status_code == 200
        assert isinstance(res_usr.json()["data"], list)
