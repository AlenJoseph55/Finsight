"""
Portfolio & Holdings Router.

Integrates:
- Real document ingestion via PortfolioIntelligenceAgent (Agent 1)
- Deterministic Math Engine with database persistence.
- SaaS Entitlements: Feature gating (FeatureService) and usage metering (QuotaService).
- Standardized API response envelopes & error codes.
"""

from datetime import date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, HTTPException, status
from sqlalchemy import select, delete, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import get_settings
from backend.app.database import get_db
from backend.app.models.schema import User, Portfolio, Holding, SectorAllocation, DocumentChunk
from backend.app.services.math_engine import FinancialMathEngine, HoldingInput
from backend.app.services.tax_engine import TaxEngine, SellEstimateResult
from backend.app.schemas.portfolio import (
    PortfolioSummary,
    UpdateHoldingRequest,
    FlushInvestmentDataResponse,
    SellEstimateRequest,
    BrokerOptionResponse,
)
from backend.app.core.responses import SuccessResponse
from backend.app.core.context import request_id_ctx
from backend.app.core.exceptions import FinSightException, ErrorCode
from backend.app.services.features import FeatureService
from backend.app.services.quota import QuotaService
from backend.app.services.document_parser import DocumentParserService
from backend.app.agents.portfolio_agent import PortfolioIntelligenceAgent
from backend.app.core.sectors import normalize_sector
from backend.app.routers.auth import get_current_user

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])
settings = get_settings()


