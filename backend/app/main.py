"""
FinSight Backend - Main FastAPI Application.

Architecture Highlights:
- Lifespan context manager initializes PostgreSQL tables & pgvector automatically.
- Observability Middleware:
  * Generates a unique `request_id` per request for distributed tracing.
  * Captures client IP and anonymizes the last octet for DPDP/GDPR privacy compliance.
  * Measures latency and logs structured machine-readable JSON records.
- Standardized Global Exception Handlers:
  * Catches FinSightException, validation errors, and unexpected exceptions.
  * Formats all errors into the unified `ErrorResponse` envelope.
- SaaS Control Plane & Super-Admin routes enabled.
"""

import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import text

from backend.app.config import get_settings
from backend.app.database import engine, Base
from backend.app.core.exceptions import FinSightException, ErrorCode
from backend.app.core.context import request_id_ctx, client_ip_ctx
from backend.app.core.logging import logger, anonymize_ip, get_client_ip
from backend.app.routers import health, auth, portfolio, admin, sip, chat, alerts, analytics
from backend.app.market import market_data
from backend.app.core.responses import SuccessResponse

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup and shutdown events.
    On startup:
      1. Ensures pgvector extension is available in Postgres.
      2. Creates all ORM tables (including new SaaS & subscription tables).
    On shutdown:
      Disposes of the database connection pool cleanly.
    """
    logger.info("Initializing FinSight Backend...")
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        await conn.run_sync(Base.metadata.create_all)
        # Migrate users table columns if missing
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'investor';"))
        # One-time data cleanup: downgrade legacy admin_key users to investor (Mitigation H4)
        await conn.execute(text("UPDATE users SET role = 'investor' WHERE auth_method = 'admin_key';"))
        # Migrate market_events and alerts table columns if missing
        await conn.execute(text("ALTER TABLE market_events ADD COLUMN IF NOT EXISTS topic_tag VARCHAR(100);"))
        await conn.execute(text("ALTER TABLE market_events ADD COLUMN IF NOT EXISTS action_advice TEXT;"))
        await conn.execute(text("ALTER TABLE market_events ADD COLUMN IF NOT EXISTS stocks_affected JSON DEFAULT '[]'::json;"))
        await conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS topic_tag VARCHAR(100);"))
        await conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS action_advice TEXT;"))
        await conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS stocks_affected JSON DEFAULT '[]'::json;"))
    logger.info("Database tables and pgvector extension ready.")

    # Sync API keys from settings into os.environ for LiteLLM
    if settings.GEMINI_API_KEY and not os.environ.get("GEMINI_API_KEY"):
        os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY
    if settings.GROQ_API_KEY and not os.environ.get("GROQ_API_KEY"):
        os.environ["GROQ_API_KEY"] = settings.GROQ_API_KEY
    if settings.OPENAI_API_KEY and not os.environ.get("OPENAI_API_KEY"):
        os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY

    yield  # Application processes requests

    logger.info("Disposing database connection pool...")
    await engine.dispose()
    logger.info("Database shutdown complete.")


is_prod = settings.ENVIRONMENT.lower() == "production"

app = FastAPI(
    title="FinSight API",
    description="Privacy-First Agentic Financial Intelligence Platform",
    version="0.2.0",
    lifespan=lifespan,
    docs_url=None if is_prod else "/docs",
    redoc_url=None if is_prod else "/redoc",
    openapi_url=None if is_prod else "/openapi.json",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Structured Observability & Request Tracing Middleware
# =============================================================================
@app.middleware("http")
async def observability_middleware(request: Request, call_next):
    """
    Traces every incoming request with:
    - Unique request_id
    - Anonymized client IP (DPDP & GDPR privacy-safe)
    - Execution duration in milliseconds
    - Structured JSON audit log
    """
    # 1. Generate unique request identifier
    req_id = f"req_{uuid.uuid4().hex[:12]}"
    request_id_ctx.set(req_id)

    # 2. Extract and anonymize client IP
    raw_ip = get_client_ip(request)
    masked_ip = anonymize_ip(raw_ip)
    client_ip_ctx.set(masked_ip)

    # 3. Time request execution
    start_time = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

    # 4. Inject correlation headers
    response.headers["X-Request-ID"] = req_id
    response.headers["X-Process-Time-Ms"] = str(duration_ms)

    # 5. Output structured JSON log entry
    logger.info(
        f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)",
        extra={
            "extra_data": {
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "latency_ms": duration_ms,
                "user_agent": request.headers.get("user-agent", "unknown"),
            }
        },
    )
    return response


# =============================================================================
# Global Standardized Exception Handlers
# =============================================================================
@app.exception_handler(FinSightException)
async def finsight_exception_handler(request: Request, exc: FinSightException):
    """Handles all operational domain exceptions across the application."""
    req_id = request_id_ctx.get()
    return JSONResponse(
        status_code=exc.http_status,
        headers={"X-Request-ID": req_id},
        content={
            "success": False,
            "request_id": req_id,
            "path": request.url.path,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": None,
            "error": {
                "code": exc.code.value if hasattr(exc.code, "value") else str(exc.code),
                "http_status": exc.http_status,
                "message": exc.message,
                "details": exc.details,
            },
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handles Pydantic validation errors on request body/params."""
    req_id = request_id_ctx.get()
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        headers={"X-Request-ID": req_id},
        content={
            "success": False,
            "request_id": req_id,
            "path": request.url.path,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": None,
            "error": {
                "code": ErrorCode.FS_VALIDATION_4220.value,
                "http_status": 422,
                "message": "Invalid request parameters or payload format.",
                "details": {"validation_errors": exc.errors()},
            },
        },
    )


