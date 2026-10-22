from pathlib import Path

from PIL import Image

from app.services import file_parser, ocr
from app.services.ocr import OcrLine


def _png(tmp_path) -> Path:
    p = tmp_path / "scan.png"
    Image.new("RGB", (400, 200), "white").save(p)
    return p


def test_image_without_engine_keeps_page_and_says_nothing_was_read(tmp_path, monkeypatch):
    monkeypatch.setattr(ocr, "pick_engine", lambda: "none")
    ex = file_parser.parse_image(_png(tmp_path), "scan.png", tmp_path)
    assert ex.pages and not ex.fragments
    assert any("no text layer" in n for n in ex.notes)


def test_image_ocr_lines_become_flagged_fragments(tmp_path, monkeypatch):
    monkeypatch.setattr(ocr, "pick_engine", lambda: "tesseract")
    monkeypatch.setattr(ocr, "_tesseract", lambda p: [OcrLine("NET WT 12 OZ", [10, 20, 110, 40], 0.95),
                                                     OcrLine("Wheat flour", [10, 60, 90, 80], 0.3)])
    ex = file_parser.parse_image(_png(tmp_path), "scan.png", tmp_path)
    assert [f.text for f in ex.fragments] == ["NET WT 12 OZ", "Wheat flour"]
    assert ex.fragments[0].ocr == "tesseract" and ex.fragments[1].ocr_conf == 0.3
    assert any("low confidence" in n for n in ex.notes)

    from app.services.extract_fields import pdf_source
    assert not pdf_source([ex.fragments[0]]).flagged
    assert pdf_source([ex.fragments[1]]).flagged


def test_engine_failure_never_breaks_upload(tmp_path, monkeypatch):
    monkeypatch.setattr(ocr, "pick_engine", lambda: "tesseract")
    def boom(p): raise RuntimeError("tesseract is not installed")
    monkeypatch.setattr(ocr, "_tesseract", boom)
    ex = file_parser.parse_image(_png(tmp_path), "scan.png", tmp_path)
    assert ex.pages and any("OCR failed" in n for n in ex.notes)


def test_per_role_llm_does_not_inherit_other_provider_key(monkeypatch):
    from app.services.llm import LLM
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("LLM_API_KEY", "gemini-key")
    monkeypatch.setenv("LLM_RULES_PROVIDER", "openai_compatible")
    monkeypatch.setenv("LLM_RULES_BASE_URL", "https://api.groq.com/openai/v1")
    rules, chat = LLM("rules"), LLM("chat")
    assert rules.provider == "openai_compatible" and rules.key == "" and not rules.enabled
    assert chat.provider == "gemini" and chat.key == "gemini-key" and chat.enabled