@router.get("/summary", response_model=SuccessResponse[PortfolioSummary])
async def get_portfolio_summary(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the latest portfolio summary with deterministically calculated
    weights, returns, sector exposures, and concentration warning.
    """
    req_id = request_id_ctx.get()
    user_id = current_user.id
    stmt = (
        select(Portfolio)
        .where(Portfolio.user_id == user_id)
        .order_by(Portfolio.created_at.desc())
        .options(
            selectinload(Portfolio.holdings),
            selectinload(Portfolio.sector_allocations),
        )
    )
    result = await db.execute(stmt)
    portfolio = result.scalars().first()

    if not portfolio:
        raise FinSightException(
            code=ErrorCode.FS_NOT_FOUND_4040,
            message="No portfolio found for this user. Upload a statement or seed demo data.",
            http_status=404,
        )

    # Re-evaluate sector allocations & concentration flags against Look-Through decomposition
    if portfolio.holdings:
        holding_inputs = [
            HoldingInput(
                name=h.name,
                sector=h.sector,
                invested_amount=h.invested_amount,
                current_value=h.current_value,
            )
            for h in portfolio.holdings
        ]
        math_check = FinancialMathEngine.compute(holding_inputs, concentration_threshold_pct=30.0)

        existing_sectors = {sa.sector: sa.allocation_pct for sa in portfolio.sector_allocations}
        needs_sector_update = (
            any(s.lower() == "diversified" for s in existing_sectors)
            or set(existing_sectors.keys()) != set(math_check.sector_allocations.keys())
        )

        if (
            needs_sector_update
            or portfolio.is_concentrated != math_check.is_concentrated
            or portfolio.concentration_summary != math_check.concentration_summary
        ):
            portfolio.is_concentrated = math_check.is_concentrated
            portfolio.concentration_summary = math_check.concentration_summary

            if needs_sector_update:
                for sa in list(portfolio.sector_allocations):
                    await db.delete(sa)
                await db.flush()

                for sector_name, alloc_pct in math_check.sector_allocations.items():
                    total_val = round(math_check.current_value * (alloc_pct / 100.0), 2)
                    new_sa = SectorAllocation(
                        portfolio_id=portfolio.id,
                        sector=sector_name,
                        allocation_pct=alloc_pct,
                        total_value=total_val,
                    )
                    db.add(new_sa)

            await db.commit()
            await db.refresh(portfolio, ["sector_allocations", "holdings"])

    return SuccessResponse(request_id=req_id, path=request.url.path, data=portfolio)


@router.post("/seed-sample", response_model=SuccessResponse[PortfolioSummary])
async def seed_sample_portfolio(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Seeds the exact sample portfolio matching user's holdings:
    - Mutual Funds: Parag Parikh Flexi Cap, HDFC Mid Cap, Motilal Oswal Nasdaq 100
    - Stocks: HDFC Bank, Reliance, TCS
    """
    if settings.ENVIRONMENT.lower() == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo portfolio seeding is strictly prohibited in production environments.",
        )

    req_id = request_id_ctx.get()
    user_id = current_user.id

    # Ensure a user exists
    user_stmt = select(User).where(User.id == user_id)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()
    if not user:
        user = User(
            id=user_id,
            email_hash="demo_user_hash_1234567890",
            auth_method="jwt",
            is_demo=True,
            display_name="Demo Investor",
        )
        db.add(user)
        await db.commit()

    raw_holdings = [
        HoldingInput(name="Parag Parikh Flexi Cap Fund", sector=normalize_sector("Diversified"), invested_amount=200000.0, current_value=245000.0),
        HoldingInput(name="HDFC Mid-Cap Opportunities Fund", sector=normalize_sector("Diversified"), invested_amount=150000.0, current_value=180000.0),
        HoldingInput(name="Motilal Oswal Nasdaq 100 ETF", sector=normalize_sector("Information Technology"), invested_amount=100000.0, current_value=122000.0),
        HoldingInput(name="HDFC Bank Ltd", sector=normalize_sector("Financial Services"), invested_amount=160000.0, current_value=175000.0),
        HoldingInput(name="Reliance Industries Ltd", sector=normalize_sector("Energy"), invested_amount=120000.0, current_value=134000.0),
        HoldingInput(name="Tata Consultancy Services Ltd", sector=normalize_sector("Information Technology"), invested_amount=110000.0, current_value=120000.0),
    ]

    math_result = FinancialMathEngine.compute(raw_holdings, concentration_threshold_pct=30.0)

    # Deterministic XIRR calculation based on holding vintage
    sample_flows = [
        (date.today() - timedelta(days=365), -math_result.total_invested),
        (date.today(), math_result.current_value),
    ]
    computed_xirr = FinancialMathEngine.calculate_xirr(sample_flows)

    new_portfolio = Portfolio(
        user_id=user_id,
        source_file_name="sample_seed.pdf",
        extraction_status="complete",
        extraction_note=None,
        total_invested=math_result.total_invested,
        current_value=math_result.current_value,
        absolute_return_pct=math_result.absolute_return_pct,
        xirr_pct=computed_xirr,
        is_concentrated=math_result.is_concentrated,
        concentration_summary=math_result.concentration_summary,
    )
    db.add(new_portfolio)
    await db.flush()

    for h in math_result.holdings:
        holding_record = Holding(
            portfolio_id=new_portfolio.id,
            name=h.name,
            sector=h.sector,
            invested_amount=h.invested_amount,
            current_value=h.current_value,
            allocation_pct=h.allocation_pct,
            instrument_type="MUTUAL_FUND" if "Fund" in h.name or "ETF" in h.name else "STOCK",
        )
        db.add(holding_record)

    for sector_name, alloc_pct in math_result.sector_allocations.items():
        total_val = round(math_result.current_value * (alloc_pct / 100.0), 2)
        db.add(
            SectorAllocation(
                portfolio_id=new_portfolio.id,
                sector=sector_name,
                allocation_pct=alloc_pct,
                total_value=total_val,
            )
        )

    await db.commit()

    # Re-fetch with eager loads
    refreshed_stmt = (
        select(Portfolio)
        .where(Portfolio.id == new_portfolio.id)
        .options(
            selectinload(Portfolio.holdings),
            selectinload(Portfolio.sector_allocations),
        )
    )
    refreshed_res = await db.execute(refreshed_stmt)
    portfolio_record = refreshed_res.scalars().first()

    return SuccessResponse(request_id=req_id, path=request.url.path, data=portfolio_record)


