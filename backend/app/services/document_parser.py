"""
Document Parser Service for FinSight.

Handles ingestion and structural pre-processing of investment statements:
- Native text PDFs (CAMS/KFintech CAS, broker contract notes)
- Scanned / image-only PDFs (rendered to images for Vision)
- Direct image screenshots (Zerodha, Groww, Angel One)
- Structured tabular files (CSV, Excel .xlsx)
"""
import base64
import io
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional

import pandas as pd
from PIL import Image
import pdfplumber

from backend.app.core.exceptions import ErrorCode, FinSightException
from backend.app.core.logging import logger


@dataclass
class ParsedDocument:
    raw_text: str  # Full plain text representation
    tables: List[List[List[Any]]] = field(default_factory=list)  # pages -> rows -> cols
    page_count: int = 1
    image_parts: List[Dict[str, Any]] = field(default_factory=list)  # Vision content blocks
    doc_type: Literal["pdf_text", "pdf_image", "image", "csv", "excel"] = "pdf_text"
    is_password_protected: bool = False


class DocumentParserService:
    MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB
    ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".csv", ".xlsx"}
    MAX_IMAGE_PAGES = 10  # Cap vision OCR pages to prevent token explosion
    MAX_DIMENSION = 2000  # Max pixel dimension for image resizing

    @classmethod
    def validate_file(cls, filename: str, file_size: int) -> None:
        """Validates extension and file size before processing."""
        if file_size > cls.MAX_FILE_SIZE_BYTES:
            raise FinSightException(
                code=ErrorCode.FS_FILE_4001,
                message=f"File size ({round(file_size / (1024 * 1024), 2)}MB) exceeds maximum limit of 15MB.",
                http_status=400,
                details={"file_size": file_size, "max_allowed": cls.MAX_FILE_SIZE_BYTES},
            )

        ext = os.path.splitext(filename)[1].lower()
        if ext not in cls.ALLOWED_EXTENSIONS:
            raise FinSightException(
                code=ErrorCode.FS_FILE_4000,
                message=f"Unsupported file format '{ext}'. Supported formats: PDF, PNG, JPG, WEBP, CSV, XLSX.",
                http_status=400,
                details={"filename": filename, "extension": ext},
            )

    @classmethod
    async def parse(
        cls,
        file_bytes: bytes,
        filename: str,
        password: Optional[str] = None,
    ) -> ParsedDocument:
        """
        Parses raw document bytes into a unified ParsedDocument representation.
        """
        cls.validate_file(filename, len(file_bytes))
        ext = os.path.splitext(filename)[1].lower()

        if ext == ".pdf":
            return cls._parse_pdf(file_bytes, password=password)
        elif ext in {".png", ".jpg", ".jpeg", ".webp"}:
            return cls._parse_image(file_bytes)
        elif ext == ".csv":
            return cls._parse_csv(file_bytes)
        elif ext == ".xlsx":
            return cls._parse_excel(file_bytes)
        else:
            raise FinSightException(
                code=ErrorCode.FS_FILE_4000,
                message=f"Unsupported file type '{ext}'",
                http_status=400,
            )

    @classmethod
    def _parse_pdf(cls, file_bytes: bytes, password: Optional[str] = None) -> ParsedDocument:
        stream = io.BytesIO(file_bytes)
        try:
            pdf = pdfplumber.open(stream, password=password or "")
        except Exception as e:
            err_msg = str(e).lower()
            if "password" in err_msg or "authenticate" in err_msg:
                raise FinSightException(
                    code=ErrorCode.FS_FILE_4002,
                    message="The PDF is password protected or the provided password was incorrect.",
                    http_status=400,
                    details={"hint": "CAMS / KFintech CAS statements typically use PAN or DOB as password."},
                )
            logger.error(f"Failed to open PDF: {e}")
            raise FinSightException(
                code=ErrorCode.FS_FILE_4000,
                message=f"Could not read PDF file: {e}",
                http_status=400,
            )

        with pdf:
            pages = pdf.pages
            page_count = len(pages)
            extracted_texts: List[str] = []
            extracted_tables: List[List[List[Any]]] = []

            for idx, page in enumerate(pages):
                txt = page.extract_text() or ""
                extracted_texts.append(txt)
                tables = page.extract_tables() or []
                if tables:
                    extracted_tables.append(tables)

            combined_text = "\n\n--- Page Break ---\n\n".join(extracted_texts).strip()

            # If the PDF has substantial extractable text (>= 50 chars), return text parse
            if len(combined_text) >= 50:
                return ParsedDocument(
                    raw_text=combined_text,
                    tables=extracted_tables,
                    page_count=page_count,
                    image_parts=[],
                    doc_type="pdf_text",
                    is_password_protected=bool(password),
                )

            # Scanned / pure-image PDF fallback: render pages to images for Vision
            logger.info("PDF contains minimal text; falling back to image rendering for Vision.")
            image_parts: List[Dict[str, Any]] = []
            max_pages = min(page_count, cls.MAX_IMAGE_PAGES)

            for i in range(max_pages):
                page_img = pages[i].to_image(resolution=150).original
                b64_data = cls._image_to_base64(page_img)
                image_parts.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64_data}"},
                })

            return ParsedDocument(
                raw_text="",
                tables=[],
                page_count=page_count,
                image_parts=image_parts,
                doc_type="pdf_image",
                is_password_protected=bool(password),
            )

    @classmethod
    def _parse_image(cls, file_bytes: bytes) -> ParsedDocument:
        try:
            img = Image.open(io.BytesIO(file_bytes))
            b64_data = cls._image_to_base64(img)
            return ParsedDocument(
                raw_text="",
                tables=[],
                page_count=1,
                image_parts=[{
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64_data}"},
                }],
                doc_type="image",
                is_password_protected=False,
            )
        except Exception as e:
            logger.error(f"Image parsing failed: {e}")
            raise FinSightException(
                code=ErrorCode.FS_FILE_4000,
                message=f"Failed to process image: {e}",
                http_status=400,
            )

    @classmethod
    def _parse_csv(cls, file_bytes: bytes) -> ParsedDocument:
        try:
            df = pd.read_csv(io.BytesIO(file_bytes))
            # Clean dataframe string
            text_repr = df.to_string(index=False)
            table_data = [df.columns.tolist()] + df.values.tolist()
            return ParsedDocument(
                raw_text=text_repr,
                tables=[table_data],
                page_count=1,
                image_parts=[],
                doc_type="csv",
                is_password_protected=False,
            )
        except Exception as e:
            logger.error(f"CSV parsing error: {e}")
            raise FinSightException(
                code=ErrorCode.FS_FILE_4000,
                message=f"Failed to parse CSV document: {e}",
                http_status=400,
            )

    @classmethod
    def _parse_excel(cls, file_bytes: bytes) -> ParsedDocument:
        try:
            excel_file = pd.ExcelFile(io.BytesIO(file_bytes), engine="openpyxl")
            all_text_parts: List[str] = []
            all_tables: List[List[List[Any]]] = []

            for sheet_name in excel_file.sheet_names:
                df = excel_file.parse(sheet_name)
                if not df.empty:
                    sheet_str = f"--- Sheet: {sheet_name} ---\n" + df.to_string(index=False)
                    all_text_parts.append(sheet_str)
                    table_data = [df.columns.tolist()] + df.values.tolist()
                    all_tables.append(table_data)

            combined_text = "\n\n".join(all_text_parts)
            return ParsedDocument(
                raw_text=combined_text,
                tables=all_tables,
                page_count=len(excel_file.sheet_names),
                image_parts=[],
                doc_type="excel",
                is_password_protected=False,
            )
        except Exception as e:
            logger.error(f"Excel parsing error: {e}")
            raise FinSightException(
                code=ErrorCode.FS_FILE_4000,
                message=f"Failed to parse Excel document: {e}",
                http_status=400,
            )

    @classmethod
    def _image_to_base64(cls, img: Image.Image) -> str:
        """Converts PIL Image to optimized base64 JPEG."""
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        # Resize if exceeding max dimension
        w, h = img.size
        if max(w, h) > cls.MAX_DIMENSION:
            scale = cls.MAX_DIMENSION / max(w, h)
            new_w, new_h = int(w * scale), int(h * scale)
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=85, optimize=True)
        return base64.b64encode(buffer.getvalue()).decode("utf-8")
