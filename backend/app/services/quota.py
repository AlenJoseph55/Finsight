"""
FinSight AI Quota Enforcement and Metering Service.

Provides deterministic enforcement and auditing for metered AI operations
(e.g., document extraction queries, chat questions, statement uploads).

Timezone Note:
  - Period start/end is always computed in UTC (consistent, unambiguous audit trail).
  - `get_status()` returns both a machine-readable UTC ISO string (`resets_at_utc`)
    and a user-friendly local-time string (`resets_at_local`) in the user's timezone.
  - Pass `user_tz` from the user's `preferences_json["timezone"]` to get localized display.
"""

from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.schema import Subscription, Plan, PlanQuota, UsageEvent
from backend.app.core.exceptions import QuotaExceededException
from backend.app.core.logging import logger
from backend.app.core.timezone import now_utc, TZ_UTC, format_reset_time

DEFAULT_FREE_LIMITS = {
    "document_uploads": 2,
    "ai_chat_queries": 10,
    "market_alert_subscriptions": 0,
    "portfolio_snapshots": 3,
}


class QuotaService:
    @staticmethod
    def get_period_start(period: str = "monthly") -> datetime:
        """
        Returns the UTC start timestamp for the current quota period.
        All comparisons are in UTC for a consistent, timezone-agnostic audit trail.
        """
        now = now_utc()
        if period == "monthly":
            return datetime(year=now.year, month=now.month, day=1, tzinfo=TZ_UTC)
        # Lifetime or unrecognized period defaults to beginning of time
        return datetime(year=1970, month=1, day=1, tzinfo=TZ_UTC)

    @classmethod
    async def get_limit(cls, quota_key: str, user_id: int, db: AsyncSession) -> int:
        """
        Fetches the limit for a quota key based on the user's active subscription tier.
        Returns -1 if unlimited. Falls back to Free tier limits if no subscription exists.
        """
        # Find active subscription
        sub_stmt = select(Subscription).where(
            Subscription.user_id == user_id,
            Subscription.status == "active",
        )
        sub_res = await db.execute(sub_stmt)
        active_sub = sub_res.scalars().first()

        plan_id = active_sub.plan_id if active_sub else None

        if plan_id:
            pq_stmt = select(PlanQuota).where(
                PlanQuota.plan_id == plan_id,
                PlanQuota.quota_key == quota_key,
            )
            pq_res = await db.execute(pq_stmt)
            plan_quota = pq_res.scalars().first()
            if plan_quota is not None:
                return plan_quota.limit_value

        # Fallback: check if a "free" plan exists in DB
        free_plan_stmt = select(Plan).where(Plan.slug == "free")
        free_plan_res = await db.execute(free_plan_stmt)
        free_plan = free_plan_res.scalars().first()
        if free_plan:
            pq_stmt = select(PlanQuota).where(
                PlanQuota.plan_id == free_plan.id,
                PlanQuota.quota_key == quota_key,
            )
            pq_res = await db.execute(pq_stmt)
            free_quota = pq_res.scalars().first()
            if free_quota is not None:
                return free_quota.limit_value

        # Hardcoded fallback safety limit
        return DEFAULT_FREE_LIMITS.get(quota_key, 2)

    @classmethod
    async def get_usage(cls, quota_key: str, user_id: int, db: AsyncSession, period: str = "monthly") -> int:
        """
        Counts usage events for the given user and quota key within the current period.
        """
        period_start = cls.get_period_start(period)
        count_stmt = select(func.count(UsageEvent.id)).where(
            UsageEvent.user_id == user_id,
            UsageEvent.quota_key == quota_key,
            UsageEvent.created_at >= period_start,
        )
        res = await db.execute(count_stmt)
        return res.scalar() or 0

    @classmethod
    async def get_status(
        cls,
        quota_key: str,
        user_id: int,
        db: AsyncSession,
        user_tz: str = "Asia/Kolkata",
    ) -> Dict[str, Any]:
        """
        Returns full status dictionary for frontend quota modals and progress bars.

        Args:
            quota_key: e.g. "document_uploads", "ai_chat_queries"
            user_id: The authenticated user's ID.
            db: Async database session.
            user_tz: IANA timezone string from user.preferences_json["timezone"].
                     Defaults to "Asia/Kolkata" (India-first). Used only for display.

        Returns:
            Dict containing:
              - resets_at_utc: ISO 8601 UTC string for machine use / API consumers.
              - resets_at_local: Human-readable reset time in the user's local timezone.
        """
        limit = await cls.get_limit(quota_key, user_id, db)
        used = await cls.get_usage(quota_key, user_id, db, period="monthly")
        now = now_utc()

        # Calculate next month's first day (UTC midnight)
        next_month = now.month + 1 if now.month < 12 else 1
        next_year = now.year if now.month < 12 else now.year + 1
        resets_at_utc = datetime(next_year, next_month, 1, tzinfo=TZ_UTC)

        remaining = -1 if limit == -1 else max(0, limit - used)
        return {
            "quota_key": quota_key,
            "used": used,
            "limit": limit,
            "remaining": remaining,
            "is_unlimited": limit == -1,
            "period": "monthly",
            "resets_at_utc": resets_at_utc.isoformat(),
            "resets_at_local": format_reset_time(resets_at_utc, user_tz),
        }

    @classmethod
    async def enforce(cls, quota_key: str, user_id: int, db: AsyncSession, user_tz: str = "Asia/Kolkata"):
        """
        Verifies if the user is allowed to perform an action.
        Raises QuotaExceededException (HTTP 429, FS_QUOTA_4290) if exhausted.
        """
        status = await cls.get_status(quota_key, user_id, db, user_tz=user_tz)
        limit = status["limit"]
        used = status["used"]

        if limit != -1 and used >= limit:
            logger.warning(
                f"Quota exceeded for user={user_id} on key={quota_key}: {used}/{limit}"
            )
            raise QuotaExceededException(
                quota_key=quota_key,
                used=used,
                limit=limit,
                resets_at=status["resets_at_utc"],
            )

    @classmethod
    async def record(
        cls,
        quota_key: str,
        user_id: int,
        db: AsyncSession,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> UsageEvent:
        """
        Appends a new usage event into the immutable ledger and flushes it to the DB.
        """
        event = UsageEvent(
            user_id=user_id,
            quota_key=quota_key,
            metadata_json=metadata or {},
        )
        db.add(event)
        await db.flush()
        logger.info(f"Recorded usage event for user={user_id}, key={quota_key}")
        return event
