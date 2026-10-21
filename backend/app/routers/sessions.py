"""Creating, listing and deleting briefs (projects), and serving page renders.

Uploads are plain (sync) routes: FastAPI runs them in a worker thread, so reading files and calling the AI
does not stall every other request.
"""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.config import settings
from app.models.brief import BriefState, ChangeLogEntry, FileInfo
from app.routers.common import SessionView, load, locked, require_draft, restore_decisions, save_and_view, view
from app.services.ai_assist import run_ai
from app.services.guidelines import category_labels, normalize_category
from app.services.pipeline import analyze, now, read_files, recompute
from app.session_store import store

router = APIRouter(prefix="/sessions", tags=["Sessions"])

CaseT = Literal["update", "new_market", "new_product"]


def _kind(name: str) -> str:
    ext = Path(name).suffix.lower().lstrip(".")
    return {"pdf": "artwork", "xlsx": "content sheet", "docx": "document", "txt": "notes", "md": "notes"}.get(ext, "image")


def _category(value: Optional[str]) -> str:
    """The category id for a form or request value (an id or its label). Unknown values are refused."""
    cid = normalize_category(value)
    if cid is None:
        raise HTTPException(status_code=400, detail=f"Unknown product category '{value}'. Choose one of: "
                                                    + ", ".join(category_labels().values()) + ".")
    return cid


def _create(sid: str, paths: List[Path], case: str, market: str, category: str = "food",
            standards: Optional[List[str]] = None, company: Optional[List] = None,
            source_market: Optional[str] = None, source_session_id: Optional[str] = None,
            name_override: Optional[str] = None, note: Optional[str] = None) -> SessionView:
    d = store.dir(sid)
    stamp = now()
    source = (source_market or "").strip().upper() or None
    state = BriefState(session_id=sid, created_at=stamp, updated_at=stamp, case=case, market=market.strip().upper(),
                       source_market=source if case == "new_market" else None, source_session_id=source_session_id,
                       name_override=name_override, category=category, standards=standards or [],
                       company_clauses=company or [])
    if note:
        state.change_log.append(ChangeLogEntry(at=stamp, by="Reviewer", action="duplicate", note=note))
    ex = read_files([(p, p.name) for p in paths], d)
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
    source_market: Optional[str] = None
    source_session_id: Optional[str] = None
    category: str = "food"
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
    """Every brief on this server, most recently changed first. A damaged brief is skipped, not fatal."""
    out: List[ProjectSummary] = []
    for sid in store.list_ids():
        loaded = store.load(sid)
        if loaded is None:
            continue
        st = loaded[0]
        out.append(ProjectSummary(
            session_id=st.session_id, product_name=st.product_name, market=st.market, source_market=st.source_market,
            source_session_id=st.source_session_id, category=st.category, case=st.case, status=st.status, created_at=st.created_at, updated_at=st.updated_at,
            files=[f.name for f in st.files], readiness=st.readiness.score if st.readiness else None,
            blocking_open=st.readiness.blocking_open if st.readiness else None, questions_open=len(st.questions),
        ))
    out.sort(key=lambda p: p.updated_at, reverse=True)
    return out


@router.delete("/{sid}", status_code=204)
def delete_project(sid: str) -> None:
    with store.lock(sid):
        if store.load(sid) is None and sid not in store.broken:
            load(sid)  # raises 404
        store.delete(sid)  # a damaged brief can still be deleted


def _check_names(files: List[UploadFile]) -> List[str]:
    """Validates the whole batch before anything is written."""
    if not files:
        raise HTTPException(status_code=400, detail="Upload at least one file.")
    if len(files) > settings.MAX_FILES_PER_UPLOAD:
        raise HTTPException(status_code=400, detail=f"Upload at most {settings.MAX_FILES_PER_UPLOAD} files at a time.")
    names: List[str] = []
    for up in files:
        name = Path(up.filename or "file").name
        ext = Path(name).suffix.lower().lstrip(".")
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"'{name}': .{ext} files are not supported.")
        if name.lower() in {n.lower() for n in names}:
            raise HTTPException(status_code=400, detail=f"Two files are named '{name}'. Rename one and upload again.")
        names.append(name)
    return names


def _save_uploads(files: List[UploadFile], into: Path) -> List[Path]:
    """Copies uploads into a staging folder, stopping as soon as a file passes the size limit."""
    limit = settings.MAX_FILE_SIZE_BYTES
    saved: List[Path] = []
    for up, name in zip(files, _check_names(files)):
        dst = into / name
        size = 0
        with open(dst, "wb") as out:
            while chunk := up.file.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(status_code=413, detail=f"'{name}' is larger than {limit // (1024 * 1024)} MB.")
                out.write(chunk)
        saved.append(dst)
    return saved


def _same_files(paths: List[Path]) -> Optional[BriefState]:
    """An existing brief built from exactly these files (same names and sizes), if any."""
    wanted = sorted((p.name, p.stat().st_size) for p in paths)
    for sid in store.list_ids():
        loaded = store.load(sid)  # a damaged brief returns None and is skipped
        if loaded and sorted((f.name, f.size) for f in loaded[0].files) == wanted:
            return loaded[0]
    return None


def _company_clauses(raw: str, filename: str) -> list:
    """Accepted rulebook rules sent by the upload form; each is re-checked against the catalog."""
    from app.services.rulebook import to_clauses

    try:
        accepted = json.loads(raw) if raw else []
    except ValueError:
        raise HTTPException(status_code=400, detail="The company rules could not be read.")
    return to_clauses(accepted if isinstance(accepted, list) else [], filename or "rulebook")


