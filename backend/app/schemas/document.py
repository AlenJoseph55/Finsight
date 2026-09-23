from typing import Any, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator
from backend.app.core.sectors import NSESector



class ExtractedHolding(BaseModel):
    name: str  # Full scheme/stock name as on statement
    symbol: Optional[str] = None  # e.g. "HDFCBANK.NS", "PPFAS"
    isin: Optional[str] = None  # e.g. "INF879O01019"
    instrument_type: Literal[
        "MUTUAL_FUND", "STOCK", "ETF", "GOLD", "BOND"
    ] = "MUTUAL_FUND"
    folio_number: Optional[str] = None
    units: Optional[float] = None
    nav: Optional[float] = None  # NAV or buy price per unit
    invested_amount: float = 0.0
    current_value: float = 0.0
    sector: NSESector = "Diversified"  # Constrained to NSE taxonomy
    market_cap_category: Optional[
        Literal["LARGE_CAP", "MID_CAP", "SMALL_CAP", "MULTI_CAP"]
    ] = None

    @field_validator("sector", mode="before")
    @classmethod
    def validate_sector(cls, v: Any) -> str:
        from backend.app.core.sectors import normalize_sector
        if isinstance(v, str):
            return normalize_sector(v)
        return "Diversified"



class ExtractedStatement(BaseModel):
    investor_name: Optional[str] = None  # Extracted; stored AES-256 encrypted
    statement_period: Optional[str] = None  # e.g. "Apr 2025 – Aug 2026"
    currency: str = "INR"
    holdings: List[ExtractedHolding] = Field(default_factory=list)
    extraction_notes: Optional[str] = None  # LLM self-reported uncertainty


class ExtractedSIP(BaseModel):
    fund_name: str
    monthly_amount: float = 0.0
    frequency: str = "MONTHLY"  # MONTHLY or QUARTERLY
    sector: NSESector = "Diversified"
    instrument_type: Literal["MUTUAL_FUND", "ETF", "STOCK"] = "MUTUAL_FUND"
    start_date_str: Optional[str] = None
    folio_number: Optional[str] = None

    @field_validator("sector", mode="before")
    @classmethod
    def validate_sector(cls, v: Any) -> str:
        from backend.app.core.sectors import normalize_sector
        if isinstance(v, str):
            return normalize_sector(v)
        return "Diversified"


class ExtractedSIPStatement(BaseModel):
    investor_name: Optional[str] = None
    sips: List[ExtractedSIP] = Field(default_factory=list)
    extraction_notes: Optional[str] = None
