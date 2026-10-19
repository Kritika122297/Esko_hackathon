"""File parsing service for BriefForge.

Extracts text, structural metadata, images, and tables from PDFs,
Excel spreadsheets, Word documents, and raster images.
"""

from pathlib import Path
import base64
import os
import io
import uuid
import logging
from typing import Optional, Dict, Any, List, Tuple

from app.models.extraction import ExtractedData, ExtractedText
from app.config import settings

logger = logging.getLogger(__name__)


def _classify_panel_location(bbox: List[float], page_width: float, page_height: float) -> str:
    """Classifies text block location on a packaging dieline/page based on bounding box."""
    if not bbox or len(bbox) < 4 or page_width <= 0 or page_height <= 0:
        return "page content"

    x0, y0, x1, y1 = bbox
    cx = (x0 + x1) / 2.0
    cy = (y0 + y1) / 2.0

    rel_x = cx / page_width
    rel_y = cy / page_height

    # Heuristic for multi-panel flat dielines
    if rel_x < 0.33:
        panel_x = "left panel"
    elif rel_x > 0.66:
        panel_x = "right panel"
    else:
        panel_x = "center panel"

    if rel_y < 0.25:
        return f"top / {panel_x}"
    elif rel_y > 0.75:
        return f"bottom / {panel_x}"
    return panel_x


def parse_pdf(file_path: Path, session_id: str, output_dir: Optional[Path] = None) -> ExtractedData:
    """Parses a PDF packaging artwork or specification file using PyMuPDF (fitz).

    Extracts text blocks with coordinates, page numbers, and renders each page to PNG.
    """
    extracted = ExtractedData(session_id=session_id)
    render_dir = (output_dir or settings.UPLOAD_DIR) / session_id / "renders"
    render_dir.mkdir(parents=True, exist_ok=True)

    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.warning("PyMuPDF (fitz) is not installed. Falling back to plain text extraction.")
        return extracted

    try:
        doc = fitz.open(str(file_path))
        file_name = file_path.name

        extracted.metadata["file_name"] = file_name
        extracted.metadata["page_count"] = len(doc)
        extracted.metadata["file_type"] = "pdf"

        for page_index in range(len(doc)):
            page = doc[page_index]
            page_num = page_index + 1
            rect = page.rect
            page_width, page_height = rect.width, rect.height

            # Render page to image for Gemini Vision
            try:
                pix = page.get_pixmap(dpi=150)
                image_filename = f"page_{page_num}_{uuid.uuid4().hex[:6]}.png"
                image_path = render_dir / image_filename
                pix.save(str(image_path))
                extracted.images.append(str(image_path))
            except Exception as img_err:
                logger.error(f"Failed to render PDF page {page_num} to image: {img_err}")

            # Extract structured text blocks (x0, y0, x1, y1, text, block_no, block_type)
            blocks = page.get_text("blocks")
            for block in blocks:
                if len(block) >= 5:
                    x0, y0, x1, y1, text = block[:5]
                    cleaned_text = str(text).strip()
                    if not cleaned_text:
                        continue

                    # Determine rough location / panel
                    bbox = [float(x0), float(y0), float(x1), float(y1)]
                    location = _classify_panel_location(bbox, page_width, page_height)

                    extracted.texts.append(
                        ExtractedText(
                            text=cleaned_text,
                            source_file=file_name,
                            location=f"Page {page_num} ({location})",
                            confidence=0.95,
                            page_number=page_num,
                            bbox=bbox,
                        )
                    )

        doc.close()
    except Exception as e:
        logger.error(f"Error parsing PDF file {file_path}: {e}")
        extracted.metadata["error"] = str(e)

    return extracted


def parse_excel(file_path: Path, session_id: str) -> ExtractedData:
    """Parses an Excel spreadsheet (.xlsx, .xls) using openpyxl.

    Reads sheet by sheet and cell by cell, specifically preserving the Notes column.
    """
    extracted = ExtractedData(session_id=session_id)
    file_name = file_path.name
    extracted.metadata["file_name"] = file_name
    extracted.metadata["file_type"] = "excel"

    try:
        import openpyxl
    except ImportError:
        logger.warning("openpyxl is not installed.")
        return extracted

    try:
        wb = openpyxl.load_workbook(str(file_path), data_only=True)
        extracted.metadata["sheet_names"] = wb.sheetnames

        for sheet_name in wb.sheetnames:
            sheet = wb[sheet_name]
            sheet_rows: List[List[Any]] = []
            notes_entries: List[Dict[str, Any]] = []

            # Read all rows
            header_map: Dict[int, str] = {}
            for row_idx, row in enumerate(sheet.iter_rows(values_only=True), start=1):
                row_vals = list(row)
                if not any(v is not None for v in row_vals):
                    continue

                if row_idx == 1:
                    # Headers
                    for col_idx, cell_val in enumerate(row_vals, start=1):
                        if cell_val is not None:
                            header_map[col_idx] = str(cell_val).strip()
                    sheet_rows.append(row_vals)
                    continue

                sheet_rows.append(row_vals)

                # Cell-by-cell inspection and Notes column preservation
                for col_idx, cell_val in enumerate(row_vals, start=1):
                    if cell_val is None:
                        continue
                    val_str = str(cell_val).strip()
                    if not val_str:
                        continue

                    header_name = header_map.get(col_idx, f"Col{col_idx}")
                    col_letter = openpyxl.utils.get_column_letter(col_idx)
                    cell_coord = f"{col_letter}{row_idx}"

                    # Check if this is a Notes / Comments column
                    is_notes_col = any(
                        keyword in header_name.lower()
                        for keyword in ["note", "comment", "remark", "status", "review", "flag"]
                    )

                    if is_notes_col:
                        notes_entries.append(
                            {
                                "cell": cell_coord,
                                "header": header_name,
                                "row": row_idx,
                                "content": val_str,
                            }
                        )
                        location = f"Sheet '{sheet_name}' cell {cell_coord} [Notes: {header_name}]"
                    else:
                        location = f"Sheet '{sheet_name}' cell {cell_coord} ({header_name})"

                    extracted.texts.append(
                        ExtractedText(
                            text=f"{header_name}: {val_str}" if header_name != f"Col{col_idx}" else val_str,
                            source_file=file_name,
                            location=location,
                            confidence=1.0,
                        )
                    )

            # Store sheet table structure
            extracted.tables.append(
                {
                    "sheet_name": sheet_name,
                    "row_count": len(sheet_rows),
                    "headers": list(header_map.values()),
                    "notes_entries": notes_entries,
                    "sample_rows": sheet_rows[:15],
                }
            )

        wb.close()
    except Exception as e:
        logger.error(f"Error parsing Excel file {file_path}: {e}")
        extracted.metadata["error"] = str(e)

    return extracted


