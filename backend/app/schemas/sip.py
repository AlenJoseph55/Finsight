"""
Pydantic Schemas for SIP (Systematic Investment Plan) Management & Projections.
"""

from datetime import datetime
from typing import List, Optional, Dict
from pydantic import BaseModel, Field, ConfigDict


class SipPlanBase(BaseModel):
    fund_name: str = Field(..., description="Name of the mutual fund or ETF")
    fund_sector: str = Field(..., description="NSE Sector taxonomy")
    instrument_type: str = Field("MUTUAL_FUND", description="MUTUAL_FUND, ETF, or STOCK")
    monthly_amount: float = Field(..., ge=0, description="Monthly commitment in INR (₹)")
    frequency: str = Field("MONTHLY", description="MONTHLY or QUARTERLY")
    start_date_str: Optional[str] = Field(None, description="Start date of SIP")
    folio_number: Optional[str] = Field(None, description="Folio number if available")
    is_active: bool = True


class SipPlanCreate(SipPlanBase):
    pass


class SipPlanResponse(SipPlanBase):
    id: Optional[int] = None
    user_id: int
    source_file_name: Optional[str] = None
    allocation_pct: float = Field(0.0, description="Percentage of total monthly SIP outflow")
    extraction_status: str = "complete"
    extraction_note: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SipProjectionPoint(BaseModel):
    year: int = Field(..., description="Horizon in years (e.g. 1, 3, 5, 10, 15, 20)")
    total_invested: float = Field(..., description="Total principal invested in INR")
    conservative: float = Field(..., description="Projected future value at 8% CAGR")
    moderate: float = Field(..., description="Projected future value at 12% CAGR")
    optimistic: float = Field(..., description="Projected future value at 15% CAGR")


class SipSectorAllocation(BaseModel):
    sector: str
    monthly_amount: float
    allocation_pct: float


class SipSummaryResponse(BaseModel):
    total_monthly_outflow: float = Field(..., description="Total monthly SIP contribution in INR")
    active_sips_count: int = Field(..., description="Number of active SIPs")
    is_concentrated: bool = Field(False, description="True if any sector exceeds threshold (default 40%)")
    concentration_summary: Optional[str] = None
    sector_allocations: List[SipSectorAllocation] = []
    sip_plans: List[SipPlanResponse] = []
    projections: List[SipProjectionPoint] = []
