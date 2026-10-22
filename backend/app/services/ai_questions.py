"""AI question wording: the AI only rephrases; code decides which questions exist and what the answers are.

The model sees each open question (text, reason, owner, field names) and returns plainer wording.
Code keeps a rewrite only if it is non-empty, short enough and still contains every number from the original.
Options, answers and field updates are never touched. The original wording is kept for transparency.
"""

from __future__ import annotations

import re
from typing import Dict, List

from app.models.brief import BriefState, Question
from app.services.checks import CheckContext
from app.services.llm import get_llm

MAX_QUESTIONS = 12


def _numbers(text: str) -> set:
    return set(re.findall(r"\d+(?:\.\d+)?", text or ""))


def build_prompt(state: BriefState, questions: List[Question]) -> str:
    labels = {f.key: f.label for f in state.fields}
    rows = "\n".join(
        f'- id={q.id} | owner={q.owner} | fields={", ".join(labels.get(k, k) for k in q.fields)}\n'
        f"  question: {q.question}\n  why: {q.why}" for q in questions)
    return (
        "You edit questions in a packaging design brief so the person who must answer understands them at once. "
        "Rewrite each question and its reason in your own words: plain, friendly English, in the voice of a colleague "
        "asking the named owner for help. Never copy the input text. Keep every number, unit and field name exactly. "
        "Do not add facts, do not answer the question, do not change its meaning. "
        "Question: one short sentence. Why: at most two short sentences, even if the input reason is long.\n"
        'Return JSON only: {"questions":[{"id":"","question":"","why":""}]}\n\nQUESTIONS:\n' + rows)


def validate_rewrites(data, questions: List[Question]) -> Dict[str, Dict[str, str]]:
    """qid -> {orig, question, why}, only for rewrites that pass the checks."""
    by_id = {q.id: q for q in questions}
    out: Dict[str, Dict[str, str]] = {}
    items = data.get("questions") if isinstance(data, dict) else None
    for item in items or []:
        if not isinstance(item, dict) or item.get("id") not in by_id:
            continue
        q = by_id[item["id"]]
        new_q, new_why = str(item.get("question") or "").strip(), str(item.get("why") or "").strip()
        if not new_q or not new_why or len(new_q) > 240 or len(new_why) > 420:
            continue
        if not _numbers(q.question + " " + q.why) <= _numbers(new_q + " " + new_why):
            continue  # a number from the original is gone: do not trust the rewrite
        if new_q == q.question and new_why == q.why:
            continue  # nothing changed: not worth a tag
        out[q.id] = {"orig": q.question, "question": new_q, "why": new_why}
    return out


def apply_rewrites(questions: List[Question], saved: CheckContext) -> None:
    """Use stored rewrites, only while the question's own wording is still the one that was rewritten."""
    for q in questions:
        rw = saved.question_text.get(q.id)
        if rw and rw["orig"] == q.question:
            q.original_question, q.question, q.why, q.ai_worded = q.question, rw["question"], rw["why"], True


def reword_questions(state: BriefState, saved: CheckContext) -> int:
    model = get_llm("questions")
    todo = [q for q in state.questions if q.id not in saved.question_text and not q.ai_worded]
    todo.sort(key=lambda q: q.priority != "must_answer")
    todo = todo[:MAX_QUESTIONS]
    if not model.enabled or not todo:
        return 0
    found = validate_rewrites(model.json(build_prompt(state, todo)), todo)
    saved.question_text.update(found)
    apply_rewrites(state.questions, saved)
    return len(found)
