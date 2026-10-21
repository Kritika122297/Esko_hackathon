"""The assistant prepares changes; nothing happens until a person applies them."""

from app.services import chat
from test_chat import FakeModel
from test_sample_pack import client  # noqa: F401  (isolated session store)
from test_sample_pack_extra import _session


def _ask(c, sid, text):
    return c.post(f"/api/sessions/{sid}/chat", json={"message": text}).json()


def _field(c, sid, key):
    return next(f for f in c.get(f"/api/sessions/{sid}").json()["state"]["fields"] if f["key"] == key)


def test_a_change_is_only_proposed_until_applied(client):
    c = client
    sid = _session(c)
    before = _field(c, sid, "storage")["value"]
    reply = _ask(c, sid, "Set storage instructions to Store in a cool, dry place")
    assert len(reply["actions"]) == 1
    action = reply["actions"][0]
    assert action["type"] == "edit_field" and action["status"] == "proposed" and "storage" in action["label"].lower()
    assert action["impact"] is not None
    assert _field(c, sid, "storage")["value"] == before  # nothing changed yet

    r = c.post(f"/api/sessions/{sid}/chat/actions/{action['id']}/apply").json()
    assert r["action"]["status"] == "applied"
    f = next(x for x in r["view"]["state"]["fields"] if x["key"] == "storage")
    assert f["value"] == "Store in a cool, dry place" and f["user_confirmed"]
    assert r["view"]["state"]["change_log"][-1]["note"] == "Requested in the assistant"
    # The conversation remembers it, and it cannot run twice.
    saved = c.get(f"/api/sessions/{sid}/chat").json()[-1]["actions"][0]
    assert saved["status"] == "applied"
    assert c.post(f"/api/sessions/{sid}/chat/actions/{action['id']}/apply").status_code == 409


def test_cancel_changes_nothing(client):
    c = client
    sid = _session(c)
    before = _field(c, sid, "storage")["value"]
    action = _ask(c, sid, "change storage to Keep frozen")["actions"][0]
    r = c.post(f"/api/sessions/{sid}/chat/actions/{action['id']}/cancel").json()
    assert r["action"]["status"] == "cancelled" and r["view"] is None
    assert _field(c, sid, "storage")["value"] == before
    assert c.post(f"/api/sessions/{sid}/chat/actions/{action['id']}/apply").status_code == 409


def test_suggested_answers_are_prepared_with_their_impact(client):
    c = client
    sid = _session(c)
    reply = _ask(c, sid, "Accept the suggested answers for Legal")
    assert reply["actions"] and all(a["type"] == "answer_question" for a in reply["actions"])
    state = c.get(f"/api/sessions/{sid}").json()["state"]
    legal = {q["id"] for q in state["questions"] if q["owner"] == "Legal"}
    assert {a["params"]["question"] for a in reply["actions"]} <= legal
    assert any(a["impact"]["resolved"] for a in reply["actions"])  # the preview shows what it fixes
    a = reply["actions"][0]
    r = c.post(f"/api/sessions/{sid}/chat/actions/{a['id']}/apply").json()
    assert r["action"]["status"] == "applied"
    assert a["params"]["question"] in {x["id"] for x in r["view"]["state"]["answered_questions"]}


def test_a_change_that_no_longer_fits_fails_with_the_reason(client):
    c = client
    sid = _session(c)
    reply = _ask(c, sid, "pass the Legal questions to the agency")
    a = reply["actions"][0]
    # The same question is answered on screen before the prepared change is applied.
    c.post(f"/api/sessions/{sid}/questions/{a['params']['question']}/answer", json={"kind": "unknown"})
    r = c.post(f"/api/sessions/{sid}/chat/actions/{a['id']}/apply").json()
    assert r["action"]["status"] == "failed" and r["action"]["result"]


def test_not_applicable_needs_a_reason_and_an_empty_field(client):
    c = client
    sid = _session(c)
    assert not _ask(c, sid, "mark storage as not applicable")["actions"]  # asks why
    reply = _ask(c, sid, "mark storage as not applicable because it is shelf stable")
    assert not reply["actions"] and "has a value" in reply["answer"]


def test_ai_proposals_are_checked_by_code(client, monkeypatch):
    c = client
    sid = _session(c)
    model = FakeModel({"answer": "I prepared two changes.", "actions": [
        {"type": "edit_field", "field": "made_up_field", "value": "x"},
        {"type": "delete_everything"},
        {"type": "edit_field", "field": "storage", "value": "Keep dry"},
    ]})
    monkeypatch.setattr(chat, "_models", lambda: [model])
    reply = _ask(c, sid, "could you fix the storage text and anything else?")  # not a plain command: the AI handles it
    assert [a["params"]["field"] for a in reply["actions"]] == ["storage"]
    assert "Not prepared" in reply["answer"] and "made_up_field" in reply["answer"]
    assert "OPEN QUESTIONS" in model.prompts[0]


def test_a_finalized_brief_gets_no_changes(client):
    from app.session_store import store

    c = client
    sid = _session(c)
    store.load(sid)[0].status = "finalized"
    reply = _ask(c, sid, "set storage to Keep dry")
    assert not reply["actions"] and "finalized" in reply["answer"]


def test_questions_without_an_action_word_stay_plain_answers(client):
    c = client
    sid = _session(c)
    reply = _ask(c, sid, "What is still blocking the brief?")
    assert reply["actions"] == []
