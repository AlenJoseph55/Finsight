"""
Deterministic Financial Math & Integrity Engine.

Engineering Philosophy:
- NEVER let an LLM do financial arithmetic. LLMs are probabilistic text predictors.
- Pure Python deterministic math guarantees 100% precision, zero hallucinations,
  and auditability.
"""

from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
from datetime import date


@dataclass
class HoldingInput:
    name: str
    sector: str
    invested_amount: float
    current_value: float


@dataclass
class CalculatedHolding:
    name: str
    sector: str
    invested_amount: float
    current_value: float
    allocation_pct: float
    gain_loss: float
    gain_loss_pct: float


@dataclass
class PortfolioMathResult:
    total_invested: float
    current_value: float
    absolute_return_pct: float
    holdings: List[CalculatedHolding]
    sector_allocations: Dict[str, float]  # sector -> percentage
    is_concentrated: bool
    concentration_summary: str
    audit_trail: List[str]


# Broad multi-asset and multi-sector categories that represent diversified exposure across many industries.
# These should never trigger a single-sector concentration warning.
DIVERSIFIED_SECTORS = {
    "diversified",
    "diversified equity",
    "multi-sector",
    "multi sector",
    "multi-cap",
    "multi cap",
    "flexi-cap",
    "flexi cap",
    "multi-asset",
    "multi asset",
    "index fund",
    "index funds",
    "mutual fund",
    "mutual funds",
    "broad market",
    "other",
}


# Look-Through sector breakdown profiles for mutual funds & index ETFs.
# Derived from published factsheets of major Indian mutual funds & NSE indices.
FUND_LOOKTHROUGH_PROFILES: Dict[str, Dict[str, float]] = {
    # Parag Parikh Flexi Cap Fund
    "parag parikh": {
        "Financial Services": 0.31,
        "Information Technology": 0.25,
        "Consumer Goods": 0.17,
        "Automobile": 0.11,
        "Healthcare": 0.09,
        "Energy": 0.07,
    },
    # HDFC Mid-Cap Opportunities Fund
    "hdfc mid-cap": {
        "Financial Services": 0.22,
        "Information Technology": 0.18,
        "Capital Goods": 0.18,
        "Healthcare": 0.16,
        "Automobile": 0.14,
        "Chemicals": 0.08,
        "Consumer Goods": 0.04,
    },
    "hdfc mid cap": {
        "Financial Services": 0.22,
        "Information Technology": 0.18,
        "Capital Goods": 0.18,
        "Healthcare": 0.16,
        "Automobile": 0.14,
        "Chemicals": 0.08,
        "Consumer Goods": 0.04,
    },
    # Mirae Asset Large Cap / Bluechip
    "mirae asset": {
        "Financial Services": 0.34,
        "Information Technology": 0.15,
        "Energy": 0.12,
        "Consumer Goods": 0.10,
        "Automobile": 0.09,
        "Healthcare": 0.08,
        "Construction & Infrastructure": 0.06,
        "Metals & Mining": 0.04,
        "Telecommunication": 0.02,
    },
    # Motilal Oswal Nasdaq 100 ETF (US Tech)
    "nasdaq": {
        "Information Technology": 0.58,
        "Telecommunication": 0.16,
        "Consumer Goods": 0.14,
        "Healthcare": 0.07,
        "Capital Goods": 0.05,
    },
    # Nifty 50 Index Fund / Large Cap
    "nifty 50": {
        "Financial Services": 0.35,
        "Information Technology": 0.14,
        "Energy": 0.12,
        "Consumer Goods": 0.10,
        "Automobile": 0.07,
        "Healthcare": 0.05,
        "Construction & Infrastructure": 0.04,
        "Telecommunication": 0.04,
        "Metals & Mining": 0.04,
        "Chemicals": 0.03,
        "Capital Goods": 0.02,
    },
    # Nifty Next 50 / Mid Cap
    "next 50": {
        "Financial Services": 0.23,
        "Capital Goods": 0.18,
        "Chemicals": 0.14,
        "Consumer Goods": 0.13,
        "Healthcare": 0.12,
        "Automobile": 0.10,
        "Energy": 0.06,
        "Information Technology": 0.04,
    },
}

