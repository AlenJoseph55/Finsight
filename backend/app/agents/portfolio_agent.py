"""
Agent 1: Portfolio Intelligence Agent.

Orchestrates statement ingestion, multi-modal LLM extraction,
controlled NSE sector normalization, deterministic arithmetic,
field encryption, and semantic chunk embeddings.
"""
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.app.core.exceptions import ErrorCode, FinSightException
from backend.app.core.logging import logger
from backend.app.core.sectors import NSE_SECTORS, normalize_sector
from backend.app.llm.router import LLMRouter, llm_router as default_llm_router
from backend.app.models.schema import Holding, Portfolio, SectorAllocation
from backend.app.schemas.document import ExtractedStatement
from backend.app.services.crypto import encrypt_text
from backend.app.services.document_parser import DocumentParserService, ParsedDocument
from backend.app.services.embeddings import ChunkEmbedService
from backend.app.services.math_engine import FinancialMathEngine, HoldingInput


SYSTEM_EXTRACTION_PROMPT = f"""You are FinSight's expert Financial Statement Parsing Agent.
Your task is to extract structured investment portfolio holdings from the provided financial statement.
The document could be a CAMS/KFintech Consolidated Account Statement (CAS) PDF, a broker contract note, a Zerodha / Groww / Angel One screenshot or CSV/Excel report.

Rules:
1. Extract all holdings: Mutual Funds, Stocks (Equities), ETFs, Gold, Bonds.
2. For each holding, capture:
   - name: Exact scheme or company name as stated.
   - symbol: Exchange ticker if available (e.g., "HDFCBANK.NS", "RELIANCE.NS", "PPFAS").
   - isin: 12-character ISIN code if present (e.g., "INF879O01019").
   - instrument_type: One of MUTUAL_FUND, STOCK, ETF, GOLD, BOND.
   - folio_number: Folio or account number if available.
   - units: Number of units/shares owned (float).
   - nav: Purchase price or Net Asset Value per unit.
   - invested_amount: Total purchase/cost value in INR. If not explicitly stated, compute units * nav or current_value.
   - current_value: Current valuation/market value in INR.
   - sector: Map the company/scheme to the MOST APPROPRIATE sector from this strict NSE list:
     {', '.join(NSE_SECTORS)}.
     Use 'Diversified' for index funds, flexicap funds, or if uncertain.
   - market_cap_category: One of LARGE_CAP, MID_CAP, SMALL_CAP, MULTI_CAP if discernible.
3. Extract the investor_name and statement_period if visible.
4. If values are blurry, partially cut off, or missing, extract what is available and explain the issue in 'extraction_notes'.
5. Always output strictly valid JSON conforming to the ExtractedStatement schema.
"""


import re

def _normalize_tokens(name: str) -> set:
    stop_words = {
        "fund", "direct", "growth", "regular", "plan", "fof", "ltd", "limited",
        "series", "idcw", "dividend", "corp", "corporation", "scheme", "dp", "gr"
    }
    tokens = set(re.sub(r"[^a-zA-Z0-9]+", " ", name.lower()).split())
    filtered = tokens - stop_words
    return filtered if filtered else tokens

def _holdings_match(name1: str, name2: str, symbol1: Optional[str] = None, symbol2: Optional[str] = None) -> bool:
    if symbol1 and symbol2 and symbol1.strip().upper() == symbol2.strip().upper():
        return True

    clean1 = re.sub(r"[^a-zA-Z0-9]+", " ", name1.lower()).strip()
    clean2 = re.sub(r"[^a-zA-Z0-9]+", " ", name2.lower()).strip()
    if clean1 == clean2:
        return True

    tokens1 = _normalize_tokens(name1)
    tokens2 = _normalize_tokens(name2)
    if tokens1 and tokens2:
        if tokens1 == tokens2:
            return True
        intersection = tokens1.intersection(tokens2)
        if len(intersection) >= 2 and (tokens1.issubset(tokens2) or tokens2.issubset(tokens1)):
            return True

    return False


