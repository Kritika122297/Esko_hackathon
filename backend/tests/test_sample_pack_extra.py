from test_sample_pack import client  # noqa: F401  (isolated session store)


def _session(c):
    from app.config import settings
    files = [("files", (p.name, p.read_bytes())) for p in sorted(settings.SAMPLES_DIR.glob("*")) if p.is_file()]
    r = c.post("/api/sessions", files=files, data={"case": "update", "market": "US"})
    assert r.status_code == 201, r.text
    return r.json()["state"]["session_id"]


def test_undo_restores_previous_value_and_records_origin(client):
    c = client
    sid = _session(c)
    before = next(f for f in c.get(f"/api/sessions/{sid}").json()["state"]["fields"] if f["key"] == "net_weight")["value"]
    c.put(f"/api/sessions/{sid}/fields/net_weight", json={"value": "999 g"})
    r = c.post(f"/api/sessions/{sid}/fields/net_weight/undo")
    f = next(f for f in r.json()["state"]["fields"] if f["key"] == "net_weight")
    assert f["value"] == before
    assert [h["origin"] for h in f["history"]][-1] == "human"
    assert r.json()["state"]["change_log"][-1]["action"] == "undo"


def test_not_applicable_removes_missing_issue_and_is_logged(client):
    c = client
    sid = _session(c)
    c.put(f"/api/sessions/{sid}/fields/added_sugars", json={"value": ""})
    r = c.post(f"/api/sessions/{sid}/fields/added_sugars/not-applicable", json={"reason": "Not a sweetened product"})
    st = r.json()["state"]
    f = next(f for f in st["fields"] if f["key"] == "added_sugars")
    assert f["absence"] == "not_applicable"
    assert not any(i["id"] == "missing:added_sugars" for i in st["issues"])
    assert f["status"] == "confirmed"
    assert st["readiness"]["fields_missing"] == 0 or all(x["key"] != "added_sugars" or x["status"] != "missing" for x in st["fields"])


def test_standards_options_and_checklist(client):
    c = client
    opts = c.get("/api/standards").json()
    codes = {m["code"] for m in opts["markets"]}
    assert {"US", "FR", "EU", "IN"} <= codes
    cats = {c["id"]: c for c in opts["categories"]}
    assert cats["food"]["has_rules"] and cats["cosmetics"]["has_rules"] and not cats["retail"]["has_rules"]
    r = c.get("/api/standards/applicable", params={"market": "FR"}).json()
    assert {p["standard"] for p in r["packs"]} == {"base", "eu_1169"} and r["all_verified"] is False
    unknown = c.get("/api/standards/applicable", params={"market": "ZZ"}).json()
    assert unknown["market_rules"] is False
    fields = c.get("/api/standards/checklist", params={"market": "US"}).json()["fields"]
    net = next(f for f in fields if f["key"] == "net_weight")
    assert net["clauses"] == ["US-FDA/21CFR101.105"] and net["owner"] == "Supply Chain"


def test_category_and_standards_are_kept_when_files_are_added(client):
    from app.config import settings
    c = client
    files = [("files", (p.name, p.read_bytes())) for p in sorted(settings.SAMPLES_DIR.glob("*")) if p.is_file()]
    r = c.post("/api/sessions", files=files, data={"case": "new_market", "market": "FR", "category": "food", "standards": "eu_1169"})
    assert r.status_code == 201, r.text
    st = r.json()["state"]
    assert st["category"] == "food" and st["standards"] == ["eu_1169"] and st["market"] == "FR"
    again = c.post(f"/api/sessions/{st['session_id']}/files", files=[files[0]]).json()["state"]
    assert again["standards"] == ["eu_1169"] and again["category"] == "food"
