"""
Tax & Trade Cost Engine for FinSight.

Implements deterministic calculations for Indian brokerage fees, statutory charges,
and capital gains tax under Union Budget 2024 (effective July 23, 2024).

Features:
- Accurate Broker Fee Calculation (Zerodha, Groww, Angel One, Upstox, HDFC Sec, ICICI Direct, Paytm Money, Kuvera)
- Statutory Charges: STT, Exchange Turnover Fee, SEBI Turnover Fee, GST (18%)
- Budget 2024 Capital Gains Rules:
  * Equity STCG: 20% (holding period <= 365 days)
  * Equity LTCG: 12.5% on gains exceeding ₹1.25 Lakh annual exemption (holding period > 365 days)
  * Debt MF: Taxed at slab rates (indicative 30%)
- Mutual Fund Exit Load detection (1% if held < 365 days)
- Actionable Tax-Saving Strategies & Tax-Loss Harvesting recommendations
"""

from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


BROKER_CONFIGS: Dict[str, Dict[str, Any]] = {
    "zerodha": {
        "name": "Zerodha",
        "equity_delivery_flat": 0.0,
        "equity_delivery_pct": 0.0,
        "mf_fee_flat": 0.0,
        "notes": "₹0 Brokerage on Equity Delivery & Direct Mutual Funds via Coin",
    },
    "groww": {
        "name": "Groww",
        "equity_delivery_flat": 20.0,
        "equity_delivery_pct": 0.0005,  # ₹20 or 0.05% whichever is lower
        "mf_fee_flat": 0.0,
        "notes": "₹20 or 0.05% (whichever lower) per executed equity order; ₹0 on Direct MFs",
    },
    "angel_one": {
        "name": "Angel One",
        "equity_delivery_flat": 0.0,
        "equity_delivery_pct": 0.0,
        "mf_fee_flat": 0.0,
        "notes": "₹0 Brokerage on Equity Delivery & Mutual Funds",
    },
    "upstox": {
        "name": "Upstox",
        "equity_delivery_flat": 20.0,
        "equity_delivery_pct": 0.025,  # Up to ₹20 or 2.5% whichever lower
        "mf_fee_flat": 0.0,
        "notes": "₹20 or 2.5% per delivery order; ₹0 on Mutual Funds",
    },
    "hdfc_sec": {
        "name": "HDFC Securities",
        "equity_delivery_flat": 25.0,  # min ₹25
        "equity_delivery_pct": 0.005,  # 0.50%
        "mf_fee_flat": 0.0,
        "notes": "0.50% or ₹25 minimum per executed delivery order",
    },
    "icici_direct": {
        "name": "ICICI Direct",
        "equity_delivery_flat": 0.0,
        "equity_delivery_pct": 0.00275,  # 0.275% Prime plan
        "mf_fee_flat": 0.0,
        "notes": "0.275% equity delivery brokerage",
    },
    "paytm_money": {
        "name": "Paytm Money",
        "equity_delivery_flat": 0.0,
        "equity_delivery_pct": 0.0,
        "mf_fee_flat": 0.0,
        "notes": "₹0 Brokerage on Equity Delivery & Direct MF",
    },
    "kuvera": {
        "name": "Kuvera",
        "equity_delivery_flat": 0.0,
        "equity_delivery_pct": 0.0,
        "mf_fee_flat": 0.0,
        "notes": "100% Free Direct Mutual Funds",
    },
    "other": {
        "name": "Other / Standard Broker",
        "equity_delivery_flat": 20.0,
        "equity_delivery_pct": 0.0005,
        "mf_fee_flat": 0.0,
        "notes": "Standard discount broker fee (₹20 or 0.05%)",
    },
}

# Statutory Rates for Indian Markets (Budget 2024)
NSE_EXCHANGE_CHARGE_PCT = 0.0000297   # 0.00297% on turnover
SEBI_TURNOVER_FEE_PCT   = 0.000001    # ₹10 per crore (0.0001%)
GST_RATE                = 0.18        # 18% on (Brokerage + Exchange Charges + SEBI fee)

# Equity Delivery STT: 0.1% on sell side
EQUITY_STT_PCT          = 0.001

# Equity Mutual Fund Redemption STT: 0.001%
MF_EQUITY_STT_PCT       = 0.00001

# Union Budget 2024 Capital Gains Rates (Effective July 23, 2024)
EQUITY_STCG_RATE        = 0.20        # 20%
EQUITY_LTCG_RATE        = 0.125       # 12.5%
LTCG_ANNUAL_EXEMPTION   = 125000.0    # ₹1.25 Lakh per financial year (Sec 112A)
HOLDING_PERIOD_LT_DAYS  = 365         # > 365 days = Long-Term for Equity


