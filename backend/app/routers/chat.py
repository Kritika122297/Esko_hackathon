"""Ask questions about one brief, and apply the changes the assistant prepares. The conversation is saved with
the brief.

Locks: the conversation has its own lock, so a slow AI reply does not hold up edits to the brief. Work on the
brief itself (previews, applying an action) also takes the brief's lock, always after the conversation's.
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.routers import chat_actions
from app.routers.common import SessionView, load
from app.services.chat import ChatAction, ChatAnswer, ChatMessage, ChatTurn, answer
from app.services.pipeline import now
from app.session_store import store

router = APIRouter(prefix="/sessions", tags=["Chat"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)


class ActionResult(BaseModel):
    action: ChatAction
    view: Optional[SessionView] = Field(None, description="The brief after the change; empty when it did not run")


def _history(sid: str) -> List[ChatMessage]:
    return [ChatMessage.model_validate(m) for m in store.load_chat(sid)]


def _save(sid: str, history: List[ChatMessage]) -> None:
    store.save_chat(sid, [m.model_dump() for m in history[-200:]])


@router.get("/{sid}/chat", response_model=List[ChatMessage])
def get_chat(sid: str) -> List[ChatMessage]:
    load(sid)
    return _history(sid)


@router.post("/{sid}/chat", response_model=ChatAnswer)
def chat(sid: str, req: ChatRequest) -> ChatAnswer:
    with store.lock(f"chat-{sid}"):
        state, _, _ = load(sid)
        history = _history(sid)
        question = req.message.strip()
        reply = answer(state, question, [ChatTurn(role=m.role, text=m.text) for m in history])
        if reply.proposals:
            with store.lock(sid):  # the preview reads the brief; nothing in it changes
                state, ctx, _ = load(sid)
                reply.actions, rejected = chat_actions.build(state, ctx, reply.proposals)
            if rejected:
                reply.answer += "\n\nNot prepared: " + "; ".join(rejected) + "."
            if not reply.actions and not rejected:
                reply.answer += "\n\nI could not prepare a change from that."
        history += [
            ChatMessage(role="user", text=question, at=now()),
            ChatMessage(role="assistant", text=reply.answer, at=now(), scope=reply.scope, citations=reply.citations,
                        suggestions=reply.suggestions, actions=reply.actions),
        ]
        _save(sid, history)
        return reply


def _find(history: List[ChatMessage], aid: str) -> Tuple[ChatMessage, ChatAction]:
    for m in reversed(history):
        for a in m.actions:
            if a.id == aid:
                return m, a
    raise HTTPException(status_code=404, detail="That change is no longer in the conversation.")


@router.post("/{sid}/chat/actions/{aid}/apply", response_model=ActionResult)
def apply_action(sid: str, aid: str) -> ActionResult:
    """Runs a prepared change. It is checked again against the brief as it is now, because things may have
    changed since it was prepared; a change that no longer fits is marked failed with the reason."""
    with store.lock(f"chat-{sid}"):
        load(sid)
        history = _history(sid)
        _, action = _find(history, aid)
        if action.status != "proposed":
            raise HTTPException(status_code=409, detail=f"This change was already {action.status}.")
        view: Optional[SessionView] = None
        try:
            view = chat_actions.execute(sid, action)
            action.status, action.result = "applied", "Applied and re-checked. Logged in the change log."
        except HTTPException as err:
            detail = err.detail if isinstance(err.detail, str) else (err.detail or {}).get("message", "It could not be applied.")
            action.status, action.result = "failed", str(detail)
        _save(sid, history)
        return ActionResult(action=action, view=view)


@router.post("/{sid}/chat/actions/{aid}/cancel", response_model=ActionResult)
def cancel_action(sid: str, aid: str) -> ActionResult:
    with store.lock(f"chat-{sid}"):
        load(sid)
        history = _history(sid)
        _, action = _find(history, aid)
        if action.status == "proposed":
            action.status, action.result = "cancelled", "Not applied."
            _save(sid, history)
        return ActionResult(action=action)


@router.delete("/{sid}/chat", status_code=204)
def clear_chat(sid: str) -> None:
    with store.lock(f"chat-{sid}"):
        load(sid)
        store.save_chat(sid, [])
