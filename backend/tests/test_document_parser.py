"""
Unit tests for DocumentParserService.
"""
import pytest
from io import BytesIO
from PIL import Image
from backend.app.core.exceptions import ErrorCode, FinSightException
from backend.app.services.document_parser import DocumentParserService


def test_file_size_validation():
    # Below limit should pass
    DocumentParserService.validate_file("test.pdf", 1024 * 1024)

    # Above 15MB should raise FS_FILE_4001
    oversized = (15 * 1024 * 1024) + 1
    with pytest.raises(FinSightException) as exc_info:
        DocumentParserService.validate_file("test.pdf", oversized)
    assert exc_info.value.code == ErrorCode.FS_FILE_4001


def test_unsupported_file_extension():
    disallowed = ["statement.exe", "portfolio.zip", "data.json", "script.sh"]
    for filename in disallowed:
        with pytest.raises(FinSightException) as exc_info:
            DocumentParserService.validate_file(filename, 1024)
        assert exc_info.value.code == ErrorCode.FS_FILE_4000


@pytest.mark.asyncio
async def test_csv_parsing():
    csv_content = b"name,symbol,sector,invested_amount,current_value\nHDFC Bank,HDFCBANK.NS,Banking,10000,12000\nTCS,TCS.NS,IT,15000,18000"
    parsed = await DocumentParserService.parse(csv_content, "holdings.csv")

    assert parsed.doc_type == "csv"
    assert "HDFC Bank" in parsed.raw_text
    assert "TCS" in parsed.raw_text
    assert len(parsed.tables) > 0


@pytest.mark.asyncio
async def test_image_parsing():
    # Create simple in-memory PNG image
    img = Image.new("RGB", (100, 100), color="blue")
    buf = BytesIO()
    img.save(buf, format="PNG")
    img_bytes = buf.getvalue()

    parsed = await DocumentParserService.parse(img_bytes, "zerodha_screenshot.png")
    assert parsed.doc_type == "image"
    assert len(parsed.image_parts) == 1
    assert parsed.image_parts[0]["type"] == "image_url"
    assert "data:image/jpeg;base64," in parsed.image_parts[0]["image_url"]["url"]