@app.exception_handler(StarletteHTTPException)
async def starlette_http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handles standard HTTP errors such as 404 Not Found or 405 Method Not Allowed."""
    req_id = request_id_ctx.get()
    code = ErrorCode.FS_NOT_FOUND_4040.value if exc.status_code == 404 else f"FS_HTTP_{exc.status_code}"
    return JSONResponse(
        status_code=exc.status_code,
        headers={"X-Request-ID": req_id},
        content={
            "success": False,
            "request_id": req_id,
            "path": request.url.path,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": None,
            "error": {
                "code": code,
                "http_status": exc.status_code,
                "message": str(exc.detail),
                "details": None,
            },
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catches unhandled internal server exceptions."""
    req_id = request_id_ctx.get()
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        headers={"X-Request-ID": req_id},
        content={
            "success": False,
            "request_id": req_id,
            "path": request.url.path,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": None,
            "error": {
                "code": ErrorCode.FS_INTERNAL_5001.value,
                "http_status": 500,
                "message": "An unexpected internal server error occurred. Our team has been notified.",
                "details": {"error_type": type(exc).__name__},
            },
        },
    )


# =============================================================================
# Route Controllers
# =============================================================================
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(portfolio.router)
app.include_router(sip.router)
app.include_router(chat.router)
app.include_router(alerts.router)
app.include_router(admin.router)
app.include_router(analytics.router)


# Market Data Abstraction Endpoint (NSE, BSE, US, AMFI)
@app.get("/market/quote", tags=["Market Data"])
async def get_market_quote(symbol: str, exchange: str = "NSE", request: Request = None):
    """Fetches real-time or delayed quote using the configured provider abstraction."""
    req_id = request_id_ctx.get()
    quote = await market_data.get_quote(symbol=symbol, exchange=exchange)
    if not quote:
        raise FinSightException(
            code=ErrorCode.FS_NOT_FOUND_4040,
            message=f"Quote not found for symbol '{symbol}' on exchange '{exchange}'.",
            http_status=404,
        )
    return SuccessResponse(request_id=req_id, path=request.url.path, data=quote.model_dump())


@app.get("/market/news", tags=["Market Data"])
async def get_market_news(category: str = "general", request: Request = None):
    """Fetches market news using Finnhub/yfinance abstraction."""
    req_id = request_id_ctx.get()
    news_items = await market_data.get_news(category=category)
    return SuccessResponse(request_id=req_id, path=request.url.path, data=[n.model_dump() for n in news_items])


@app.get("/", tags=["Root"])
async def root(request: Request):
    req_id = request_id_ctx.get()
    return SuccessResponse(
        request_id=req_id,
        path=request.url.path,
        data={
            "name": "FinSight API",
            "version": "0.2.0",
            "status": "operational",
            "docs": "/docs",
            "privacy": "AES-256 field encryption + IP anonymization + hashed identifiers active",
            "saas_infrastructure": {
                "quotas": "Active (PostgreSQL + Redis)",
                "feature_flags": "Active (Hierarchical + Admin Overrides)",
                "llm_router": "Multi-model abstraction ready",
                "market_router": "Multi-vendor abstraction ready",
            },
        },
    )
