from app.services import chat
from test_sample_pack import client  # noqa: F401  (isolated session store)
from test_sample_pack_extra import _session


class FakeModel:
    def __init__(self, reply=None, fail=False, name="m"):
        self.provider, self.model, self.key, self.base_url = "fake", name, "k", ""
        self.reply, self.fail, self.prompts = reply, fail, []
        self.enabled = True

    def json(self, prompt, images=None, temperature=0):
        self.prompts.append(prompt)
        if self.fail:
            raise chat.LLMError("429: rate limited")
        return self.reply


def test_without_ai_a_general_question_gets_an_honest_reply_not_a_random_finding(client):
    sid = _session(client)
    a = client.post(f"/api/sessions/{sid}/chat", json={"message": "What does FDA stand for?"}).json()
    assert not a["citations"] and "not available" in a["answer"]
    hi = client.post(f"/api/sessions/{sid}/chat", json={"message": "hi there"}).json()
    assert hi["answer"].startswith("Hello")


def test_general_answers_are_allowed_and_marked_general(client, monkeypatch):
    sid = _session(client)
    model = FakeModel({"answer": "FDA is the US Food and Drug Administration.", "scope": "general"})
    monkeypatch.setattr(chat, "_models", lambda: [model])
    a = client.post(f"/api/sessions/{sid}/chat", json={"message": "What does FDA stand for?"}).json()
    assert a["answer"].startswith("FDA is") and a["scope"] == "general" and not a["citations"]
    assert "general knowledge" in model.prompts[0].lower()
    hist = client.get(f"/api/sessions/{sid}/chat").json()
    assert hist[-1]["scope"] == "general"


def test_falls_back_to_the_next_model_and_drops_unknown_citations(client, monkeypatch):
    sid = _session(client)
    busy = FakeModel(fail=True, name="a")
    ok = FakeModel({"answer": "Net weight is listed.", "scope": "general", "fields": ["net_weight", "made_up"]}, name="b")
    monkeypatch.setattr(chat, "_models", lambda: [busy, ok])
    a = client.post(f"/api/sessions/{sid}/chat", json={"message": "what is the net weight?"}).json()
    assert busy.prompts and ok.prompts
    assert [c["key"] for c in a["citations"]] == ["net_weight"] and a["scope"] == "both"
