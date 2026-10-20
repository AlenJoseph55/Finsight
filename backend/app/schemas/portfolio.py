"""
Pydantic Schemas for Portfolio & Holdings.

Why separate Pydantic schemas from SQLAlchemy models?
- Database models define table columns & relationships in Postgres.
- Pydantic models define what the frontend is allowed to send and receive over HTTP.
- This creates an isolation boundary: internal fields (e.g. raw_text_encrypted)
  are never accidentally exposed to API clients.
"""

from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from backend.app.services.tax_engine import SellEstimateResult, ChargesBreakdown, GainLossBreakdown, TaxTip, PortfolioLossCandidate


class HoldingBase(BaseModel):
    name: str = Field(..., description="Name of company or mutual fund")
    symbol: Optional[str] = Field(None, description="Ticker symbol e.g., HDFCBANK.NS")
    instrument_type: str = Field(..., description="MUTUAL_FUND, STOCK, or ETF")
    sector: str = Field(..., description="Industry sector e.g. Financials, Technology")
    market_cap_category: Optional[str] = Field(None, description="LARGE_CAP, MID_CAP, SMALL_CAP")
    invested_amount: float = Field(..., ge=0, description="Total amount invested in INR (₹)")
    current_value: float = Field(..., ge=0, description="Current market value in INR (₹)")
    units: Optional[float] = Field(None, ge=0, description="Number of units or shares owned")
    nav: Optional[float] = Field(None, ge=0, description="Net Asset Value or current unit price")
    purchase_date: Optional[date] = Field(None, description="Date of acquisition for LTCG/STCG calculation")
    broker: Optional[str] = Field(None, description="Broker platform name e.g. zerodha, groww")


class HoldingCreate(HoldingBase):
    pass


class HoldingResponse(HoldingBase):
    id: int
    portfolio_id: int
    allocation_pct: float = Field(..., description="Percentage of total portfolio value")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SectorAllocationResponse(BaseModel):
    sector: str
    allocation_pct: float
    total_value: float

    model_config = ConfigDict(from_attributes=True)


class PortfolioSummary(BaseModel):
    id: int
    total_invested: float
    current_value: float
    absolute_return_pct: float
    xirr_pct: Optional[float] = None
    is_concentrated: bool = False
    concentration_summary: Optional[str] = None
    extraction_status: str = "complete"
    extraction_note: Optional[str] = None
    holdings: List[HoldingResponse] = []
    sector_allocations: List[SectorAllocationResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FeedbackCreate(BaseModel):
    holding_id: Optional[int] = None
    holding_name: str
    original_value: str
    corrected_value: str
    correction_field: str = Field(..., description="'sector', 'amount', or 'instrument_type'")
    notes: Optional[str] = None


class UpdateHoldingRequest(BaseModel):
    name: Optional[str] = Field(None, description="Updated name of the company or mutual fund")
    sector: Optional[str] = Field(None, description="Updated industry sector")
    invested_amount: Optional[float] = Field(None, ge=0, description="Updated total invested amount in INR")
    current_value: Optional[float] = Field(None, ge=0, description="Updated current market value in INR")
    units: Optional[float] = Field(None, ge=0, description="Updated number of units or shares")
    nav: Optional[float] = Field(None, ge=0, description="Updated NAV or unit price")
    instrument_type: Optional[str] = Field(None, description="'STOCK', 'MUTUAL_FUND', or 'ETF'")
    purchase_date: Optional[date] = Field(None, description="Updated acquisition date")
    broker: Optional[str] = Field(None, description="Updated broker identifier")


class FlushInvestmentDataResponse(BaseModel):
    message: str
    deleted_portfolios: int
    deleted_holdings: int


class SellEstimateRequest(BaseModel):
    holding_id: int = Field(..., description="Holding ID to estimate exit for")
    sell_quantity: Optional[float] = Field(None, ge=0, description="Quantity/units to sell")
    sell_amount: Optional[float] = Field(None, ge=0, description="Target gross sell amount in INR")
    broker: Optional[str] = Field("zerodha", description="Broker platform identifier (e.g. zerodha, groww, angel_one, etc.)")
    purchase_date: Optional[date] = Field(None, description="Acquisition date override for exact tax calculation")
    custom_exit_load_pct: Optional[float] = Field(None, ge=0, description="Custom mutual fund exit load percentage override")


class BrokerOptionResponse(BaseModel):
    key: str
    name: str
    notes: str


