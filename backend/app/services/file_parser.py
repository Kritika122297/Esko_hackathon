"""Readers for packaging artwork (PDF), content sheets (Excel), documents and notes.

Readers only read: they never interpret values. Every fragment keeps its file, page,
position (or cell) so later steps can show proof for each value.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from app.config import settings
from app.models.extraction import ExcelRow, ExcelTable, Extraction, Fragment, PageInfo, Panel

logger = logging.getLogger(__name__)

# Limits that keep one odd file from exhausting the server. Content sheets and cartons are far smaller.
MAX_SHEET_ROWS, MAX_SHEET_COLS = 5000, 60
MAX_PDF_PAGES = 30
MAX_RENDER_PIXELS = 40_000_000  # per page; the render DPI drops for very large pages

# Printing-guide phrases found on dielines. Their colour/font is learned per file so that
# related guide marks (registration codes, layer names) are removed as well.
GUIDE_PHRASES = (
    "art orientation",
    "orientation",
    "copy free",
    "front panel",
    "back panel",
    "left panel",
    "right panel",
    "top panel",
    "bottom panel",
    "side panel",
    "principal display panel",
    "bleed",
    "fold line",
    "cut line",
    "crease",
    "do not print",
    "safety margin",
    "safe area",
    "varnish free",
    "glue area",
    "glue flap",
)
PANEL_ANCHORS = {
    "principal display panel": "front",
    "front panel": "front",
    "back panel": "back",
    "left panel": "left",
    "right panel": "right",
    "top panel": "top",
    "bottom panel": "bottom",
}
PANEL_LABELS = {
    "front": "Front panel (PDP)",
    "back": "Back panel",
    "left": "Left side panel",
    "right": "Right side panel",
    "top": "Top panel",
    "bottom": "Bottom panel",
}


def _norm(text: str) -> str:
    return " ".join(text.lower().split())


def _color_hex(color) -> Optional[str]:
    if color is None:
        return None
    if isinstance(color, int):
        return f"{color:06x}"
    return "".join(f"{int(round(c * 255)):02x}" for c in color[:3])


def _is_guide_text(text: str) -> bool:
    n = _norm(text).strip(" .:")
    return any(n == p or n.startswith(p + " ") or n.endswith(" " + p) for p in GUIDE_PHRASES)


def _collapse_letter_spacing(text: str) -> str:
    """'Ty p i c a l Va l u e s' -> 'TypicalValues' style text gets its letters re-joined."""
    tokens = text.split(" ")
    singles = sum(1 for t in tokens if len(t) <= 1)
    if len(tokens) >= 4 and singles / len(tokens) >= 0.6:
        return re.sub(r"(?<=\S) (?=\S)", "", text.replace("  ", "\u0000")).replace("\u0000", " ")
    return text


# --------------------------------------------------------------------------- PDF


def _coverage(outer, inner) -> float:
    ox0, oy0, ox1, oy1 = outer
    ix0, iy0, ix1, iy1 = inner
    w = max(0.0, min(ox1, ix1) - max(ox0, ix0))
    h = max(0.0, min(oy1, iy1) - max(oy0, iy0))
    area = max((ix1 - ix0) * (iy1 - iy0), 1e-6)
    return w * h / area


def _hidden_text_boxes(page) -> List[Tuple[str, List[float]]]:
    """Text drawn first and then fully covered by a later opaque fill or image.

    Uses the page's drawing order (bbox log); such text exists in the file but is not
    visible in print, typically leftovers from an older or foreign-market version.
    """
    try:
        log = page.get_bboxlog()
        traces = page.get_texttrace()
    except Exception as err:  # pragma: no cover - depends on PyMuPDF build
        logger.warning("Hidden-text detection unavailable: %s", err)
        return []
    hidden: List[Tuple[str, List[float]]] = []
    for t in traces:
        text = "".join(chr(c[0]) for c in t["chars"]).strip()
        if not text:
            continue
        seq = t.get("seqno", -1)
        bbox = list(t["bbox"])
        if t.get("type") == 3 or t.get("opacity", 1.0) == 0:
            hidden.append((text, bbox))
            continue
        for kind, rect in log[seq + 1:]:
            if kind in ("fill-path", "fill-image", "fill-shade") and _coverage(rect, bbox) > 0.9:
                hidden.append((text, bbox))
                break
    return hidden


def _detect_panel_grid(page, file_name: str, page_no: int, anchors: List[Tuple[str, List[float]]]) -> List[Panel]:
    """Builds panel rectangles from long axis-aligned dieline lines, named by guide labels."""
    width, height = page.rect.width, page.rect.height
    by_color: Dict[str, Dict[str, set]] = {}
    for dr in page.get_drawings():
        col = dr.get("color")
        if not col:
            continue
        key = _color_hex(col)
        bucket = by_color.setdefault(key, {"v": set(), "h": set(), "rgb": tuple(col[:3])})
        for item in dr["items"]:
            if item[0] != "l":
                continue
            p1, p2 = item[1], item[2]
            if abs(p1.x - p2.x) < 1 and abs(p1.y - p2.y) > height * 0.12:
                bucket["v"].add(round(p1.x))
            elif abs(p1.y - p2.y) < 1 and abs(p1.x - p2.x) > width * 0.12:
                bucket["h"].add(round(p1.y))

    def score(b) -> float:
        r, g, bl = b["rgb"]
        redness = 1.0 if (r > 0.7 and g < 0.4 and bl < 0.4) else 0.0
        inner_v = [x for x in b["v"] if 5 < x < width - 5]
        inner_h = [y for y in b["h"] if 5 < y < height - 5]
        if len(inner_v) < 2 or len(inner_h) < 1:
            return -1
        return redness * 10 + min(len(inner_v), 6) + min(len(inner_h), 4)

    best = max(by_color.values(), key=score, default=None)
    if not best or score(best) < 0:
        return []

    def merge(vals: List[int]) -> List[float]:
        out: List[float] = []
        for v in sorted(vals):
            if not out or v - out[-1] > 8:
                out.append(float(v))
        return out

    xs = [0.0] + [x for x in merge(list(best["v"])) if 5 < x < width - 5] + [width]
    ys = [0.0] + [y for y in merge(list(best["h"])) if 5 < y < height - 5] + [height]
    cells = []
    for r in range(len(ys) - 1):
        for c in range(len(xs) - 1):
            cells.append({"row": r, "col": c, "bbox": [xs[c], ys[r], xs[c + 1], ys[r + 1]], "names": []})

    def cell_at(bbox) -> Optional[dict]:
        cx, cy = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2
        for cell in cells:
            x0, y0, x1, y1 = cell["bbox"]
            if x0 <= cx <= x1 and y0 <= cy <= y1:
                return cell
        return None

    for text, bbox in anchors:
        n = _norm(text)
        for phrase, pid in PANEL_ANCHORS.items():
            if phrase in n:
                cell = cell_at(bbox)
                if cell is not None:
                    cell["names"].append((phrase, pid))
                break

    main_row = None
    for cell in cells:
        if any(p == "principal display panel" for p, _ in cell["names"]):
            main_row = cell["row"]
    if main_row is None:
        rows_with_names: Dict[int, int] = {}
        for cell in cells:
            if cell["names"]:
                rows_with_names[cell["row"]] = rows_with_names.get(cell["row"], 0) + 1
        main_row = max(rows_with_names, key=rows_with_names.get) if rows_with_names else None
    if main_row is None:
        return []

    column_names: Dict[int, str] = {}
    for cell in cells:
        if cell["row"] == main_row and cell["names"]:
            column_names[cell["col"]] = cell["names"][0][1]

    panels: List[Panel] = []
    for cell in cells:
        x0, y0, x1, y1 = cell["bbox"]
        if (x1 - x0) < width * 0.06 or (y1 - y0) < height * 0.06:
            continue  # glue strips and slivers
        col_name = column_names.get(cell["col"])
        if cell["row"] == main_row and col_name:
            pid, label, is_main = col_name, PANEL_LABELS[col_name], col_name == "front"
        elif col_name and cell["row"] == main_row - 1:
            pid, label, is_main = f"top_{col_name}", f"Top flap above {PANEL_LABELS[col_name].split(' (')[0].lower()}", False
        elif col_name and cell["row"] == main_row + 1:
            pid, label, is_main = f"bottom_{col_name}", f"Bottom flap below {PANEL_LABELS[col_name].split(' (')[0].lower()}", False
        elif cell["row"] < main_row - 1 and col_name:
            pid, label, is_main = f"tuck_{col_name}", f"Top tuck flap ({col_name})", False
        else:
            continue
        panels.append(Panel(id=pid, label=label, file=file_name, page=page_no, bbox=[x0, y0, x1, y1], is_main=is_main))
    return panels


def _panel_for(bbox: List[float], panels: List[Panel], page_no: int) -> Optional[str]:
    cx, cy = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2
    for p in panels:
        if p.page != page_no:
            continue
        x0, y0, x1, y1 = p.bbox
        if x0 <= cx <= x1 and y0 <= cy <= y1:
            return p.id
    return None


def _merge_letter_spans(spans: List[dict]) -> List[dict]:
    """Joins curved text drawn one letter at a time into words, and drops layered copies."""
    out: List[dict] = []
    run: List[dict] = []

    def flush():
        if not run:
            return
        if len(run) == 1:
            out.append(run[0])
        else:
            centers = [((s["bbox"][0] + s["bbox"][2]) / 2, (s["bbox"][1] + s["bbox"][3]) / 2) for s in run]
            steps = [((centers[i + 1][0] - centers[i][0]) ** 2 + (centers[i + 1][1] - centers[i][1]) ** 2) ** 0.5
                     for i in range(len(centers) - 1)]
            typical = sorted(steps)[len(steps) // 2] if steps else 0
            text = run[0]["text"]
            for i, s in enumerate(run[1:]):
                text += (" " if steps[i] > typical * 1.45 else "") + s["text"]
            x0 = min(s["bbox"][0] for s in run)
            y0 = min(s["bbox"][1] for s in run)
            x1 = max(s["bbox"][2] for s in run)
            y1 = max(s["bbox"][3] for s in run)
            merged = dict(run[0])
            merged.update(text=text, bbox=[x0, y0, x1, y1])
            out.append(merged)
        run.clear()

    for s in spans:
        single = len(s["text"].strip()) == 1
        if single and run and (s["font"], round(s["size"]), s["color"]) == (run[-1]["font"], round(run[-1]["size"]), run[-1]["color"]):
            run.append(s)
            continue
        flush()
        if single:
            run.append(s)
        else:
            out.append(s)
    flush()

    # Layered copies (outline + fill + shadow) share text and position: keep one.
    unique: List[dict] = []
    for s in out:
        dup = False
        for u in unique:
            if _norm(u["text"]) == _norm(s["text"]) and _coverage(u["bbox"], s["bbox"]) > 0.8:
                dup = True
                if s["color"] in ("231f20", "000000") and u["color"] not in ("231f20", "000000"):
                    u.update(color=s["color"])
                break
        if not dup:
            unique.append(s)
    return unique


def _ocr_fragments(ex: Extraction, render_path: Path, file_name: str, page_no: int, id_prefix: str,
                   start: int, scale: float, panels: List[Panel]) -> int:
    """Reads a page that has no text layer. `scale` turns image pixels into the page's units (PDF points)."""
    from app.services.ocr import read_image

    lines, engine, problem = read_image(render_path)
    if problem:
        ex.notes.append(f"{file_name} p{page_no}: no text layer and {problem}. The page is shown but its text was not read.")
        return 0
    n = start
    for ln in lines:
        n += 1
        bbox = [round(v * scale, 1) for v in ln.bbox] if ln.bbox else None
        ex.fragments.append(Fragment(
            id=f"{id_prefix}{n}", file=file_name, kind="pdf", text=ln.text, page=page_no, bbox=bbox,
            panel=_panel_for(bbox, panels, page_no) if bbox else None, ocr=engine, ocr_conf=round(ln.conf, 2)))
    low = sum(1 for ln in lines if ln.conf < settings.OCR_MIN_CONFIDENCE)
    ex.notes.append(f"{file_name} p{page_no}: text read by OCR ({engine}), {len(lines)} lines"
                    + (f", {low} with low confidence" if low else "") + ". Check OCR values before relying on them.")
    return len(lines)


