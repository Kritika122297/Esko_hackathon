"""Application configuration for BriefForge."""

from pathlib import Path
import os
from typing import List, Set

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BASE_DIR.parent

load_dotenv(dotenv_path=BASE_DIR / ".env")


class Settings:
    PROJECT_NAME: str = "BriefForge API"
    VERSION: str = "2.0.0"
    DESCRIPTION: str = (
        "Turns packaging artwork, content sheets and notes into a checked, "
        "source-linked design brief. AI reads and suggests. Code checks. Humans decide."
    )

    # AI provider. "none" runs the full pipeline with deterministic code only.
    #   gemini            -> Google AI Studio key (google-genai SDK)
    #   openai_compatible -> any OpenAI-style /chat/completions endpoint
    #                        (Groq, OpenRouter, Together, local Ollama, OpenAI ...)
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "none").strip().lower()
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "")
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "")
    LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "4096"))
    LLM_TIMEOUT_S: float = float(os.getenv("LLM_TIMEOUT_S", "90"))

    # OCR for images and scanned PDF pages: auto | tesseract | llm | none
    OCR_ENGINE: str = os.getenv("OCR_ENGINE", "auto").strip().lower()
    TESSERACT_CMD: str = os.getenv("TESSERACT_CMD", "")
    OCR_LANG: str = os.getenv("OCR_LANG", "eng")
    OCR_MIN_CONFIDENCE: float = float(os.getenv("OCR_MIN_CONFIDENCE", "0.6"))

    UPLOAD_DIR: Path = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads"))).resolve()
    EXPORT_DIR: Path = Path(os.getenv("EXPORT_DIR", str(BASE_DIR / "exports"))).resolve()
    SAMPLES_DIR: Path = Path(os.getenv("SAMPLES_DIR", str(REPO_DIR / "samples"))).resolve()

    ALLOWED_EXTENSIONS: Set[str] = {"pdf", "xlsx", "docx", "txt", "md", "png", "jpg", "jpeg"}
    MAX_FILE_SIZE_BYTES: int = 50 * 1024 * 1024

    # Page renders used by the artwork viewer (and by vision models when enabled)
    RENDER_DPI: int = int(os.getenv("RENDER_DPI", "144"))

    CORS_ORIGINS: List[str] = [
        o.strip()
        for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if o.strip()
    ]

    def ensure_directories(self) -> None:
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        self.EXPORT_DIR.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_directories()
