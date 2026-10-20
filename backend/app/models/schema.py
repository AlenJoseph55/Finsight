"""
SQLAlchemy Database Models for FinSight.

Key Architecture Highlights:
- Privacy-First: Raw texts encrypted with AES-256; user emails stored as one-way SHA-256 hashes.
- pgvector support: Document chunks store 768-dimensional AI embeddings for semantic search.
- Separation of Concerns: Holdings, Sector Allocations, and Market Events are normalized.
- Human-in-the-loop: FeedbackTrace table records user corrections to train future prompts.
"""

from datetime import datetime, date
from typing import List, Optional
from sqlalchemy import (
    String,
    Text,
    Float,
    Integer,
    Boolean,
    DateTime,
    Date,
    ForeignKey,
    JSON,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from backend.app.database import Base


class User(Base):
    """
    User Account Model.
    Privacy Note: We never store plaintext passwords or plaintext emails if OAuth is used.
    Email is stored as a cryptographic hash for user lookup without personal data leakage.
    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    auth_method: Mapped[str] = mapped_column(String(20), default="jwt")  # "jwt" or "google_oauth"
    oauth_sub: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    preferences_json: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="investor")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    portfolios: Mapped[List["Portfolio"]] = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="user", cascade="all, delete-orphan")
    sip_plans: Mapped[List["SipPlan"]] = relationship("SipPlan", back_populates="user", cascade="all, delete-orphan")


class Portfolio(Base):
    """
    Portfolio Snapshot Model.
    Represents a portfolio state parsed from an uploaded statement or manual import.
    """
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # Encrypted with AES-256; plaintext is never stored in DB
    raw_text_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    investor_name_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # AES-256
    extraction_status: Mapped[str] = mapped_column(String(20), default="complete")  # "complete" | "partial" | "failed"
    extraction_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # describes what failed/partial
    
    # Financial Aggregates (calculated deterministically by Python math engine)
    total_invested: Mapped[float] = mapped_column(Float, default=0.0)
    current_value: Mapped[float] = mapped_column(Float, default=0.0)
    absolute_return_pct: Mapped[float] = mapped_column(Float, default=0.0)
    xirr_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Risk Flags
    is_concentrated: Mapped[bool] = mapped_column(Boolean, default=False)
    concentration_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="portfolios")
    holdings: Mapped[List["Holding"]] = relationship("Holding", back_populates="portfolio", cascade="all, delete-orphan")
    sector_allocations: Mapped[List["SectorAllocation"]] = relationship("SectorAllocation", back_populates="portfolio", cascade="all, delete-orphan")
    document_chunks: Mapped[List["DocumentChunk"]] = relationship("DocumentChunk", back_populates="portfolio", cascade="all, delete-orphan")


class Holding(Base):
    """
    Individual Investment Holding (Stock, Mutual Fund, ETF).
    """
    __tablename__ = "holdings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    portfolio_id: Mapped[int] = mapped_column(Integer, ForeignKey("portfolios.id", ondelete="CASCADE"), index=True)
    
    instrument_type: Mapped[str] = mapped_column(String(30), default="MUTUAL_FUND")  # MUTUAL_FUND, STOCK, ETF
    name: Mapped[str] = mapped_column(String(255), index=True)
    symbol: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)  # e.g., HDFCBANK.NS, TCS.NS
    sector: Mapped[str] = mapped_column(String(100), index=True)  # e.g., Financials, Technology, Healthcare
    market_cap_category: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)  # LARGE_CAP, MID_CAP, SMALL_CAP
    
    invested_amount: Mapped[float] = mapped_column(Float, default=0.0)
    current_value: Mapped[float] = mapped_column(Float, default=0.0)
    units: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    nav: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # Net Asset Value or stock price
    allocation_pct: Mapped[float] = mapped_column(Float, default=0.0)  # Calculated deterministically
    purchase_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    broker: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    portfolio: Mapped["Portfolio"] = relationship("Portfolio", back_populates="holdings")


class SectorAllocation(Base):
    """
    Aggregated Sector Exposure.
    Precomputed breakdown of user portfolio across sectors (e.g., Financials: 23%, Tech: 19%).
    """
    __tablename__ = "sector_allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    portfolio_id: Mapped[int] = mapped_column(Integer, ForeignKey("portfolios.id", ondelete="CASCADE"), index=True)
    sector: Mapped[str] = mapped_column(String(100), index=True)
    allocation_pct: Mapped[float] = mapped_column(Float)
    total_value: Mapped[float] = mapped_column(Float)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    portfolio: Mapped["Portfolio"] = relationship("Portfolio", back_populates="sector_allocations")


class DocumentChunk(Base):
    """
    Document Chunks for RAG (Retrieval-Augmented Generation).
    Stores parsed statements, annual reports, or research notes split into passages.
    The 'embedding' column is a pgvector Vector(768) type for semantic similarity search.
    """
    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    portfolio_id: Mapped[int] = mapped_column(Integer, ForeignKey("portfolios.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(Text)
    chunk_index: Mapped[int] = mapped_column(Integer)
    source_page: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # 768-dimensional vector embedding (matching Gemini text-embedding-004)
    embedding = mapped_column(Vector(768), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    portfolio: Mapped["Portfolio"] = relationship("Portfolio", back_populates="document_chunks")


class MarketEvent(Base):
    """
    Market Event Detected by Agent 3 (Market Monitor).
    Stores news headlines, categorized affected sectors, and severity score.
    """
    __tablename__ = "market_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    headline: Mapped[str] = mapped_column(String(500))
    summary: Mapped[str] = mapped_column(Text)
    sectors_affected: Mapped[list] = mapped_column(JSON, default=list)  # ["Financials", "Technology"]
    stocks_affected: Mapped[list] = mapped_column(JSON, default=list)
    topic_tag: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    action_advice: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(20), default="MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    source_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Alert(Base):
    """
    Personalized Risk/Market Alert sent to an investor.
    Triggered when a MarketEvent matches a sector in which the user has exposure.
    """
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    event_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("market_events.id", ondelete="SET NULL"), nullable=True)
    
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    topic_tag: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    action_advice: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stocks_affected: Mapped[list] = mapped_column(JSON, default=list)
    severity: Mapped[str] = mapped_column(String(20), default="INFO")  # INFO, WARNING, DANGER
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="alerts")
    event: Mapped[Optional["MarketEvent"]] = relationship("MarketEvent")


class FeedbackTrace(Base):
    """
    Human-in-the-Loop Feedback Trace.
    When a user corrects an AI-extracted holding (e.g. changing sector from Tech to Healthcare),
    we record the correction here to evaluate accuracy and dynamically feed few-shot prompts.
    """
    __tablename__ = "feedback_traces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    holding_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("holdings.id", ondelete="CASCADE"), nullable=True)
    
    holding_name: Mapped[str] = mapped_column(String(255))
    original_value: Mapped[str] = mapped_column(String(255))
    corrected_value: Mapped[str] = mapped_column(String(255))
    correction_field: Mapped[str] = mapped_column(String(50))  # "sector", "amount", "instrument_type"
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# =============================================================================
# SaaS Subscription, Feature Flags, Quotas & AI Audit Models
# =============================================================================

class Plan(Base):
    """
    Subscription Tier Definition (e.g. Free, Pro, Enterprise).
    """
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True)  # "free", "pro", "enterprise"
    name: Mapped[str] = mapped_column(String(100))
    price_monthly_inr: Mapped[float] = mapped_column(Float, default=0.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    quotas: Mapped[List["PlanQuota"]] = relationship("PlanQuota", back_populates="plan", cascade="all, delete-orphan")
    features: Mapped[List["PlanFeature"]] = relationship("PlanFeature", back_populates="plan", cascade="all, delete-orphan")
    subscriptions: Mapped[List["Subscription"]] = relationship("Subscription", back_populates="plan")


class PlanQuota(Base):
    """
    Numeric usage limit assigned to a plan (e.g. document_uploads = 2 / monthly).
    limit_value = -1 indicates unlimited.
    """
    __tablename__ = "plan_quotas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("plans.id", ondelete="CASCADE"), index=True)
    quota_key: Mapped[str] = mapped_column(String(100), index=True)  # "document_uploads", "ai_chat_queries"
    limit_value: Mapped[int] = mapped_column(Integer)  # -1 = unlimited
    period: Mapped[str] = mapped_column(String(20), default="monthly")  # "monthly", "lifetime"

    plan: Mapped["Plan"] = relationship("Plan", back_populates="quotas")


class Subscription(Base):
    """
    Active user subscription associating a user to a plan.
    """
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("plans.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="active")  # "active", "cancelled", "expired"
    current_period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    current_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User")
    plan: Mapped["Plan"] = relationship("Plan", back_populates="subscriptions")


class UsageEvent(Base):
    """
    Immutable ledger of metered consumption (e.g. 1 document uploaded, 1 AI query run).
    """
    __tablename__ = "usage_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    quota_key: Mapped[str] = mapped_column(String(100), index=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    user: Mapped["User"] = relationship("User")


class Feature(Base):
    """
    Master catalogue of features that can be gated (e.g. market_alerts_news).
    """
    __tablename__ = "features"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    default_enabled: Mapped[bool] = mapped_column(Boolean, default=False)


class PlanFeature(Base):
    """
    Mapping of features enabled for each subscription plan.
    """
    __tablename__ = "plan_features"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("plans.id", ondelete="CASCADE"), index=True)
    feature_key: Mapped[str] = mapped_column(String(100), index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    config_json: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)

    plan: Mapped["Plan"] = relationship("Plan", back_populates="features")


class UserFeatureOverride(Base):
    """
    Super-admin level overrides per user.
    Allows an admin to manually grant or revoke any feature for an individual user
    regardless of their subscription tier.
    """
    __tablename__ = "user_feature_overrides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    feature_key: Mapped[str] = mapped_column(String(100), index=True)
    enabled: Mapped[bool] = mapped_column(Boolean)
    overridden_by_admin_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User")


class LLMLog(Base):
    """
    Comprehensive audit log of every LLM call across all providers.
    Tracks token consumption, latency, cost in USD, and provider fallback events.
    """
    __tablename__ = "llm_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    request_id: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    task_type: Mapped[str] = mapped_column(String(50), index=True)  # "extraction", "vision", "research", "classification"
    provider: Mapped[str] = mapped_column(String(50))               # "gemini", "groq", "openai"
    model: Mapped[str] = mapped_column(String(100))                 # "gemini-1.5-flash", "llama-3.3-70b-versatile"
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    fallback_used: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="success")  # "success", "failed"
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class SipPlan(Base):
    """
    Systematic Investment Plan (SIP) Mandate Model.
    Tracks recurring monthly/quarterly investments, fund name, mapped sector,
    and extraction metadata.
    """
    __tablename__ = "sip_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    fund_name: Mapped[str] = mapped_column(String(255), index=True)
    fund_sector: Mapped[str] = mapped_column(String(100), index=True)
    instrument_type: Mapped[str] = mapped_column(String(30), default="MUTUAL_FUND")  # MUTUAL_FUND, ETF, STOCK

    monthly_amount: Mapped[float] = mapped_column(Float, default=0.0)
    frequency: Mapped[str] = mapped_column(String(20), default="MONTHLY")  # MONTHLY, QUARTERLY
    start_date_str: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    folio_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    extraction_status: Mapped[str] = mapped_column(String(20), default="complete")  # complete, partial, failed
    extraction_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sip_plans")


class WebVisit(Base):
    """
    Privacy-friendly web visitor session tracking.
    Stores anonymized session fingerprints without personal data leakage.
    DPDP & GDPR compliant.
    """
    __tablename__ = "web_visits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    visitor_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    page_path: Mapped[str] = mapped_column(String(255), index=True)
    page_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    referrer: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    device_type: Mapped[str] = mapped_column(String(30), default="desktop")
    browser: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    os: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(50), default="India")
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class WebEvent(Base):
    """
    Behavioral & Feature Interaction Events (User exploration patterns & conversion funnels).
    """
    __tablename__ = "web_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    visitor_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    event_category: Mapped[str] = mapped_column(String(50), index=True)
    event_action: Mapped[str] = mapped_column(String(100), index=True)
    event_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    event_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

