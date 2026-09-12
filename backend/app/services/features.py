"""
FinSight Feature Flag & Entitlement Service.

Hierarchy of Feature Access Resolution:
1. User Feature Override (Super-Admin decision for individual user wins).
2. Subscription Plan Features (Features granted to the user's current subscription tier).
3. System Default (Feature's default_enabled status).

Performance:
- Cached in Redis (TTL 60 seconds).
- Invalidated immediately when an admin updates a user override or plan feature.
"""

from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.schema import UserFeatureOverride, Subscription, PlanFeature, Feature
from backend.app.core.exceptions import FeatureDisabledException
from backend.app.core.logging import logger

try:
    import redis.asyncio as aioredis
    from backend.app.config import get_settings
    settings = get_settings()
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
except Exception:
    redis_client = None


class FeatureService:
    @staticmethod
    def _cache_key(user_id: int, feature_key: str) -> str:
        return f"feature_flag:{user_id}:{feature_key}"

    @classmethod
    async def is_enabled(cls, feature_key: str, user_id: int, db: AsyncSession) -> bool:
        """
        Determines whether a user has access to a specific feature key.
        Checks Redis cache -> UserFeatureOverride -> PlanFeature -> Feature.default_enabled.
        """
        cache_key = cls._cache_key(user_id, feature_key)
        if redis_client:
            try:
                cached = await redis_client.get(cache_key)
                if cached is not None:
                    return cached == "1"
            except Exception as e:
                logger.warning(f"Redis cache read error for feature flag: {e}")

        # 1. Super-admin override check
        override_stmt = select(UserFeatureOverride).where(
            UserFeatureOverride.user_id == user_id,
            UserFeatureOverride.feature_key == feature_key,
        )
        override_res = await db.execute(override_stmt)
        override = override_res.scalars().first()
        if override is not None:
            await cls._set_cache(cache_key, override.enabled)
            return override.enabled

        # 2. User's active subscription tier check
        sub_stmt = select(Subscription).where(
            Subscription.user_id == user_id,
            Subscription.status == "active",
        )
        sub_res = await db.execute(sub_stmt)
        active_sub = sub_res.scalars().first()

        if active_sub:
            pf_stmt = select(PlanFeature).where(
                PlanFeature.plan_id == active_sub.plan_id,
                PlanFeature.feature_key == feature_key,
            )
            pf_res = await db.execute(pf_stmt)
            plan_feat = pf_res.scalars().first()
            if plan_feat is not None:
                await cls._set_cache(cache_key, plan_feat.enabled)
                return plan_feat.enabled

        # 3. Default fallback in features catalogue
        feat_stmt = select(Feature).where(Feature.key == feature_key)
        feat_res = await db.execute(feat_stmt)
        feature_def = feat_res.scalars().first()
        enabled = feature_def.default_enabled if feature_def else False

        await cls._set_cache(cache_key, enabled)
        return enabled

    @classmethod
    async def enforce(cls, feature_key: str, user_id: int, db: AsyncSession):
        """
        Enforces access to a feature. Raises FeatureDisabledException if user is not entitled.
        """
        has_access = await cls.is_enabled(feature_key, user_id, db)
        if not has_access:
            raise FeatureDisabledException(
                feature_key=feature_key,
                reason=f"Feature '{feature_key}' is not available on your current plan or has been disabled.",
            )

    @classmethod
    async def _set_cache(cls, key: str, value: bool, ttl: int = 60):
        if redis_client:
            try:
                await redis_client.setex(key, ttl, "1" if value else "0")
            except Exception as e:
                logger.warning(f"Redis cache write error for feature flag: {e}")

    @classmethod
    async def invalidate_user_cache(cls, user_id: int, feature_key: Optional[str] = None):
        """
        Invalidates cached feature decisions for a user.
        """
        if not redis_client:
            return
        try:
            if feature_key:
                await redis_client.delete(cls._cache_key(user_id, feature_key))
            else:
                pattern = f"feature_flag:{user_id}:*"
                keys = await redis_client.keys(pattern)
                if keys:
                    await redis_client.delete(*keys)
        except Exception as e:
            logger.warning(f"Redis cache invalidation error: {e}")
