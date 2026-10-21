"""Where AI genuinely helps: reading the rendered print, and a second opinion on claims.

Every AI output is validated by code before use:
* readings must name a known field; they only ever add an alternative candidate
  (shown as 'AI vision reading'), never overwrite a value;
* review findings must cite existing fields and quote text that really is in them;
* AI findings are always 'needs human check' and never blocking.
"""

from __future__ import annotations

import io
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List

from app.models.brief import AIStatus, BriefState, Candidate, Issue, SourceRef
from app.models.extraction import Extraction
from app.services.catalog import FIELD_BY_KEY
from app.services.checks import CheckContext
from app.services.ai_questions import reword_questions
from app.services.ai_rules import quote_found, rule_review
from app.services.llm import LLMError, any_enabled, get_llm, llm
from app.services.values import comparable, norm_text, plural

logger = logging.getLogger(__name__)

VISION_FIELDS = ("statement_of_identity", "net_weight", "serving_size", "servings_per_package", "calories",
                 "total_fat", "saturated_fat", "trans_fat", "cholesterol", "sodium", "total_carbohydrate",
                 "dietary_fiber", "total_sugars", "added_sugars", "protein", "ingredients", "allergen_statement",
                 "dietary_info", "producer")
OWNERS = {"Legal", "R&D", "Brand", "Agency", "Supply Chain"}


def _page_png(session_dir: Path, image_name: str, max_side: int = 2048) -> bytes:
    from PIL import Image

    with Image.open(session_dir / "renders" / image_name) as img:
        img = img.convert("RGB")
        img.thumbnail((max_side, max_side))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()


def _short_error(err: Exception) -> str:
    """A plain one-line reason for the UI, without raw provider payloads."""
    text = str(err)
    for code, reason in (("503", "the AI provider is busy (503)"), ("429", "the AI quota is used up for now (429)"),
                         ("401", "the API key was rejected (401)"), ("403", "the API key has no access (403)"),
                         ("404", "the model is not available to this key (404)")):
        if code in text:
            return reason
    return text.split("{")[0].strip()[:90] or err.__class__.__name__


def run_ai(state: BriefState, saved: CheckContext, ex: Extraction, session_dir: Path) -> None:
    state.ai = AIStatus(provider=llm.provider, model=llm.model or None, enabled=llm.enabled)
    if not any_enabled():
        state.ai.notes.append("AI is switched off: all values come from document text and all checks are code. "
                              "The visual cross-check of the printed artwork did not run.")
        return
    # The two calls are independent: the review reads values and code findings,
    # the vision check only appends alternative candidates. Run them side by side.
    proposed: dict = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        vision = pool.submit(vision_crosscheck, state, saved, ex, session_dir)
        review = pool.submit(claims_review, state, saved)
        rules = pool.submit(rule_review, state, saved)
    try:
        proposed["rules"] = rules.result()
    except (LLMError, Exception) as err:
        logger.warning("Rule review failed: %s", err)
        state.ai.notes.append(f"AI rule review did not run: {_short_error(err)}.")
    try:
        n = vision.result()
        if n is not None:
            state.ai.used_for.append(f"Read the rendered artwork and compared {n} printed values with the file text")
    except (LLMError, Exception) as err:  # AI failure must never break the brief
        logger.warning("Vision cross-check failed: %s", err)
        state.ai.notes.append(f"Vision cross-check did not run: {_short_error(err)}. Values rely on the file text only.")
    try:
        proposed["claims"] = review.result()
    except (LLMError, Exception) as err:
        logger.warning("Claims review failed: %s", err)
        state.ai.notes.append(f"AI claims review did not run: {_short_error(err)}.")
    from app.services.pipeline import recompute  # re-check so duplicates are merged and questions exist

    recompute(state, saved)
    for key, check, text in (("rules", "ai.rules", f"Checked the brief against {state.market} label rules"),
                             ("claims", "ai.review", "Second opinion on claims and wording")):
        if key in proposed:
            shown = sum(1 for i in state.issues if i.check == check)
            state.ai.used_for.append(f"{text}: {proposed[key]} point(s) passed code validation, {shown} new after merging "
                                     "with code findings")
    try:
        if get_llm("questions").enabled:
            n = reword_questions(state, saved)
            if n:
                state.ai.used_for.append(f"Reworded {plural(n, 'question')} in plain language (options and answers stay code-made)")
    except (LLMError, Exception) as err:
        logger.warning("Question wording failed: %s", err)
        state.ai.notes.append(f"AI question wording did not run: {_short_error(err)}.")


