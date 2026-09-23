"""
FinSight Alerts & Market Monitor Router (Agent 3).

Endpoints:
- GET       /alerts/           -> Fetch user alerts summary & recent notifications
- POST      /alerts/scan       -> Trigger proactive market news scan & correlation
- PATCH     /alerts/{id}/read  -> Mark single alert as read
- PATCH     /alerts/read-all   -> Mark all alerts for user as read
- POST      /alerts/simulate   -> Developer/Demo endpoint to instantly inject a simulated event
- WebSocket /alerts/ws         -> Real-time alert push stream (heartbeat ping/pong)
- GET       /alerts/ws/status  -> Number of connected clients (admin/debug)
"""

import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, WebSocket, WebSocketDisconnect
from sqlalchemy import func, select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import get_settings
from backend.app.database import get_db
from backend.app.models.schema import Alert, MarketEvent, User
from backend.app.routers.auth import get_current_user
from backend.app.schemas.alert import (
    AlertResponse,
    AlertSummaryResponse,
    ScanResult,
    SimulateEventRequest,
)
from backend.app.core.context import request_id_ctx
from backend.app.core.responses import SuccessResponse
from backend.app.core.exceptions import FinSightException, ErrorCode
from backend.app.core.logging import logger
from backend.app.agents.market_agent import market_monitor_agent
from backend.app.ws.connection_manager import ws_manager

router = APIRouter(prefix="/alerts", tags=["Alerts & Market Monitor"])

# ── Heartbeat interval in seconds (keeps proxies from closing idle sockets) ──
_PING_INTERVAL = 30