class ChargesBreakdown(BaseModel):
    brokerage: float
    stt: float
    exchange_charges: float
    sebi_fee: float
    gst: float
    stamp_duty: float
    exit_load: float
    total_charges: float


class GainLossBreakdown(BaseModel):
    invested_cost: float
    gross_proceeds: float
    gross_gain: float
    holding_days: int
    is_long_term: bool
    tax_category: str  # "LTCG", "STCG", or "DEBT_SLAB"
    tax_rate_pct: float
    ltcg_exemption_applied: float
    taxable_gain: float
    estimated_tax: float
    effective_tax_rate_pct: float


class TaxTip(BaseModel):
    type: str  # "warning", "info", "success", "harvest"
    title: str
    description: str
    potential_savings: Optional[float] = None


class PortfolioLossCandidate(BaseModel):
    holding_id: int
    name: str
    unrealized_loss: float
    loss_pct: float


class SellEstimateResult(BaseModel):
    holding_id: int
    holding_name: str
    instrument_type: str
    broker_key: str
    broker_name: str
    sell_quantity: float
    total_units: float
    sell_price: float
    gross_sell_value: float
    charges: ChargesBreakdown
    net_proceeds: float
    gain_loss: GainLossBreakdown
    tax_tips: List[TaxTip]
    harvest_candidates: List[PortfolioLossCandidate] = []
    disclaimer: str


