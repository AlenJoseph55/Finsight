"""
FinSight Agent 3: Market Monitor & Proactive Portfolio Alerts.

Responsibilities:
1. Ingests real-time financial market news via MarketDataService (Finnhub/yfinance).
2. Classifies events with LLMRouter (task='classification' -> Groq Llama 3.3 with Gemini fallback).
   Extracts affected NSE sectors, severity (INFO, WARNING, DANGER), sentiment, and impact summary.
3. Deduplicates events by headline to prevent alert spam.
4. Correlates affected sectors with actual user portfolio holdings and active SIPs.
5. Persists MarketEvents and personalized Alerts for affected investors.
6. Provides a simulation engine for instant demo and testing workflows.
"""

import time
from typing import Dict, List, Optional, Set
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logging import logger
from backend.app.core.sectors import NSE_SECTORS, normalize_sector
from backend.app.llm.router import LLMRouter, llm_router as default_llm_router
from backend.app.market import market_data as default_market_data
from backend.app.market.service import MarketDataService
from backend.app.models.schema import Alert, MarketEvent, Portfolio, SipPlan, User
from backend.app.schemas.alert import NewsClassification, ScanResult, StockImpact


DEFAULT_DEMO_EVENTS = {
    "Financial Services": (
        "RBI Signals Stricter Liquidity Norms & Heightened Risk Weights on Consumer Credit",
        "The Reserve Bank of India cautions lenders on aggressive unsecured credit expansion, potentially narrowing net interest margins and tightening liquidity.",
        "RBI POLICY",
        "Private banks face margin compression; NBFC cost of funds will spike. Trim high-beta financial exposure.",
        [
            {"ticker": "HDFCBANK", "name": "HDFC Bank Ltd", "impact_pct": "-1.8%", "sentiment": "BEARISH", "rationale": "High consumer loan mix faces increased capital requirements"},
            {"ticker": "ICICIBANK", "name": "ICICI Bank", "impact_pct": "-1.4%", "sentiment": "BEARISH", "rationale": "Unsecured credit provisions expected to tick upward"},
            {"ticker": "BAJFINANCE", "name": "Bajaj Finance", "impact_pct": "-2.9%", "sentiment": "BEARISH", "rationale": "NBFC lending cost of funds rising rapidly"},
        ],
    ),
    "Information Technology": (
        "Global Enterprise IT Spending Guidance Weakens Amid Cautious Tech Budgets",
        "Key North American clients delay discretionary cloud transformation projects, stretching deal conversion cycles for Indian IT services providers.",
        "TECH SLOWDOWN",
        "Deal conversion cycles expanding. Focus on defensive large-caps with strong dividend yields.",
        [
            {"ticker": "TCS", "name": "Tata Consultancy Services", "impact_pct": "-1.6%", "sentiment": "BEARISH", "rationale": "BFSI vertical discretionary spend deferred"},
            {"ticker": "INFY", "name": "Infosys Ltd", "impact_pct": "-2.1%", "sentiment": "BEARISH", "rationale": "Guidance revision risk on cloud consulting delays"},
            {"ticker": "WIPRO", "name": "Wipro Ltd", "impact_pct": "-1.2%", "sentiment": "BEARISH", "rationale": "Consulting revenues under margin pressure"},
        ],
    ),
    "Energy": (
        "Middle East Escalation Drives Brent Crude Surge Past $90/bbl",
        "Surging crude oil prices support upstream exploration realizations while compressing marketing margins for domestic oil marketing companies and aviation fuel consumers.",
        "IRAN-US ESCALATION",
        "Oil & Defence rally. Aviation under pressure as fuel costs spike. Consider reducing aviation exposure.",
        [
            {"ticker": "ONGC", "name": "Oil & Natural Gas Corp", "impact_pct": "+4.2%", "sentiment": "BULLISH", "rationale": "Direct beneficiary of Brent crude surge above $90/bbl"},
            {"ticker": "HAL", "name": "Hindustan Aeronautics", "impact_pct": "+6.1%", "sentiment": "BULLISH", "rationale": "Geopolitical escalation lifts defence procurement sentiment"},
            {"ticker": "INDIGO", "name": "InterGlobe Aviation", "impact_pct": "-3.8%", "sentiment": "BEARISH", "rationale": "Aviation turbine fuel accounts for >40% of operating expenses"},
            {"ticker": "RELIANCE", "name": "Reliance Industries", "impact_pct": "+1.9%", "sentiment": "BULLISH", "rationale": "Gross refining margins expand on regional supply anxiety"},
        ],
    ),
    "Automobile": (
        "Auto Component Input Costs Escalate as Inventory Levels Reach Multi-Month Highs",
        "Vehicle manufacturers face margin headwinds from rising steel and specialty metals alongside cooling domestic retail footfalls.",
        "AUTO MARGIN PRESSURE",
        "Input cost spikes and rising dealer inventories could limit near-term price hikes.",
        [
            {"ticker": "TATAMOTORS", "name": "Tata Motors Ltd", "impact_pct": "-2.5%", "sentiment": "BEARISH", "rationale": "Domestic commercial vehicle demand softening; EV margin pressure"},
            {"ticker": "MARUTI", "name": "Maruti Suzuki India", "impact_pct": "-1.5%", "sentiment": "BEARISH", "rationale": "Entry hatchback volume softness and input inflation"},
            {"ticker": "M&M", "name": "Mahindra & Mahindra", "impact_pct": "-1.1%", "sentiment": "BEARISH", "rationale": "Tractor and utility vehicle raw material costs rise"},
        ],
    ),
    "Healthcare": (
        "USFDA Issues Form 483 Inspection Observations on Indian Generic API Plants",
        "Heightened regulatory scrutiny on key domestic pharmaceutical facilities may delay upcoming generic drug launches in export markets.",
        "USFDA SCRUTINY",
        "Compliance costs to rise; potential approval delays for export generics.",
        [
            {"ticker": "SUNPHARMA", "name": "Sun Pharma Industries", "impact_pct": "-1.8%", "sentiment": "BEARISH", "rationale": "Export facility clearance inspection delays"},
            {"ticker": "CIPLA", "name": "Cipla Ltd", "impact_pct": "-1.2%", "sentiment": "BEARISH", "rationale": "Inhaler facility re-audit requirements"},
            {"ticker": "DRREDDY", "name": "Dr. Reddy's Laboratories", "impact_pct": "-2.0%", "sentiment": "BEARISH", "rationale": "Form 483 procedural citations at API site"},
        ],
    ),
    "FMCG": (
        "Rural Demand Softens as Uneven Monsoon Pressures Staple Food Volumes",
        "Leading consumer goods companies report rural volume deceleration and input cost spikes across palm oil and packaging materials.",
        "RURAL DEMAND DIP",
        "Volume growth subdued in rural areas; premium urban segments remain resilient.",
        [
            {"ticker": "HINDUNILVR", "name": "Hindustan Unilever", "impact_pct": "-1.4%", "sentiment": "BEARISH", "rationale": "Rural distribution volume slowdown in home & personal care"},
            {"ticker": "ITC", "name": "ITC Ltd", "impact_pct": "+0.5%", "sentiment": "BULLISH", "rationale": "Cigarette volume defensiveness and hotel segment strength"},
            {"ticker": "NESTLEIND", "name": "Nestle India", "impact_pct": "-0.9%", "sentiment": "BEARISH", "rationale": "Milk and cocoa raw material price inflation"},
        ],
    ),
    "Realty": (
        "Mortgage Rates Rise Following Central Bank Tightening Cycle",
        "Rising home loan interest rates test luxury real estate pre-sales while commercial lease absorption remains resilient.",
        "MORTGAGE HIKE",
        "Affordable housing demand sensitive to EMI hikes; prime commercial properties stay stable.",
        [
            {"ticker": "DLF", "name": "DLF Ltd", "impact_pct": "-2.2%", "sentiment": "BEARISH", "rationale": "Premium residential bookings face delayed decision cycles"},
            {"ticker": "GODREJPROP", "name": "Godrej Properties", "impact_pct": "-2.8%", "sentiment": "BEARISH", "rationale": "Higher borrowing costs impact launch velocity"},
        ],
    ),
}


