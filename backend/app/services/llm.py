"""Provider-neutral JSON client for an optional multimodal LLM.

Supported: Google Gemini (google-genai) and any OpenAI-compatible /chat/completions API
(Groq, OpenRouter, Together, OpenAI, a local Ollama, ...). With LLM_PROVIDER=none the
app runs on deterministic code only.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import time
from typing import Any, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

DEFAULT_MODELS = {"gemini": "gemini-3.8-flash", "openai_compatible": "gpt-4o-mini"}


class LLMError(RuntimeError):
    pass


def _parse_json(text: str) -> Any:
    t = (text or "").strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t)
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}|\[.*\]", t, re.S)
        if m:
            return json.loads(m.group(0))
        raise LLMError("Model did not return JSON")


ROLES = ("vision", "ocr", "rules", "claims", "questions", "chat")


def _role_env(role: str, name: str) -> str:
    """LLM_<ROLE>_<NAME>. A role that names its own provider never inherits another provider's key or model;
    a role with no provider of its own uses the shared LLM_<NAME>."""
    own_provider = role != "default" and os.getenv(f"LLM_{role.upper()}_PROVIDER", "").strip()
    if own_provider:
        return os.getenv(f"LLM_{role.upper()}_{name}", "").strip()
    shared = os.getenv(f"LLM_{name}", "").strip()
    if not shared and name == "API_KEY":
        shared = os.getenv("GEMINI_API_KEY", "").strip()
    return shared


class LLM:
    """One model connection. A role (vision, rules, ...) can override the shared settings in .env."""

    def __init__(self, role: str = "default") -> None:
        self.role = role
        self.provider = (_role_env(role, "PROVIDER") or "none").lower()
        self.model = _role_env(role, "MODEL") or DEFAULT_MODELS.get(self.provider, "")
        self.key = _role_env(role, "API_KEY")
        self.base_url = (_role_env(role, "BASE_URL") or "https://api.openai.com/v1").rstrip("/")

    @property
    def enabled(self) -> bool:
        if self.provider == "gemini":
            return bool(self.key)
        if self.provider == "openai_compatible":
            return bool(self.key) or "localhost" in self.base_url or "127.0.0.1" in self.base_url
        return False

    def json(self, prompt: str, images: Optional[List[bytes]] = None) -> Any:
        if not self.enabled:
            raise LLMError("AI provider not configured")
        call = self._gemini if self.provider == "gemini" else self._openai
        for attempt in (1, 2):  # one retry for a busy provider or an empty/cut-off reply
            try:
                return call(prompt, images or [])
            except Exception as err:
                transient = any(code in str(err) for code in ("503", "429", "500", "502", "504"))                     or "did not return JSON" in str(err) or isinstance(err, (httpx.TimeoutException, httpx.TransportError))
                if attempt == 2 or not transient:
                    raise
                logger.info("LLM %s retrying after: %s", self.role, str(err)[:80])
                time.sleep(2)

    def _gemini(self, prompt: str, images: List[bytes]) -> Any:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self.key)
        parts: List[Any] = [types.Part.from_bytes(data=img, mime_type="image/png") for img in images]
        parts.append(prompt)
        resp = client.models.generate_content(
            model=self.model,
            contents=parts,
            config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0),
        )
        return _parse_json(resp.text or "")

    def _openai(self, prompt: str, images: List[bytes]) -> Any:
        content: List[dict] = [{"type": "text", "text": prompt}]
        for img in images:
            content.append({"type": "image_url",
                            "image_url": {"url": "data:image/png;base64," + base64.b64encode(img).decode()}})
        body = {"model": self.model, "temperature": 0, "messages": [{"role": "user", "content": content}],
                "response_format": {"type": "json_object"}, "max_tokens": settings.LLM_MAX_TOKENS}
        if "gpt-oss" in self.model:  # reasoning models: keep thinking short so the answer is not cut off
            body["reasoning_effort"] = "low"
        headers = {"Authorization": f"Bearer {self.key}"} if self.key else {}
        with httpx.Client(timeout=settings.LLM_TIMEOUT_S) as http:
            r = http.post(f"{self.base_url}/chat/completions", json=body, headers=headers)
            if r.status_code == 400:  # some providers reject JSON mode with images
                body.pop("response_format")
                r = http.post(f"{self.base_url}/chat/completions", json=body, headers=headers)
            if r.status_code >= 400:
                raise LLMError(f"{r.status_code}: {r.text[:200]}")
            return _parse_json(r.json()["choices"][0]["message"]["content"])


llm = LLM()  # the shared default connection
_by_role: dict = {}


def get_llm(role: str) -> LLM:
    """The connection for one job. Falls back to the shared settings when the role has none of its own."""
    if role not in _by_role:
        _by_role[role] = LLM(role)
    return _by_role[role]


def any_enabled() -> bool:
    return llm.enabled or any(get_llm(r).enabled for r in ROLES)
