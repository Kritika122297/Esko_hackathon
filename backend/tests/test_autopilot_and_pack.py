"""Brief Autopilot (the recorded pipeline trace) and Talk to the Pack (inspect, audit, fix one element)."""

import time

from app.config import settings
from app.routers import pack
from test_chat import FakeModel
from test_sample_pack import client  # noqa: F401  (isolated session store)
from test_sample_pack_extra import _session


def _files():
    return [("files", (p.name, p.read_bytes())) for p in sorted(settings.SAMPLES_DIR.glob("*")) if p.is_file()]


# ---------------------------------------------------------------- Autopilot trace


def test_every_pipeline_stage_is_traced_with_real_counts(client):
    r = client.post("/api/sessions", files=_files(), data={"case": "update", "market": "US"})
    assert r.status_code == 201  # the synchronous upload still answers with the finished brief
    events = r.json()["state"]["autopilot_trace"]
    steps = {e["step"] for e in events}
    assert {"upload", "read", "extract", "reconcile", "checks", "ai", "route", "save"} <= steps
    assert all(e["status"] != "running" for e in events)  # stored events are each step's result
    by_tool = {e["tool"]: e for e in events}
    assert "16 dieline panels" in next(e["message"] for e in events if e["step"] == "read" and "Read 2 files" in e["message"])
    assert "disagree" in by_tool["Reconciliation"]["message"]
    assert by_tool["US label rules"]["citation"] == "US-FDA/21CFR101.7"
    assert "blocking" in by_tool["Question routing"]["message"]
    assert sum(e["duration_ms"] for e in events if e["step"] == "read") > 0
    sid = r.json()["state"]["session_id"]
    stored = client.get(f"/api/sessions/{sid}/trace").json()
    assert stored["status"] == "done" and [e["id"] for e in stored["events"]] == [e["id"] for e in events]


def test_background_build_streams_events_and_ends_with_done(client):
    r = client.post("/api/sessions", files=_files(),
                    data={"case": "update", "market": "US", "allow_duplicate": "true", "background": "true"})
    assert r.status_code == 202
    sid = r.json()["session_id"]
    with client.stream("GET", f"/api/sessions/{sid}/trace/stream") as s:
        body = "".join(s.iter_text())
    assert body.count("event: trace") >= 15
    assert body.rstrip().split("\n\n")[-1].startswith("event: done") and '"status": "done"' in body
    assert client.get(f"/api/sessions/{sid}").status_code == 200
    # Afterwards the stored trace is replayed, again ending with done.
    with client.stream("GET", f"/api/sessions/{sid}/trace/stream") as s:
        again = "".join(s.iter_text())
    assert "event: done" in again and again.count("event: trace") >= 15


def test_trace_of_an_unknown_brief_is_404(client):
    assert client.get("/api/sessions/0123456789ab/trace").status_code == 404
    assert client.get("/api/sessions/0123456789ab/trace/stream").status_code == 404


def test_a_failed_background_build_is_reported_in_the_trace(client, monkeypatch):
    from app.routers import sessions

    def boom(*_):
        raise RuntimeError("disk full")
    monkeypatch.setattr(sessions.autopilot, "build", boom)
    r = client.post("/api/sessions", files=_files(),
                    data={"case": "update", "market": "US", "allow_duplicate": "true", "background": "true"})
    sid = r.json()["session_id"]
    for _ in range(100):
        t = client.get(f"/api/sessions/{sid}/trace").json()
        if t["status"] != "running":
            break
        time.sleep(0.05)
    assert t["status"] == "error" and "disk full" in t["error"]
    assert any("could not be built" in e["message"] for e in t["events"])
    assert client.get(f"/api/sessions/{sid}").status_code == 404  # no half-made brief


# ---------------------------------------------------------------- Talk to the Pack


def test_inspect_shows_value_sources_findings_and_clauses(client):
    sid = _session(client)
    i = client.get(f"/api/sessions/{sid}/fields/net_weight/inspect").json()
    assert i["label"] == "Net weight" and i["value"]
    assert any(s["kind"] == "pdf" for s in i["candidates"])
    assert any(c["id"] == "US-FDA/21CFR101.7" for c in i["clauses"])
    assert any(x["id"] == "us.net_weight_oz" for x in i["issues"])
    assert client.get(f"/api/sessions/{sid}/fields/nope/inspect").status_code == 404