def parse_pdf(path: Path, file_name: str, session_dir: Path, id_prefix: str) -> Extraction:
    import pymupdf

    ex = Extraction()
    doc = pymupdf.open(str(path))
    render_dir = session_dir / "renders"
    render_dir.mkdir(parents=True, exist_ok=True)
    n = 0
    if doc.page_count > MAX_PDF_PAGES:
        ex.notes.append(f"{file_name}: only the first {MAX_PDF_PAGES} of {doc.page_count} pages were read.")
    try:
        for page in doc:
            if page.number >= MAX_PDF_PAGES:
                break
            page_no = page.number + 1
            image_name = f"{Path(file_name).stem}_p{page_no}.png"
            area_in2 = max(page.rect.width * page.rect.height, 1.0) / (72.0 * 72.0)
            dpi = min(settings.RENDER_DPI, max(int((MAX_RENDER_PIXELS / area_in2) ** 0.5), 18))
            page.get_pixmap(dpi=dpi, alpha=False).save(str(render_dir / image_name))
            ex.pages.append(PageInfo(file=file_name, page=page_no, width=page.rect.width, height=page.rect.height, image=image_name))

            spans: List[dict] = []
            for block in page.get_text("dict")["blocks"]:
                if block.get("type") != 0:
                    continue
                for line in block["lines"]:
                    for s in line["spans"]:
                        if not s["text"].strip():
                            continue
                        spans.append({
                            "text": s["text"].strip(),
                            "bbox": [float(v) for v in s["bbox"]],
                            "color": _color_hex(s["color"]),
                            "font": s["font"],
                            "size": float(s["size"]),
                        })
            spans = _merge_letter_spans(spans)
            for s in spans:
                s["text"] = _collapse_letter_spacing(s["text"])

            # Learn the guide-mark style (colour + font) from known guide phrases.
            guide_styles = {(s["color"], s["font"]) for s in spans if _is_guide_text(s["text"])}
            anchors = [(s["text"], s["bbox"]) for s in spans if (s["color"], s["font"]) in guide_styles]
            panels = _detect_panel_grid(page, file_name, page_no, anchors)
            ex.panels.extend(panels)

            hidden_boxes = _hidden_text_boxes(page)

            def is_hidden(text: str, bbox: List[float]) -> bool:
                key = re.sub(r"\s+", "", text.lower())
                for htext, hbox in hidden_boxes:
                    if key and key in re.sub(r"\s+", "", htext.lower()) and _coverage(hbox, bbox) > 0.5:
                        return True
                return False

            for s in spans:
                n += 1
                ex.fragments.append(Fragment(
                    id=f"{id_prefix}{n}",
                    file=file_name,
                    kind="pdf",
                    text=s["text"],
                    page=page_no,
                    bbox=[round(v, 1) for v in s["bbox"]],
                    panel=_panel_for(s["bbox"], panels, page_no),
                    color=s["color"],
                    font=s["font"],
                    size=round(s["size"], 1),
                    is_guide=(s["color"], s["font"]) in guide_styles,
                    is_hidden=is_hidden(s["text"], s["bbox"]),
                ))

            if not spans:  # scanned page: nothing to read in the PDF itself
                n += _ocr_fragments(ex, render_dir / image_name, file_name, page_no, id_prefix, n,
                                    72.0 / dpi, panels)

            guides = sum(1 for s in spans if (s["color"], s["font"]) in guide_styles)
            if guides:
                ex.notes.append(f"{file_name} p{page_no}: ignored {guides} printing-guide marks (e.g. 'Art orientation', 'Copy free').")
            if not panels:
                ex.notes.append(f"{file_name} p{page_no}: no dieline panel grid found; text is not assigned to panels.")
            image_blocks = sum(1 for b in page.get_text("dict")["blocks"] if b.get("type") == 1)
            if image_blocks:
                ex.notes.append(
                    f"{file_name} p{page_no}: {image_blocks} image areas (logos, seals, barcode, photography) carry no machine-readable text."
                )
    finally:
        doc.close()
    return ex


