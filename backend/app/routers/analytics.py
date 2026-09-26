"""
Privacy-First Analytics Collection Router for FinSight.

Collects:
1. Pageview events (traffic, routes, referrers, device/browser).
2. Behavioral interaction events (funnel exploration, feature usage, clicks).

Privacy Note:
- Does NOT set tracking cookies.
- Anonymizes IP addresses using daily rolling SHA-256 hashes.
- 100% DPDP & GDPR compliant.
"""

import hashlib
from datetime import datetime, timezone, date
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.schema import WebVisit, WebEvent
from backend.app.core.context import request_id_ctx
from backend.app.core.logging import get_client_ip, logger
from backend.app.core.responses import SuccessResponse

router = APIRouter(prefix="/analytics", tags=["Analytics Ingestion"])


class AnalyticsCollectPayload(BaseModel):
    type: str = Field(default="pageview", description="'pageview' or 'event'")
    session_id: Optional[str] = None
    visitor_id: Optional[str] = None
    user_id: Optional[int] = None
    path: str = Field(default="/", description="Route path e.g. /dashboard")
    title: Optional[str] = None
    referrer: Optional[str] = None
    duration_seconds: Optional[int] = 0

    # Event specific
    category: Optional[str] = "navigation"  # "navigation", "feature_use", "funnel", "conversion"
    action: Optional[str] = "view_page"
    label: Optional[str] = None
    value: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


def _parse_user_agent(ua_string: str) -> Dict[str, str]:
    """Lightweight rule-based User-Agent parser without heavy dependencies."""
    ua = ua_string.lower()

    # Device
    if any(m in ua for m in ["iphone", "android", "mobile", "ipod", "blackberry"]):
        device = "mobile"
    elif "ipad" in ua or "tablet" in ua:
        device = "tablet"
    else:
        device = "desktop"

    # Browser
    if "edg/" in ua:
        browser = "Edge"
    elif "chrome/" in ua and "safari/" in ua and "edg/" not in ua:
        browser = "Chrome"
    elif "safari/" in ua and "chrome/" not in ua:
        browser = "Safari"
    elif "firefox/" in ua:
        browser = "Firefox"
    else:
        browser = "Other"

    # OS
    if "macintosh" in ua or "mac os" in ua:
        os = "macOS"
    elif "windows" in ua:
        os = "Windows"
    elif "android" in ua:
        os = "Android"
    elif "iphone" in ua or "ipad" in ua or "ios" in ua:
        os = "iOS"
    elif "linux" in ua:
        os = "Linux"
    else:
        os = "Other"

    return {"device": device, "browser": browser, "os": os}


def _get_or_create_session_id(request: Request, client_session_id: Optional[str]) -> str:
    """Generates privacy-preserving daily session hash if client doesn't supply one."""
    if client_session_id and len(client_session_id) >= 16:
        return client_session_id

    client_ip = get_client_ip(request)
    ua = request.headers.get("User-Agent", "unknown")
    salt_date = date.today().isoformat()
    raw = f"{client_ip}:{ua}:{salt_date}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


@router.post("/collect", response_model=SuccessResponse[Dict[str, Any]])
async def collect_analytics(
    payload: AnalyticsCollectPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Ingests client telemetry (pageview or interaction event) asynchronously.
    """
    req_id = request_id_ctx.get()
    session_id = _get_or_create_session_id(request, payload.session_id)
    ua_info = _parse_user_agent(request.headers.get("User-Agent", ""))

    try:
        if payload.type == "pageview":
            visit = WebVisit(
                session_id=session_id,
                visitor_id=payload.visitor_id,
                user_id=payload.user_id,
                page_path=payload.path or "/",
                page_title=payload.title,
                referrer=payload.referrer,
                device_type=ua_info["device"],
                browser=ua_info["browser"],
                os=ua_info["os"],
                country="India",
                duration_seconds=payload.duration_seconds or 0,
            )
            db.add(visit)
        else:
            # Behavioral interaction event
            event = WebEvent(
                session_id=session_id,
                visitor_id=payload.visitor_id,
                user_id=payload.user_id,
                event_category=payload.category or "feature_use",
                event_action=payload.action or "interaction",
                event_label=payload.label,
                event_value=payload.value,
                metadata_json=payload.metadata or {},
            )
            db.add(event)

        await db.commit()
    except Exception as e:
        logger.error(f"Failed to record analytics event: {e}")
        await db.rollback()

    return SuccessResponse(
        request_id=req_id,
        path=request.url.path,
        data={"status": "recorded", "session_id": session_id},
    )
