import io
import logging
from typing import Tuple
from fastapi import UploadFile, HTTPException, status
import pdfplumber
import docx

logger = logging.getLogger("interviewiq.extractor")

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {".pdf", ".docx"}


async def extract_text_from_file(file: UploadFile) -> Tuple[str, str]:
    """
    Safely extract plain text from an uploaded PDF or DOCX resume.
    Returns: (extracted_text, file_extension)
    Raises HTTPException for invalid file types, oversized files, or empty/scanned documents.
    """
    filename = file.filename or "resume.pdf"
    file_ext = "." + filename.split(".")[-1].lower() if "." in filename else ""

    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{file_ext}'. InterviewIQ supports PDF and DOCX documents only.",
        )

    # Read contents into memory safely
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of 5MB (Uploaded: {round(len(content) / (1024 * 1024), 2)}MB).",
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is completely empty (0 bytes).",
        )

    raw_text = ""

    try:
        if file_ext == ".pdf":
            raw_text = _extract_from_pdf(content)
        elif file_ext == ".docx":
            raw_text = _extract_from_docx(content)
    except Exception as e:
        logger.error(f"[Extractor] Error reading {file_ext} file: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse document: {str(e)}",
        )

    # Check for empty or scanned image document
    cleaned = raw_text.strip()
    if len(cleaned) < 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded resume contains very little or no extractable text. Please ensure you are uploading a text-based document rather than a scanned image or photo without an OCR text layer.",
        )

    return cleaned, file_ext.replace(".", "")


def _extract_from_pdf(content: bytes) -> str:
    """Extract text from PDF bytes using pdfplumber."""
    text_parts = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        if not pdf.pages:
            return ""
        for page_idx, page in enumerate(pdf.pages):
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n".join(text_parts)


def _extract_from_docx(content: bytes) -> str:
    """Extract text from DOCX bytes using python-docx."""
    doc = docx.Document(io.BytesIO(content))
    text_parts = [p.text for p in doc.paragraphs if p.text]
    # Also extract from tables if any
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                if cell.text:
                    text_parts.append(cell.text)
    return "\n".join(text_parts)
