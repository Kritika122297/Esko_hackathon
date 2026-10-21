import os
import sys
from pathlib import Path

# Tests are deterministic and offline: never call the AI provider configured in .env.
os.environ["LLM_PROVIDER"] = "none"
# .env holds real keys and per-role providers; blank every LLM setting (load_dotenv never overrides an existing
# variable) so no test can reach a provider.
for _name in ("API_KEY", "MODEL", "BASE_URL", "PROVIDER"):
    for _role in ("", "VISION_", "OCR_", "RULES_", "CLAIMS_", "QUESTIONS_", "CHAT_"):
        os.environ[f"LLM_{_role}{_name}"] = "none" if (_name, _role) == ("PROVIDER", "") else ""
os.environ["GEMINI_API_KEY"] = ""

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
