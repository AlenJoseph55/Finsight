"""
FinSight LLM Provider Router & Abstraction Layer.

Capabilities:
- Dynamic YAML-driven configuration per model provider.
- Task-based routing (e.g. extraction -> gemini, research -> groq).
- Automated multi-provider fallback chains with zero caller code changes.
- Token, latency, and cost calculation with PostgreSQL auditing.
- Transparent structured output parsing with Pydantic.
"""

import asyncio
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Type
import yaml
from pydantic import BaseModel

import litellm
from backend.app.core.exceptions import FinSightException, ErrorCode
from backend.app.core.logging import logger
from backend.app.config import get_settings
from backend.app.llm.providers.base import LLMResponse
from backend.app.llm.logger import LLMLogger

# Turn off verbose LiteLLM logging in stdout
litellm.suppress_debug_info = True


class LLMRouter:
    def __init__(self, config_dir: Optional[Path] = None):
        if config_dir is None:
            # Default to backend/config/llm relative to this file
            self.config_dir = Path(__file__).resolve().parent.parent.parent / "config" / "llm"
        else:
            self.config_dir = config_dir
        self.providers: Dict[str, Dict[str, Any]] = {}
        self.routes: Dict[str, Dict[str, Any]] = {}
        self.reload_configs()

    def reload_configs(self):
        """Loads and parses all provider and routing YAML configuration files."""
        if not self.config_dir.exists():
            logger.warning(f"LLM config directory not found at {self.config_dir}")
            return

        self.providers.clear()
        for yaml_file in self.config_dir.glob("*.yaml"):
            if yaml_file.name == "active.yaml":
                continue
            try:
                with open(yaml_file, "r") as f:
                    cfg = yaml.safe_load(f)
                    if cfg and isinstance(cfg, dict) and cfg.get("provider"):
                        self.providers[cfg["provider"]] = cfg
            except Exception as e:
                logger.error(f"Error loading LLM config {yaml_file}: {e}")

        active_path = self.config_dir / "active.yaml"
        if active_path.exists():
            try:
                with open(active_path, "r") as f:
                    active_cfg = yaml.safe_load(f)
                    if active_cfg and "routes" in active_cfg:
                        self.routes = active_cfg["routes"]
            except Exception as e:
                logger.error(f"Error loading active routes config: {e}")

    def get_route_chain(self, task: str) -> List[str]:
        """Returns ordered list of provider names to try for a given task."""
        if task in self.routes:
            route = self.routes[task]
            primary = route.get("primary")
            fallbacks = route.get("fallback", [])
            chain = []
            if primary:
                chain.append(primary)
            chain.extend(f for f in fallbacks if f not in chain)
            return chain
        # Default chain if task not mapped
        return ["gemini", "groq", "openai"]

    def _calculate_cost(self, cfg: Dict[str, Any], prompt_tokens: int, completion_tokens: int) -> float:
        in_rate = cfg.get("cost_per_1m_input_tokens", 0.0) / 1_000_000
        out_rate = cfg.get("cost_per_1m_output_tokens", 0.0) / 1_000_000
        return round((prompt_tokens * in_rate) + (completion_tokens * out_rate), 6)

    async def complete(
        self,
        task: str,
        messages: List[Dict[str, Any]],
        response_model: Optional[Type[BaseModel]] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> LLMResponse:
        """
        Executes a completion request by selecting the configured provider for the task
        and falling back gracefully if errors occur.
        """
        chain = self.get_route_chain(task)
        last_exception: Optional[Exception] = None

        for idx, provider_name in enumerate(chain):
            cfg = self.providers.get(provider_name)
            if not cfg or not cfg.get("enabled", True):
                continue

            # Ensure API key is present in environment
            api_key_env = cfg.get("api_key_env")
            if api_key_env:
                if not os.environ.get(api_key_env):
                    settings_val = getattr(get_settings(), api_key_env, None)
                    if settings_val:
                        os.environ[api_key_env] = settings_val
                    else:
                        logger.warning(f"Missing API key environment variable {api_key_env} for provider {provider_name}")
                        continue

            primary_model = cfg.get("model", "")
            raw_fallback_models = cfg.get("fallback_models", [])
            if isinstance(raw_fallback_models, str):
                raw_fallback_models = [raw_fallback_models]
            candidate_models = [primary_model] + [m for m in raw_fallback_models if m and m != primary_model]

            temp = temperature if temperature is not None else cfg.get("temperature", 0.1)
            tokens_limit = max_tokens or cfg.get("max_tokens", 4096)

            for model_idx, model in enumerate(candidate_models):
                fallback_used = (idx > 0) or (model_idx > 0)
                max_retries = 2

                for attempt in range(max_retries + 1):
                    start_time = time.perf_counter()
                    try:
                        kwargs: Dict[str, Any] = {
                            "model": model,
                            "messages": messages,
                            "temperature": temp,
                            "max_tokens": tokens_limit,
                        }
                        if response_model is not None:
                            kwargs["response_format"] = response_model

                        # Call unified LiteLLM async completion
                        resp = await litellm.acompletion(**kwargs)
                        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

                        raw_content = resp.choices[0].message.content or ""
                        prompt_tokens = resp.usage.prompt_tokens if hasattr(resp, "usage") and resp.usage else 0
                        completion_tokens = resp.usage.completion_tokens if hasattr(resp, "usage") and resp.usage else 0
                        cost = self._calculate_cost(cfg, prompt_tokens, completion_tokens)

                        # Parse into Pydantic model if requested
                        parsed_data = None
                        if response_model is not None:
                            try:
                                parsed_data = response_model.model_validate_json(raw_content)
                            except Exception as pe:
                                logger.warning(f"Structured output parse failed for {model}: {pe}")

                        # Audit log
                        await LLMLogger.log_call(
                            task_type=task,
                            provider=provider_name,
                            model=model,
                            prompt_tokens=prompt_tokens,
                            completion_tokens=completion_tokens,
                            cost_usd=cost,
                            latency_ms=latency_ms,
                            fallback_used=fallback_used,
                            status="success",
                        )

                        return LLMResponse(
                            content=raw_content,
                            parsed=parsed_data,
                            provider=provider_name,
                            model=model,
                            prompt_tokens=prompt_tokens,
                            completion_tokens=completion_tokens,
                            cost_usd=cost,
                            latency_ms=latency_ms,
                            fallback_used=fallback_used,
                        )

                    except Exception as e:
                        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                        err_str = str(e).lower()
                        is_transient = (
                            isinstance(e, (litellm.ServiceUnavailableError, litellm.RateLimitError))
                            or "503" in err_str
                            or "unavailable" in err_str
                            or "high demand" in err_str
                            or "capacity" in err_str
                        )

                        if is_transient and attempt < max_retries:
                            backoff_sec = 1.5 * (attempt + 1)
                            logger.warning(
                                f"Transient LLM failure on {provider_name} ({model}): {e}. Retrying in {backoff_sec}s (attempt {attempt + 1}/{max_retries})..."
                            )
                            await asyncio.sleep(backoff_sec)
                            continue

                        logger.warning(
                            f"LLM call failed on provider '{provider_name}' ({model}) for task '{task}': {e}. Trying fallback..."
                        )
                        await LLMLogger.log_call(
                            task_type=task,
                            provider=provider_name,
                            model=model,
                            prompt_tokens=0,
                            completion_tokens=0,
                            cost_usd=0.0,
                            latency_ms=latency_ms,
                            fallback_used=fallback_used,
                            status="failed",
                            error_message=str(e),
                        )
                        last_exception = e
                        break

        # If all candidate providers failed
        last_err_text = str(last_exception) if last_exception is not None else "No provider in route chain has an active API key configured"
        raise FinSightException(
            code=ErrorCode.FS_AI_5030,
            message=f"All configured LLM providers failed for task '{task}'. Last error: {last_err_text}",
            http_status=503,
            details={"task": task, "attempted_providers": chain},
        )

    async def embed(self, texts: List[str]) -> List[List[float]]:
        """
        Generates vector embeddings for a list of text strings.
        Uses litellm.aembedding() routed via the 'embedding' task configuration.
        """
        if not texts:
            return []

        chain = self.get_route_chain("embedding")
        last_exception: Optional[Exception] = None

        for provider_name in chain:
            cfg = self.providers.get(provider_name)
            if not cfg or not cfg.get("enabled", True):
                continue

            model = cfg.get("embedding_model", "gemini/gemini-embedding-001")
            dims = cfg.get("embedding_dimensions", 768)
            api_key_env = cfg.get("api_key_env")
            if api_key_env:
                if not os.environ.get(api_key_env):
                    settings_val = getattr(get_settings(), api_key_env, None)
                    if settings_val:
                        os.environ[api_key_env] = settings_val
                    else:
                        logger.warning(f"Missing API key {api_key_env} for provider {provider_name}")
                        continue

            try:
                kwargs: Dict[str, Any] = {
                    "model": model,
                    "input": texts,
                }
                if "gemini" in model.lower():
                    kwargs["dimensions"] = dims

                response = await litellm.aembedding(**kwargs)
                embeddings = [item["embedding"][:dims] for item in response.data]
                return embeddings
            except Exception as e:
                logger.warning(f"Embedding failed on provider '{provider_name}' ({model}): {e}")
                last_exception = e

        last_err_text = str(last_exception) if last_exception is not None else "No embedding provider has an active API key configured"
        raise FinSightException(
            code=ErrorCode.FS_AI_5030,
            message=f"All configured embedding providers failed. Last error: {last_err_text}",
            http_status=503,
            details={"task": "embedding", "attempted_providers": chain},
        )


# Global singleton router instance
llm_router = LLMRouter()