@router.post("", response_model=SessionView, status_code=201)
def create_session(
    files: List[UploadFile] = File(...),
    case: CaseT = Form("update"),
    market: str = Form("US"),
    source_market: str = Form(""),
    category: str = Form("food"),
    standards: str = Form(""),
    company_rules: str = Form(""),
    company_file: str = Form(""),
    allow_duplicate: bool = Form(False),
) -> SessionView:
    _check_names(files)
    category = _category(category)
    company = _company_clauses(company_rules, company_file)
    tmp = settings.UPLOAD_DIR / f"_incoming_{store.new_id()}"
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
        sid = store.new_id()
        d = store.dir(sid)
        d.mkdir(parents=True)
        for s in saved:  # into the brief's folder before reading, so the saved brief always has its files
            shutil.move(str(s), str(d / s.name))
        try:
            return _create(sid, [d / s.name for s in saved], case, market, category,
                           [s.strip() for s in standards.split(",") if s.strip()], company, source_market)
        except Exception:
            shutil.rmtree(d, ignore_errors=True)  # no half-made brief left behind
            raise
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


@router.post("/{sid}/files", response_model=SessionView)
@locked
def add_files(sid: str, files: List[UploadFile] = File(...)) -> SessionView:
    """Adds or replaces files in an existing brief, re-reads everything and keeps every human decision."""
    old, _, _ = load(sid)
    require_draft(old)  # a finalized brief is reopened first, openly and on the record
    _check_names(files)
    d = store.dir(sid)
    staging = d / f"_incoming_{store.new_id()}"
    backup = d / f"_previous_{store.new_id()}"
    staging.mkdir()
    backup.mkdir()
    try:
        staged = _save_uploads(files, staging)  # every file is checked before any existing file is replaced
        for p in staged:
            if (d / p.name).exists():
                shutil.move(str(d / p.name), str(backup / p.name))
            shutil.move(str(p), str(d / p.name))
        added = [d / p.name for p in staged]
        try:
            return _reread(sid, old, added)
        except Exception:
            for p in added:  # put the brief's files back as they were
                if not (backup / p.name).exists():
                    p.unlink(missing_ok=True)
            for p in backup.iterdir():
                shutil.move(str(p), str(d / p.name))
            raise
    finally:
        shutil.rmtree(staging, ignore_errors=True)
        shutil.rmtree(backup, ignore_errors=True)


class DuplicateMarketRequest(BaseModel):
    target_market: str
    category: Optional[str] = None
    product_name_override: Optional[str] = None


EDITION = re.compile(r"\s*\([A-Z]{2,5} Edition\)$")


@router.post("/{sid}/duplicate-market", response_model=SessionView, status_code=201)
def duplicate_market(sid: str, req: DuplicateMarketRequest) -> SessionView:
    """Adapts an existing brief to another market as a new brief: the same files, read again against the new
    market's rules. The source brief is not changed. Decisions, sign-offs and the change log are not copied,
    because they were made for the other market; the new brief starts as a draft."""
    target = req.target_market.strip().upper()
    if not target:
        raise HTTPException(status_code=400, detail="Choose the market to adapt the brief to.")
    with store.lock(sid):  # files are copied while nobody changes the source
        source, _, _ = load(sid)
        if target == source.market.upper():
            raise HTTPException(status_code=400, detail=f"The brief is already for {target}. Choose another market.")
        category = _category(req.category) if req.category else source.category
        src_dir = store.dir(sid)
        files = [src_dir / f.name for f in source.files if (src_dir / f.name).is_file()]
        if not files:
            raise HTTPException(status_code=400, detail="The original files of this brief are no longer on the server, "
                                                        "so it cannot be duplicated. Upload them as a new brief.")
        new_sid = store.new_id()
        d = store.dir(new_sid)
        d.mkdir(parents=True)
        try:
            for p in files:
                shutil.copy2(p, d / p.name)
        except OSError:
            shutil.rmtree(d, ignore_errors=True)
            raise HTTPException(status_code=500, detail="The files could not be copied for the new brief.")
    name = (req.product_name_override or "").strip() or f"{EDITION.sub('', source.product_name)} ({target} Edition)"
    try:
        return _create(new_sid, [d / p.name for p in files], "new_market", target, category,
                       company=list(source.company_clauses), source_market=source.market, source_session_id=sid,
                       name_override=name[:120],
                       note=f"Duplicated from {source.product_name} ({sid}) to adapt {source.market} to {target}.")
    except Exception:
        shutil.rmtree(d, ignore_errors=True)  # no half-made brief left behind
        raise


def _reread(sid: str, old: BriefState, added: List[Path]) -> SessionView:
    d = store.dir(sid)
    names = list(dict.fromkeys([f.name for f in old.files] + [p.name for p in added]))
    paths = [d / n for n in names if (d / n).exists()]

    state = BriefState(session_id=sid, created_at=old.created_at, updated_at=now(), case=old.case, market=old.market,
                       source_market=old.source_market, source_session_id=old.source_session_id,
                       name_override=old.name_override, category=old.category, standards=list(old.standards),
                       company_clauses=list(old.company_clauses), acknowledgements=dict(old.acknowledgements),
                       change_log=list(old.change_log), answered_questions=list(old.answered_questions))
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
