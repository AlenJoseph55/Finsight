"""
Pydantic Schemas for Agent 3 (Market Monitor & Proactive Alerts).
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class StockImpact(BaseModel):
    ticker: str = Field(..., description="Stock ticker symbol (e.g. 'ONGC', 'HAL')")
    name: str = Field(..., description="Company name (e.g. 'Oil & Natural Gas Corp')")
    impact_pct: str = Field(..., description="Estimated price impact e.g. '+4.2%' or '-3.8%'")
    sentiment: str = Field(default="NEUTRAL", description="BULLISH, BEARISH, or NEUTRAL")
    rationale: Optional[str] = Field(default=None, description="Reasoning for this stock's impact")
    is_in_portfolio: bool = Field(default=False, description="Whether user holds this stock")
    user_holding_name: Optional[str] = Field(default=None, description="Matching portfolio holding name")


class NewsClassification(BaseModel):
    """Structured LLM extraction from market news headlines."""
    sectors_affected: List[str] = Field(
        default_factory=list,
        description="NSE sectors affected by this news (e.g. ['Financial Services', 'Energy'])",
    )
    topic_tag: str = Field(
        default="",
        description="Concise uppercase topic badge (e.g. 'IRAN-US ESCALATION', 'RBI POLICY')",
    )
    action_advice: str = Field(
        default="",
        description="Actionable investor advice or strategic takeaway",
    )
    stocks_affected: List[StockImpact] = Field(
        default_factory=list,
        description="Specific stocks impacted by this news with expected direction",
    )
    severity: str = Field(
        default="INFO",
        description="Event severity level: INFO, WARNING, or DANGER",
    )
    sentiment: str = Field(
        default="NEUTRAL",
        description="Market sentiment: POSITIVE, NEUTRAL, or NEGATIVE",
    )
    one_line_summary: str = Field(
        default="",
        description="Crisp 1-line investor-focused summary of the market impact",
    )
    is_portfolio_relevant: bool = Field(
        default=True,
        description="Whether this event has direct material relevance to retail equity or mutual fund investors",
    )


class AlertResponse(BaseModel):
    id: int
    user_id: int
    event_id: Optional[int] = None
    title: str
    message: str
    severity: str  # INFO, WARNING, DANGER
    is_read: bool
    created_at: datetime
    event_headline: Optional[str] = None
    sectors_affected: List[str] = Field(default_factory=list)
    source_url: Optional[str] = None
    topic_tag: Optional[str] = None
    action_advice: Optional[str] = None
    stocks_affected: List[StockImpact] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class AlertSummaryResponse(BaseModel):
    unread_count: int
    total_count: int
    alerts: List[AlertResponse]


class ScanResult(BaseModel):
    events_processed: int
    alerts_created: int
    skipped_duplicates: int
    scan_duration_ms: float
    message: str = "Market scan complete"


class SimulateEventRequest(BaseModel):
    sector: str = Field(..., description="NSE Sector to simulate impact for")
    severity: str = Field(default="WARNING", description="Severity: INFO, WARNING, or DANGER")
    headline: Optional[str] = Field(default=None, description="Custom headline (optional)")
    summary: Optional[str] = Field(default=None, description="Custom summary (optional)")
    topic_tag: Optional[str] = Field(default=None, description="Topic badge (optional)")
    action_advice: Optional[str] = Field(default=None, description="Actionable commentary (optional)")
    stocks: Optional[List[dict]] = Field(default=None, description="List of stock impacts (optional)")

