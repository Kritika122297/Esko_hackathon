"""Autopilot trace: what the pipeline is doing, recorded as it happens.

Every event comes from a real step with its real duration and counts; call sites are one line
(`trace.event(...)`) or one `with trace.timed(...)` block. Outside a recording (for example when a brief is
re-checked after an edit) the helpers do nothing.

A Recorder per brief collects events. Recorders of briefs that are still being built live in a registry, so
`/trace` and `/trace/stream` can show them before the brief is saved; when the build ends the final events are
stored on the brief as `autopilot_trace`.
"""

from __future__ import annotations

import threading
import time
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Dict, Iterator, List, Optional

from app.models.brief import TraceEvent

_current: ContextVar[Optional["Recorder"]] = ContextVar("autopilot_trace", default=None)
_registry: Dict[str, "Recorder"] = {}
_lock = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


class Recorder:
    def __init__(self, sid: str):
        self.sid = sid
        self.events: List[TraceEvent] = []  # every event, 'running' ones included, in order
        self.status = "running"  # running | done | error
        self.error: Optional[str] = None
        self.cond = threading.Condition()
        self._once: set = set()
        self._seq = 0

    def add(self, ev: TraceEvent) -> None:
        with self.cond:
            self.events.append(ev)
            self.cond.notify_all()

    def finish(self, status: str = "done", error: Optional[str] = None) -> None:
        with self.cond:
            self.status, self.error = status, error
            self.cond.notify_all()

    def once(self, key: str) -> bool:
        """True the first time it is asked for `key` (per brief build)."""
        if key in self._once:
            return False
        self._once.add(key)
        return True

    def next_id(self, step: str) -> str:
        self._seq += 1
        return f"{step}-{self._seq}"

    def final_events(self) -> List[TraceEvent]:
        """Each step's last word: a 'running' event replaced by its result."""
        out: Dict[str, TraceEvent] = {}
        for ev in self.events:
            out[ev.id] = ev
        return list(out.values())


def register(sid: str) -> Recorder:
    rec = Recorder(sid)
    with _lock:
        # Keep the registry small: finished builds are stored on their brief.
        for old in [k for k, r in _registry.items() if r.status != "running"][:-20]:
            _registry.pop(old, None)
        _registry[sid] = rec
    return rec


def get(sid: str) -> Optional[Recorder]:
    with _lock:
        return _registry.get(sid)


@contextmanager
def recording(rec: Recorder) -> Iterator[Recorder]:
    token = _current.set(rec)
    try:
        yield rec
    finally:
        _current.reset(token)


def active() -> Optional[Recorder]:
    return _current.get()


def event(step: str, tool: str, status: str, message: str, detail: Optional[str] = None,
          citation: Optional[str] = None, duration_ms: int = 0, event_id: Optional[str] = None) -> None:
    rec = _current.get()
    if rec is None:
        return
    rec.add(TraceEvent(id=event_id or rec.next_id(step), timestamp=_now(), step=step, tool=tool, status=status,
                       message=message, detail=detail, citation=citation, duration_ms=int(duration_ms)))


class Timer:
    """A running step. `done()` records its result with the time since it started."""

    def __init__(self, step: str, tool: str, eid: Optional[str]):
        self.step, self.tool, self.eid = step, tool, eid
        self.started = time.perf_counter()
        self.finished = False

    @property
    def ms(self) -> int:
        return int((time.perf_counter() - self.started) * 1000)

    def done(self, status: str, message: str, detail: Optional[str] = None, citation: Optional[str] = None) -> None:
        self.finished = True
        event(self.step, self.tool, status, message, detail, citation, self.ms, self.eid)


@contextmanager
def timed(step: str, tool: str, running: str) -> Iterator[Timer]:
    """Records 'running' now and the result when the block ends (a failure is recorded, then re-raised)."""
    rec = _current.get()
    eid = rec.next_id(step) if rec else None
    if rec:
        event(step, tool, "running", running, event_id=eid)
    t = Timer(step, tool, eid)
    try:
        yield t
    except Exception as err:
        if not t.finished:
            t.done("warning", f"{tool} failed: {str(err)[:160] or err.__class__.__name__}")
        raise
    if not t.finished:
        t.done("ok", running.rstrip(".…") + ": done")
