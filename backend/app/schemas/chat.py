"""
Pydantic schemas for FinSight Portfolio Research Copilot (Agent 2).
"""
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role of message author: 'user', 'assistant', or 'system'")
    content: str = Field(..., description="Message text content")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000, description="Investor question")
    portfolio_id: Optional[int] = Field(None, description="Optional target portfolio ID (defaults to default user portfolio)")
    session_id: Optional[str] = Field("default", description="Conversation session ID for memory window")


class ChatSourceCitation(BaseModel):
    chunk_id: int
    source_page: Optional[int] = None
    content_preview: str
    relevance_score: Optional[float] = None


class ChatResponse(BaseModel):
    answer: str
    citations: List[ChatSourceCitation] = Field(default_factory=list)
    follow_up_suggestions: List[str] = Field(default_factory=list)
    latency_ms: float
    model_used: Optional[str] = None
    provider_used: Optional[str] = None