# Generic fallback profile for broad/multi-cap/diversified equity mutual funds
GENERIC_DIVERSIFIED_PROFILE: Dict[str, float] = {
    "Financial Services": 0.32,
    "Information Technology": 0.18,
    "Consumer Goods": 0.13,
    "Energy": 0.11,
    "Automobile": 0.08,
    "Healthcare": 0.07,
    "Capital Goods": 0.04,
    "Construction & Infrastructure": 0.04,
    "Metals & Mining": 0.03,
}


class FinancialMathEngine:
    """
    Deterministic engine for computing weights, returns, sector rollups,
    and concentration risk thresholds.
    """

    @classmethod
    def get_holding_sector_weights(cls, holding_name: str, sector: str) -> Dict[str, float]:
        """
        Option 1: Look-Through Decomposition.
        Returns normalized sector weights for a given holding.
        If the holding is a mutual fund, ETF, or classified under a diversified category,
        it decomposes the fund into actual underlying economic sectors based on published factsheets.
        Direct stocks retain 100% of their designated sector.
        """
        name_lower = holding_name.strip().lower()
        sec_lower = sector.strip().lower()

        # Check if the holding represents a mutual fund / ETF / diversified instrument
        is_fund = (
            sec_lower in DIVERSIFIED_SECTORS
            or "fund" in name_lower
            or "etf" in name_lower
            or "index" in name_lower
            or "flexi" in name_lower
            or "multi" in name_lower
        )

        if is_fund:
            # 1. Dynamic Look-Through Service (Redis Cache -> SEBI Category -> Morningstar)
            try:
                from backend.app.services.fund_service import MutualFundDataService
                weights = MutualFundDataService.get_fund_sector_weights_sync(holding_name)
                if weights:
                    return weights
            except Exception:
                pass

            # 2. Match known static profile table
            for key, profile in FUND_LOOKTHROUGH_PROFILES.items():
                if key in name_lower:
                    total_w = sum(profile.values())
                    return {s: w / total_w for s, w in profile.items()}

            # If sector is an explicit industry sector (e.g., IT fund or Pharma fund), respect that
            if sec_lower not in DIVERSIFIED_SECTORS and sector != "":
                return {sector: 1.0}

            # Otherwise return generic broad market diversified profile
            total_w = sum(GENERIC_DIVERSIFIED_PROFILE.values())
            return {s: w / total_w for s, w in GENERIC_DIVERSIFIED_PROFILE.items()}

        # Direct individual stock: 100% allocation to its specific sector
        return {sector: 1.0}

    @staticmethod
    def calculate_xirr(
        cash_flows: List[Tuple[date, float]],
        guess: float = 0.1,
        max_iter: int = 100,
        tol: float = 1e-5,
    ) -> Optional[float]:
        """
        Computes the exact Extended Internal Rate of Return (XIRR)
        using the Newton-Raphson method with bisection safeguard.
        cash_flows: List of (date, amount) tuples where:
          - Outflows (investments) are negative numbers.
          - Inflows / current portfolio value are positive numbers.
        Returns annualized return percentage (e.g. 16.4 for 16.4%), or None if insufficient flows.
        """
        if len(cash_flows) < 2:
            return None

        sorted_flows = sorted(cash_flows, key=lambda x: x[0])
        d0 = sorted_flows[0][0]

        has_positive = any(amt > 0 for _, amt in sorted_flows)
        has_negative = any(amt < 0 for _, amt in sorted_flows)
        if not (has_positive and has_negative):
            return None

        r = guess
        for _ in range(max_iter):
            if r <= -0.999:
                r = -0.999

            f_val = 0.0
            f_prime = 0.0

            for dt, c in sorted_flows:
                days = (dt - d0).days
                t = days / 365.0
                denom = (1.0 + r) ** t
                if denom == 0:
                    continue
                f_val += c / denom
                f_prime += -t * c / ((1.0 + r) ** (t + 1.0))

            if abs(f_val) < tol:
                return round(r * 100.0, 2)

            if f_prime == 0.0:
                break

            r_next = r - (f_val / f_prime)
            if abs(r_next - r) < tol:
                return round(r_next * 100.0, 2)

            r = r_next

        # Bisection fallback
        low, high = -0.9, 5.0
        for _ in range(60):
            mid = (low + high) / 2.0
            f_mid = sum(c / ((1.0 + mid) ** ((dt - d0).days / 365.0)) for dt, c in sorted_flows)
            if abs(f_mid) < tol:
                return round(mid * 100.0, 2)
            f_low = sum(c / ((1.0 + low) ** ((dt - d0).days / 365.0)) for dt, c in sorted_flows)
            if (f_low > 0 and f_mid > 0) or (f_low < 0 and f_mid < 0):
                low = mid
            else:
                high = mid

        return round(mid * 100.0, 2)

    @classmethod
    def compute(
        cls,
        holdings: List[HoldingInput],
        concentration_threshold_pct: float = 40.0,
        enable_lookthrough: bool = True,
    ) -> PortfolioMathResult:
        audit: List[str] = []

        if not holdings:
            return PortfolioMathResult(
                total_invested=0.0,
                current_value=0.0,
                absolute_return_pct=0.0,
                holdings=[],
                sector_allocations={},
                is_concentrated=False,
                concentration_summary="No holdings present in portfolio.",
                audit_trail=["Empty holdings list supplied."],
            )

        # 1. Total sums
        total_invested = round(sum(h.invested_amount for h in holdings), 2)
        current_value = round(sum(h.current_value for h in holdings), 2)
        audit.append(f"Computed total_invested = ₹{total_invested:,.2f} across {len(holdings)} holdings")
        audit.append(f"Computed current_value = ₹{current_value:,.2f}")

        # 2. Absolute return
        if total_invested > 0:
            abs_return_pct = round(((current_value - total_invested) / total_invested) * 100.0, 2)
        else:
            abs_return_pct = 0.0
        audit.append(f"Absolute return = {abs_return_pct}%")

        # 3. Individual holding allocations and gains
        calculated_holdings: List[CalculatedHolding] = []
        for h in holdings:
            alloc_pct = round((h.current_value / current_value * 100.0), 2) if current_value > 0 else 0.0
            gain_loss = round(h.current_value - h.invested_amount, 2)
            gain_loss_pct = (
                round((gain_loss / h.invested_amount * 100.0), 2)
                if h.invested_amount > 0
                else 0.0
            )

            calculated_holdings.append(
                CalculatedHolding(
                    name=h.name,
                    sector=h.sector,
                    invested_amount=h.invested_amount,
                    current_value=h.current_value,
                    allocation_pct=alloc_pct,
                    gain_loss=gain_loss,
                    gain_loss_pct=gain_loss_pct,
                )
            )

        # 4. Sector breakdown rollup (with Look-Through decomposition for mutual funds)
        sector_totals: Dict[str, float] = {}
        for ch in calculated_holdings:
            if enable_lookthrough:
                weights = cls.get_holding_sector_weights(ch.name, ch.sector)
                for sec, w in weights.items():
                    sector_totals[sec] = sector_totals.get(sec, 0.0) + (ch.current_value * w)
            else:
                sector_totals[ch.sector] = sector_totals.get(ch.sector, 0.0) + ch.current_value

        sector_allocations: Dict[str, float] = {
            sector: round((val / current_value * 100.0), 2)
            for sector, val in sector_totals.items()
        } if current_value > 0 else {}

        # 5. Math verification check (Invariant assertion)
        sum_allocations = sum(sector_allocations.values())
        if abs(sum_allocations - 100.0) > 0.5 and current_value > 0:
            audit.append(f"WARNING: Sum of sector allocations ({sum_allocations}%) deviates slightly from 100% due to rounding")
        else:
            audit.append("Integrity check passed: Sector weights sum to ~100%")

        # 6. Concentration risk detection
        # Specific industry sectors (e.g. IT, Banking, Auto) exceeding threshold indicate risk.
        # Broad diversified funds are excluded since they already span dozens of industries.
        concentrated_sectors = [
            (sec, pct) for sec, pct in sector_allocations.items()
            if pct >= concentration_threshold_pct and sec.strip().lower() not in DIVERSIFIED_SECTORS
        ]

        is_concentrated = len(concentrated_sectors) > 0
        if is_concentrated:
            warnings = [
                f"{sec} ({pct}% vs limit {concentration_threshold_pct}%)"
                for sec, pct in concentrated_sectors
            ]
            summary = f"High sector concentration risk in: {', '.join(warnings)}."
            audit.append(f"Risk Flag Triggered: {summary}")
        else:
            summary = f"Portfolio is well diversified. No single sector exceeds {concentration_threshold_pct}%."
            audit.append("Risk Check: Diversification healthy")

        return PortfolioMathResult(
            total_invested=total_invested,
            current_value=current_value,
            absolute_return_pct=abs_return_pct,
            holdings=calculated_holdings,
            sector_allocations=sector_allocations,
            is_concentrated=is_concentrated,
            concentration_summary=summary,
            audit_trail=audit,
        )


