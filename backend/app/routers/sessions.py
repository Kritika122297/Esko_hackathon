"""Creating, listing and deleting briefs (projects), and serving page renders."""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.config import settings
from app.models.brief import BriefState, ChangeLogEntry, FileInfo
from app.routers.common import SessionView, load, restore_decisions, save_and_view, view
from app.services.ai_assist import run_ai
from app.services.pipeline import analyze, now, read_files, recompute
from app.session_store import store

router = APIRouter(prefix="/sessions", tags=["Sessions"])

CaseT = Literal["update", "new_market", "new_product"]


def _kind(name: str) -> str:
    ext = Path(name).suffix.lower().lstrip(".")
    return {"pdf": "artwork", "xlsx": "content sheet", "docx": "document", "txt": "notes", "md": "notes"}.get(ext, "image")


def _create(paths: List[Path], case: str, market: str, category: str = "food", standards: Optional[List[str]] = None,
            company: Optional[List] = None) -> SessionView:
    sid = store.new_id()
    d = store.dir(sid)
    d.mkdir(parents=True, exist_ok=True)
    stamp = now()
    state = BriefState(session_id=sid, created_at=stamp, updated_at=stamp, case=case, market=market.upper(),
                       category=(category or "food").lower(), standards=standards or [],
                       company_clauses=company or [])
    pairs = [(p, p.name) for p in paths]
    ex = read_files(pairs, d)
    for p in paths:
        pages = sum(1 for pg in ex.pages if pg.file == p.name) or None
        state.files.append(FileInfo(name=p.name, kind=_kind(p.name), size=p.stat().st_size, pages=pages))
    ctx = analyze(state, ex)
    recompute(state, ctx)  # code checks first, so the AI review only adds new points
    run_ai(state, ctx, ex, d)
    return save_and_view(state, ctx, ex)


class ProjectSummary(BaseModel):
    session_id: str
    product_name: str
    market: str
    case: str
    status: str
    created_at: str
    updated_at: str
    files: List[str]
    readiness: Optional[int] = None
    blocking_open: Optional[int] = None
    questions_open: Optional[int] = None


@router.get("", response_model=List[ProjectSummary])
def list_projects() -> List[ProjectSummary]:
    """Every brief on this server, most recently changed first."""
    out: List[ProjectSummary] = []
    for sid in store.list_ids():
        loaded = store.load(sid)
        if loaded is None:
            continue
        st = loaded[0]
        out.append(ProjectSummary(
            session_id=st.session_id, product_name=st.product_name, market=st.market, case=st.case,
            status=st.status, created_at=st.created_at, updated_at=st.updated_at, files=[f.name for f in st.files],
            readiness=st.readiness.score if st.readiness else None,
            blocking_open=st.readiness.blocking_open if st.readiness else None,
            questions_open=len(st.questions),
        ))
    out.sort(key=lambda p: p.updated_at, reverse=True)
    return out


@router.delete("/{sid}", status_code=204)
def delete_project(sid: str) -> None:
    load(sid)
    store.delete(sid)


def _save_uploads(files: List[UploadFile], into: Path) -> List[Path]:
    saved: List[Path] = []
    for up in files:
        name = Path(up.filename or "file").name
        ext = Path(name).suffix.lower().lstrip(".")
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"'{name}': .{ext} files are not supported.")
        dst = into / name
        with open(dst, "wb") as out:
            shutil.copyfileobj(up.file, out)
        if dst.stat().st_size > settings.MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=413, detail=f"'{name}' is larger than 50 MB.")
        saved.append(dst)
    return saved


def _same_files(paths: List[Path]) -> Optional[BriefState]:
    """An existing brief built from exactly these files (same names and sizes), if any."""
    wanted = sorted((p.name, p.stat().st_size) for p in paths)
    for sid in store.list_ids():
        loaded = store.load(sid)
        if loaded and sorted((f.name, f.size) for f in loaded[0].files) == wanted:
            return loaded[0]
    return None