def vision_crosscheck(state: BriefState, saved: CheckContext, ex: Extraction, session_dir: Path):
    pdf_pages = [p for p in ex.pages if p.file.lower().endswith(".pdf")]
    if not pdf_pages:
        return None
    page = pdf_pages[0]
    rows: List[str] = []
    anchors = {}
    for key in VISION_FIELDS:
        f = state.field(key)
        pdf = next((c for c in (f.candidates if f else []) if c.source.kind == "pdf"), None)
        if pdf is None:
            continue
        anchors[key] = pdf
        where = (pdf.source.panel or "").replace("_", " ")
        rows.append(f"- {key} ({FIELD_BY_KEY[key].label}, {where}): text layer says '{pdf.value[:300]}'")
    prompt = (
        "You are checking packaging artwork for a design brief. The image is the flat dieline of a carton.\n"
        "For each field below, read what is VISIBLY PRINTED at that place in the image and copy it exactly.\n"
        "If you cannot read it clearly, use null. Never guess or correct values.\n"
        "Also report the digits printed under the barcode (or null) and any certification logos/badges that are\n"
        "images (e.g. 'USDA Organic', 'Certified Vegan').\n"
        'Return JSON only: {"readings":[{"field":"<key>","visible":"<text or null>","confidence":0.0}],'
        '"barcode_digits":null,"logos":[]}\n\nFIELDS:\n' + "\n".join(rows)
    )
    vision = get_llm("vision")
    if not vision.enabled:
        return None
    data = vision.json(prompt, [_page_png(session_dir, page.image)])
    agreed = 0
    for r in (data.get("readings") or []) if isinstance(data, dict) else []:
        key, seen = r.get("field"), r.get("visible")
        conf = float(r.get("confidence") or 0)
        if key not in anchors or not isinstance(seen, str) or not seen.strip() or conf < 0.6:
            continue
        f = state.field(key)
        if any(comparable(key, c.value) == comparable(key, seen) for c in f.candidates if c.source.kind == "pdf"):
            agreed += 1
            continue
        src = anchors[key].source.model_copy()
        src.kind, src.snippet, src.flagged = "ai", f"AI vision reading: {seen.strip()}", True
        f.candidates.append(Candidate(value=seen.strip(), source=src))
    digits = data.get("barcode_digits") if isinstance(data, dict) else None
    bc = state.field("barcode")
    if isinstance(digits, str) and bc and bc.value:
        if re.sub(r"\D", "", digits) == re.sub(r"\D", "", bc.value):
            saved.artwork.barcode_text_found = True
            bc.sources.append(SourceRef(file=page.file, kind="ai", page=page.page, snippet=f"AI vision reading: {digits}"))
        elif re.sub(r"\D", "", digits):
            bc.candidates.append(Candidate(value=digits, source=SourceRef(file=page.file, kind="ai", page=page.page,
                                                                         snippet=f"AI vision reading: {digits}", flagged=True)))
    for logo in (data.get("logos") or []) if isinstance(data, dict) else []:
        if isinstance(logo, str) and logo.strip():
            saved.artwork.claims.setdefault(logo.strip(), []).append(
                SourceRef(file=page.file, kind="ai", page=page.page, snippet=f"Logo seen by AI: {logo.strip()}"))
    state.ai.notes.append(f"Vision reading agreed with the file text on {plural(agreed, 'field')}.")
    return len(rows)


_ABSENCE = re.compile(r"\b(?:missing|absent|lack(?:s|ing)?|omitted|not (?:declared|stated|provided|listed|included|shown)|"
                      r"no [\w-]+(?: [\w-]+)? (?:statement|declaration|section|warning|disclosure)|without)\b", re.I)


def about_absence(title: str) -> bool:
    return bool(_ABSENCE.search(title or ""))


def claims_review(state: BriefState, saved: CheckContext) -> int:
    values = {f.key: f.value for f in state.fields if f.on_artwork and f.value}
    known = "\n".join(f"- {i.title}" for i in state.issues)
    prompt = (
        f"You review packaging copy for the {state.market} market. Below are the brief fields and the issues "
        "already found by rule-based checks. List up to 5 ADDITIONAL concerns about the claims and wording that "
        "ARE PRESENT in the text (for example a claim the ingredients contradict, or a misleading phrase). "
        "Do NOT report anything that is missing or absent, and do not list statements you think a pack should "
        "carry: required statements are checked separately against the real rules. Do not do arithmetic (code "
        "handles math). Skip anything already listed.\n"
        "Each concern must cite field keys from the list and quote the exact text it is about, copied word for word.\n"
        'Return JSON only: {"concerns":[{"title":"<5-9 word title>","description":"<one sentence: what is wrong and why>",'
        '"fields":["<key>"],"quote":"<exact text, without the key name>",'
        '"owner":"Legal|R&D|Brand|Agency|Supply Chain"}]}\n\n'
        f"FIELDS:\n{values}\n\nALREADY FOUND:\n{known}"
    )
    model = get_llm("claims")
    if not model.enabled:
        return 0
    data = model.json(prompt)
    added = 0
    for c in (data.get("concerns") or [])[:5] if isinstance(data, dict) else []:
        keys = [k for k in c.get("fields") or [] if k in values]
        quote = str(c.get("quote") or "")
        if not keys or not quote or not quote_found(quote, keys, values):
            continue  # unverifiable -> dropped
        title = str(c.get("title") or "AI review point")[:120]
        if about_absence(title):
            continue  # "something is missing" cannot be proven from a quote; required statements are the rule review's job
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40]
        saved.ai_issues.append(Issue(
            id=f"ai:{slug}", check="ai.review", severity="warning", kind="needs_human", category="ai_review",
            title=title, description=str(c.get("description") or "")[:600] + f" (Quoted: '{quote[:120]}')",
            fields=keys, evidence=[s for k in keys for s in state.field(k).sources[:1]],
            owner=c.get("owner") if c.get("owner") in OWNERS else "Legal", detected_by="ai",
        ))
        added += 1
    return added