class MarketMonitorAgent:
    def __init__(
        self,
        router: Optional[LLMRouter] = None,
        market_data_service: Optional[MarketDataService] = None,
    ):
        self.router = router or default_llm_router
        self.market_data = market_data_service or default_market_data

    async def classify_headline(
        self, headline: str, summary: str = ""
    ) -> Optional[NewsClassification]:
        """
        Classifies a market news headline into affected NSE sectors, specific stocks, and severity
        using the active classification LLM route (Groq Llama 3.3 -> Gemini fallback).
        """
        prompt = f"""You are FinSight's Agent 3 (Market Intelligence Monitor).
Your mission is to evaluate financial news headlines and map their direct economic impact to National Stock Exchange of India (NSE) sectors and specific stocks.

Canonical NSE Sectors:
{", ".join(NSE_SECTORS)}

News Headline: {headline}
Summary: {summary}

Instructions:
1. Determine `sectors_affected`: Select all relevant sectors from the canonical list above that will directly experience financial, operational, or valuation impacts. If none apply or it is generic global gossip, return an empty list.
2. Determine `topic_tag`: A short 2-4 word uppercase topic badge (e.g. 'IRAN-US ESCALATION', 'RBI POLICY HIKE', 'TECH BUDGET CUT').
3. Determine `action_advice`: 1-2 concise, actionable strategic sentences for retail investors (e.g. 'Oil & Defence rally. Aviation under pressure as fuel costs spike. Consider reducing aviation exposure.').
4. Determine `stocks_affected`: List of 2 to 4 specific Indian or global stocks materially impacted, each with:
   - ticker (e.g. 'ONGC', 'HAL', 'INDIGO', 'TCS', 'HDFCBANK')
   - name (e.g. 'Oil & Natural Gas Corp', 'InterGlobe Aviation')
   - impact_pct (e.g. '+4.2%' or '-3.8%')
   - sentiment ('BULLISH', 'BEARISH', or 'NEUTRAL')
   - rationale (brief 1-sentence reason)
5. Determine `severity`:
   - "INFO": Routine macro update, positive earnings, standard corporate action.
   - "WARNING": Moderate regulatory headwind, interest rate hike, margin compression, input cost spike.
   - "DANGER": Severe fraud, insolvency, abrupt policy ban, systemic contagion, massive single-day shock.
6. Determine `sentiment`: "POSITIVE", "NEUTRAL", or "NEGATIVE".
7. Determine `one_line_summary`: A concise 1-line actionable impact sentence tailored for Indian retail investors.
8. Determine `is_portfolio_relevant`: True if retail equity, ETF, or mutual fund portfolios holding these sectors should be informed; False if irrelevant trivia.
"""
        messages = [
            {
                "role": "system",
                "content": "You are a financial news intelligence agent for Indian retail equity and mutual fund investors. Output valid JSON.",
            },
            {"role": "user", "content": prompt},
        ]

        try:
            resp = await self.router.complete(
                task="classification",
                messages=messages,
                response_model=NewsClassification,
                temperature=0.1,
            )
            if resp.parsed and isinstance(resp.parsed, NewsClassification):
                # Normalize sector names
                norm_sectors = []
                for s in resp.parsed.sectors_affected:
                    norm = normalize_sector(s)
                    if norm not in norm_sectors:
                        norm_sectors.append(norm)
                resp.parsed.sectors_affected = norm_sectors
                return resp.parsed
        except Exception as e:
            logger.error(f"Error classifying headline '{headline[:40]}...': {e}")

        # Heuristic fallback if LLM classification fails or API key unavailable
        return self._heuristic_classify(headline, summary)

    def _heuristic_classify(self, headline: str, summary: str = "") -> NewsClassification:
        """Deterministic keyword fallback for sector and stock tagging when LLM is unreachable."""
        text = f"{headline} {summary}".lower()
        sectors: List[str] = []
        stocks_affected: List[StockImpact] = []
        topic_tag = ""
        action_advice = ""

        if any(w in text for w in ["oil", "crude", "petroleum", "gas", "energy", "refinery", "brent", "iran"]):
            sectors.append(normalize_sector("Energy"))
            topic_tag = "IRAN-US ESCALATION" if any(w in text for w in ["iran", "middle east", "escalation", "war"]) else "ENERGY SHOCK"
            action_advice = "Oil & Defence rally. Aviation under pressure as fuel costs spike. Consider reducing aviation exposure."
            stocks_affected = [
                StockImpact(ticker="ONGC", name="Oil & Natural Gas Corp", impact_pct="+4.2%", sentiment="BULLISH", rationale="Crude rally drives upstream margin expansion"),
                StockImpact(ticker="HAL", name="Hindustan Aeronautics", impact_pct="+6.1%", sentiment="BULLISH", rationale="Geopolitical escalation lifts defence procurement sentiment"),
                StockImpact(ticker="INDIGO", name="InterGlobe Aviation", impact_pct="-3.8%", sentiment="BEARISH", rationale="Aviation turbine fuel accounts for >40% of operating expenses"),
                StockImpact(ticker="RELIANCE", name="Reliance Industries", impact_pct="+1.9%", sentiment="BULLISH", rationale="Gross refining margins expand on regional supply anxiety"),
            ]
        elif any(w in text for w in ["bank", "rbi", "nbfc", "lending", "interest rate", "repo rate", "credit", "fintech"]):
            sectors.append(normalize_sector("Financial Services"))
            topic_tag = "RBI LIQUIDITY CRUNCH"
            action_advice = "Unsecured lending risk weights tightened. Move toward capital-rich large-cap private banks."
            stocks_affected = [
                StockImpact(ticker="HDFCBANK", name="HDFC Bank Ltd", impact_pct="-1.8%", sentiment="BEARISH", rationale="Stricter risk-weights dampen retail credit growth"),
                StockImpact(ticker="ICICIBANK", name="ICICI Bank", impact_pct="-1.4%", sentiment="BEARISH", rationale="Provisions on unsecured retail loan book"),
                StockImpact(ticker="BAJFINANCE", name="Bajaj Finance", impact_pct="-2.9%", sentiment="BEARISH", rationale="Borrowing cost escalation for non-bank lenders"),
            ]
        elif any(w in text for w in ["it", "tech", "software", "cloud", "saas", "ai", "nasdaq", "infosys", "tcs"]):
            sectors.append(normalize_sector("Information Technology"))
            topic_tag = "TECH SPEND SLOWDOWN"
            action_advice = "Enterprise cloud transformation projects delayed. Favor firms with strong BFSI pipeline."
            stocks_affected = [
                StockImpact(ticker="TCS", name="Tata Consultancy Services", impact_pct="-1.6%", sentiment="BEARISH", rationale="US enterprise client discretionary budget freeze"),
                StockImpact(ticker="INFY", name="Infosys Ltd", impact_pct="-2.1%", sentiment="BEARISH", rationale="Cloud migration contract renewals face margin cuts"),
                StockImpact(ticker="WIPRO", name="Wipro Ltd", impact_pct="-1.2%", sentiment="BEARISH", rationale="Consulting vertical headwinds persist"),
            ]
        elif any(w in text for w in ["auto", "vehicle", "car", "ev", "motor", "tata motors", "maruti"]):
            sectors.append(normalize_sector("Automobile"))
            topic_tag = "AUTO MARGIN PRESSURE"
            action_advice = "Rising raw material costs challenge vehicle OEM margins."
            stocks_affected = [
                StockImpact(ticker="TATAMOTORS", name="Tata Motors Ltd", impact_pct="-2.5%", sentiment="BEARISH", rationale="Domestic inventory build-up and EV discounting"),
                StockImpact(ticker="MARUTI", name="Maruti Suzuki India", impact_pct="-1.5%", sentiment="BEARISH", rationale="Input inflation across steel and components"),
                StockImpact(ticker="M&M", name="Mahindra & Mahindra", impact_pct="-1.1%", sentiment="BEARISH", rationale="Tractor and commercial volume slowdown"),
            ]
        elif any(w in text for w in ["pharma", "drug", "fda", "hospital", "health", "biotech"]):
            sectors.append(normalize_sector("Healthcare"))
            topic_tag = "USFDA REGULATORY PROBE"
            action_advice = "Audit observations may delay export generics; expect near-term price consolidation."
            stocks_affected = [
                StockImpact(ticker="SUNPHARMA", name="Sun Pharma Industries", impact_pct="-1.8%", sentiment="BEARISH", rationale="API manufacturing plant inspection queries"),
                StockImpact(ticker="DRREDDY", name="Dr. Reddy's Laboratories", impact_pct="-2.0%", sentiment="BEARISH", rationale="Regulatory observations on key generic lines"),
            ]
        elif any(w in text for w in ["realty", "real estate", "housing", "property", "developer"]):
            sectors.append(normalize_sector("Realty"))
            topic_tag = "MORTGAGE RATE HIKE"
            action_advice = "Higher borrowing costs slow mid-income housing sales."
            stocks_affected = [
                StockImpact(ticker="DLF", name="DLF Ltd", impact_pct="-2.2%", sentiment="BEARISH", rationale="Pre-sale momentum eases under higher interest rates"),
                StockImpact(ticker="GODREJPROP", name="Godrej Properties", impact_pct="-2.8%", sentiment="BEARISH", rationale="High-leverage launch models face finance cost spikes"),
            ]
        elif any(w in text for w in ["fmcg", "consumer", "food", "staple", "retail"]):
            sectors.append(normalize_sector("Consumer Goods"))
            topic_tag = "RURAL VOLUME HEADWINDS"
            action_advice = "Inflation in agricultural inputs weighs on volume growth."
            stocks_affected = [
                StockImpact(ticker="HINDUNILVR", name="Hindustan Unilever", impact_pct="-1.4%", sentiment="BEARISH", rationale="Rural staples demand slowdown"),
                StockImpact(ticker="ITC", name="ITC Ltd", impact_pct="+0.5%", sentiment="BULLISH", rationale="Defensive cash-flows provide downside buffer"),
            ]

        if not sectors:
            sectors.append(normalize_sector("Diversified"))
            topic_tag = "MARKET UPDATE"
            action_advice = "Monitor broad market volatility."

        severity = "INFO"
        if any(w in text for w in ["hike", "cut", "warning", "caution", "scrutiny", "probe", "decline", "fall", "slump"]):
            severity = "WARNING"
        if any(w in text for w in ["ban", "crash", "fraud", "default", "crisis", "plunge", "collapse", "investigation"]):
            severity = "DANGER"

        sentiment = "NEGATIVE" if severity in ("WARNING", "DANGER") else "NEUTRAL"
        return NewsClassification(
            sectors_affected=sectors,
            topic_tag=topic_tag,
            action_advice=action_advice,
            stocks_affected=stocks_affected,
            severity=severity,
            sentiment=sentiment,
            one_line_summary=headline,
            is_portfolio_relevant=True,
        )

    async def correlate_event_with_users(
        self, db: AsyncSession, event: MarketEvent
    ) -> List[Alert]:
        """
        Cross-references a MarketEvent's affected sectors and stocks with all users'
        holdings, sector allocations, and active SIPs.
        Creates personalized Alert records.
        """
        event_sectors: Set[str] = set(event.sectors_affected or [])
        if not event_sectors and not event.stocks_affected:
            return []

        # Find all users
        user_stmt = select(User)
        user_res = await db.execute(user_stmt)
        users = user_res.scalars().all()

        created_alerts: List[Alert] = []

        for user in users:
            # 1. Fetch user's latest portfolio
            port_stmt = (
                select(Portfolio)
                .where(Portfolio.user_id == user.id)
                .order_by(Portfolio.created_at.desc())
                .options(
                    selectinload(Portfolio.holdings),
                    selectinload(Portfolio.sector_allocations),
                )
            )
            port_res = await db.execute(port_stmt)
            portfolio = port_res.scalars().first()

            # 2. Fetch user's active SIPs
            sip_stmt = select(SipPlan).where(
                SipPlan.user_id == user.id, SipPlan.is_active == True
            )
            sip_res = await db.execute(sip_stmt)
            active_sips = sip_res.scalars().all()

            # Check for sector matches
            matching_holdings = []
            exposure_pct = 0.0

            if portfolio:
                for h in portfolio.holdings:
                    if h.sector in event_sectors:
                        matching_holdings.append(h.name)

                for sa in portfolio.sector_allocations:
                    if sa.sector in event_sectors:
                        exposure_pct += sa.allocation_pct

            matching_sips = []
            for s in active_sips:
                if s.fund_sector in event_sectors:
                    matching_sips.append(s.fund_name)

            # 3. Check for specific stock matches and annotate portfolio ownership
            annotated_stocks = []
            raw_stocks = event.stocks_affected or []
            held_stock_names = []

            for s in raw_stocks:
                s_dict = s if isinstance(s, dict) else (s.model_dump() if hasattr(s, "model_dump") else dict(s))
                ticker = (s_dict.get("ticker") or "").strip().lower()
                name = (s_dict.get("name") or "").strip().lower()
                is_held = False
                matched_holding_name = None

                if portfolio:
                    for h in portfolio.holdings:
                        h_name_lower = h.name.lower()
                        if (ticker and ticker in h_name_lower) or (name and (name in h_name_lower or h_name_lower in name)):
                            is_held = True
                            matched_holding_name = h.name
                            held_stock_names.append(h.name)
                            break

                s_copy = dict(s_dict)
                s_copy["is_in_portfolio"] = is_held
                s_copy["user_holding_name"] = matched_holding_name
                annotated_stocks.append(s_copy)

            # Sort so user's owned stocks always appear first
            annotated_stocks.sort(key=lambda s: not s.get("is_in_portfolio", False))
            has_held_stock = any(s.get("is_in_portfolio") for s in annotated_stocks)

            # If user has exposure in any affected sector OR holds an affected stock, generate a personalized alert
            if matching_holdings or matching_sips or exposure_pct > 0 or has_held_stock:
                sectors_str = ", ".join(sorted(event_sectors)) if event_sectors else (event.topic_tag or "Market Alert")
                title = f"{event.severity.upper()} Alert: {sectors_str}"

                parts = []
                # Explicit direct stock impact callout for user's owned holdings
                held_impacts = [
                    f"{s.get('user_holding_name') or s.get('name')} [{s.get('ticker')}] ({s.get('impact_pct')} {s.get('sentiment')})"
                    for s in annotated_stocks
                    if s.get("is_in_portfolio")
                ]
                if held_impacts:
                    parts.append(f"Direct impact on your portfolio: {', '.join(held_impacts)}.")

                if exposure_pct > 0:
                    parts.append(
                        f"Your portfolio has {exposure_pct:.1f}% exposure to {sectors_str}."
                    )
                if (matching_holdings or held_stock_names) and not held_impacts:
                    all_matched = list(dict.fromkeys(matching_holdings + held_stock_names))
                    preview_holdings = ", ".join(all_matched[:3])
                    if len(all_matched) > 3:
                        preview_holdings += f" (+{len(all_matched)-3} more)"
                    parts.append(f"Affected holdings: {preview_holdings}.")
                if matching_sips:
                    unique_sips = list(dict.fromkeys(matching_sips))
                    preview_sips = ", ".join(unique_sips[:2])
                    if len(unique_sips) > 2:
                        preview_sips += f" (+{len(unique_sips)-2} more)"
                    parts.append(f"Active SIPs in sector: {preview_sips}.")

                parts.append(f"Impact: {event.summary}")
                message = " ".join(parts)

                alert = Alert(
                    user_id=user.id,
                    event_id=event.id,
                    title=title,
                    message=message,
                    severity=event.severity,
                    topic_tag=event.topic_tag,
                    action_advice=event.action_advice,
                    stocks_affected=annotated_stocks,
                    is_read=False,
                )
                db.add(alert)
                created_alerts.append(alert)

        return created_alerts

    async def scan(self, db: AsyncSession) -> ScanResult:
        """
        Executes the full Market Monitor Agent pipeline:
        1. Ingest news headlines via MarketDataService
        2. Deduplicate against existing market_events
        3. Classify with LLMRouter
        4. Correlate with users' portfolios & SIPs
        5. Persist events and alerts
        """
        start_time = time.perf_counter()
        events_processed = 0
        alerts_created_count = 0
        skipped_duplicates = 0

        # 1. Ingest news
        news_items = await self.market_data.get_news(category="general")
        
        # If no external news returned (e.g. offline or no API key), fallback to sample headlines
        if not news_items:
            logger.info("No external market news returned; scanning fallback market items.")
            from backend.app.market.models import NewsItem
            from backend.app.core.timezone import now_utc

            news_items = [
                NewsItem(
                    headline="RBI Signals Stricter Liquidity Norms & Heightened Risk Weights on Consumer Credit",
                    summary="Central bank highlights financial sector vulnerabilities and urges proactive buffer accumulation.",
                    published_at=now_utc(),
                ),
                NewsItem(
                    headline="Global Enterprise IT Spending Guidance Weakens Amid Cautious Tech Budgets",
                    summary="Tech spending slowdown may temper deal pipelines for tier-1 Indian software exporters.",
                    published_at=now_utc(),
                ),
                NewsItem(
                    headline="Middle East Escalation Drives Brent Crude Surge Past $90/bbl",
                    summary="Surging crude oil prices support upstream exploration realizations while compressing marketing margins for domestic oil marketing companies and aviation fuel consumers.",
                    published_at=now_utc(),
                ),
            ]

        # 2. Check for duplicates
        headlines = [n.headline for n in news_items]
        dup_stmt = select(MarketEvent.headline).where(MarketEvent.headline.in_(headlines))
        dup_res = await db.execute(dup_stmt)
        existing_headlines = set(dup_res.scalars().all())

        for item in news_items:
            if item.headline in existing_headlines:
                skipped_duplicates += 1
                continue

            # 3. Classify
            classification = await self.classify_headline(item.headline, item.summary)
            if not classification or not classification.is_portfolio_relevant:
                continue

            # 4. Persist MarketEvent
            stocks_data = [
                s.model_dump() if hasattr(s, "model_dump") else s
                for s in (classification.stocks_affected or [])
            ]
            event = MarketEvent(
                headline=item.headline,
                summary=classification.one_line_summary or item.summary,
                sectors_affected=classification.sectors_affected,
                severity=classification.severity,
                topic_tag=classification.topic_tag or "",
                action_advice=classification.action_advice or "",
                stocks_affected=stocks_data,
                source_url=item.url,
            )
            db.add(event)
            await db.flush()  # Populates event.id
            events_processed += 1
            existing_headlines.add(item.headline)

            # 5. Correlate and create alerts
            user_alerts = await self.correlate_event_with_users(db, event)
            alerts_created_count += len(user_alerts)

        await db.commit()
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return ScanResult(
            events_processed=events_processed,
            alerts_created=alerts_created_count,
            skipped_duplicates=skipped_duplicates,
            scan_duration_ms=duration_ms,
            message=f"Scanned {len(news_items)} headlines. Created {alerts_created_count} personalized alerts across {events_processed} new events.",
        )

    async def simulate_event(
        self,
        db: AsyncSession,
        sector: str,
        severity: str = "WARNING",
        headline: Optional[str] = None,
        summary: Optional[str] = None,
        target_user_id: Optional[int] = None,
        topic_tag: Optional[str] = None,
        action_advice: Optional[str] = None,
        stocks: Optional[List[dict]] = None,
    ) -> ScanResult:
        """
        Instantly injects a simulated market event for demo/testing purposes
        without requiring external provider or LLM calls.
        """
        start_time = time.perf_counter()
        norm_sector = normalize_sector(sector)

        demo_tuple = DEFAULT_DEMO_EVENTS.get(norm_sector)
        if demo_tuple:
            default_headline, default_summary, def_topic, def_advice, def_stocks = demo_tuple
        else:
            default_headline = f"Significant Policy & Macro Shifts Detected in {norm_sector}"
            default_summary = f"Regulatory updates and sector volume movements suggest heightened volatility for {norm_sector} assets."
            def_topic = f"{norm_sector.upper()} VOLATILITY"
            def_advice = f"Review exposure to {norm_sector} holdings."
            def_stocks = []

        final_headline = headline or default_headline
        final_summary = summary or default_summary
        final_topic = topic_tag or def_topic
        final_advice = action_advice or def_advice
        final_stocks = stocks if stocks is not None else def_stocks

        # Add unique timestamp suffix to headline to avoid collision if run multiple times in demo
        unique_headline = f"{final_headline} [{int(time.time()) % 10000}]"

        event = MarketEvent(
            headline=unique_headline,
            summary=final_summary,
            sectors_affected=[norm_sector],
            severity=severity.upper(),
            topic_tag=final_topic,
            action_advice=final_advice,
            stocks_affected=final_stocks,
            source_url=None,
        )
        db.add(event)
        await db.flush()

        # Correlate
        user_alerts = await self.correlate_event_with_users(db, event)
        await db.commit()

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return ScanResult(
            events_processed=1,
            alerts_created=len(user_alerts),
            skipped_duplicates=0,
            scan_duration_ms=duration_ms,
            message=f"Simulated event created for {norm_sector}. Generated {len(user_alerts)} user alerts.",
        )


# Default singleton
market_monitor_agent = MarketMonitorAgent()
