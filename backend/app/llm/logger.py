"""
FinSight LLM Audit Logger.
Persists execution metrics (tokens, latency, cost in USD, fallback flags) to the llm_logs table.
"""

from typing import Optional
from backend.app.database import AsyncSessionLocal
from backend.app.models.schema import LLMLog
from backend.app.core.context import request_id_ctx, user_id_ctx
from backend.app.core.logging import logger


class LLMLogger:
    @staticmethod
    async def log_call(
        task_type: str,
        provider: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        cost_usd: float,
        latency_ms: float,
        fallback_used: bool = False,
        status: str = "success",
        error_message: Optional[str] = None,
    ):
        """Asynchronously writes an audit record into PostgreSQL."""
        try:
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    record = LLMLog(
                        user_id=user_id_ctx.get(),
                        request_id=request_id_ctx.get(),
                        task_type=task_type,
                        provider=provider,
                        model=model,
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        cost_usd=cost_usd,
                        latency_ms=latency_ms,
                        fallback_used=fallback_used,
                        status=status,
                        error_message=error_message,
                    )
                    session.add(record)
            logger.info(
                f"LLM Call: task={task_type} provider={provider} model={model} "
                f"tokens={prompt_tokens}+{completion_tokens} latency={latency_ms:.1f}ms cost=${cost_usd:.6f}"
            )
        except Exception as e:
            logger.error(f"Failed to record LLMLog to database: {e}")