@router.get("/", response_model=SuccessResponse[AlertSummaryResponse])
async def get_alerts(
    request: Request,
    current_user: User = Depends(get_current_user),
    user_id: Optional[int] = Query(default=None, description="Target user identifier override"),
    limit: int = Query(default=30, le=100, description="Max alerts to return"),
    unread_only: bool = Query(default=False, description="Filter for unread alerts only"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns recent alerts for the user, with total count and unread count.
    """
    req_id = request_id_ctx.get()
    target_user_id = user_id if user_id is not None else current_user.id

    # Total unread count for the user
    unread_stmt = select(func.count(Alert.id)).where(
        Alert.user_id == target_user_id, Alert.is_read == False
    )
    unread_res = await db.execute(unread_stmt)
    unread_count = unread_res.scalar_one() or 0

    # Total count for the user
    total_stmt = select(func.count(Alert.id)).where(Alert.user_id == target_user_id)
    total_res = await db.execute(total_stmt)
    total_count = total_res.scalar_one() or 0

    # Fetch alerts
    query = (
        select(Alert)
        .where(Alert.user_id == target_user_id)
        .options(selectinload(Alert.event))
        .order_by(Alert.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        query = query.where(Alert.is_read == False)

    alerts_res = await db.execute(query)
    alerts = alerts_res.scalars().all()

    alert_responses: List[AlertResponse] = [
        AlertResponse(
            id=a.id,
            user_id=a.user_id,
            event_id=a.event_id,
            title=a.title,
            message=a.message,
            severity=a.severity,
            is_read=a.is_read,
            created_at=a.created_at,
            event_headline=a.event.headline if a.event else None,
            sectors_affected=a.event.sectors_affected if a.event and a.event.sectors_affected else [],
            source_url=a.event.source_url if a.event else None,
            topic_tag=a.topic_tag or (a.event.topic_tag if a.event else None),
            action_advice=a.action_advice or (a.event.action_advice if a.event else None),
            stocks_affected=a.stocks_affected or (a.event.stocks_affected if a.event else []),
        )
        for a in alerts
    ]

    summary = AlertSummaryResponse(
        unread_count=unread_count,
        total_count=total_count,
        alerts=alert_responses,
    )
    return SuccessResponse(request_id=req_id, path=request.url.path, data=summary)


@router.post("/scan", response_model=SuccessResponse[ScanResult])
async def trigger_market_scan(
    request: Request,
    current_user: User = Depends(get_current_user),
    user_id: Optional[int] = Query(default=None, description="Target user identifier"),
    db: AsyncSession = Depends(get_db),
):
    """
    Triggers Agent 3 proactive market scan:
    Ingests news headlines, classifies them with LLMRouter, matches against
    user holdings & SIPs, and creates personalized alerts.
    After creating alerts, pushes them live to any connected browser tabs.
    """
    req_id = request_id_ctx.get()
    target_user_id = user_id if user_id is not None else current_user.id
    result = await market_monitor_agent.scan(db)

    # Push new alerts to connected browsers if any were created
    if result.alerts_created > 0 and ws_manager.connected_tab_count > 0:
        # Fetch the fresh unread alerts so we can push the full objects
        stmt = (
            select(Alert)
            .where(Alert.user_id == target_user_id, Alert.is_read == False)
            .options(selectinload(Alert.event))
            .order_by(Alert.created_at.desc())
            .limit(result.alerts_created)
        )
        res = await db.execute(stmt)
        new_alerts = res.scalars().all()
        for alert in new_alerts:
            payload = {
                "type": "new_alert",
                "data": {
                    "id": alert.id,
                    "title": alert.title,
                    "message": alert.message,
                    "severity": alert.severity,
                    "is_read": alert.is_read,
                    "created_at": alert.created_at.isoformat(),
                    "event_headline": alert.event.headline if alert.event else None,
                    "sectors_affected": (
                        alert.event.sectors_affected
                        if alert.event and alert.event.sectors_affected
                        else []
                    ),
                    "source_url": alert.event.source_url if alert.event else None,
                    "topic_tag": alert.topic_tag or (alert.event.topic_tag if alert.event else None),
                    "action_advice": alert.action_advice or (alert.event.action_advice if alert.event else None),
                    "stocks_affected": alert.stocks_affected or (alert.event.stocks_affected if alert.event else []),
                },
            }
            await ws_manager.broadcast_to_user(user_id, payload)
        logger.info(
            f"WS: pushed {len(new_alerts)} new alert(s) to user_id={user_id}"
        )

    return SuccessResponse(request_id=req_id, path=request.url.path, data=result)


@router.patch("/{alert_id}/read", response_model=SuccessResponse[dict])
async def mark_alert_read(
    alert_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    user_id: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Marks a single alert as read."""
    req_id = request_id_ctx.get()
    target_user_id = user_id if user_id is not None else current_user.id

    stmt = select(Alert).where(Alert.id == alert_id, Alert.user_id == target_user_id)
    res = await db.execute(stmt)
    alert = res.scalars().first()

    if not alert:
        raise FinSightException(
            code=ErrorCode.FS_NOT_FOUND_4040,
            message=f"Alert with id {alert_id} not found",
            http_status=404,
        )

    alert.is_read = True
    await db.commit()

    return SuccessResponse(
        request_id=req_id,
        path=request.url.path,
        data={"id": alert_id, "is_read": True},
    )


@router.patch("/read-all", response_model=SuccessResponse[dict])
async def mark_all_alerts_read(
    request: Request,
    current_user: User = Depends(get_current_user),
    user_id: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Marks all alerts for a user as read."""
    req_id = request_id_ctx.get()
    target_user_id = user_id if user_id is not None else current_user.id

    stmt = (
        update(Alert)
        .where(Alert.user_id == target_user_id, Alert.is_read == False)
        .values(is_read=True)
    )
    res = await db.execute(stmt)
    await db.commit()

    return SuccessResponse(
        request_id=req_id,
        path=request.url.path,
        data={"updated_count": res.rowcount, "is_read": True},
    )


@router.post("/simulate", response_model=SuccessResponse[ScanResult])
async def simulate_market_event(
    payload: SimulateEventRequest,
    request: Request,
    user_id: int = Query(default=1),
    db: AsyncSession = Depends(get_db),
):
    """
    Developer & Demo endpoint to immediately inject a simulated market event
    and generate correlated portfolio alerts without requiring external API access.
    After creating the alert, pushes it live to any connected browser tabs.
    """
    settings = get_settings()
    if settings.ENVIRONMENT.lower() == "production":
        raise FinSightException(
            code=ErrorCode.FS_FEATURE_4031,
            message="Market event simulation is disabled in production.",
            http_status=403,
        )

    req_id = request_id_ctx.get()
    result = await market_monitor_agent.simulate_event(
        db=db,
        sector=payload.sector,
        severity=payload.severity,
        headline=payload.headline,
        summary=payload.summary,
        target_user_id=user_id,
        topic_tag=payload.topic_tag,
        action_advice=payload.action_advice,
        stocks=payload.stocks,
    )

    # Push the new simulated alert to connected browsers
    if result.alerts_created > 0 and ws_manager.connected_tab_count > 0:
        stmt = (
            select(Alert)
            .where(Alert.user_id == user_id, Alert.is_read == False)
            .options(selectinload(Alert.event))
            .order_by(Alert.created_at.desc())
            .limit(1)
        )
        res = await db.execute(stmt)
        latest = res.scalars().first()
        if latest:
            ws_payload = {
                "type": "new_alert",
                "data": {
                    "id": latest.id,
                    "title": latest.title,
                    "message": latest.message,
                    "severity": latest.severity,
                    "is_read": latest.is_read,
                    "created_at": latest.created_at.isoformat(),
                    "event_headline": latest.event.headline if latest.event else None,
                    "sectors_affected": (
                        latest.event.sectors_affected
                        if latest.event and latest.event.sectors_affected
                        else []
                    ),
                    "source_url": latest.event.source_url if latest.event else None,
                    "topic_tag": latest.topic_tag or (latest.event.topic_tag if latest.event else None),
                    "action_advice": latest.action_advice or (latest.event.action_advice if latest.event else None),
                    "stocks_affected": latest.stocks_affected or (latest.event.stocks_affected if latest.event else []),
                },
            }
            await ws_manager.broadcast_to_user(user_id, ws_payload)
            logger.info(
                f"WS: pushed simulated alert to user_id={user_id}"
            )

    return SuccessResponse(request_id=req_id, path=request.url.path, data=result)


# =============================================================================
# WebSocket Endpoint — Real-Time Alert Stream
# =============================================================================

@router.websocket("/ws")
async def alerts_websocket(websocket: WebSocket, user_id: int = Query(default=1)):
    """
    Persistent WebSocket connection for real-time alert delivery.

    Protocol:
      - Client connects to ws://<host>/alerts/ws?user_id=<id>
      - Server sends {"type": "connected", "user_id": <id>} on handshake
      - Server sends {"type": "ping"} every 30 seconds as heartbeat
      - Server sends {"type": "new_alert", "data": {...}} when an alert fires
      - Client may send {"type": "pong"} — silently acknowledged
      - Connection closed gracefully on tab close / network loss
    """
    await websocket.accept()
    ws_manager.connect(user_id, websocket)

    # Greet the client
    await websocket.send_json({"type": "connected", "user_id": user_id})

    try:
        while True:
            # Send a ping heartbeat every PING_INTERVAL seconds.
            # We use wait_for so the loop can also process incoming client messages.
            try:
                message = await asyncio.wait_for(
                    websocket.receive_json(), timeout=_PING_INTERVAL
                )
                # Handle pong or any client message silently
                if isinstance(message, dict) and message.get("type") == "pong":
                    pass  # acknowledged, nothing to do
            except asyncio.TimeoutError:
                # No message received — send heartbeat ping
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass  # Normal browser tab close / refresh
    except Exception as exc:
        logger.warning(f"WS error for user_id={user_id}: {exc}")
    finally:
        ws_manager.disconnect(user_id, websocket)


@router.get("/ws/status", tags=["Alerts & Market Monitor"])
async def websocket_status(request: Request):
    """Returns the number of currently connected WebSocket clients (debug/admin)."""
    req_id = request_id_ctx.get()
    return SuccessResponse(
        request_id=req_id,
        path=request.url.path,
        data={
            "connected_users": ws_manager.connected_user_count,
            "connected_tabs": ws_manager.connected_tab_count,
        },
    )
