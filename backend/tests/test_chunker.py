"""
Unit tests for Document Chunking and Tokenization.
"""
from backend.app.services.embeddings import ChunkEmbedService, CHUNK_SIZE_TOKENS, CHUNK_OVERLAP_TOKENS


def test_chunk_empty_text():
    assert ChunkEmbedService.chunk_text("") == []
    assert ChunkEmbedService.chunk_text("    ") == []
    assert ChunkEmbedService.chunk_text(None) == []


def test_chunk_short_text():
    short_text = "This is a short statement excerpt with 10 tokens."
    chunks = ChunkEmbedService.chunk_text(short_text)
    assert len(chunks) == 1
    assert chunks[0] == short_text


def test_chunk_long_text_overlap():
    # Generate text with ~1200 words (exceeds 512 tokens)
    words = ["investment", "portfolio", "dividend", "equity", "return", "holding"] * 250
    long_text = " ".join(words)

    chunks = ChunkEmbedService.chunk_text(long_text, chunk_size=100, overlap=20)
    assert len(chunks) > 1

    # Check that chunks exist and have non-empty text
    for chunk in chunks:
        assert len(chunk.strip()) > 0

    # Ensure consecutive chunks share overlapping words
    words_chunk_0 = set(chunks[0].split())
    words_chunk_1 = set(chunks[1].split())
    assert len(words_chunk_0.intersection(words_chunk_1)) > 0
