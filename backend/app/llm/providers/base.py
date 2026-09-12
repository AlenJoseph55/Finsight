"""
Base interface for LLM Providers (Strategy Pattern).
Defines the standard contract that every model provider adapter implements.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Type
from pydantic import BaseModel


class LLMResponse(BaseModel):
    content: str
    parsed: Optional[Any] = None
    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: float = 0.0
    fallback_used: bool = False


class BaseLLMProvider(ABC):
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.provider_name = config.get("provider", "unknown")
        self.model_name = config.get("model", "")
        self.supports_vision = config.get("supports_vision", False)
        self.supports_structured_output = config.get("supports_structured_output", True)

    @abstractmethod
    async def complete(
        self,
        messages: List[Dict[str, str]],
        response_model: Optional[Type[BaseModel]] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        images: Optional[List[bytes]] = None,
    ) -> LLMResponse:
        """Executes completion against the provider API."""
        pass