def _company_clauses(raw: str, filename: str) -> list:
    """Accepted rulebook rules sent by the upload form; each is re-checked against the catalog."""
    import json

    from app.services.rulebook import to_clauses

    try:
        accepted = json.loads(raw) if raw else []
    except ValueError:
        raise HTTPException(status_code=400, detail="The company rules could not be read.")
    return to_clauses(accepted if isinstance(accepted, list) else [], filename or "rulebook")


@router.post("", response_model=SessionView, status_code=201)
async def create_session(
    files: List[UploadFile] = File(...),
    case: CaseT = Form("update"),
    market: str = Form("US"),
    category: str = Form("food"),
    standards: str = Form(""),
    company_rules: str = Form(""),
    company_file: str = Form(""),
    allow_duplicate: bool = Form(False),
) -> SessionView:
    if not files:
        raise HTTPException(status_code=400, detail="Upload at least one file.")
    sid_tmp = store.new_id()
    tmp = settings.UPLOAD_DIR / f"_incoming_{sid_tmp}"
    tmp.mkdir(parents=True, exist_ok=True)
    try:
        saved = _save_uploads(files, tmp)
        existing = None if allow_duplicate else _same_files(saved)
        if existing is not None:
            raise HTTPException(status_code=409, detail={
                "message": f"These files already have a brief: {existing.product_name}.",
                "existing": existing.session_id,
                "product_name": existing.product_name,
            })
        result = _create(saved, case, market, category, [s.strip() for s in standards.split(",") if s.strip()],
                         _company_clauses(company_rules, company_file))
        for s in saved:
            shutil.move(str(s), str(store.dir(result.state.session_id) / s.name))
        return result
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


@router.post("/{sid}/files", response_model=SessionView)
async def add_files(sid: str, files: List[UploadFile] = File(...)) -> SessionView:
    """Adds or replaces files in an existing brief, re-reads everything and keeps every human decision."""
    old, _, _ = load(sid)
    if not files:
        raise HTTPException(status_code=400, detail="Add at least one file.")
    d = store.dir(sid)
    added = _save_uploads(files, d)
    names = list(dict.fromkeys([f.name for f in old.files] + [p.name for p in added]))
    paths = [d / n for n in names if (d / n).exists()]

    state = BriefState(session_id=sid, created_at=old.created_at, updated_at=now(), case=old.case, market=old.market,
                       category=old.category, standards=list(old.standards), company_clauses=list(old.company_clauses),
                       acknowledgements=dict(old.acknowledgements), change_log=list(old.change_log))
    ex = read_files([(p, p.name) for p in paths], d)
    for p in paths:
        pages = sum(1 for pg in ex.pages if pg.file == p.name) or None
        state.files.append(FileInfo(name=p.name, kind=_kind(p.name), size=p.stat().st_size, pages=pages))
    ctx = analyze(state, ex)
    restored = restore_decisions(state, old)
    replaced = [p.name for p in added if p.name in {f.name for f in old.files}]
    note = f"Added {', '.join(p.name for p in added if p.name not in replaced) or 'no new files'}"
    if replaced:
        note += f"; replaced {', '.join(replaced)}"
    state.change_log.append(ChangeLogEntry(at=now(), by="Reviewer", action="files",
                                           note=f"{note}. Re-checked; {restored} reviewer decisions kept."))
    recompute(state, ctx)
    run_ai(state, ctx, ex, d)
    return save_and_view(state, ctx, ex)


@router.get("/{sid}", response_model=SessionView)
def get_session(sid: str) -> SessionView:
    state, _, ex = load(sid)
    return view(state, ex)


@router.get("/{sid}/pages/{image}")
def page_image(sid: str, image: str) -> FileResponse:
    load(sid)
    path = (store.dir(sid) / "renders" / Path(image).name)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Page image not found.")
    return FileResponse(path, media_type="image/png")