def test_audit_without_ai_reports_code_findings_and_quotes_the_rule(client):
    sid = _session(client)
    a = client.post(f"/api/sessions/{sid}/fields/net_weight/audit").json()
    assert a["verdict"] == "issue" and not a["ai"]
    assert a["quotes"][0]["clause_id"] == "US-FDA/21CFR101.7"


def test_audit_says_when_no_rule_applies(client):
    sid = _session(client)
    a = client.post(f"/api/sessions/{sid}/fields/marketing_copy/audit").json()
    assert a["verdict"] == "no_rule" and a["quotes"] == [] and "No rule" in a["answer"]


def test_ai_audit_may_only_cite_given_clauses_and_code_beats_compliant(client, monkeypatch):
    sid = _session(client)
    model = FakeModel({"verdict": "compliant", "answer": "It meets the rule.", "clause_id": "MADE-UP/1",
                       "quote": "anything"})
    monkeypatch.setattr(pack, "chain", lambda role: [model])
    a = client.post(f"/api/sessions/{sid}/fields/net_weight/audit").json()
    assert a["ai"] and a["verdict"] == "issue"  # an open code finding outranks the AI
    assert all(q["clause_id"] == "US-FDA/21CFR101.7" for q in a["quotes"])  # the invented clause is not shown
    model.reply = {"verdict": "issue", "answer": "Ounces are missing.", "clause_id": "US-FDA/21CFR101.7",
                   "quote": "in both US customary (ounces) and metric (grams) units"}
    a = client.post(f"/api/sessions/{sid}/fields/net_weight/audit").json()
    assert a["quotes"][0]["exact"] and "ounces" in a["quotes"][0]["text"]


def test_suggest_fix_prefers_code_and_apply_logs_old_and_new(client):
    c = client
    sid = _session(c)
    s = c.post(f"/api/sessions/{sid}/fields/net_weight/suggest-fix").json()
    assert s["source"] == "code" and "OZ" in s["suggested"] and s["impact"]["resolved"]
    before = s["current"]
    st = c.post(f"/api/sessions/{sid}/fields/net_weight/apply-fix",
                json={"value": s["suggested"], "source": "code", "reason": "ounces added"}).json()["state"]
    entry = st["change_log"][-1]
    assert entry["by"] == "AI via Talk to the Pack" and entry["old"] == before and entry["new"] == s["suggested"]
    assert next(f for f in st["fields"] if f["key"] == "net_weight")["value"] == s["suggested"]
    assert "us.net_weight_oz" not in {i["id"] for i in st["issues"] if i["state"] == "open"}


def test_ai_fix_cannot_invent_numbers_and_nothing_changes_until_applied(client, monkeypatch):
    c = client
    sid = _session(c)
    before = next(f for f in c.get(f"/api/sessions/{sid}").json()["state"]["fields"] if f["key"] == "producer")["value"]
    model = FakeModel({"suggested": "Dancing Fish Granola Co., 99999 Nowhere Road", "reason": "address"})
    monkeypatch.setattr(pack, "chain", lambda role: [model])
    s = c.post(f"/api/sessions/{sid}/fields/producer/suggest-fix").json()
    assert s["suggested"] is None and s["message"]  # 99999 is not in the brief
    model.reply = {"suggested": "PRODUCED BY DANCING FISH GRANOLA CO.", "reason": "same"}
    assert c.post(f"/api/sessions/{sid}/fields/producer/suggest-fix").json()["suggested"] is None  # no change
    after = next(f for f in c.get(f"/api/sessions/{sid}").json()["state"]["fields"] if f["key"] == "producer")["value"]
    assert after == before


def test_apply_fix_respects_finalized_briefs(client):
    from app.session_store import store

    sid = _session(client)
    store.load(sid)[0].status = "finalized"
    r = client.post(f"/api/sessions/{sid}/fields/net_weight/apply-fix", json={"value": "NET WT 1 OZ (28g)", "source": "ai"})
    assert r.status_code == 409