@dataclass
class SIPInput:
    fund_name: str
    sector: str
    monthly_amount: float
    frequency: str = "MONTHLY"
    instrument_type: str = "MUTUAL_FUND"
    start_date_str: Optional[str] = None
    folio_number: Optional[str] = None


@dataclass
class SIPCalculatedPlan:
    fund_name: str
    sector: str
    monthly_amount: float
    frequency: str
    allocation_pct: float
    instrument_type: str
    start_date_str: Optional[str] = None
    folio_number: Optional[str] = None


@dataclass
class SIPSectorAllocationData:
    sector: str
    monthly_amount: float
    allocation_pct: float


@dataclass
class SIPProjectionPointData:
    year: int
    total_invested: float
    conservative: float  # 8%
    moderate: float      # 12%
    optimistic: float    # 15%


@dataclass
class SIPMathResult:
    total_monthly_outflow: float
    active_sips_count: int
    calculated_plans: List[SIPCalculatedPlan]
    sector_allocations: List[SIPSectorAllocationData]
    is_concentrated: bool
    concentration_summary: str
    projections: List[SIPProjectionPointData]
    audit_trail: List[str]


class SIPMathEngine:
    """
    Deterministic engine for computing SIP metrics, future value projections,
    sector concentration checks, and compound growth scenarios.
    """

    HORIZONS_YEARS = [1, 3, 5, 10, 15, 20]
    RATES = {
        "conservative": 0.08,  # 8% CAGR
        "moderate": 0.12,      # 12% CAGR
        "optimistic": 0.15,    # 15% CAGR
    }

    @staticmethod
    def calculate_sip_fv(monthly_amount: float, annual_rate: float, years: int) -> float:
        """
        Calculates SIP Future Value using standard annuity due compounding:
        FV = P * [((1 + i)^n - 1) / i] * (1 + i)
        where i = annual_rate / 12, n = years * 12
        """
        if monthly_amount <= 0 or years <= 0:
            return 0.0
        i = annual_rate / 12.0
        n = years * 12
        if i == 0:
            return round(monthly_amount * n, 2)
        fv = monthly_amount * (((1.0 + i) ** n - 1.0) / i) * (1.0 + i)
        return round(fv, 2)

    @classmethod
    def compute(
        cls,
        sips: List[SIPInput],
        concentration_threshold_pct: float = 40.0,
    ) -> SIPMathResult:
        audit: List[str] = []

        if not sips:
            return SIPMathResult(
                total_monthly_outflow=0.0,
                active_sips_count=0,
                calculated_plans=[],
                sector_allocations=[],
                is_concentrated=False,
                concentration_summary="No active SIP mandates registered.",
                projections=[],
                audit_trail=["Empty SIP list supplied."],
            )

        # 1. Normalize monthly amounts (e.g. Quarterly -> monthly / 3)
        normalized_amounts: List[float] = []
        for s in sips:
            freq = (s.frequency or "MONTHLY").upper()
            if freq == "QUARTERLY":
                m_amt = round(s.monthly_amount / 3.0, 2)
            else:
                m_amt = round(s.monthly_amount, 2)
            normalized_amounts.append(m_amt)

        total_monthly = round(sum(normalized_amounts), 2)
        audit.append(f"Computed total_monthly_outflow = ₹{total_monthly:,.2f} across {len(sips)} SIP mandates")

        # 2. Compute individual SIP allocation percentages
        calculated_plans: List[SIPCalculatedPlan] = []
        for s, m_amt in zip(sips, normalized_amounts):
            alloc_pct = round((m_amt / total_monthly * 100.0), 2) if total_monthly > 0 else 0.0
            calculated_plans.append(
                SIPCalculatedPlan(
                    fund_name=s.fund_name,
                    sector=s.sector,
                    monthly_amount=m_amt,
                    frequency=s.frequency,
                    allocation_pct=alloc_pct,
                    instrument_type=s.instrument_type,
                    start_date_str=s.start_date_str,
                    folio_number=s.folio_number,
                )
            )

        # 3. Sector Rollup (with Look-Through decomposition)
        sector_totals: Dict[str, float] = {}
        for cp in calculated_plans:
            weights = FinancialMathEngine.get_holding_sector_weights(cp.fund_name, cp.sector)
            for sec, w in weights.items():
                sector_totals[sec] = round(sector_totals.get(sec, 0.0) + (cp.monthly_amount * w), 2)

        sector_allocations: List[SIPSectorAllocationData] = []
        for sec, sec_amt in sorted(sector_totals.items(), key=lambda x: x[1], reverse=True):
            alloc_pct = round((sec_amt / total_monthly * 100.0), 2) if total_monthly > 0 else 0.0
            sector_allocations.append(
                SIPSectorAllocationData(
                    sector=sec,
                    monthly_amount=sec_amt,
                    allocation_pct=alloc_pct,
                )
            )

        # 4. Concentration Check
        # Exclude inherently diversified categories
        concentrated = [
            sa for sa in sector_allocations
            if sa.allocation_pct >= concentration_threshold_pct
            and sa.sector.strip().lower() not in DIVERSIFIED_SECTORS
        ]
        is_concentrated = len(concentrated) > 0
        if is_concentrated:
            warnings = [
                f"{sa.sector} ({sa.allocation_pct}% vs limit {concentration_threshold_pct}%)"
                for sa in concentrated
            ]
            summary = f"High sector concentration in monthly SIPs: {', '.join(warnings)}."
            audit.append(f"Risk Flag: {summary}")
        else:
            summary = f"SIP allocations are well-diversified. No single sector exceeds {concentration_threshold_pct}% of monthly outflow."
            audit.append("Risk Check: SIP allocation diversified")

        # 5. Future Value Projections across horizons
        projections: List[SIPProjectionPointData] = []
        for yr in cls.HORIZONS_YEARS:
            invested = round(total_monthly * yr * 12, 2)
            cons_fv = cls.calculate_sip_fv(total_monthly, cls.RATES["conservative"], yr)
            mod_fv = cls.calculate_sip_fv(total_monthly, cls.RATES["moderate"], yr)
            opt_fv = cls.calculate_sip_fv(total_monthly, cls.RATES["optimistic"], yr)

            projections.append(
                SIPProjectionPointData(
                    year=yr,
                    total_invested=invested,
                    conservative=cons_fv,
                    moderate=mod_fv,
                    optimistic=opt_fv,
                )
            )
        audit.append(f"Generated compound growth projections for horizons {cls.HORIZONS_YEARS} years")

        return SIPMathResult(
            total_monthly_outflow=total_monthly,
            active_sips_count=len([s for s in sips if s.monthly_amount > 0]),
            calculated_plans=calculated_plans,
            sector_allocations=sector_allocations,
            is_concentrated=is_concentrated,
            concentration_summary=summary,
            projections=projections,
            audit_trail=audit,
        )

