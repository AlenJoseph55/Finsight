"""
SIP (Systematic Investment Plan) Router.

Provides:
- GET /sip/summary: Returns active SIPs, allocations, and compound growth projections.
- POST /sip/upload: Ingests a screenshot, PDF, or spreadsheet via SIPIntelligenceAgent.
- POST /sip/seed-sample: Seeds a realistic sample Indian SIP portfolio for instant testing.
- DELETE /sip/{sip_id}: Deletes a specific SIP mandate.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import get_settings
from backend.app.database import get_db
from backend.app.models.schema import User, SipPlan
from backend.app.schemas.sip import (
    SipPlanResponse,
    SipProjectionPoint,
    SipSectorAllocation,
    SipSummaryResponse,
)
from backend.app.core.responses import SuccessResponse
from backend.app.core.context import request_id_ctx
from backend.app.core.exceptions import FinSightException, ErrorCode
from backend.app.core.sectors import normalize_sector
from backend.app.services.features import FeatureService
from backend.app.services.quota import QuotaService
from backend.app.services.document_parser import DocumentParserService
from backend.app.services.math_engine import SIPInput, SIPMathEngine, SIPMathResult
from backend.app.agents.sip_agent import SIPIntelligenceAgent
from backend.app.routers.auth import get_current_user

router = APIRouter(prefix="/sip", tags=["SIP"])
settings = get_settings()


def _build_summary_response(plans: List[SipPlan]) -> SipSummaryResponse:
    sip_inputs = [
        SIPInput(
            fund_name=p.fund_name,
            sector=p.fund_sector,
            monthly_amount=p.monthly_amount,
            frequency=p.frequency,
            instrument_type=p.instrument_type,
            start_date_str=p.start_date_str,
            folio_number=p.folio_number,
        )
        for p in plans
    ]

    math_result: SIPMathResult = SIPMathEngine.compute(sip_inputs)

    plan_responses: List[SipPlanResponse] = []
    for p, cp in zip(plans, math_result.calculated_plans):
        plan_responses.append(
            SipPlanResponse(
                id=p.id,
                user_id=p.user_id,
                source_file_name=p.source_file_name,
                fund_name=p.fund_name,
                fund_sector=p.fund_sector,
                instrument_type=p.instrument_type,
                monthly_amount=p.monthly_amount,
                frequency=p.frequency,
                allocation_pct=cp.allocation_pct,
                start_date_str=p.start_date_str,
                folio_number=p.folio_number,
                is_active=p.is_active,
                extraction_status=p.extraction_status,
                extraction_note=p.extraction_note,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )

    sector_alloc_responses = [
        SipSectorAllocation(
            sector=sa.sector,
            monthly_amount=sa.monthly_amount,
            allocation_pct=sa.allocation_pct,
        )
        for sa in math_result.sector_allocations
    ]

    projections_responses = [
        SipProjectionPoint(
            year=proj.year,
            total_invested=proj.total_invested,
            conservative=proj.conservative,
            moderate=proj.moderate,
            optimistic=proj.optimistic,
        )
        for proj in math_result.projections
    ]

    return SipSummaryResponse(
        total_monthly_outflow=math_result.total_monthly_outflow,
        active_sips_count=math_result.active_sips_count,
        is_concentrated=math_result.is_concentrated,
        concentration_summary=math_result.concentration_summary,
        sector_allocations=sector_alloc_responses,
        sip_plans=plan_responses,
        projections=projections_responses,
    )


@router.get("/summary", response_model=SuccessResponse[SipSummaryResponse])
async def get_sip_summary(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns active SIP mandates and deterministic compound growth projections.
    """
    req_id = request_id_ctx.get()
    user_id = current_user.id
    stmt = (
        select(SipPlan)
        .where(SipPlan.user_id == user_id, SipPlan.is_active == True)
        .order_by(SipPlan.monthly_amount.desc())
    )
    res = await db.execute(stmt)
    plans = res.scalars().all()

    summary_data = _build_summary_response(list(plans))
    return SuccessResponse(request_id=req_id, path=request.url.path, data=summary_data)


