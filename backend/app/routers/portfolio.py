"""
Portfolio & Holdings Router.

Integrates:
- Deterministic Math Engine with database persistence.
- SaaS Entitlements: Feature gating (FeatureService) and usage metering (QuotaService).
- Standardized API response envelopes & error codes.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Request
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.database import get_db
from backend.app.models.schema import User, Portfolio, Holding, SectorAllocation
from backend.app.services.math_engine import FinancialMathEngine, HoldingInput
from backend.app.schemas.portfolio import PortfolioSummary
from backend.app.core.responses import SuccessResponse
from backend.app.core.context import request_id_ctx
from backend.app.core.exceptions import FinSightException, ErrorCode
from backend.app.services.features import FeatureService
from backend.app.services.quota import QuotaService

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


@router.get("/summary", response_model=SuccessResponse[PortfolioSummary])
async def get_portfolio_summary(
    request: Request,
    user_id: int = 1,
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the latest portfolio summary with deterministically calculated
    weights, returns, sector exposures, and concentration warning.
    """
    req_id = request_id_ctx.get()
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

    return SuccessResponse(request_id=req_id, path=request.url.path, data=portfolio)


@router.post("/seed-sample", response_model=SuccessResponse[PortfolioSummary])
async def seed_sample_portfolio(
    request: Request,
    user_id: int = 1,
    db: AsyncSession = Depends(get_db),
):
    """
    Seeds the exact sample portfolio matching user's holdings:
    - Mutual Funds: Parag Parikh Flexi Cap, HDFC Mid Cap, Motilal Oswal Nasdaq 100
    - Stocks: HDFC Bank, Reliance, TCS
    """
    req_id = request_id_ctx.get()

    # Ensure a user exists
    user_stmt = select(User).where(User.id == user_id)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()
    if not user:
        user = User(id=user_id, email_hash="demo_user_hash_1234567890", auth_method="jwt")
        db.add(user)
        await db.commit()

    raw_holdings = [
        HoldingInput(name="Parag Parikh Flexi Cap Fund", sector="Diversified / Multi-Sector", invested_amount=200000.0, current_value=245000.0),
        HoldingInput(name="HDFC Mid-Cap Opportunities Fund", sector="Mid Cap Growth", invested_amount=150000.0, current_value=180000.0),
        HoldingInput(name="Motilal Oswal Nasdaq 100 ETF", sector="US Technology", invested_amount=100000.0, current_value=122000.0),
        HoldingInput(name="HDFC Bank Ltd", sector="Financials", invested_amount=160000.0, current_value=175000.0),
        HoldingInput(name="Reliance Industries Ltd", sector="Energy", invested_amount=120000.0, current_value=134000.0),
        HoldingInput(name="Tata Consultancy Services Ltd", sector="Technology", invested_amount=110000.0, current_value=120000.0),
    ]

    math_result = FinancialMathEngine.compute(raw_holdings, concentration_threshold_pct=30.0)

    new_portfolio = Portfolio(
        user_id=user_id,
        source_file_name="sample_seed.pdf",
        total_invested=math_result.total_invested,
        current_value=math_result.current_value,
        absolute_return_pct=math_result.absolute_return_pct,
        xirr_pct=13.8,
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

    for sec in math_result.sector_allocations:
        db.add(
            SectorAllocation(
                portfolio_id=new_portfolio.id,
                sector=sec.sector,
                allocation_pct=sec.allocation_pct,
                total_value=sec.total_value,
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


@router.post("/upload", response_model=SuccessResponse[dict])
async def upload_portfolio_document(
    request: Request,
    user_id: int = 1,
    filename: Optional[str] = "statement.pdf",
    db: AsyncSession = Depends(get_db),
):
    """
    Upload Statement Endpoint (Pre-Phase 2 Quota & Feature Gated).
    Checks:
      1. Feature Gate: Is `portfolio_upload` enabled for user?
      2. Usage Quota: Has user exceeded `document_uploads` limit for the month?
    Records 1 usage event upon passing checks.
    """
    req_id = request_id_ctx.get()

    # 1. Feature flag check
    await FeatureService.enforce("portfolio_upload", user_id, db)

    # 2. Quota check
    await QuotaService.enforce("document_uploads", user_id, db)

    # 3. Record metered consumption
    await QuotaService.record(
        quota_key="document_uploads",
        user_id=user_id,
        db=db,
        metadata={"filename": filename},
    )
    await db.commit()

    quota_status = await QuotaService.get_status("document_uploads", user_id, db)

    return SuccessResponse(
        request_id=req_id,
        path=request.url.path,
        data={
            "status": "received",
            "filename": filename,
            "quota_status": quota_status,
            "message": "Document accepted for processing.",
        },
    )