def parse_word(file_path: Path, session_id: str) -> ExtractedData:
    """Parses a Word document (.docx) using python-docx.

    Extracts paragraphs and structured tables.
    """
    extracted = ExtractedData(session_id=session_id)
    file_name = file_path.name
    extracted.metadata["file_name"] = file_name
    extracted.metadata["file_type"] = "word"

    try:
        import docx
    except ImportError:
        logger.warning("python-docx is not installed.")
        return extracted

    try:
        doc = docx.Document(str(file_path))

        # Extract paragraphs
        for p_idx, para in enumerate(doc.paragraphs, start=1):
            text = para.text.strip()
            if text:
                extracted.texts.append(
                    ExtractedText(
                        text=text,
                        source_file=file_name,
                        location=f"Paragraph {p_idx}",
                        confidence=0.95,
                    )
                )

        # Extract tables
        for t_idx, table in enumerate(doc.tables, start=1):
            table_rows: List[List[str]] = []
            for row in table.rows:
                row_data = [cell.text.strip() for cell in row.cells]
                table_rows.append(row_data)

            extracted.tables.append(
                {
                    "table_index": t_idx,
                    "rows": table_rows,
                }
            )

            # Also add table cell text to extracted texts
            for r_idx, row_data in enumerate(table_rows, start=1):
                row_str = " | ".join(row_data)
                if row_str.strip():
                    extracted.texts.append(
                        ExtractedText(
                            text=row_str,
                            source_file=file_name,
                            location=f"Table {t_idx} Row {r_idx}",
                            confidence=0.95,
                        )
                    )

    except Exception as e:
        logger.error(f"Error parsing Word file {file_path}: {e}")
        extracted.metadata["error"] = str(e)

    return extracted


def parse_image(file_path: Path, session_id: str, output_dir: Optional[Path] = None) -> ExtractedData:
    """Loads an image using Pillow, saves a normalized render, and encodes base64."""
    extracted = ExtractedData(session_id=session_id)
    file_name = file_path.name
    render_dir = (output_dir or settings.UPLOAD_DIR) / session_id / "renders"
    render_dir.mkdir(parents=True, exist_ok=True)

    extracted.metadata["file_name"] = file_name
    extracted.metadata["file_type"] = "image"

    try:
        from PIL import Image

        with Image.open(str(file_path)) as img:
            extracted.metadata["width"] = img.width
            extracted.metadata["height"] = img.height
            extracted.metadata["format"] = img.format

            # Save normalized image
            out_img_name = f"img_{uuid.uuid4().hex[:6]}.png"
            out_img_path = render_dir / out_img_name
            img.save(str(out_img_path), format="PNG")
            extracted.images.append(str(out_img_path))

            # Encode small base64 preview for metadata
            thumb = img.copy()
            thumb.thumbnail((400, 400))
            buffered = io.BytesIO()
            thumb.save(buffered, format="PNG")
            b64_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
            extracted.metadata["thumbnail_base64"] = b64_str

            extracted.texts.append(
                ExtractedText(
                    text=f"[Image File: {file_name} ({img.width}x{img.height})]",
                    source_file=file_name,
                    location="Image Visual",
                    confidence=1.0,
                )
            )

    except Exception as e:
        logger.error(f"Error loading image file {file_path}: {e}")
        extracted.metadata["error"] = str(e)

    return extracted


def parse_file(
    file_path: Path,
    filename: str,
    session_id: str,
    output_dir: Optional[Path] = None,
) -> ExtractedData:
    """Router function that invokes the correct parser based on file extension."""
    ext = Path(filename).suffix.lower().lstrip(".")

    if ext == "pdf":
        return parse_pdf(file_path, session_id, output_dir)
    elif ext in ["xlsx", "xls"]:
        return parse_excel(file_path, session_id)
    elif ext in ["docx", "doc"]:
        return parse_word(file_path, session_id)
    elif ext in ["png", "jpg", "jpeg", "webp"]:
        return parse_image(file_path, session_id, output_dir)
    else:
        # Fallback raw text reader
        extracted = ExtractedData(session_id=session_id)
        extracted.metadata["file_name"] = filename
        extracted.metadata["file_type"] = ext or "unknown"
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read().strip()
                if content:
                    extracted.texts.append(
                        ExtractedText(
                            text=content,
                            source_file=filename,
                            location="Raw file text",
                            confidence=0.8,
                        )
                    )
        except Exception as e:
            logger.error(f"Failed fallback reading of {file_path}: {e}")
        return extracted