@router.post("/upload", response_model=SuccessResponse[SipSummaryResponse])
async def upload_sip_document(
    request: Request,
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload SIP statement, screenshot (Groww, Zerodha, Kuvera), or Excel/CSV.
    """
    req_id = request_id_ctx.get()
    user_id = current_user.id

    filename = file.filename or "sip_mandate.png"
    DocumentParserService.validate_file(filename, 0)

    # Feature & Quota verification
    await FeatureService.enforce("portfolio_upload", user_id, db)
    await QuotaService.enforce("document_uploads", user_id, db)

    file_bytes = await file.read()
    DocumentParserService.validate_file(filename, len(file_bytes))

    agent = SIPIntelligenceAgent()
    sip_summary = await agent.process_document(
        file_bytes=file_bytes,
        filename=filename,
        user_id=user_id,
        db=db,
        password=password,
    )

    await QuotaService.record(
        quota_key="document_uploads",
        user_id=user_id,
        db=db,
        metadata={"filename": filename, "type": "sip"},
    )
    await db.commit()

    return SuccessResponse(request_id=req_id, path=request.url.path, data=sip_summary)


@router.post("/seed-sample", response_model=SuccessResponse[SipSummaryResponse])
async def seed_sample_sips(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Seeds a representative Indian mutual fund SIP portfolio:
    - Parag Parikh Flexi Cap Fund: ₹10,000/mo (Diversified)
    - HDFC Mid-Cap Opportunities Fund: ₹6,000/mo (Diversified)
    - ICICI Prudential Technology Fund: ₹5,000/mo (Information Technology)
    - Nippon India Small Cap Fund: ₹4,000/mo (Diversified)
    """
    if settings.ENVIRONMENT.lower() == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo SIP seeding is strictly prohibited in production environments.",
        )

    req_id = request_id_ctx.get()
    user_id = current_user.id

    # Ensure user exists
    u_stmt = select(User).where(User.id == user_id)
    u_res = await db.execute(u_stmt)
    user = u_res.scalar_one_or_none()
    if not user:
        user = User(
            id=user_id,
            email_hash="demo_sip_user_hash",
            auth_method="jwt",
            is_demo=True,
            display_name="Demo Investor",
        )
        db.add(user)
        await db.commit()

    sample_plans = [
        SipPlan(
            user_id=user_id,
            source_file_name="groww_sips_screenshot.png",
            fund_name="Parag Parikh Flexi Cap Fund",
            fund_sector=normalize_sector("Diversified"),
            instrument_type="MUTUAL_FUND",
            monthly_amount=10000.0,
            frequency="MONTHLY",
            start_date_str="2023-01-10",
            folio_number="PPFAS-998811",
            is_active=True,
            extraction_status="complete",
        ),
        SipPlan(
            user_id=user_id,
            source_file_name="groww_sips_screenshot.png",
            fund_name="HDFC Mid-Cap Opportunities Fund",
            fund_sector=normalize_sector("Diversified"),
            instrument_type="MUTUAL_FUND",
            monthly_amount=6000.0,
            frequency="MONTHLY",
            start_date_str="2023-04-15",
            folio_number="HDFC-443322",
            is_active=True,
            extraction_status="complete",
        ),
        SipPlan(
            user_id=user_id,
            source_file_name="groww_sips_screenshot.png",
            fund_name="ICICI Prudential Technology Fund",
            fund_sector=normalize_sector("Information Technology"),
            instrument_type="MUTUAL_FUND",
            monthly_amount=5000.0,
            frequency="MONTHLY",
            start_date_str="2023-08-01",
            folio_number="ICICI-110022",
            is_active=True,
            extraction_status="complete",
        ),
        SipPlan(
            user_id=user_id,
            source_file_name="groww_sips_screenshot.png",
            fund_name="Nippon India Small Cap Fund",
            fund_sector=normalize_sector("Diversified"),
            instrument_type="MUTUAL_FUND",
            monthly_amount=4000.0,
            frequency="MONTHLY",
            start_date_str="2024-01-05",
            folio_number="NIPP-776655",
            is_active=True,
            extraction_status="complete",
        ),
    ]

    for sp in sample_plans:
        db.add(sp)
    await db.commit()

    # Re-fetch active plans
    stmt = select(SipPlan).where(SipPlan.user_id == user_id, SipPlan.is_active == True)
    res = await db.execute(stmt)
    active_plans = res.scalars().all()

    summary_data = _build_summary_response(list(active_plans))
    return SuccessResponse(request_id=req_id, path=request.url.path, data=summary_data)


@router.delete("/{sip_id}", response_model=SuccessResponse[dict])
async def delete_sip_plan(
    request: Request,
    sip_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    req_id = request_id_ctx.get()
    user_id = current_user.id
    stmt = select(SipPlan).where(SipPlan.id == sip_id, SipPlan.user_id == user_id)
    res = await db.execute(stmt)
    plan = res.scalar_one_or_none()
    if not plan:
        raise FinSightException(
            code=ErrorCode.FS_NOT_FOUND_4040,
            message="SIP mandate not found.",
            http_status=404,
        )
    await db.delete(plan)
    await db.commit()

    return SuccessResponse(
        request_id=req_id,
        path=request.url.path,
        data={"message": f"SIP mandate {sip_id} removed successfully."},
    )
