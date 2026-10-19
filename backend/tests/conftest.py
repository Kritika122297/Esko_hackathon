import os
import sys
from pathlib import Path

# Tests are deterministic and offline: never call the AI provider configured in .env.
os.environ["LLM_PROVIDER"] = "none"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
