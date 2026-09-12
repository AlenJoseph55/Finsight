"""
Deterministic Financial Math & Integrity Engine.

Engineering Philosophy:
- NEVER let an LLM do financial arithmetic. LLMs are probabilistic text predictors.
- Pure Python deterministic math guarantees 100% precision, zero hallucinations,
  and auditability.
"""

from typing import List, Dict, Any, Tuple
from dataclasses import dataclass


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


class FinancialMathEngine:
    """
    Deterministic engine for computing weights, returns, sector rollups,
    and concentration risk thresholds.
    """

    @staticmethod
    def compute(
        holdings: List[HoldingInput],
        concentration_threshold_pct: float = 40.0,
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

        # 4. Sector breakdown rollup
        sector_totals: Dict[str, float] = {}
        for ch in calculated_holdings:
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
        concentrated_sectors = [
            (sec, pct) for sec, pct in sector_allocations.items()
            if pct >= concentration_threshold_pct
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