@router.post("/upload", response_model=SuccessResponse[PortfolioSummary])
async def upload_portfolio_document(
    request: Request,
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload Statement Endpoint (Agent 1 Pipeline).
    1. Validates Content-Length header against 15MB limit.
    2. Enforces Feature Gate: `portfolio_upload`.
    3. Enforces Quota Gate: `document_uploads`.
    4. Parses document (PDF text / scanned Vision / image / CSV / Excel).
    5. Deduplicates holdings against existing records.
    6. Triggers deterministic financial recalculation.
    7. Emits structured log event.
    8. Encrypts sensitive fields (AES-256) and persists in PostgreSQL.
    9. Generates semantic vector embeddings for RAG.
    10. Records metered quota usage.
    """
    req_id = request_id_ctx.get()
    user_id = current_user.id

    # 1. Content-Length header pre-check
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            cl_int = int(content_length)
            if cl_int > DocumentParserService.MAX_FILE_SIZE_BYTES:
                raise FinSightException(
                    code=ErrorCode.FS_FILE_4001,
                    message="File size exceeds maximum limit of 15MB.",
                    http_status=400,
                )
        except ValueError:
            pass

    # 2. Extension check before DB calls
    filename = file.filename or "statement.pdf"
    DocumentParserService.validate_file(filename, 0)

    # 3. Feature flag check
    await FeatureService.enforce("portfolio_upload", user_id, db)

    # 4. Quota check
    await QuotaService.enforce("document_uploads", user_id, db)

    # 5. Read body into memory and validate actual size
    file_bytes = await file.read()
    DocumentParserService.validate_file(filename, len(file_bytes))

    # 5. Process through Agent 1
    agent = PortfolioIntelligenceAgent()
    portfolio = await agent.process_document(
        file_bytes=file_bytes,
        filename=filename,
        user_id=user_id,
        db=db,
        password=password,
    )

    # 6. Record quota consumption
    await QuotaService.record(
        quota_key="document_uploads",
        user_id=user_id,
        db=db,
        metadata={"filename": filename, "portfolio_id": portfolio.id},
    )
    await db.commit()

    return SuccessResponse(request_id=req_id, path=request.url.path, data=portfolio)


@router.post("/refresh-prices", response_model=SuccessResponse[PortfolioSummary])
async def refresh_portfolio_prices(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Live Price & Valuation Refresher.
    Fetches real-time market prices for stocks and NAVs for mutual funds,
    then recalculates total portfolio values, returns, and Look-Through sector exposures.
    """
    req_id = request_id_ctx.get()
    user_id = current_user.id

    stmt = (
        select(Portfolio)
        .where(Portfolio.user_id == user_id)
        .order_by(Portfolio.created_at.desc())
        .options(
            selectinload(Portfolio.holdings),
            selectinload(Portfolio.sector_allocations),
        )
    )
    result = await db.execute(stmt)
    portfolio = result.scalars().first()

    if not portfolio or not portfolio.holdings:
        raise FinSightException(
            code=ErrorCode.FS_NOT_FOUND_4040,
            message="No portfolio or holdings found to refresh.",
            http_status=404,
        )

    # Symbol normalization map for Indian large caps
    NAME_TO_TICKER = {
        "hdfc bank": "HDFCBANK",
        "reliance": "RELIANCE",
        "tcs": "TCS",
        "tata consultancy": "TCS",
        "infosys": "INFY",
        "icici bank": "ICICIBANK",
        "sbi": "SBIN",
        "state bank": "SBIN",
        "bharti airtel": "BHARTIARTL",
        "itc": "ITC",
        "kotak": "KOTAKBANK",
        "larsen": "LT",
        "l&t": "LT",
        "axis bank": "AXISBANK",
        "nasdaq": "QQQ",
    }

    from backend.app.market.service import market_data

    # Query live prices for direct stocks and ETFs
    for h in portfolio.holdings:
        type_upper = (h.instrument_type or "").upper()
        name_lower = h.name.lower()

        if type_upper in ["STOCK", "ETF"] or ("fund" not in name_lower and "scheme" not in name_lower):
            sym = h.symbol
            if not sym:
                for k, v in NAME_TO_TICKER.items():
                    if k in name_lower:
                        sym = v
                        break
            if sym:
                try:
                    quote = await market_data.get_quote(sym, exchange="US" if sym == "QQQ" else "NSE")
                    if quote and quote.price > 0:
                        if h.units and h.units > 0:
                            h.current_value = round(h.units * quote.price, 2)
                        elif quote.change_pct != 0:
                            h.current_value = round(h.current_value * (1.0 + (quote.change_pct / 100.0)), 2)
                except Exception:
                    pass

    # Recalculate mathematical rollups using Look-Through
    await recalculate_portfolio(portfolio, db)

    return SuccessResponse(request_id=req_id, path=request.url.path, data=portfolio)


async def recalculate_portfolio(portfolio: Portfolio, db: AsyncSession) -> Portfolio:
    """
    Recomputes total invested, current value, absolute return, concentration risk,
    and Look-Through sector allocations for a portfolio based on its current holdings.
    """
    if not portfolio.holdings:
        portfolio.total_invested = 0.0
        portfolio.current_value = 0.0
        portfolio.absolute_return_pct = 0.0
        portfolio.is_concentrated = False
        portfolio.concentration_summary = "Portfolio is empty."
        for sa in list(portfolio.sector_allocations):
            await db.delete(sa)
        await db.flush()
        await db.commit()
        await db.refresh(portfolio, ["sector_allocations", "holdings"])
        return portfolio

    holding_inputs = [
        HoldingInput(
            name=h.name,
            sector=h.sector,
            invested_amount=h.invested_amount,
            current_value=h.current_value,
        )
        for h in portfolio.holdings
    ]
    math_result = FinancialMathEngine.compute(holding_inputs, concentration_threshold_pct=30.0)

    portfolio.total_invested = math_result.total_invested
    portfolio.current_value = math_result.current_value
    portfolio.absolute_return_pct = math_result.absolute_return_pct
    portfolio.is_concentrated = math_result.is_concentrated
    portfolio.concentration_summary = math_result.concentration_summary

    # Update individual holding allocation percentages
    for h, ch in zip(portfolio.holdings, math_result.holdings):
        h.allocation_pct = ch.allocation_pct

    # Refresh sector allocations table records
    for sa in list(portfolio.sector_allocations):
        await db.delete(sa)
    await db.flush()

    for sector_name, alloc_pct in math_result.sector_allocations.items():
        total_val = round(math_result.current_value * (alloc_pct / 100.0), 2)
        new_sa = SectorAllocation(
            portfolio_id=portfolio.id,
            sector=sector_name,
            allocation_pct=alloc_pct,
            total_value=total_val,
        )
        db.add(new_sa)

    await db.commit()
    await db.refresh(portfolio, ["sector_allocations", "holdings"])
    return portfolio


@router.put("/holdings/{holding_id}", response_model=SuccessResponse[PortfolioSummary])
async def update_holding(
    request: Request,
    holding_id: int,
    payload: UpdateHoldingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Updates an investment holding's name, sector, invested amount, or current value,
    then recalculates the portfolio's Look-Through sector exposures and returns.
    """
    req_id = request_id_ctx.get()

    stmt = (
        select(Holding)
        .where(Holding.id == holding_id)
        .options(
            selectinload(Holding.portfolio).selectinload(Portfolio.holdings),
            selectinload(Holding.portfolio).selectinload(Portfolio.sector_allocations),
        )
    )
    result = await db.execute(stmt)
    holding = result.scalars().first()

    if not holding or not holding.portfolio or holding.portfolio.user_id != current_user.id:
        raise FinSightException(
            code=ErrorCode.FS_NOT_FOUND_4040,
            message=f"Holding with ID {holding_id} not found for this user.",
            http_status=404,
        )

    portfolio = holding.portfolio

    # Update fields if provided
    if payload.name is not None and payload.name.strip():
        holding.name = payload.name.strip()
    if payload.sector is not None and payload.sector.strip():
        holding.sector = normalize_sector(payload.sector.strip())
    if payload.invested_amount is not None:
        holding.invested_amount = round(payload.invested_amount, 2)
    if payload.current_value is not None:
        holding.current_value = round(payload.current_value, 2)
    if payload.units is not None:
        holding.units = payload.units
    if payload.nav is not None:
        holding.nav = payload.nav
    if payload.instrument_type is not None and payload.instrument_type.strip():
        holding.instrument_type = payload.instrument_type.strip().upper()
    if payload.purchase_date is not None:
        holding.purchase_date = payload.purchase_date
    if payload.broker is not None:
        holding.broker = payload.broker.strip().lower()

    await recalculate_portfolio(portfolio, db)

    return SuccessResponse(request_id=req_id, path=request.url.path, data=portfolio)


@router.delete("/holdings/{holding_id}", response_model=SuccessResponse[PortfolioSummary])
async def delete_holding(
    request: Request,
    holding_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Removes an investment holding completely from the user's portfolio
    and recalculates all portfolio analytics and Look-Through sector exposures.
    """
    req_id = request_id_ctx.get()

    stmt = (
        select(Holding)
        .where(Holding.id == holding_id)
        .options(
            selectinload(Holding.portfolio).selectinload(Portfolio.holdings),
            selectinload(Holding.portfolio).selectinload(Portfolio.sector_allocations),
        )
    )
    result = await db.execute(stmt)
    holding = result.scalars().first()

    if not holding or not holding.portfolio or holding.portfolio.user_id != current_user.id:
        raise FinSightException(
            code=ErrorCode.FS_NOT_FOUND_4040,
            message=f"Holding with ID {holding_id} not found for this user.",
            http_status=404,
        )

    portfolio = holding.portfolio
    portfolio.holdings.remove(holding)
    await db.delete(holding)
    await db.flush()

    await recalculate_portfolio(portfolio, db)

    return SuccessResponse(request_id=req_id, path=request.url.path, data=portfolio)


@router.delete("/flush", response_model=SuccessResponse[FlushInvestmentDataResponse])
async def flush_all_investment_data(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Completely flushes out all investment data (portfolios, holdings, statements,
    sector allocations, and document chunks) for the authenticated user,
    leaving a 100% clean slate.
    """
    req_id = request_id_ctx.get()
    user_id = current_user.id

    p_stmt = (
        select(Portfolio)
        .where(Portfolio.user_id == user_id)
        .options(selectinload(Portfolio.holdings))
    )
    p_result = await db.execute(p_stmt)
    user_portfolios = p_result.scalars().all()

    p_ids = [p.id for p in user_portfolios]
    deleted_portfolios_count = len(p_ids)
    deleted_holdings_count = 0

    if p_ids:
        # Delete document chunks
        await db.execute(delete(DocumentChunk).where(DocumentChunk.portfolio_id.in_(p_ids)))
        # Delete sector allocations
        await db.execute(delete(SectorAllocation).where(SectorAllocation.portfolio_id.in_(p_ids)))
        # Count and delete holdings
        h_res = await db.execute(select(func.count(Holding.id)).where(Holding.portfolio_id.in_(p_ids)))
        deleted_holdings_count = h_res.scalar() or 0
        await db.execute(delete(Holding).where(Holding.portfolio_id.in_(p_ids)))
        # Delete portfolios
        await db.execute(delete(Portfolio).where(Portfolio.id.in_(p_ids)))
        await db.commit()

    return SuccessResponse(
        request_id=req_id,
        path=request.url.path,
        data=FlushInvestmentDataResponse(
            message="All investment data successfully flushed.",
            deleted_portfolios=deleted_portfolios_count,
            deleted_holdings=deleted_holdings_count,
        ),
    )


@router.get("/brokers", response_model=SuccessResponse[List[BrokerOptionResponse]])
async def get_supported_brokers(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Returns list of supported Indian stock & mutual fund brokers with fee summaries.
    """
    req_id = request_id_ctx.get()
    brokers = TaxEngine.get_supported_brokers()
    return SuccessResponse(
        request_id=req_id,
        path=request.url.path,
        data=[BrokerOptionResponse(**b) for b in brokers],
    )


@router.post("/sell-estimate", response_model=SuccessResponse[SellEstimateResult])
async def calculate_sell_estimate(
    request: Request,
    payload: SellEstimateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Calculates detailed brokerage fees, statutory charges (STT, GST, SEBI turnover, exchange fees),
    exit loads, capital gains tax (LTCG vs STCG under Budget 2024), and tax-saving harvesting tips.
    """
    req_id = request_id_ctx.get()
    stmt = (
        select(Holding)
        .where(Holding.id == payload.holding_id)
        .options(
            selectinload(Holding.portfolio).selectinload(Portfolio.holdings),
        )
    )
    result = await db.execute(stmt)
    holding = result.scalars().first()

    if not holding or not holding.portfolio or holding.portfolio.user_id != current_user.id:
        raise FinSightException(
            code=ErrorCode.FS_NOT_FOUND_4040,
            message=f"Holding with ID {payload.holding_id} not found.",
            http_status=404,
        )

    # Derive current price/NAV
    units = holding.units if (holding.units and holding.units > 0) else 1.0
    current_price = (
        holding.nav
        if (holding.nav and holding.nav > 0)
        else (holding.current_value / units if units > 0 else holding.current_value)
    )

    # Gather other holdings in the same portfolio for loss-harvesting checks
    other_holdings = [
        {
            "id": h.id,
            "name": h.name,
            "invested_amount": h.invested_amount,
            "current_value": h.current_value,
        }
        for h in holding.portfolio.holdings
        if h.id != holding.id
    ]

    effective_purchase_date = payload.purchase_date or holding.purchase_date
    broker_choice = (payload.broker or holding.broker or "zerodha").lower()

    estimate = TaxEngine.calculate(
        holding_id=holding.id,
        holding_name=holding.name,
        instrument_type=holding.instrument_type,
        current_price_or_nav=current_price,
        total_units=units,
        total_invested=holding.invested_amount,
        sell_quantity=payload.sell_quantity,
        sell_amount=payload.sell_amount,
        broker_key=broker_choice,
        purchase_date=effective_purchase_date,
        custom_exit_load_pct=payload.custom_exit_load_pct,
        other_portfolio_holdings=other_holdings,
    )

    return SuccessResponse(
        request_id=req_id,
        path=request.url.path,
        data=estimate,
    )