# --------------------------------------------------------------------------- Excel


def _is_highlight(cell) -> bool:
    try:
        if cell.fill is None or cell.fill.fill_type != "solid":
            return False
        rgb = str(cell.fill.fgColor.rgb or "")[-6:].upper()
    except Exception:
        return False
    # Theme and indexed colours have no RGB (openpyxl returns an error text); they are not review highlights.
    if not re.fullmatch(r"[0-9A-F]{6}", rgb) or rgb in ("FFFFFF", "000000"):
        return False
    r, g, b = int(rgb[0:2], 16), int(rgb[2:4], 16), int(rgb[4:6], 16)
    # Yellow / amber review highlights: strong red+green, weaker blue.
    return r > 200 and g > 180 and b < 215 and (r - b) > 25


def _is_header_fill(cell) -> bool:
    try:
        if cell.fill is None or cell.fill.fill_type != "solid":
            return False
        rgb = str(cell.fill.fgColor.rgb or "")[-6:].upper()
        r, g, b = int(rgb[0:2], 16), int(rgb[2:4], 16), int(rgb[4:6], 16)
        return (r + g + b) < 300  # dark section banner
    except Exception:
        return False


def _cell_text(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = str(value).strip()
    return text or None


def parse_excel(path: Path, file_name: str, id_prefix: str) -> Extraction:
    import openpyxl
    from openpyxl.utils import get_column_letter

    ex = Extraction()
    wb = openpyxl.load_workbook(str(path), data_only=True)
    n = 0
    for ws in wb.worksheets:
        section: Optional[str] = None
        table_mode: Optional[dict] = None
        # ws.max_row/max_column count formatted but empty cells; one stray cell far away would make the loop
        # visit millions of cells. Use the cells that hold a value, within a generous limit.
        used = [k for k, c in ws._cells.items() if c.value not in (None, "")]  # noqa: SLF001
        if not used:
            continue
        last_row, max_col = max(r for r, _ in used), max(c for _, c in used)
        if last_row > MAX_SHEET_ROWS or max_col > MAX_SHEET_COLS:
            ex.notes.append(f"{file_name} / {ws.title}: only the first {MAX_SHEET_ROWS} rows and {MAX_SHEET_COLS} "
                            "columns were read.")
            last_row, max_col = min(last_row, MAX_SHEET_ROWS), min(max_col, MAX_SHEET_COLS)
        for row in ws.iter_rows(min_row=1, max_row=last_row, max_col=max_col):
            cells = list(row)
            first = cells[0] if cells else None
            values = [_cell_text(c.value) for c in cells]
            if not any(values):
                table_mode = None
                continue

            # Every non-empty cell is kept as a fragment for proof and search.
            for c, v in zip(cells, values):
                if v:
                    n += 1
                    ex.fragments.append(Fragment(
                        id=f"{id_prefix}{n}", file=file_name, kind="excel", text=v,
                        sheet=ws.title, cell=c.coordinate,
                    ))

            # Section banner
            if first is not None and values[0] and _is_header_fill(first) and sum(1 for v in values if v) <= 2:
                section = values[0]
                table_mode = None
                continue

            # Column table header: first cell names the row label, others look like pack sizes
            pack_cols = [(c, v) for c, v in zip(cells[1:], values[1:]) if v and re.fullmatch(r"\d+(\.\d+)?\s*(g|kg|ml|l|oz)", v.lower())]
            if table_mode is None and values[0] and len(pack_cols) >= 2:
                table_mode = {
                    "title": section,
                    "header_cell": first.coordinate,
                    "columns": [(c.column, v) for c, v in pack_cols],
                    "rows": [],
                    "cells": [],
                }
                ex.excel_tables.append(ExcelTable(sheet=ws.title, title=section, header_cell=first.coordinate,
                                                  columns=[v for _, v in pack_cols], rows=[], cells=[]))
                continue

            if table_mode is not None and values[0]:
                table = ex.excel_tables[-1]
                rec: Dict[str, Optional[str]] = {"label": values[0], "label_cell": first.coordinate}
                cell_rec: Dict[str, Optional[str]] = {}
                for idx, (col_idx, col_name) in enumerate(table_mode["columns"]):
                    amount_cell = ws.cell(row=first.row, column=col_idx)
                    next_col = table_mode["columns"][idx + 1][0] if idx + 1 < len(table_mode["columns"]) else max_col + 1
                    dv_cell = ws.cell(row=first.row, column=col_idx + 1) if col_idx + 1 < next_col else None
                    rec[col_name] = _cell_text(amount_cell.value)
                    rec[f"{col_name} %DV"] = _cell_text(dv_cell.value) if dv_cell is not None else None
                    cell_rec[col_name] = amount_cell.coordinate
                    cell_rec[f"{col_name} %DV"] = dv_cell.coordinate if dv_cell is not None else None
                table.rows.append(rec)
                table.cells.append(cell_rec)
                continue

            # Sub-header rows such as "Field | English (US) | Notes"
            if values[0] and values[0].lower() in ("field", "fields", "item"):
                continue

            # Label / value / note groups. Labels are in any column; the value sits to the
            # right; an italic cell after the value is the note for that value.
            col = 0
            while col < len(cells):
                c, v = cells[col], values[col]
                if not v or col + 1 >= len(cells):
                    col += 1
                    continue
                is_label = bool(c.font and c.font.b) or (col == 0) or (cells[col - 1].value is None if col > 0 else True)
                val_cell = cells[col + 1]
                val = values[col + 1]
                if not is_label or (c.font and c.font.i):
                    col += 1
                    continue
                note_cell = cells[col + 2] if col + 2 < len(cells) else None
                note = values[col + 2] if col + 2 < len(cells) else None
                note_is_note = bool(note_cell is not None and note and note_cell.font and note_cell.font.i)
                if val is not None and not (val_cell.font and val_cell.font.i):
                    ex.excel_rows.append(ExcelRow(
                        sheet=ws.title, section=section, label=v, label_cell=c.coordinate,
                        value=val, value_cell=val_cell.coordinate,
                        note=note if note_is_note else None,
                        note_cell=note_cell.coordinate if note_is_note else None,
                        highlighted=_is_highlight(val_cell),
                    ))
                    col += 3 if note_is_note else 2
                else:
                    col += 1
    wb.close()
    if ex.excel_tables:
        for t in ex.excel_tables:
            ex.notes.append(f"{file_name}: read table '{t.title}' with columns {', '.join(t.columns)}.")
    return ex


# --------------------------------------------------------------------------- Word / text / images


def parse_word(path: Path, file_name: str, id_prefix: str) -> Extraction:
    import docx

    ex = Extraction()
    d = docx.Document(str(path))
    n = 0
    for i, para in enumerate(d.paragraphs, start=1):
        text = para.text.strip()
        if text:
            n += 1
            ex.fragments.append(Fragment(id=f"{id_prefix}{n}", file=file_name, kind="word", text=text, cell=f"Paragraph {i}"))
    for t_idx, table in enumerate(d.tables, start=1):
        for r_idx, row in enumerate(table.rows, start=1):
            cells = [c.text.strip() for c in row.cells]
            if len(cells) >= 2 and cells[0] and cells[1]:
                ex.excel_rows.append(ExcelRow(sheet=f"Table {t_idx}", label=cells[0], label_cell=f"T{t_idx}R{r_idx}C1",
                                              value=cells[1], value_cell=f"T{t_idx}R{r_idx}C2",
                                              note=cells[2] if len(cells) > 2 and cells[2] else None))
            joined = " | ".join(c for c in cells if c)
            if joined:
                n += 1
                ex.fragments.append(Fragment(id=f"{id_prefix}{n}", file=file_name, kind="word", text=joined,
                                             cell=f"Table {t_idx} row {r_idx}"))
    return ex


def parse_text(path: Path, file_name: str, id_prefix: str) -> Extraction:
    ex = Extraction()
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    n = 0
    for i, line in enumerate(lines, start=1):
        text = line.strip()
        if not text:
            continue
        n += 1
        ex.fragments.append(Fragment(id=f"{id_prefix}{n}", file=file_name, kind="text", text=text, cell=f"Line {i}"))
        m = re.match(r"^\s*([A-Za-z][A-Za-z /&()%.-]{2,60})\s*[:=]\s*(.+)$", line)
        if m:
            ex.excel_rows.append(ExcelRow(sheet="notes", label=m.group(1).strip(), label_cell=f"Line {i}",
                                          value=m.group(2).strip(), value_cell=f"Line {i}"))
    return ex


def parse_image(path: Path, file_name: str, session_dir: Path, id_prefix: str = "f0_") -> Extraction:
    from PIL import Image

    ex = Extraction()
    render_dir = session_dir / "renders"
    render_dir.mkdir(parents=True, exist_ok=True)
    with Image.open(str(path)) as img:
        # The extension is part of the name: 'label.png' must not overwrite the render of 'label.pdf'.
        image_name = f"{Path(file_name).stem}_{Path(file_name).suffix.lstrip('.').lower()}_p1.png"
        img.convert("RGB").save(str(render_dir / image_name), format="PNG")
        ex.pages.append(PageInfo(file=file_name, page=1, width=float(img.width), height=float(img.height), image=image_name))
    if not _ocr_fragments(ex, render_dir / image_name, file_name, 1, id_prefix, 0, 1.0, []):
        ex.notes.append(f"{file_name}: image file has no text layer; values can only be read by the AI vision step.")
    return ex


def parse_file(path: Path, file_name: str, session_dir: Path, file_index: int) -> Extraction:
    ext = path.suffix.lower().lstrip(".")
    prefix = f"f{file_index}_"
    if ext == "pdf":
        return parse_pdf(path, file_name, session_dir, prefix)
    if ext == "xlsx":
        return parse_excel(path, file_name, prefix)
    if ext == "docx":
        return parse_word(path, file_name, prefix)
    if ext in ("txt", "md"):
        return parse_text(path, file_name, prefix)
    if ext in ("png", "jpg", "jpeg"):
        return parse_image(path, file_name, session_dir, prefix)
    ex = Extraction()
    ex.notes.append(f"{file_name}: unsupported file type '.{ext}' was not read.")
    return ex


def merge_extractions(parts: List[Extraction]) -> Extraction:
    total = Extraction()
    for p in parts:
        total.fragments += p.fragments
        total.excel_rows += p.excel_rows
        total.excel_tables += p.excel_tables
        total.pages += p.pages
        total.panels += p.panels
        total.notes += p.notes
    return total
