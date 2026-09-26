"""
Database Connection & Session Management.

Why Async SQLAlchemy 2.0?
- In traditional synchronous code, every database query blocks the Python thread.
- With Async SQLAlchemy + asyncpg, queries release the event loop, allowing FastAPI
  to handle hundreds of concurrent requests efficiently.
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from backend.app.config import get_settings

settings = get_settings()

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+asyncpg://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

connect_args = {}
# Supabase Transaction Pooler (port 6543 / Supavisor) requires statement_cache_size=0
# to prevent "DuplicatePreparedStatementError" with asyncpg.
if any(domain in db_url for domain in ("supabase.com", "supabase.co", "pooler")):
    connect_args["statement_cache_size"] = 0

# Create the async engine with connection pooling
# pool_size: number of persistent connections to keep open
# max_overflow: how many temporary extra connections to create under high load
engine: AsyncEngine = create_async_engine(
    db_url,
    echo=(settings.LOG_LEVEL == "DEBUG"),
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Checks that connection is alive before using it
    connect_args=connect_args,
)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy database models.
    All models inherit from this so SQLAlchemy can discover them.
    """
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI Dependency that yields a database session per request,
    and guarantees that the session is closed when the request finishes.
    Usage in routes:
        @router.get("/example")
        async def example_route(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
