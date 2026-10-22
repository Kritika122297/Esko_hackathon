import json

from test_sample_pack import client  # noqa: F401  (isolated session store)

from app.services import rulebook

RULEBOOK = """Acme Foods packaging rules.
All packs must show the batch number on the back panel.
The barcode shall be placed on the base of the pack.
Marketing should include a recycling message.
Our brand colour is blue.
Every pack must state the country of origin.
"""


def test_keyword_rules_quote_the_sentence_and_name_a_known_field():
    rules = rulebook.propose(RULEBOOK)
    by_field = {r["field"]: r for r in rules}
    assert by_field["batch_lot"]["quote"] == "All packs must show the batch number on the back panel."
    assert by_field["batch_lot"]["severity"] == "blocking"
    assert by_field["country_of_origin"]["severity"] == "blocking"
    assert all(rulebook.norm_text(r["quote"]) in rulebook.norm_text(RULEBOOK) for r in rules)
    assert not any("brand colour" in r["quote"] for r in rules)  # no obligation, no rule


def test_ai_rule_with_a_made_up_quote_or_field_is_dropped(monkeypatch):
    monkeypatch.setattr(rulebook, "ai_rules", lambda text: [
        {"field": "batch_lot", "severity": "blocking", "owner": "Brand", "quote": "Packs must carry a gold seal.", "method": "ai"},
        {"field": "not_a_field", "severity": "blocking", "owner": "Brand", "quote": "Every pack must state the country of origin.", "method": "ai"}])
    rules = rulebook.propose(RULEBOOK)
    assert not any("gold seal" in r["quote"] or r["field"] == "not_a_field" for r in rules)


def test_accepted_rules_become_company_clauses():
    clauses = rulebook.to_clauses([{"field": "batch_lot", "quote": "All packs must show the batch number.", "severity": "blocking"},
                                   {"field": "nope", "quote": "x"}], "acme.txt")
    assert [c.id for c in clauses] == ["COMPANY/1"] and clauses[0].requires[0].field == "batch_lot"


def test_upload_endpoint_then_a_brief_that_follows_the_company_rule(client):
    c = client
    r = c.post("/api/standards/company-rulebook", files={"file": ("acme.txt", RULEBOOK.encode())})
    assert r.status_code == 200, r.text
    proposed = r.json()["rules"]
    assert any(p["field"] == "batch_lot" for p in proposed)
    assert c.post("/api/standards/company-rulebook", files={"file": ("x.exe", b"MZ")}).status_code == 400

    from app.config import settings
    files = [("files", (p.name, p.read_bytes())) for p in sorted(settings.SAMPLES_DIR.glob("*")) if p.is_file()]
    accepted = [p for p in proposed if p["field"] == "batch_lot"]
    st = c.post("/api/sessions", files=files, data={"case": "update", "market": "US", "category": "food",
                                                    "company_rules": json.dumps(accepted), "company_file": "acme.txt"}).json()["state"]
    issue = next(i for i in st["issues"] if i["id"] == "missing:batch_lot")
    assert issue["clauses"] == ["COMPANY/1"] and issue["severity"] == "blocking"
    plain = c.post("/api/sessions", files=files, data={"case": "update", "market": "US", "allow_duplicate": "true"}).json()["state"]
    assert not any(i["id"] == "missing:batch_lot" for i in plain["issues"])  # US food rules alone do not ask for it
