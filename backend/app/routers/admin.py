"""
FinSight Super-Admin Router.
Provides administrative controls for:
- User subscription plans & quota management.
- Per-user and per-plan feature flag overrides.
- Seeding default SaaS tiers (Free, Pro, Enterprise).
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.schema import (
    User,
    Plan,
    PlanQuota,
    PlanFeature,
    Feature,
    Subscription,
    UserFeatureOverride,
    UsageEvent,
)
from backend.app.core.responses import SuccessResponse
from backend.app.core.context import request_id_ctx
from backend.app.services.features import FeatureService
from backend.app.services.quota import QuotaService

router = APIRouter(prefix="/admin", tags=["Super Admin"])


# --- Schemas ---
class FeatureOverrideRequest(BaseModel):
    feature_key: str
    enabled: bool
    reason: Optional[str] = "Admin override"


class AssignPlanRequest(BaseModel):
    plan_slug: str


@router.post("/seed-saas-defaults", response_model=SuccessResponse[Dict[str, str]])
async def seed_saas_defaults(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Initializes default SaaS plans (Free, Pro, Enterprise), features catalog,
    plan quotas, and plan feature assignments.
    """
    req_id = request_id_ctx.get()

    # 1. Feature catalogue
    features_data = [
        ("portfolio_upload", "Portfolio Upload", "Upload statements via PDF/screenshot", True),
        ("portfolio_ai_extraction", "AI Document Extraction", "Agent 1 document parsing with Gemini", False),
        ("market_alerts_news", "News-based Market Alerts", "Agent 3 sector news monitoring & alert generation", False),
        ("market_alerts_price", "Price-based Market Alerts", "Agent 3 price anomaly triggers", False),
        ("research_assistant", "AI Research Assistant", "Agent 2 interactive RAG chat", False),
        ("export_reports", "Export Reports", "PDF/Excel report download", False),
    ]

    for key, name, desc, default_on in features_data:
        res = await db.execute(select(Feature).where(Feature.key == key))
        if not res.scalars().first():
            db.add(Feature(key=key, name=name, description=desc, default_enabled=default_on))

    await db.flush()

    # 2. Plans and Quotas
    tiers = [
        {
            "slug": "free",
            "name": "Free Tier",
            "price": 0.0,
            "quotas": {
                "document_uploads": 2,
                "ai_chat_queries": 10,
                "market_alert_subscriptions": 0,
                "portfolio_snapshots": 3,
            },
            "features": {
                "portfolio_upload": True,
                "portfolio_ai_extraction": False,
                "market_alerts_news": False,
                "market_alerts_price": False,
                "research_assistant": False,
                "export_reports": False,
            },
        },
        {
            "slug": "pro",
            "name": "Pro Tier",
            "price": 999.0,  # INR 999/month
            "quotas": {
                "document_uploads": 20,
                "ai_chat_queries": 500,
                "market_alert_subscriptions": 50,
                "portfolio_snapshots": -1,  # unlimited
            },
            "features": {
                "portfolio_upload": True,
                "portfolio_ai_extraction": True,
                "market_alerts_news": True,
                "market_alerts_price": True,
                "research_assistant": True,
                "export_reports": True,
            },
        },
        {
            "slug": "enterprise",
            "name": "Enterprise Tier",
            "price": 4999.0,
            "quotas": {
                "document_uploads": -1,
                "ai_chat_queries": -1,
                "market_alert_subscriptions": -1,
                "portfolio_snapshots": -1,
            },
            "features": {
                "portfolio_upload": True,
                "portfolio_ai_extraction": True,
                "market_alerts_news": True,
                "market_alerts_price": True,
                "research_assistant": True,
                "export_reports": True,
            },
        },
    ]

    for tier in tiers:
        res = await db.execute(select(Plan).where(Plan.slug == tier["slug"]))
        plan = res.scalars().first()
        if not plan:
            plan = Plan(slug=tier["slug"], name=tier["name"], price_monthly_inr=tier["price"])
            db.add(plan)
            await db.flush()

        # Seed quotas
        for q_key, limit in tier["quotas"].items():
            pq_res = await db.execute(
                select(PlanQuota).where(PlanQuota.plan_id == plan.id, PlanQuota.quota_key == q_key)
            )
            if not pq_res.scalars().first():
                db.add(PlanQuota(plan_id=plan.id, quota_key=q_key, limit_value=limit))

        # Seed features
        for f_key, enabled in tier["features"].items():
            pf_res = await db.execute(
                select(PlanFeature).where(PlanFeature.plan_id == plan.id, PlanFeature.feature_key == f_key)
            )
            if not pf_res.scalars().first():
                db.add(PlanFeature(plan_id=plan.id, feature_key=f_key, enabled=enabled))

    await db.commit()

    return SuccessResponse(
        request_id=req_id,
        path=request.url.path,
        data={"message": "Default SaaS plans (Free, Pro, Enterprise), quotas, and features initialized."},
    )


