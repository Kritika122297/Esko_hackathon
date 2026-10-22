"""Session persistence: one folder per session with the files, renders and JSON state."""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import uuid
from contextlib import contextmanager
from pathlib import Path
from threading import Lock, RLock
from typing import Dict, Iterator, Optional, Tuple

from app.config import settings
from app.models.brief import BriefState
from app.models.extraction import Extraction
from app.services.checks import CheckContext

logger = logging.getLogger(__name__)

_SAFE_ID = re.compile(r"^[a-f0-9]{12}$")


def _write_atomic(path: Path, text: str) -> None:
    """Writes to a temporary file and swaps it in, so a crash never leaves a half-written state file."""
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def _add_new_fields(state: BriefState) -> None:
    """A brief saved before a field was added to the catalog gets it, empty, so it can be filled in."""
    from app.models.brief import BriefField
    from app.services.catalog import FIELDS

    have = {f.key for f in state.fields}
    for fd in FIELDS:
        if fd.key not in have:
            state.fields.append(BriefField(key=fd.key, label=fd.label, section=fd.section, mandatory=fd.mandatory,
                                           on_artwork=fd.on_artwork))


class SessionStore:
    def __init__(self, root: Path):
        self.root = root
        self._lock = RLock()
        self._cache: Dict[str, Tuple[BriefState, CheckContext, Extraction]] = {}
        self._session_locks: Dict[str, Lock] = {}
        self.broken: Dict[str, str] = {}  # session id -> why it could not be read

    def new_id(self) -> str:
        return uuid.uuid4().hex[:12]

    def dir(self, sid: str) -> Path:
        if not _SAFE_ID.match(sid):
            raise KeyError(sid)
        return self.root / sid

    @contextmanager
    def lock(self, sid: str) -> Iterator[None]:
        """One change at a time per brief. Cached states are shared objects mutated in place, so two requests
        on the same brief (a double click, an edit during an upload) must not interleave."""
        with self._lock:
            lk = self._session_locks.setdefault(sid, Lock())
        with lk:
            yield

    def save(self, state: BriefState, ctx: CheckContext, ex: Extraction) -> None:
        with self._lock:
            d = self.dir(state.session_id)
            d.mkdir(parents=True, exist_ok=True)
            _write_atomic(d / "context.json", ctx.model_dump_json())
            _write_atomic(d / "extraction.json", ex.model_dump_json())
            _write_atomic(d / "state.json", state.model_dump_json(indent=1))  # last: it marks the session complete
            self._cache[state.session_id] = (state, ctx, ex)
            self.broken.pop(state.session_id, None)

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
            try:
                state = BriefState.model_validate(json.loads((d / "state.json").read_text(encoding="utf-8")))
                ctx = CheckContext.model_validate(json.loads((d / "context.json").read_text(encoding="utf-8")))
                ex = Extraction.model_validate(json.loads((d / "extraction.json").read_text(encoding="utf-8")))
            except (OSError, ValueError) as err:  # damaged or from an incompatible version: skip, do not break others
                logger.warning("Session %s could not be read: %s", sid, str(err)[:200])
                self.broken[sid] = "The saved brief is damaged or from an older version and cannot be opened."
                return None
            _add_new_fields(state)
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
            _write_atomic(self.dir(sid) / "chat.json", json.dumps(messages, ensure_ascii=False))

    def list_ids(self) -> list[str]:
        if not self.root.exists():
            return []
        return [d.name for d in self.root.iterdir() if d.is_dir() and _SAFE_ID.match(d.name) and (d / "state.json").exists()]

    def delete(self, sid: str) -> None:
        with self._lock:
            self._cache.pop(sid, None)
            self.broken.pop(sid, None)
            shutil.rmtree(self.dir(sid), ignore_errors=True)


store = SessionStore(settings.UPLOAD_DIR)
