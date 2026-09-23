"""
Tests for OAuth Authentication, JWT Verification, and Environment Guardrails.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.config import get_settings
from backend.app.routers.auth import create_access_token
from backend.app.database import engine


@pytest.fixture(autouse=True)
def clean_engine_pool():
    import asyncio
    asyncio.run(engine.dispose())
    yield
    asyncio.run(engine.dispose())


@pytest.mark.asyncio
async def test_auth_and_environment_guardrails_lifecycle(monkeypatch):
    """
    Comprehensive test covering:
    1. Dev mode unauthenticated fallback to demo account.
    2. Dev OAuth simulator issuing valid JWT and user record.
    3. Authenticated requests with Bearer token.
    4. Production guardrails blocking demo login, dev-oauth, and sample seeds.
    5. Production authenticated request succeeding with valid JWT.
    """
    settings = get_settings()
    original_env = settings.ENVIRONMENT

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # -------------------------------------------------------------
            # 1. Development Mode: Unauthenticated Fallback
            # -------------------------------------------------------------
            monkeypatch.setattr(settings, "ENVIRONMENT", "development")
            res_me_demo = await client.get("/auth/me")
            assert res_me_demo.status_code == 200
            demo_data = res_me_demo.json()["data"]
            assert demo_data["user"]["id"] == 1
            assert demo_data["user"]["is_demo"] is True
            assert demo_data["is_demo_allowed"] is True

            # -------------------------------------------------------------
            # 2. Development Mode: Dev OAuth Simulator
            # -------------------------------------------------------------
            res_oauth = await client.post(
                "/auth/dev-oauth",
                json={
                    "email": "test.analyst@example.com",
                    "display_name": "Test Analyst",
                    "role": "investor",
                },
            )
            assert res_oauth.status_code == 200
            oauth_data = res_oauth.json()
            assert "access_token" in oauth_data
            assert oauth_data["token_type"] == "bearer"
            assert oauth_data["user"]["display_name"] == "Test Analyst"
            assert oauth_data["user"]["role"] == "investor"
            assert oauth_data["user"]["is_demo"] is False
            assert oauth_data["user"]["auth_method"] == "google_oauth"

            token = oauth_data["access_token"]

            # Mitigation H1: Dev-oauth rejects arbitrary roles
            res_invalid_role = await client.post(
                "/auth/dev-oauth",
                json={"email": "hacker@example.com", "role": "unauthorized_role"},
            )
            assert res_invalid_role.status_code == 422

            # Create super-admin session for later production RBAC test
            res_admin_oauth = await client.post(
                "/auth/dev-oauth",
                json={
                    "email": "super.admin@example.com",
                    "display_name": "Super Administrator",
                    "role": "super_admin",
                },
            )
            assert res_admin_oauth.status_code == 200
            admin_token = res_admin_oauth.json()["access_token"]

            # -------------------------------------------------------------
            # 3. Authenticated Request using Bearer Token
            # -------------------------------------------------------------
            res_me_auth = await client.get(
                "/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert res_me_auth.status_code == 200
            auth_user = res_me_auth.json()["data"]["user"]
            assert auth_user["display_name"] == "Test Analyst"
            assert auth_user["is_demo"] is False

            # Update preferences with token
            res_pref = await client.patch(
                "/auth/preferences",
                headers={"Authorization": f"Bearer {token}"},
                json={"timezone": "Asia/Kolkata", "currency": "INR"},
            )
            assert res_pref.status_code == 200

            # -------------------------------------------------------------
            # 4. Production Mode Guardrails
            # -------------------------------------------------------------
            monkeypatch.setattr(settings, "ENVIRONMENT", "production")

            # 4a. Dev OAuth simulator must be rejected with 403 Forbidden
            res_prod_oauth = await client.post(
                "/auth/dev-oauth",
                json={"email": "hacker@demo.internal"},
            )
            assert res_prod_oauth.status_code == 403
            err_msg = res_prod_oauth.json().get("error", {}).get("message") or res_prod_oauth.json().get("detail", "")
            assert "disabled in production" in err_msg.lower()

            # 4b. Demo login must be rejected with 403 Forbidden
            res_prod_login = await client.post(
                "/auth/login",
                json={"email": "demo@user.com"},
            )
            assert res_prod_login.status_code == 403

            # 4c. Unauthenticated request to /auth/me must return 401 Unauthorized
            res_prod_unauth = await client.get("/auth/me")
            assert res_prod_unauth.status_code == 401

            # 4d. Unauthenticated request to portfolio summary must return 401
            res_prod_summary = await client.get("/portfolio/summary")
            assert res_prod_summary.status_code == 401

            # 4e. Demo portfolio seeding must be rejected in production (401 or 403)
            res_prod_seed = await client.post("/portfolio/seed-sample")
            assert res_prod_seed.status_code in [401, 403]

            # 4f. Demo SIP seeding must be rejected in production (401 or 403)
            res_prod_sip_seed = await client.post("/sip/seed-sample")
            assert res_prod_sip_seed.status_code in [401, 403]

            # -------------------------------------------------------------
            # 5. Production Mode with Valid Bearer Token: Must Succeed
            # -------------------------------------------------------------
            res_prod_auth = await client.get(
                "/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert res_prod_auth.status_code == 200
            prod_data = res_prod_auth.json()["data"]
            assert prod_data["user"]["display_name"] == "Test Analyst"
            assert prod_data["environment"] == "production"
            assert prod_data["is_demo_allowed"] is False

            # -------------------------------------------------------------
            # 6. Admin Authentication & Role Enforcement (Tier 1 Allowlist)
            # -------------------------------------------------------------
            # 6a. Legacy /auth/admin-login endpoint must be completely removed (404)
            res_legacy_admin = await client.post(
                "/auth/admin-login",
                json={"admin_key": "any-secret-key"},
            )
            assert res_legacy_admin.status_code == 404

            # 6b. In production: regular investor token calling /admin/plans must return 403
            res_investor_admin = await client.get(
                "/admin/plans",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert res_investor_admin.status_code == 403

            # 6c. In production: super_admin token calling /admin/plans must succeed (200)
            res_super_admin = await client.get(
                "/admin/plans",
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert res_super_admin.status_code == 200
            assert res_super_admin.json()["success"] is True

            # 6d. Test admin_emails_list property parsing and case normalization
            monkeypatch.setattr(settings, "ADMIN_EMAILS", "Alen@FinSight.dev, superAdmin@Example.com ")
            assert "alen@finsight.dev" in settings.admin_emails_list
            assert "superadmin@example.com" in settings.admin_emails_list
            assert len(settings.admin_emails_list) == 2

    finally:
        monkeypatch.setattr(settings, "ENVIRONMENT", original_env)