class TaxEngine:
    @staticmethod
    def get_supported_brokers() -> List[Dict[str, Any]]:
        return [
            {
                "key": k,
                "name": v["name"],
                "notes": v["notes"],
            }
            for k, v in BROKER_CONFIGS.items()
        ]

    @classmethod
    def calculate(
        cls,
        holding_id: int,
        holding_name: str,
        instrument_type: str,
        current_price_or_nav: float,
        total_units: float,
        total_invested: float,
        sell_quantity: Optional[float] = None,
        sell_amount: Optional[float] = None,
        broker_key: str = "zerodha",
        purchase_date: Optional[date] = None,
        custom_exit_load_pct: Optional[float] = None,
        other_portfolio_holdings: Optional[List[Dict[str, Any]]] = None,
    ) -> SellEstimateResult:
        """
        Computes accurate brokerage, statutory fees, capital gains tax, and tax optimization tips.
        """
        broker_info = BROKER_CONFIGS.get(broker_key.lower(), BROKER_CONFIGS["other"])
        clean_type = instrument_type.upper() if instrument_type else "STOCK"
        is_mf = clean_type in ("MUTUAL_FUND", "MF")

        # 1. Determine sell quantity and sell value
        if current_price_or_nav <= 0:
            current_price_or_nav = 1.0

        if total_units <= 0:
            # Fallback if units were not recorded: derive from invested / current
            total_units = (total_invested / current_price_or_nav) if total_invested > 0 else 1.0

        if sell_quantity is not None and sell_quantity > 0:
            qty = min(sell_quantity, total_units)
        elif sell_amount is not None and sell_amount > 0:
            qty = min(sell_amount / current_price_or_nav, total_units)
        else:
            qty = total_units

        gross_sell_value = qty * current_price_or_nav

        # Pro-rated invested cost basis for the sold quantity
        cost_basis_per_unit = total_invested / total_units if total_units > 0 else current_price_or_nav
        invested_cost = qty * cost_basis_per_unit
        gross_gain = gross_sell_value - invested_cost

        # 2. Holding period & classification
        today = date.today()
        holding_days: int = 366  # Default fallback if purchase date is unknown (assumed >1 year)
        has_exact_purchase_date = purchase_date is not None

        if has_exact_purchase_date and purchase_date:
            holding_days = max(0, (today - purchase_date).days)

        is_long_term = holding_days > HOLDING_PERIOD_LT_DAYS

        # 3. Calculate Brokerage
        if is_mf:
            brokerage = broker_info.get("mf_fee_flat", 0.0)
        else:
            flat = broker_info.get("equity_delivery_flat", 0.0)
            pct = broker_info.get("equity_delivery_pct", 0.0)
            if flat > 0 and pct > 0:
                brokerage = min(flat, gross_sell_value * pct)
            elif flat > 0:
                brokerage = flat
            elif pct > 0:
                brokerage = gross_sell_value * pct
            else:
                brokerage = 0.0

        # 4. Statutory Charges
        stamp_duty = 0.0  # Stamp duty applies to BUY side in India, not SELL side.

        if is_mf:
            # MF Redemption: STT is 0.001% on equity-oriented schemes
            stt = gross_sell_value * MF_EQUITY_STT_PCT
            exchange_charges = 0.0
            sebi_fee = 0.0
            gst = 0.0  # No GST on zero broker charge
            
            # Exit load check: Typically 1% if exited within 365 days
            if custom_exit_load_pct is not None:
                exit_load = gross_sell_value * (custom_exit_load_pct / 100.0)
            else:
                if holding_days < 365:
                    exit_load = gross_sell_value * 0.01  # 1% standard exit load
                else:
                    exit_load = 0.0
        else:
            # Equity Delivery: STT is 0.1% on sell turnover
            stt = gross_sell_value * EQUITY_STT_PCT
            exchange_charges = gross_sell_value * NSE_EXCHANGE_CHARGE_PCT
            sebi_fee = gross_sell_value * SEBI_TURNOVER_FEE_PCT
            # GST is 18% on (Brokerage + Exchange Charges + SEBI Fee)
            gst = (brokerage + exchange_charges + sebi_fee) * GST_RATE
            exit_load = 0.0

        total_charges = brokerage + stt + exchange_charges + sebi_fee + gst + stamp_duty + exit_load
        net_proceeds = max(0.0, gross_sell_value - total_charges)

        # 5. Capital Gains Tax (Budget 2024 Rules)
        taxable_gain = 0.0
        ltcg_exemption_applied = 0.0
        estimated_tax = 0.0
        tax_rate_pct = 0.0
        tax_category = "LTCG" if is_long_term else "STCG"

        if gross_gain > 0:
            if is_long_term:
                tax_rate_pct = EQUITY_LTCG_RATE * 100.0  # 12.5%
                ltcg_exemption_applied = min(gross_gain, LTCG_ANNUAL_EXEMPTION)
                taxable_gain = max(0.0, gross_gain - ltcg_exemption_applied)
                estimated_tax = taxable_gain * EQUITY_LTCG_RATE
            else:
                tax_rate_pct = EQUITY_STCG_RATE * 100.0  # 20.0%
                taxable_gain = gross_gain
                estimated_tax = taxable_gain * EQUITY_STCG_RATE

        effective_tax_rate_pct = (estimated_tax / gross_gain * 100.0) if gross_gain > 0 else 0.0

        # 6. Generate Tax-Saving and Optimization Tips
        tips: List[TaxTip] = []

        # Tip A: Proximity to LTCG threshold (holding period between 300 and 365 days)
        if not is_long_term and has_exact_purchase_date and 300 <= holding_days <= 365 and gross_gain > 0:
            days_left = 366 - holding_days
            target_date = today + timedelta(days=days_left)
            # LTCG tax is 12.5% on gains over 1.25L vs STCG 20%
            lt_taxable = max(0.0, gross_gain - min(gross_gain, LTCG_ANNUAL_EXEMPTION))
            lt_tax = lt_taxable * EQUITY_LTCG_RATE
            savings = max(0.0, estimated_tax - lt_tax)
            tips.append(TaxTip(
                type="warning",
                title=f"Hold for {days_left} more days to save tax",
                description=(
                    f"Waiting until {target_date.strftime('%d %b %Y')} converts your 20% STCG into 12.5% LTCG with "
                    f"access to the ₹1.25 Lakh exemption under Section 112A."
                ),
                potential_savings=round(savings, 2),
            ))

        # Tip B: LTCG within ₹1.25 Lakh Exemption
        if is_long_term and 0 < gross_gain <= LTCG_ANNUAL_EXEMPTION:
            headroom = LTCG_ANNUAL_EXEMPTION - gross_gain
            tips.append(TaxTip(
                type="success",
                title="100% Tax-Free Capital Gain",
                description=(
                    f"Your gain of ₹{gross_gain:,.2f} is fully covered by the annual ₹1.25 Lakh LTCG exemption. "
                    f"You have ₹{headroom:,.2f} in additional tax-free capital gain headroom available this financial year."
                ),
                potential_savings=round(gross_gain * EQUITY_LTCG_RATE, 2),
            ))

        # Tip C: High LTCG exceeding ₹1.25 Lakh Exemption
        if is_long_term and gross_gain > LTCG_ANNUAL_EXEMPTION:
            excess = gross_gain - LTCG_ANNUAL_EXEMPTION
            tips.append(TaxTip(
                type="info",
                title="Stagger redemptions across Financial Years",
                description=(
                    f"Your capital gain exceeds the ₹1.25 Lakh annual exemption limit by ₹{excess:,.2f}. "
                    f"Selling part before March 31 and the rest in April allows you to utilize two years' exemption limits!"
                ),
                potential_savings=round(min(excess, LTCG_ANNUAL_EXEMPTION) * EQUITY_LTCG_RATE, 2),
            ))

        # Tip D: Mutual Fund Exit Load Warning
        if is_mf and holding_days < 365 and exit_load > 0:
            days_to_zero_load = 365 - holding_days
            tips.append(TaxTip(
                type="warning",
                title="Exit load applies on premature redemption",
                description=(
                    f"Redeeming mutual fund units within 1 year incurs a ~1.0% exit load deduction (₹{exit_load:,.2f}). "
                    f"Holding for {days_to_zero_load} more days eliminates this exit load completely."
                ),
                potential_savings=round(exit_load, 2),
            ))

        # Tip E: Tax-Loss Harvesting Candidates
        harvest_candidates: List[PortfolioLossCandidate] = []
        if other_portfolio_holdings and gross_gain > 0 and taxable_gain > 0:
            for item in other_portfolio_holdings:
                if item.get("id") == holding_id:
                    continue
                h_invested = float(item.get("invested_amount") or 0.0)
                h_current = float(item.get("current_value") or 0.0)
                if h_invested > h_current and h_invested > 0:
                    unrealized_loss = h_invested - h_current
                    loss_pct = (unrealized_loss / h_invested) * 100.0
                    harvest_candidates.append(PortfolioLossCandidate(
                        holding_id=int(item.get("id")),
                        name=str(item.get("name")),
                        unrealized_loss=round(unrealized_loss, 2),
                        loss_pct=round(loss_pct, 1),
                    ))

            if harvest_candidates:
                total_harvestable = sum(c.unrealized_loss for c in harvest_candidates)
                tax_offset_potential = min(taxable_gain, total_harvestable) * (EQUITY_LTCG_RATE if is_long_term else EQUITY_STCG_RATE)
                top_candidate = harvest_candidates[0]
                tips.append(TaxTip(
                    type="harvest",
                    title="Tax-Loss Harvesting Opportunity",
                    description=(
                        f"You have unrealized losses in your portfolio (e.g. {top_candidate.name} with -₹{top_candidate.unrealized_loss:,.2f} loss). "
                        f"Booking eligible losses in the same financial year can offset this gain and slash your tax bill."
                    ),
                    potential_savings=round(tax_offset_potential, 2),
                ))

        # Tip F: Zero gain / loss tip
        if gross_gain <= 0:
            tips.append(TaxTip(
                type="info",
                title="Capital Loss Realized",
                description=(
                    f"Selling at a loss of ₹{abs(gross_gain):,.2f} incurs zero capital gains tax. "
                    f"This loss can be carried forward for up to 8 financial years to offset future capital gains in your ITR filing."
                ),
                potential_savings=0.0,
            ))

        disclaimer = (
            "Estimates are calculated using statutory rates applicable as of Union Budget 2024 (effective July 23, 2024). "
            "Actual charges may slightly vary based on broker DP/demat debit charges (₹13.50+GST for demat transfer) and "
            "exact execution prices. Please consult a Chartered Accountant for ITR filing."
        )

        return SellEstimateResult(
            holding_id=holding_id,
            holding_name=holding_name,
            instrument_type=clean_type,
            broker_key=broker_key,
            broker_name=broker_info.get("name", "Custom Broker"),
            sell_quantity=round(qty, 4),
            total_units=round(total_units, 4),
            sell_price=round(current_price_or_nav, 2),
            gross_sell_value=round(gross_sell_value, 2),
            charges=ChargesBreakdown(
                brokerage=round(brokerage, 2),
                stt=round(stt, 2),
                exchange_charges=round(exchange_charges, 2),
                sebi_fee=round(sebi_fee, 2),
                gst=round(gst, 2),
                stamp_duty=round(stamp_duty, 2),
                exit_load=round(exit_load, 2),
                total_charges=round(total_charges, 2),
            ),
            net_proceeds=round(net_proceeds, 2),
            gain_loss=GainLossBreakdown(
                invested_cost=round(invested_cost, 2),
                gross_proceeds=round(gross_sell_value, 2),
                gross_gain=round(gross_gain, 2),
                holding_days=holding_days,
                is_long_term=is_long_term,
                tax_category=tax_category,
                tax_rate_pct=tax_rate_pct,
                ltcg_exemption_applied=round(ltcg_exemption_applied, 2),
                taxable_gain=round(taxable_gain, 2),
                estimated_tax=round(estimated_tax, 2),
                effective_tax_rate_pct=round(effective_tax_rate_pct, 2),
            ),
            tax_tips=tips,
            harvest_candidates=harvest_candidates[:3],
            disclaimer=disclaimer,
        )
