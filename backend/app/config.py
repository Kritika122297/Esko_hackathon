"""Application configuration module for BriefForge."""

from pathlib import Path
import os
from typing import Set, List
from dotenv import load_dotenv

# Base directory for the backend
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file if it exists
env_path = BASE_DIR / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()


class Settings:
    """Settings configuration for BriefForge API."""

    PROJECT_NAME: str = "BriefForge API"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = (
        "AI assistant backend that transforms messy product information, "
        "dieline PDFs, and ingredient sheets into structured packaging design briefs."
    )

    # Gemini API Configuration
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # Storage Paths
    UPLOAD_DIR: Path = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads"))).resolve()
    EXPORT_DIR: Path = Path(os.getenv("EXPORT_DIR", str(BASE_DIR / "exports"))).resolve()

    # Allowed Upload File Extensions
    ALLOWED_EXTENSIONS: Set[str] = {
        "pdf",
        "xlsx",
        "xls",
        "docx",
        "doc",
        "png",
        "jpg",
        "jpeg",
        "webp",
    }

    # Max File Size: 50MB
    MAX_FILE_SIZE_BYTES: int = 50 * 1024 * 1024

    # CORS settings
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
    ]

    def ensure_directories(self) -> None:
        """Create necessary working directories if they don't exist."""
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        self.EXPORT_DIR.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_directories()
