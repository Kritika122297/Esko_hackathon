"""Raw extraction models: what the parsers read from each uploaded file."""

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class Fragment(BaseModel):
    """One piece of text read from a document, with its exact location."""

    id: str
    file: str
    kind: str = Field(..., description="pdf | excel | word | text")
    text: str
    page: Optional[int] = None
    bbox: Optional[List[float]] = Field(None, description="PDF points [x0, y0, x1, y1]")
    panel: Optional[str] = None
    cell: Optional[str] = None
    sheet: Optional[str] = None
    color: Optional[str] = None
    font: Optional[str] = None
    size: Optional[float] = None
    is_guide: bool = Field(False, description="Dieline / printing-guide text, not product copy")
    is_hidden: bool = Field(False, description="Present in the file but covered by later artwork")


class ExcelRow(BaseModel):
    """A label/value pair read from a content sheet, with its notes and highlight state."""

    sheet: str
    section: Optional[str] = None
    label: str
    label_cell: str
    value: Optional[str] = None
    value_cell: Optional[str] = None
    note: Optional[str] = None
    note_cell: Optional[str] = None
    highlighted: bool = Field(False, description="Value cell carries a review highlight fill")
    extra: Dict[str, str] = Field(default_factory=dict, description="Additional columns, e.g. %DV")


class ExcelTable(BaseModel):
    """A column table such as nutrition values per pack size."""

    sheet: str
    title: str
    header_cell: str
    columns: List[str]
    rows: List[Dict[str, Optional[str]]]
    cells: List[Dict[str, Optional[str]]] = Field(default_factory=list)


class PageInfo(BaseModel):
    file: str
    page: int
    width: float
    height: float
    image: str = Field(..., description="Render file name inside the session folder")


class Panel(BaseModel):
    id: str
    label: str
    file: str
    page: int
    bbox: List[float]
    is_main: bool = False


class Extraction(BaseModel):
    """Everything read from a session's files."""

    fragments: List[Fragment] = Field(default_factory=list)
    excel_rows: List[ExcelRow] = Field(default_factory=list)
    excel_tables: List[ExcelTable] = Field(default_factory=list)
    pages: List[PageInfo] = Field(default_factory=list)
    panels: List[Panel] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list, description="What the readers could not read well")
