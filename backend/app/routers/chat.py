"""
Portfolio Research Copilot (Agent 2) Router.

Endpoints:
- POST /chat/ask: Submit investor questions, returns grounded answer with citations and follow-up chips.
- DELETE /chat/history: Clears memory for the given session.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.core.context import request_id_ctx
from backend.app.core.responses import SuccessResponse
from backend.app.schemas.chat import ChatRequest, ChatResponse
from backend.app.agents.research_agent import conversation_manager, research_agent

router = APIRouter(prefix="/chat", tags=["Research Copilot"])


@router.post("/ask", response_model=SuccessResponse[ChatResponse])
async def ask_research_copilot(
    payload: ChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Asks the Research Copilot (Agent 2) a grounded question about the user's
    holdings, sector allocations, SIPs, and uploaded statement passages.
    """
    req_id = request_id_ctx.get()
    session_id = payload.session_id or "default"

    response = await research_agent.answer(
        query=payload.query,
        db=db,
        portfolio_id=payload.portfolio_id,
        session_id=session_id,
    )

    return SuccessResponse(
        request_id=req_id,
        path=request.url.path,
        data=response,
    )


@router.delete("/history", response_model=SuccessResponse[dict])
async def clear_chat_history(
    request: Request,
    session_id: str = Query("default", description="Session ID to clear"),
):
    """
    Clears rolling conversation history for the specified session.
    """
    req_id = request_id_ctx.get()
    conversation_manager.clear(session_id)

    return SuccessResponse(
        request_id=req_id,
        path=request.url.path,
        data={"cleared": True, "session_id": session_id},
    )