class PortfolioIntelligenceAgent:
    def __init__(self, router: Optional[LLMRouter] = None):
        self.router = router or default_llm_router

    async def process_document(
        self,
        file_bytes: bytes,
        filename: str,
        user_id: int,
        db: AsyncSession,
        password: Optional[str] = None,
    ) -> Portfolio:
        """
        Executes the full document ingestion pipeline:
        1. Parse file structure (PDF text, scanned image, screenshots, CSV/Excel)
        2. LLM Extraction (Text completion or Gemini Vision multimodal)
        3. NSE Sector Taxonomy Normalization
        4. Deterministic Financial Math Calculation
        5. AES-256 Field Encryption
        6. Database Persistence
        7. Chunking & Semantic Vector Embeddings
        """
        logger.info(f"Processing portfolio document '{filename}' for user {user_id}")

        # 1. Parse document
        parsed_doc = await DocumentParserService.parse(
            file_bytes=file_bytes,
            filename=filename,
            password=password,
        )

        # 2. Extract structured statement using LLM
        extracted_statement = await self._extract_statement(parsed_doc, filename)

        # 3. Sector Normalization
        for holding in extracted_statement.holdings:
            holding.sector = normalize_sector(holding.sector)

        # 4. Assess extraction confidence / status
        extraction_status, extraction_note = self._assess_extraction_quality(extracted_statement)

        if extraction_status == "failed":
            raise FinSightException(
                code=ErrorCode.FS_VALIDATION_4220,
                message=f"Could not extract any valid holdings from '{filename}'. Please ensure the document contains a clear portfolio summary or holding statement.",
                http_status=422,
                details={"extraction_note": extraction_note},
            )

        # 5. Check if an existing portfolio exists for this user (Additive Upload)
        stmt = (
            select(Portfolio)
            .where(Portfolio.user_id == user_id)
            .order_by(Portfolio.created_at.desc())
            .options(
                selectinload(Portfolio.holdings),
                selectinload(Portfolio.sector_allocations),
            )
        )
        res = db.execute(stmt)
        if hasattr(res, "__await__"):
            res = await res
        existing_portfolio = res.scalars().first() if hasattr(res, "scalars") else None

        investor_name_enc = (
            encrypt_text(extracted_statement.investor_name)
            if extracted_statement.investor_name
            else None
        )
        raw_text_enc = (
            encrypt_text(parsed_doc.raw_text)
            if parsed_doc.raw_text
            else None
        )

        if not existing_portfolio:
            # First upload for this user: create new portfolio snapshot
            math_inputs = [
                HoldingInput(
                    name=h.name,
                    sector=h.sector,
                    invested_amount=float(h.invested_amount or 0.0),
                    current_value=float(h.current_value or 0.0),
                )
                for h in extracted_statement.holdings
            ]
            math_result = FinancialMathEngine.compute(math_inputs)

            portfolio = Portfolio(
                user_id=user_id,
                source_file_name=filename,
                raw_text_encrypted=raw_text_enc,
                investor_name_encrypted=investor_name_enc,
                extraction_status=extraction_status,
                extraction_note=extraction_note,
                total_invested=math_result.total_invested,
                current_value=math_result.current_value,
                absolute_return_pct=math_result.absolute_return_pct,
                is_concentrated=math_result.is_concentrated,
                concentration_summary=math_result.concentration_summary,
            )
            db.add(portfolio)
            await db.flush()

            for ch, eh in zip(math_result.holdings, extracted_statement.holdings):
                holding_row = Holding(
                    portfolio_id=portfolio.id,
                    name=eh.name,
                    symbol=eh.symbol,
                    instrument_type=eh.instrument_type,
                    sector=ch.sector,
                    market_cap_category=eh.market_cap_category,
                    invested_amount=ch.invested_amount,
                    current_value=ch.current_value,
                    units=eh.units,
                    nav=eh.nav,
                    allocation_pct=ch.allocation_pct,
                )
                db.add(holding_row)

            for sector_name, alloc_pct in math_result.sector_allocations.items():
                sector_val = round(math_result.current_value * (alloc_pct / 100.0), 2)
                sector_row = SectorAllocation(
                    portfolio_id=portfolio.id,
                    sector=sector_name,
                    allocation_pct=alloc_pct,
                    total_value=sector_val,
                )
                db.add(sector_row)

            target_portfolio_id = portfolio.id
        else:
            # Add to existing portfolio: merge/add holdings without overwriting
            portfolio = existing_portfolio
            existing_holdings = list(portfolio.holdings)

            for eh in extracted_statement.holdings:
                inv_amt = float(eh.invested_amount or 0.0)
                cur_val = float(eh.current_value or 0.0)

                matched_h: Optional[Holding] = None
                for ex_h in existing_holdings:
                    if _holdings_match(ex_h.name, eh.name, ex_h.symbol, eh.symbol):
                        matched_h = ex_h
                        break

                if matched_h:
                    # Holding already exists in portfolio
                    # Check if identical overlap from scrolling screenshot or re-upload
                    if abs(matched_h.invested_amount - inv_amt) < 0.01 and abs(matched_h.current_value - cur_val) < 0.01:
                        # Identical values: backfill missing metadata without duplicating
                        if eh.units and not matched_h.units:
                            matched_h.units = eh.units
                        if eh.nav and not matched_h.nav:
                            matched_h.nav = eh.nav
                        if eh.symbol and not matched_h.symbol:
                            matched_h.symbol = eh.symbol
                        if eh.market_cap_category and not matched_h.market_cap_category:
                            matched_h.market_cap_category = eh.market_cap_category
                    else:
                        # Updated values from newer screenshot or statement
                        matched_h.invested_amount = inv_amt
                        matched_h.current_value = cur_val
                        if eh.units:
                            matched_h.units = eh.units
                        if eh.nav:
                            matched_h.nav = eh.nav
                        if eh.sector and eh.sector != "Diversified":
                            matched_h.sector = eh.sector
                else:
                    # NEW holding to ADD to the portfolio
                    new_holding = Holding(
                        portfolio_id=portfolio.id,
                        name=eh.name,
                        symbol=eh.symbol,
                        instrument_type=eh.instrument_type,
                        sector=eh.sector,
                        market_cap_category=eh.market_cap_category,
                        invested_amount=inv_amt,
                        current_value=cur_val,
                        units=eh.units,
                        nav=eh.nav,
                        allocation_pct=0.0,
                    )
                    db.add(new_holding)
                    existing_holdings.append(new_holding)

            # Recompute math engine across ALL holdings (previous + new)
            math_inputs = [
                HoldingInput(
                    name=h.name,
                    sector=h.sector,
                    invested_amount=float(h.invested_amount),
                    current_value=float(h.current_value),
                )
                for h in existing_holdings
            ]
            math_result = FinancialMathEngine.compute(math_inputs, concentration_threshold_pct=30.0)

            portfolio.total_invested = math_result.total_invested
            portfolio.current_value = math_result.current_value
            portfolio.absolute_return_pct = math_result.absolute_return_pct
            portfolio.is_concentrated = math_result.is_concentrated
            portfolio.concentration_summary = math_result.concentration_summary
            portfolio.extraction_status = extraction_status
            if extraction_note:
                portfolio.extraction_note = extraction_note

            # Update source file list
            if filename:
                sources = [s.strip() for s in (portfolio.source_file_name or "").split(",") if s.strip()]
                if filename not in sources:
                    sources.append(filename)
                    portfolio.source_file_name = ", ".join(sources)[:255]

            # Update holding allocations across all holdings
            for h, ch in zip(existing_holdings, math_result.holdings):
                h.allocation_pct = ch.allocation_pct

            # Refresh sector allocations table records
            for sa in list(portfolio.sector_allocations):
                await db.delete(sa)
            await db.flush()

            for sector_name, alloc_pct in math_result.sector_allocations.items():
                total_val = round(math_result.current_value * (alloc_pct / 100.0), 2)
                db.add(
                    SectorAllocation(
                        portfolio_id=portfolio.id,
                        sector=sector_name,
                        allocation_pct=alloc_pct,
                        total_value=total_val,
                    )
                )

            target_portfolio_id = portfolio.id

        # Chunk and store embeddings for RAG
        if parsed_doc.raw_text:
            try:
                await ChunkEmbedService.embed_and_store(
                    portfolio_id=target_portfolio_id,
                    raw_text=parsed_doc.raw_text,
                    db=db,
                    router=self.router,
                )
            except Exception as e:
                logger.warning(f"Error during chunk embedding for portfolio {target_portfolio_id}: {e}")

        await db.commit()

        # Reload with all relationships eager-loaded
        stmt = (
            select(Portfolio)
            .where(Portfolio.id == target_portfolio_id)
            .options(
                selectinload(Portfolio.holdings),
                selectinload(Portfolio.sector_allocations),
            )
        )
        result = await db.execute(stmt)
        refreshed_portfolio = result.scalar_one()

        return refreshed_portfolio

    async def _extract_statement(
        self,
        parsed_doc: ParsedDocument,
        filename: str,
    ) -> ExtractedStatement:
        """Invokes LLM Router with either text extraction or multimodal vision."""
        if parsed_doc.doc_type in ("image", "pdf_image") or not parsed_doc.raw_text:
            # Multimodal Vision Task
            logger.info(f"Invoking Vision extraction for {filename} ({len(parsed_doc.image_parts)} image parts)")
            content_blocks: List[Dict[str, Any]] = [
                {"type": "text", "text": f"{SYSTEM_EXTRACTION_PROMPT}\n\nDocument filename: {filename}\nPlease extract the portfolio statement holdings."}
            ]
            content_blocks.extend(parsed_doc.image_parts)

            messages = [
                {"role": "user", "content": content_blocks}
            ]
            task = "vision"
        else:
            # Text-based Extraction Task
            logger.info(f"Invoking text extraction for {filename} ({len(parsed_doc.raw_text)} chars)")
            user_text = (
                f"{SYSTEM_EXTRACTION_PROMPT}\n\n"
                f"Document filename: {filename}\n\n"
                f"--- DOCUMENT RAW CONTENT ---\n"
                f"{parsed_doc.raw_text}\n"
                f"--- END DOCUMENT CONTENT ---"
            )
            messages = [
                {"role": "user", "content": user_text}
            ]
            task = "extraction"

        response = await self.router.complete(
            task=task,
            messages=messages,
            response_model=ExtractedStatement,
            temperature=0.0,
        )

        if response.parsed and isinstance(response.parsed, ExtractedStatement):
            return response.parsed

        # Fallback manual parse if parsed is not directly populated
        try:
            return ExtractedStatement.model_validate_json(response.content)
        except Exception as e:
            logger.error(f"Failed to parse LLM response into ExtractedStatement: {e}\nRaw content: {response.content}")
            raise FinSightException(
                code=ErrorCode.FS_AI_5031,
                message="Failed to structure holdings from financial statement. Please try a different statement format.",
                http_status=422,
                details={"error": str(e)},
            )

    @staticmethod
    def _assess_extraction_quality(statement: ExtractedStatement) -> tuple[str, Optional[str]]:
        """
        Determines if extraction was complete, partial, or failed.
        - failed: 0 holdings extracted.
        - partial: 1+ holdings missing invested or current values, or LLM notes present.
        - complete: all holdings have positive values and no issues noted.
        """
        if not statement.holdings:
            return "failed", statement.extraction_notes or "No holdings were identified in the statement."

        has_partial = False
        issues: List[str] = []

        if statement.extraction_notes:
            has_partial = True
            issues.append(statement.extraction_notes)

        for h in statement.holdings:
            if h.current_value <= 0 and h.invested_amount <= 0:
                has_partial = True
                issues.append(f"Holding '{h.name}' has zero/unresolved values.")

        if has_partial:
            note = "; ".join(issues)
            return "partial", note

        return "complete", None
