"""Ask questions about one brief. The conversation is saved with the brief."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.routers.common import load
from app.services.chat import ChatAnswer, ChatMessage, ChatTurn, answer
from app.services.pipeline import now
from app.session_store import store

router = APIRouter(prefix="/sessions", tags=["Chat"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)


def _history(sid: str) -> List[ChatMessage]:
    return [ChatMessage.model_validate(m) for m in store.load_chat(sid)]


@router.get("/{sid}/chat", response_model=List[ChatMessage])
def get_chat(sid: str) -> List[ChatMessage]:
    load(sid)
    return _history(sid)


@router.post("/{sid}/chat", response_model=ChatAnswer)
def chat(sid: str, req: ChatRequest) -> ChatAnswer:
    state, _, _ = load(sid)
    history = _history(sid)
    question = req.message.strip()
    reply = answer(state, question, [ChatTurn(role=m.role, text=m.text) for m in history])
    history += [
        ChatMessage(role="user", text=question, at=now()),
        ChatMessage(role="assistant", text=reply.answer, at=now(), citations=reply.citations, suggestions=reply.suggestions),
    ]
    store.save_chat(sid, [m.model_dump() for m in history[-200:]])
    return reply


@router.delete("/{sid}/chat", status_code=204)
def clear_chat(sid: str) -> None:
    load(sid)
    store.save_chat(sid, [])
