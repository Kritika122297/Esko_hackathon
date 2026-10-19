"""Helpers shared by the routers: loading sessions, applying edits, and the response shape."""

from __future__ import annotations

from typing import List, Optional, Tuple

from fastapi import HTTPException
from pydantic import BaseModel

from app.models.brief import BriefState, ChangeLogEntry, FieldChange, SourceRef
from app.models.extraction import Extraction, PageInfo, Panel
from app.services.checks import CheckContext
from app.services.merge import group_candidates
from app.services.pipeline import now, recompute
from app.services.values import comparable
from app.session_store import store


class PageView(PageInfo):
    url: str


class SessionView(BaseModel):
    state: BriefState
    pages: List[PageView]
    panels: List[Panel]


def view(state: BriefState, ex: Extraction) -> SessionView:
    pages = [PageView(**p.model_dump(), url=f"/api/sessions/{state.session_id}/pages/{p.image}") for p in ex.pages]
    return SessionView(state=state, pages=pages, panels=ex.panels)


def load(sid: str) -> Tuple[BriefState, CheckContext, Extraction]:
    loaded = store.load(sid)
    if loaded is None:
        raise HTTPException(status_code=404, detail=f"Session '{sid}' not found.")
    return loaded


def require_draft(state: BriefState) -> None:
    if state.status == "finalized":
        raise HTTPException(status_code=409, detail="The brief is finalized. Reopen it to make changes.")


def apply_edit(state: BriefState, key: str, value: str, by: str, reason: Optional[str], action: str = "edit") -> None:
    f = state.field(key)
    if f is None:
        raise HTTPException(status_code=404, detail=f"Unknown field '{key}'.")
    value = (value or "").strip()
    old = f.value
    f.history.append(FieldChange(at=now(), by=by, old=old, new=value or None, reason=reason))
    f.value = value or None
    f.user_confirmed = bool(value)
    matching = [g for g in group_candidates(key, f.candidates) if value and comparable(key, g[0].value) == comparable(key, value)]
    user_src = SourceRef(file="Reviewer", kind="user", snippet=value, note=reason)
    f.sources = [user_src] + ([c.source for c in matching[0]] if matching else [])
    state.change_log.append(ChangeLogEntry(at=now(), by=by, action=action, field=key, old=old, new=value or None,
                                           note=reason))


def restore_decisions(state: BriefState, old: BriefState) -> int:
    """Carries reviewer-confirmed values and their history onto a freshly re-read brief."""
    kept = 0
    for of in old.fields:
        f = state.field(of.key)
        if f is None or not of.user_confirmed or not of.value:
            continue
        f.value = of.value
        f.user_confirmed = True
        f.history = list(of.history)
        matching = [g for g in group_candidates(f.key, f.candidates) if comparable(f.key, g[0].value) == comparable(f.key, of.value)]
        f.sources = [SourceRef(file="Reviewer", kind="user", snippet=of.value)] + ([c.source for c in matching[0]] if matching else [])
        kept += 1
    return kept


def save_and_view(state: BriefState, ctx: CheckContext, ex: Extraction) -> SessionView:
    recompute(state, ctx)
    store.save(state, ctx, ex)
    return view(state, ex)
