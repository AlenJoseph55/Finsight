"""
SIP Intelligence Agent.

Orchestrates parsing of SIP mandate screenshots, CAS transaction statements,
AMFI confirmations, or Excel/CSV schedules, uses LLM extraction to capture
recurring commitments, normalizes sectors to NSE taxonomy, computes deterministic
future value projections (8%, 12%, 15% CAGR), and detects SIP concentration risks.
"""

from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.core.exceptions import ErrorCode, FinSightException
from backend.app.core.logging import logger
from backend.app.core.sectors import NSE_SECTORS, normalize_sector
from backend.app.llm.router import LLMRouter, llm_router as default_llm_router
from backend.app.models.schema import SipPlan
from backend.app.schemas.document import ExtractedSIPStatement
from backend.app.schemas.sip import (
    SipPlanResponse,
    SipProjectionPoint,
    SipSectorAllocation,
    SipSummaryResponse,
)
from backend.app.services.document_parser import DocumentParserService, ParsedDocument
from backend.app.services.math_engine import SIPInput, SIPMathEngine, SIPMathResult


SYSTEM_SIP_EXTRACTION_PROMPT = f"""You are FinSight's specialized SIP (Systematic Investment Plan) Parsing Agent.
Your task is to extract recurring investment commitments (SIP mandates, monthly investments, active SIP schedules)
from the provided document. The document may be a screenshot of an investment app (Groww, Zerodha Coin, Kuvera, INDmoney, ET Money, MF Central),
an AMFI statement, a bank ECS mandate confirmation, or an Excel/CSV spreadsheet.

Rules:
1. Extract each distinct active recurring SIP mandate:
   - fund_name: Exact mutual fund or scheme name (e.g. "Parag Parikh Flexi Cap Fund", "Mirae Asset Large Cap Fund", "Nippon India Small Cap Fund").
   - monthly_amount: The recurring investment amount in INR (₹) per period (e.g. 5000.0).
   - frequency: "MONTHLY" or "QUARTERLY" (default to "MONTHLY").
   - sector: Map the fund to the single MOST APPROPRIATE sector from the strict NSE taxonomy list:
     {', '.join(NSE_SECTORS)}.
     Use 'Diversified' for flexicap, multicap, index, or hybrid funds.
   - instrument_type: One of MUTUAL_FUND, ETF, STOCK.
   - start_date_str: Date or month the SIP started/next deduction date if visible.
   - folio_number: Folio or SIP registration number if available.
2. If the user provided a screenshot showing multiple SIP cards or rows, extract ALL of them.
3. If an amount cannot be read, provide notes in 'extraction_notes'.
4. Output strictly valid JSON conforming to ExtractedSIPStatement.
"""


