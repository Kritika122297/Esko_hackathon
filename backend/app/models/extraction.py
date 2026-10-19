"""Data models for raw document extractions."""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ExtractedText(BaseModel):
    """A granular block of text extracted from a source document."""

    text: str = Field(..., description="Raw text snippet")
    source_file: str = Field(..., description="File from which text was extracted")
    location: str = Field("unknown", description="'front panel', 'back panel', 'cell B12', etc.")
    confidence: float = Field(1.0, description="Confidence score between 0.0 and 1.0")
    page_number: Optional[int] = Field(None, description="Page number if extracted from a paged document")
    bbox: Optional[List[float]] = Field(None, description="Bounding box [x0, y0, x1, y1] if available")


class ExtractedData(BaseModel):
    """Aggregate raw data extracted across all uploaded files for a session."""

    session_id: str = Field(..., description="Associated session id")
    texts: List[ExtractedText] = Field(default_factory=list, description="All extracted text fragments")
    images: List[str] = Field(default_factory=list, description="File paths to rendered/extracted images")
    tables: List[Dict[str, Any]] = Field(default_factory=list, description="Extracted tables or spreadsheets")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata on source files (names, sizes, types)")