@router.get("/plans", response_model=SuccessResponse[List[Dict[str, Any]]])
async def list_plans(request: Request, db: AsyncSession = Depends(get_db)):
    """Lists all subscription plans with their quota limits and features."""
    req_id = request_id_ctx.get()
    res = await db.execute(select(Plan))
    plans = res.scalars().all()
    out = []
    for p in plans:
        q_res = await db.execute(select(PlanQuota).where(PlanQuota.plan_id == p.id))
        quotas = {q.quota_key: q.limit_value for q in q_res.scalars().all()}

        f_res = await db.execute(select(PlanFeature).where(PlanFeature.plan_id == p.id))
        features = {f.feature_key: f.enabled for f in f_res.scalars().all()}

        out.append({
            "id": p.id,
            "slug": p.slug,
            "name": p.name,
            "price_monthly_inr": p.price_monthly_inr,
            "quotas": quotas,
            "features": features,
        })

    return SuccessResponse(request_id=req_id, path=request.url.path, data=out)


@router.post("/users/{user_id}/features/override", response_model=SuccessResponse[Dict[str, Any]])
async def override_user_feature(
    user_id: int,
    body: FeatureOverrideRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Super-Admin power: Overrides feature availability for a specific user.
    Immediately invalidates Redis feature cache for immediate effect.
    """
    req_id = request_id_ctx.get()
    res = await db.execute(
        select(UserFeatureOverride).where(
            UserFeatureOverride.user_id == user_id,
            UserFeatureOverride.feature_key == body.feature_key,
        )
    )
    existing = res.scalars().first()
    if existing:
        existing.enabled = body.enabled
        existing.reason = body.reason
    else:
        override = UserFeatureOverride(
            user_id=user_id,
            feature_key=body.feature_key,
            enabled=body.enabled,
            reason=body.reason,
        )
        db.add(override)

    await db.commit()
    # Invalidate Redis cache
    await FeatureService.invalidate_user_cache(user_id, body.feature_key)

    return SuccessResponse(
        request_id=req_id,
        path=request.url.path,
        data={
            "user_id": user_id,
            "feature_key": body.feature_key,
            "enabled": body.enabled,
            "status": "override_applied",
        },
    )


@router.delete("/users/{user_id}/features/override/{feature_key}", response_model=SuccessResponse[Dict[str, Any]])
async def delete_user_feature_override(
    user_id: int,
    feature_key: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Deletes an admin override, restoring standard subscription tier logic."""
    req_id = request_id_ctx.get()
    await db.execute(
        delete(UserFeatureOverride).where(
            UserFeatureOverride.user_id == user_id,
            UserFeatureOverride.feature_key == feature_key,
        )
    )
    await db.commit()
    await FeatureService.invalidate_user_cache(user_id, feature_key)
    return SuccessResponse(
        request_id=req_id,
        path=request.url.path,
        data={"user_id": user_id, "feature_key": feature_key, "status": "override_removed"},
    )


@router.get("/users/{user_id}/quotas", response_model=SuccessResponse[Dict[str, Any]])
async def get_user_quotas(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Returns current quota limits and usage for all metered features for a user.
    Timezone: resets_at_local is shown in the user's preferred timezone from preferences.
    """
    req_id = request_id_ctx.get()

    # Fetch user timezone preference for localized reset time display
    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalars().first()
    user_tz = (user.preferences_json or {}).get("timezone", "Asia/Kolkata") if user else "Asia/Kolkata"

    tracked_keys = ["document_uploads", "ai_chat_queries", "market_alert_subscriptions", "portfolio_snapshots"]
    results = {}
    for key in tracked_keys:
        results[key] = await QuotaService.get_status(key, user_id, db, user_tz=user_tz)

    return SuccessResponse(request_id=req_id, path=request.url.path, data=results)


@router.post("/users/{user_id}/plan", response_model=SuccessResponse[Dict[str, Any]])
async def assign_user_plan(
    user_id: int,
    body: AssignPlanRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Assigns a subscription plan (e.g. 'pro', 'enterprise', 'free') to a user."""
    req_id = request_id_ctx.get()
    plan_res = await db.execute(select(Plan).where(Plan.slug == body.plan_slug))
    plan = plan_res.scalars().first()
    if not plan:
        raise FinSightException(
            code=ErrorCode.FS_NOT_FOUND_4040,
            message=f"Plan '{body.plan_slug}' not found.",
            http_status=404,
        )

    sub_res = await db.execute(select(Subscription).where(Subscription.user_id == user_id))
    sub = sub_res.scalars().first()
    if sub:
        sub.plan_id = plan.id
        sub.status = "active"
    else:
        sub = Subscription(user_id=user_id, plan_id=plan.id, status="active")
        db.add(sub)

    await db.commit()
    await FeatureService.invalidate_user_cache(user_id)

    return SuccessResponse(
        request_id=req_id,
        path=request.url.path,
        data={"user_id": user_id, "plan_slug": plan.slug, "plan_name": plan.name, "status": "assigned"},
    )
