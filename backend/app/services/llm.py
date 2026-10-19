"""Provider-neutral JSON client for an optional multimodal LLM.

Supported: Google Gemini (google-genai) and any OpenAI-compatible /chat/completions API
(Groq, OpenRouter, Together, OpenAI, a local Ollama, ...). With LLM_PROVIDER=none the
app runs on deterministic code only.
"""

from __future__ import annotations

import base64
import json
import logging
import re
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


class LLM:
    def __init__(self) -> None:
        self.provider = settings.LLM_PROVIDER
        self.model = settings.LLM_MODEL or DEFAULT_MODELS.get(self.provider, "")
        self.key = settings.LLM_API_KEY
        self.base_url = (settings.LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/")

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
        if self.provider == "gemini":
            return self._gemini(prompt, images or [])
        return self._openai(prompt, images or [])

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
                "response_format": {"type": "json_object"}}
        headers = {"Authorization": f"Bearer {self.key}"} if self.key else {}
        with httpx.Client(timeout=settings.LLM_TIMEOUT_S) as http:
            r = http.post(f"{self.base_url}/chat/completions", json=body, headers=headers)
            if r.status_code == 400:  # some providers reject JSON mode with images
                body.pop("response_format")
                r = http.post(f"{self.base_url}/chat/completions", json=body, headers=headers)
            if r.status_code >= 400:
                raise LLMError(f"{r.status_code}: {r.text[:200]}")
            return _parse_json(r.json()["choices"][0]["message"]["content"])


llm = LLM()
