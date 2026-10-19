"""Session persistence: one folder per session with the files, renders and JSON state."""

from __future__ import annotations

import json
import re
import shutil
import uuid
from pathlib import Path
from threading import RLock
from typing import Dict, Optional, Tuple

from app.config import settings
from app.models.brief import BriefState
from app.models.extraction import Extraction
from app.services.checks import CheckContext

_SAFE_ID = re.compile(r"^[a-f0-9]{12}$")


class SessionStore:
    def __init__(self, root: Path):
        self.root = root
        self._lock = RLock()
        self._cache: Dict[str, Tuple[BriefState, CheckContext, Extraction]] = {}

    def new_id(self) -> str:
        return uuid.uuid4().hex[:12]

    def dir(self, sid: str) -> Path:
        if not _SAFE_ID.match(sid):
            raise KeyError(sid)
        return self.root / sid

    def save(self, state: BriefState, ctx: CheckContext, ex: Extraction) -> None:
        with self._lock:
            d = self.dir(state.session_id)
            d.mkdir(parents=True, exist_ok=True)
            (d / "state.json").write_text(state.model_dump_json(indent=1), encoding="utf-8")
            (d / "context.json").write_text(ctx.model_dump_json(), encoding="utf-8")
            (d / "extraction.json").write_text(ex.model_dump_json(), encoding="utf-8")
            self._cache[state.session_id] = (state, ctx, ex)

    def load(self, sid: str) -> Optional[Tuple[BriefState, CheckContext, Extraction]]:
        with self._lock:
            if sid in self._cache:
                return self._cache[sid]
            try:
                d = self.dir(sid)
            except KeyError:
                return None
            if not (d / "state.json").exists():
                return None
            state = BriefState.model_validate(json.loads((d / "state.json").read_text(encoding="utf-8")))
            ctx = CheckContext.model_validate(json.loads((d / "context.json").read_text(encoding="utf-8")))
            ex = Extraction.model_validate(json.loads((d / "extraction.json").read_text(encoding="utf-8")))
            self._cache[sid] = (state, ctx, ex)
            return self._cache[sid]


    def load_chat(self, sid: str) -> list:
        path = self.dir(sid) / "chat.json"
        if not path.exists():
            return []
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return []

    def save_chat(self, sid: str, messages: list) -> None:
        with self._lock:
            (self.dir(sid) / "chat.json").write_text(json.dumps(messages, ensure_ascii=False), encoding="utf-8")

    def list_ids(self) -> list[str]:
        if not self.root.exists():
            return []
        return [d.name for d in self.root.iterdir() if d.is_dir() and _SAFE_ID.match(d.name) and (d / "state.json").exists()]

    def delete(self, sid: str) -> None:
        with self._lock:
            self._cache.pop(sid, None)
            shutil.rmtree(self.dir(sid), ignore_errors=True)


store = SessionStore(settings.UPLOAD_DIR)
