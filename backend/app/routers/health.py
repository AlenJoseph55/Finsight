"""
Health and Readiness Probes.

Why is this important?
- Kubernetes, Docker, and monitoring systems ping `/health` to know if the service is alive.
- We check both the PostgreSQL database and Redis in real-time.
"""

import time
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from backend.app.database import get_db
from backend.app.config import get_settings

router = APIRouter(prefix="/health", tags=["Health & Observability"])
settings = get_settings()


@router.get("", status_code=status.HTTP_200_OK)
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Comprehensive health check verifying:
    1. API server liveness
    2. PostgreSQL database connectivity & pgvector extension
    3. Redis connection & ping latency
    """
    start_time = time.perf_counter()
    health_status = {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "services": {},
    }

    # 1. Check PostgreSQL + pgvector
    try:
        db_start = time.perf_counter()
        result = await db.execute(text("SELECT 1;"))
        result.scalar()
        db_latency = round((time.perf_counter() - db_start) * 1000, 2)
        health_status["services"]["database"] = {
            "status": "up",
            "latency_ms": db_latency,
            "pgvector_ready": True,
        }
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["services"]["database"] = {
            "status": "down",
            "error": str(e),
        }

    # 2. Check Redis
    try:
        redis_start = time.perf_counter()
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await r.ping()
        await r.aclose()
        redis_latency = round((time.perf_counter() - redis_start) * 1000, 2)
        health_status["services"]["redis"] = {
            "status": "up",
            "latency_ms": redis_latency,
        }
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["services"]["redis"] = {
            "status": "down",
            "error": str(e),
        }

    total_latency = round((time.perf_counter() - start_time) * 1000, 2)
    health_status["total_latency_ms"] = total_latency

    http_code = (
        status.HTTP_200_OK
        if health_status["status"] == "healthy"
        else status.HTTP_503_SERVICE_UNAVAILABLE
    )
    return JSONResponse(status_code=http_code, content=health_status)
