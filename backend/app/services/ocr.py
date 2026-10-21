"""OCR for images and scanned PDF pages.

Engines, tried in this order when OCR_ENGINE=auto:
* tesseract: local and free. Gives a real box and a confidence for every line, so findings can point at the print.
* llm: the 'ocr' role model (a vision model) reads the page. No boxes, so the text is flagged for a human look.
Without either, the file is kept as a viewable page and the notes say that nothing was read.
Text read by OCR is always marked as OCR so it is never taken for a real text layer.
"""

from __future__ import annotations

import logging
import shutil
from pathlib import Path
from typing import List, NamedTuple, Optional

from app.config import settings
from app.services.llm import LLMError, get_llm

logger = logging.getLogger(__name__)


class OcrLine(NamedTuple):
    text: str
    bbox: Optional[List[float]]  # pixels of the rendered image, or None
    conf: float                  # 0-1


def _tesseract_ready() -> bool:
    try:
        import pytesseract
    except ImportError:
        return False
    if settings.TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
    return bool(settings.TESSERACT_CMD and Path(settings.TESSERACT_CMD).exists()) or shutil.which("tesseract") is not None


def pick_engine() -> str:
    want = settings.OCR_ENGINE
    if want == "none":
        return "none"
    if want in ("auto", "tesseract") and _tesseract_ready():
        return "tesseract"
    if want in ("auto", "llm") and get_llm("ocr").enabled:
        return "llm"
    return "none"


def ocr_status() -> dict:
    engine = pick_engine()
    return {"requested": settings.OCR_ENGINE, "engine": engine, "ready": engine != "none"}


def _tesseract(image_path: Path) -> List[OcrLine]:
    import pytesseract
    from PIL import Image

    with Image.open(image_path) as img:
        data = pytesseract.image_to_data(img.convert("RGB"), lang=settings.OCR_LANG, output_type=pytesseract.Output.DICT)
    lines: dict = {}
    for i, word in enumerate(data["text"]):
        word = (word or "").strip()
        try:
            conf = float(data["conf"][i])
        except (TypeError, ValueError):
            conf = -1
        if not word or conf < 0:
            continue
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        x, y, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
        entry = lines.setdefault(key, {"words": [], "box": [x, y, x + w, y + h], "conf": []})
        entry["words"].append(word)
        entry["conf"].append(conf / 100)
        b = entry["box"]
        entry["box"] = [min(b[0], x), min(b[1], y), max(b[2], x + w), max(b[3], y + h)]
    return [OcrLine(" ".join(e["words"]), [float(v) for v in e["box"]], sum(e["conf"]) / len(e["conf"]))
            for e in lines.values()]


def _llm_ocr(image_path: Path) -> List[OcrLine]:
    from app.services.ai_assist import _page_png

    model = get_llm("ocr")
    prompt = (
        "Read all text printed on this packaging image, line by line, in reading order. Copy it exactly. "
        "Do not correct, translate or guess; skip text you cannot read.\n"
        'Return JSON only: {"lines":[{"text":"","confidence":0.0}]}'
    )
    data = model.json(prompt, [_page_png(image_path.parent.parent, image_path.name)])
    out = []
    for item in (data.get("lines") or []) if isinstance(data, dict) else []:
        text = str(item.get("text") or "").strip() if isinstance(item, dict) else ""
        if text:
            # A model's own confidence is not measured the way an OCR engine's is: cap it so a human checks.
            out.append(OcrLine(text, None, min(float(item.get("confidence") or 0.5), 0.7)))
    return out


def read_image(image_path: Path) -> tuple[List[OcrLine], str, Optional[str]]:
    """Returns (lines, engine used, a plain note when nothing could be read)."""
    engine = pick_engine()
    if engine == "none":
        return [], "none", "no OCR engine is available (install Tesseract or enable the 'ocr' vision model)"
    try:
        lines = _tesseract(image_path) if engine == "tesseract" else _llm_ocr(image_path)
    except (LLMError, Exception) as err:  # a failed OCR must never break the upload
        logger.warning("OCR (%s) failed: %s", engine, err)
        return [], engine, f"{engine} OCR failed ({str(err).splitlines()[0][:80]})"
    return lines, engine, None if lines else "OCR found no readable text"
