"""Product category on briefs, and 'Duplicate as new market' (an existing brief adapted to another market)."""

import json

from app.config import settings
from test_sample_pack import client  # noqa: F401  (isolated session store)
from test_sample_pack_extra import _session


def _files():
    return [("files", (p.name, p.read_bytes())) for p in sorted(settings.SAMPLES_DIR.glob("*")) if p.is_file()]


def test_category_defaults_for_new_and_old_briefs(client):
    from app.session_store import store

    sid = _session(client)  # uploaded without a category
    assert client.get(f"/api/sessions/{sid}").json()["state"]["category"] == "food"
    # A brief saved before categories existed has no 'category' key; it still loads with the default.
    path = store.dir(sid) / "state.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data.pop("category")
    path.write_text(json.dumps(data), encoding="utf-8")
    store._cache.pop(sid)
    assert client.get(f"/api/sessions/{sid}").json()["state"]["category"] == "food"
    listed = next(p for p in client.get("/api/sessions").json() if p["session_id"] == sid)
    assert listed["category"] == "food" and listed["market"] == "US" and listed["case"] == "update"


def test_category_accepts_its_label_and_refuses_unknown_values(client):
    ok = client.post("/api/sessions", files=_files(), data={"case": "update", "market": "US",
                                                          "category": "Household & cleaning products",
                                                          "allow_duplicate": "true"})
    assert ok.status_code == 201 and ok.json()["state"]["category"] == "household"
    bad = client.post("/api/sessions", files=_files(), data={"case": "update", "market": "US",
                                                           "category": "Spaceships", "allow_duplicate": "true"})
    assert bad.status_code == 400 and "Unknown product category" in bad.json()["detail"]


def test_duplicate_as_new_market_makes_a_separate_draft_and_leaves_the_source_alone(client):
    from app.session_store import store

    sid = _session(client)
    c = client
    q = next(q for q in c.get(f"/api/sessions/{sid}").json()["state"]["questions"] if "us.net_weight_oz" in q["issue_ids"])
    opt = next(o for o in q["options"] if o["updates"])
    c.post(f"/api/sessions/{sid}/questions/{q['id']}/answer", json={"option_id": opt["id"]})
    before = (store.dir(sid) / "state.json").read_text(encoding="utf-8")

    r = c.post(f"/api/sessions/{sid}/duplicate-market", json={"target_market": " fr ", "category": "Food & beverage"})
    assert r.status_code == 201, r.text
    new = r.json()["state"]
    assert new["session_id"] != sid
    assert new["case"] == "new_market" and new["market"] == "FR" and new["category"] == "food"
    assert new["source_market"] == "US" and new["source_session_id"] == sid
    assert new["status"] == "draft"
    assert new["product_name"].endswith("(FR Edition)")
    assert not new["answered_questions"] and not new["acknowledgements"]  # decisions were for the other market
    assert any(e["action"] == "duplicate" and sid in (e["note"] or "") and "adapt US to FR" in e["note"]
               for e in new["change_log"])
    assert not any(e["action"] == "answer" for e in new["change_log"])
    # The new market's rules apply: the US net-weight rule does not.
    assert "us.net_weight_oz" not in {i["id"] for i in new["issues"]}
    assert (store.dir(sid) / "state.json").read_text(encoding="utf-8") == before  # source untouched
    listed = {p["session_id"]: p for p in c.get("/api/sessions").json()}
    assert listed[new["session_id"]]["source_session_id"] == sid


def test_duplicate_keeps_a_chosen_name_and_refuses_bad_requests(client):
    sid = _session(client)
    r = client.post(f"/api/sessions/{sid}/duplicate-market",
                    json={"target_market": "IN", "product_name_override": "Berry Crunch India"})
    assert r.json()["state"]["product_name"] == "Berry Crunch India"
    assert client.post(f"/api/sessions/{sid}/duplicate-market", json={"target_market": "US"}).status_code == 400
    assert client.post(f"/api/sessions/{sid}/duplicate-market",
                       json={"target_market": "EU", "category": "Spaceships"}).status_code == 400
    assert client.post("/api/sessions/0123456789ab/duplicate-market", json={"target_market": "EU"}).status_code == 404


def test_duplicate_needs_the_source_files(client):
    from app.session_store import store

    sid = _session(client)
    for f in store.load(sid)[0].files:
        (store.dir(sid) / f.name).unlink()
    r = client.post(f"/api/sessions/{sid}/duplicate-market", json={"target_market": "EU"})
    assert r.status_code == 400 and "no longer on the server" in r.json()["detail"]


def test_market_gap_rows_cite_real_clauses(client):
    from app.services.guidelines import load_standards

    known = {c.id for s in load_standards().values() for c in s.clauses}
    sid = _session(client)  # a US food brief
    g = client.get(f"/api/sessions/{sid}/market-gap", params={"target": "fr"}).json()
    assert g["source_market"] == "US" and g["target_market"] == "FR" and g["rules_available"]
    assert g["rows"] and set(g["summary"]) == {"blocking", "warn", "none"}
    assert sum(g["summary"].values()) == len(g["rows"])
    for r in g["rows"]:
        for side in (r["current"], r["target"]):
            if side and side["clause_id"]:
                assert side["clause_id"] in known, side["clause_id"]
    by_key = {r["key"]: r for r in g["rows"]}
    assert by_key["net_quantity"]["severity"] == "blocking"
    assert by_key["net_quantity"]["current"]["clause_id"] == "US-FDA/21CFR101.7"
    assert by_key["net_quantity"]["target"]["clause_id"] == "EU-1169/Art23"
    assert by_key["barcode"]["severity"] == "none"


def test_market_gap_says_when_no_rules_exist_and_keeps_general_only_categories_general(client):
    sid = _session(client)
    uk = client.get(f"/api/sessions/{sid}/market-gap", params={"target": "UK"}).json()
    assert not uk["rules_available"]
    assert any(r["key"] == "rules" and "No rules are loaded" in r["target"]["text"] for r in uk["rows"])
    retail = client.get(f"/api/sessions/{sid}/market-gap", params={"target": "IN", "category": "retail"}).json()
    assert not {"allergens", "nutrition", "marks"} & {r["key"] for r in retail["rows"]}
    assert client.get(f"/api/sessions/{sid}/market-gap", params={"target": "IN", "category": "Spaceships"}).status_code == 400
    assert client.get("/api/sessions/0123456789ab/market-gap", params={"target": "IN"}).status_code == 404


def test_market_profiles_only_cite_clauses_in_the_rule_packs():
    from app.services.guidelines import load_standards
    from app.services.market_gap import _profiles

    known = {c.id for s in load_standards().values() for c in s.clauses}
    for market, elements in _profiles().items():
        for element, entry in elements.items():
            assert entry.get("clause_id") in (None, *known), (market, element)
