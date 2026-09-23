"""
Document Chunking and Vector Embeddings Service.

Implements token-aware text chunking (512 tokens, 64 token overlap)
and creates 768-dimensional pgvector embeddings via Gemini text-embedding-004.
"""
from typing import List, Optional
import tiktoken
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.logging import logger
from backend.app.llm.router import LLMRouter, llm_router as default_llm_router
from backend.app.models.schema import DocumentChunk


CHUNK_SIZE_TOKENS = 512
CHUNK_OVERLAP_TOKENS = 64


class ChunkEmbedService:
    @staticmethod
    def chunk_text(
        text: str,
        chunk_size: int = CHUNK_SIZE_TOKENS,
        overlap: int = CHUNK_OVERLAP_TOKENS,
    ) -> List[str]:
        """
        Splits text into token-bounded chunks with sliding-window overlap.
        Uses OpenAI's cl100k_base tokenizer.
        """
        if not text or not text.strip():
            return []

        try:
            enc = tiktoken.get_encoding("cl100k_base")
        except Exception:
            enc = tiktoken.encoding_for_model("gpt-4")

        tokens = enc.encode(text)
        if not tokens:
            return []

        if len(tokens) <= chunk_size:
            return [text.strip()]

        chunks: List[str] = []
        step = max(1, chunk_size - overlap)
        start = 0

        while start < len(tokens):
            end = min(start + chunk_size, len(tokens))
            chunk_tokens = tokens[start:end]
            chunk_str = enc.decode(chunk_tokens).strip()
            if chunk_str:
                chunks.append(chunk_str)
            if end >= len(tokens):
                break
            start += step

        return chunks

    @classmethod
    async def embed_and_store(
        cls,
        portfolio_id: int,
        raw_text: str,
        db: AsyncSession,
        router: Optional[LLMRouter] = None,
    ) -> int:
        """
        Chunks raw document text, obtains vector embeddings, and stores
        DocumentChunk rows in PostgreSQL (pgvector).
        Returns total number of chunks created.
        """
        if not raw_text or not raw_text.strip():
            return 0

        router = router or default_llm_router
        chunks = cls.chunk_text(raw_text)
        if not chunks:
            return 0

        logger.info(f"Generating embeddings for {len(chunks)} chunks of portfolio {portfolio_id}")

        try:
            embeddings = await router.embed(chunks)
        except Exception as e:
            logger.warning(f"Embedding generation failed: {e}. Storing chunks without vector embeddings.")
            embeddings = [None] * len(chunks)

        for idx, chunk in enumerate(chunks):
            emb = embeddings[idx] if idx < len(embeddings) else None
            chunk_row = DocumentChunk(
                portfolio_id=portfolio_id,
                content=chunk,
                chunk_index=idx,
                source_page=None,
                embedding=emb,
            )
            db.add(chunk_row)

        return len(chunks)
