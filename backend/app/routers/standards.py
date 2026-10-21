"""Label-rule packs: what can be selected and what a market and category will require."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services import guidelines, rulebook

router = APIRouter(prefix="/standards", tags=["Standards"])


def _selected(standards: Optional[str]) -> Optional[list]:
    return [s.strip() for s in standards.split(",") if s.strip()] if standards else None


@router.get("")
def options() -> dict:
    return {
        "markets": guidelines.market_options(),
        "categories": guidelines.category_options(),
        "standards": [{"standard": s.standard, "name": s.name, "status": s.status, "markets": s.ui_markets,
                       "categories": s.categories, "clauses": len(s.clauses)}
                      for s in guidelines.load_standards().values() if s.standard != "base"],
    }


@router.post("/company-rulebook")
async def company_rulebook(file: UploadFile = File(...)) -> dict:
    """Reads a company rulebook and proposes rules, each quoting the sentence it came from. Nothing is applied yet."""
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="The rulebook is larger than 8 MB.")
    try:
        text = rulebook.extract_text(data, file.filename or "rulebook.txt")
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    except Exception:
        raise HTTPException(status_code=400, detail="This file could not be read as a rulebook.")
    rules = rulebook.propose(text)
    return {"filename": file.filename, "characters": len(text), "rules": rules,
            "ai_used": any(r["method"] == "ai" for r in rules)}


@router.get("/applicable")
def applicable(market: str = "US", category: str = guidelines.DEFAULT_CATEGORY, standards: Optional[str] = None) -> dict:
    return guidelines.summary(market, category, _selected(standards))


@router.get("/checklist")
def checklist(market: str = "US", category: str = guidelines.DEFAULT_CATEGORY, standards: Optional[str] = None) -> dict:
    return {"fields": guidelines.checklist(market, category, _selected(standards)),
            **guidelines.summary(market, category, _selected(standards))}
