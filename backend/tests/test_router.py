import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from backend.app.llm.router import LLMRouter
import litellm

@pytest.mark.asyncio
async def test_router_falls_back_to_secondary_model():
    router = LLMRouter()
    # Mock litellm.acompletion to fail on first model, succeed on second model
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock(message=MagicMock(content="Hello from fallback model"))]
    mock_resp.usage = MagicMock(prompt_tokens=10, completion_tokens=5)

    call_count = 0
    async def mock_acompletion(**kwargs):
        nonlocal call_count
        call_count += 1
        model = kwargs.get("model")
        if model == "gemini/gemini-3.6-flash":
            raise litellm.ServiceUnavailableError(
                message="High demand spike",
                model=model,
                llm_provider="gemini",
                response=MagicMock()
            )
        return mock_resp

    with patch("backend.app.llm.router.litellm.acompletion", side_effect=mock_acompletion):
        with patch("asyncio.sleep", new_callable=AsyncMock): # fast forward sleep
            resp = await router.complete(
                task="vision",
                messages=[{"role": "user", "content": "test"}]
            )
            assert resp.content == "Hello from fallback model"
            assert resp.model == "gemini/gemini-3.5-flash-lite"
            assert resp.fallback_used is True