class SIPIntelligenceAgent:
    def __init__(self, router: Optional[LLMRouter] = None):
        self.router = router or default_llm_router

    async def process_document(
        self,
        file_bytes: bytes,
        filename: str,
        user_id: int,
        db: AsyncSession,
        password: Optional[str] = None,
    ) -> SipSummaryResponse:
        """
        Executes the SIP ingestion pipeline:
        1. Document structure parsing (text / OCR / vision / csv / excel)
        2. LLM Extraction into ExtractedSIPStatement
        3. NSE Sector Normalization
        4. Deterministic Future Value & Concentration Computation
        5. PostgreSQL Persistence
        6. Return complete SipSummaryResponse
        """
        logger.info(f"Processing SIP document '{filename}' for user {user_id}")

        # 1. Parse document
        parsed_doc = await DocumentParserService.parse(
            file_bytes=file_bytes,
            filename=filename,
            password=password,
        )

        # 2. Extract structured SIP statement using LLM
        extracted = await self._extract_sips(parsed_doc, filename)

        if not extracted.sips:
            raise FinSightException(
                code=ErrorCode.FS_VALIDATION_4220,
                message=f"No active SIP mandates could be found in '{filename}'. Please ensure you upload a screenshot or statement showing fund names and recurring monthly amounts.",
                http_status=422,
                details={"extraction_notes": extracted.extraction_notes},
            )

        # 3. Normalize sectors
        sip_inputs: List[SIPInput] = []
        for s in extracted.sips:
            norm_sec = normalize_sector(s.sector)
            sip_inputs.append(
                SIPInput(
                    fund_name=s.fund_name,
                    sector=norm_sec,
                    monthly_amount=float(s.monthly_amount),
                    frequency=s.frequency,
                    instrument_type=s.instrument_type,
                    start_date_str=s.start_date_str,
                    folio_number=s.folio_number,
                )
            )

        # 4. Check existing active SIPs for this user (Additive Upload)
        from backend.app.agents.portfolio_agent import _holdings_match

        existing_stmt = (
            select(SipPlan)
            .where(SipPlan.user_id == user_id, SipPlan.is_active == True)
        )
        existing_res = db.execute(existing_stmt)
        if hasattr(existing_res, "__await__"):
            existing_res = await existing_res
        all_user_plans: List[SipPlan] = list(existing_res.scalars().all()) if hasattr(existing_res, "scalars") else []

        for s in sip_inputs:
            matched_plan: Optional[SipPlan] = None
            for ep in all_user_plans:
                if _holdings_match(ep.fund_name, s.fund_name):
                    matched_plan = ep
                    break

            if matched_plan:
                # Update existing active SIP with latest details
                matched_plan.monthly_amount = s.monthly_amount
                matched_plan.frequency = s.frequency
                matched_plan.instrument_type = s.instrument_type
                if s.sector and s.sector != "Diversified":
                    matched_plan.fund_sector = s.sector
                if s.start_date_str:
                    matched_plan.start_date_str = s.start_date_str
                if s.folio_number:
                    matched_plan.folio_number = s.folio_number
            else:
                # Add new SIP plan
                new_plan = SipPlan(
                    user_id=user_id,
                    source_file_name=filename,
                    fund_name=s.fund_name,
                    fund_sector=s.sector,
                    instrument_type=s.instrument_type,
                    monthly_amount=s.monthly_amount,
                    frequency=s.frequency,
                    start_date_str=s.start_date_str,
                    folio_number=s.folio_number,
                    is_active=True,
                    extraction_status="complete" if s.monthly_amount > 0 else "partial",
                    extraction_note=extracted.extraction_notes,
                )
                db.add(new_plan)
                all_user_plans.append(new_plan)

        await db.commit()

        # Refresh plans to get auto-generated IDs and timestamps
        for plan in all_user_plans:
            await db.refresh(plan)

        # 5. Compute deterministic math & projections across ALL active plans (previous + new)
        combined_sip_inputs = [
            SIPInput(
                fund_name=p.fund_name,
                sector=p.fund_sector,
                monthly_amount=float(p.monthly_amount),
                frequency=p.frequency,
                instrument_type=p.instrument_type,
                start_date_str=p.start_date_str,
                folio_number=p.folio_number,
            )
            for p in all_user_plans
        ]
        math_result: SIPMathResult = SIPMathEngine.compute(combined_sip_inputs)

        # 6. Construct response with ALL consolidated plans
        plan_responses: List[SipPlanResponse] = []
        for p, cp in zip(all_user_plans, math_result.calculated_plans):
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

    async def _extract_sips(
        self,
        parsed_doc: ParsedDocument,
        filename: str,
    ) -> ExtractedSIPStatement:
        """Invokes LLM Router with text extraction or multimodal vision."""
        if parsed_doc.doc_type in ("image", "pdf_image") or not parsed_doc.raw_text:
            logger.info(f"Invoking Vision SIP extraction for {filename}")
            content_blocks: List[Dict[str, Any]] = [
                {
                    "type": "text",
                    "text": f"{SYSTEM_SIP_EXTRACTION_PROMPT}\n\nDocument filename: {filename}\nPlease extract the SIP investment mandates.",
                }
            ]
            content_blocks.extend(parsed_doc.image_parts)
            messages = [{"role": "user", "content": content_blocks}]
            task = "vision"
        else:
            logger.info(f"Invoking text SIP extraction for {filename}")
            user_text = (
                f"{SYSTEM_SIP_EXTRACTION_PROMPT}\n\n"
                f"Document filename: {filename}\n\n"
                f"--- DOCUMENT RAW CONTENT ---\n"
                f"{parsed_doc.raw_text}\n"
                f"--- END DOCUMENT CONTENT ---"
            )
            messages = [{"role": "user", "content": user_text}]
            task = "extraction"

        response = await self.router.complete(
            task=task,
            messages=messages,
            response_model=ExtractedSIPStatement,
            temperature=0.0,
        )

        if response.parsed and isinstance(response.parsed, ExtractedSIPStatement):
            return response.parsed

        try:
            return ExtractedSIPStatement.model_validate_json(response.content)
        except Exception as e:
            logger.error(f"Failed to parse LLM response into ExtractedSIPStatement: {e}\nContent: {response.content}")
            raise FinSightException(
                code=ErrorCode.FS_AI_5031,
                message="Failed to structure SIP mandates from document. Please try a different screenshot or statement format.",
                http_status=422,
                details={"error": str(e)},
            )
