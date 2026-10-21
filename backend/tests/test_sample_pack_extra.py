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


def test_answered_question_is_kept_for_the_record(client):
    c = client
    sid = _session(c)
    q = next(q for q in c.get(f"/api/sessions/{sid}").json()["state"]["questions"] if "us.net_weight_oz" in q["issue_ids"])
    opt = next(o for o in q["options"] if o["updates"])
    st = c.post(f"/api/sessions/{sid}/questions/{q['id']}/answer", json={"option_id": opt["id"]}).json()["state"]
    assert q["id"] not in {x["id"] for x in st["questions"]}
    rec = next(a for a in st["answered_questions"] if a["id"] == q["id"])
    assert rec["kind"] == "option" and rec["answer"] == opt["label"] and rec["question"] == q["question"]


def test_dont_know_passes_question_to_agency(client):
    c = client
    sid = _session(c)
    q = c.get(f"/api/sessions/{sid}").json()["state"]["questions"][0]
    st = c.post(f"/api/sessions/{sid}/questions/{q['id']}/answer", json={"kind": "unknown"}).json()["state"]
    assert q["id"] not in {x["id"] for x in st["questions"]}
    assert all(iid in st["acknowledgements"] for iid in q["issue_ids"])
    assert next(a for a in st["answered_questions"] if a["id"] == q["id"])["kind"] == "unknown"


def test_not_applicable_answer_marks_empty_field(client):
    c = client
    sid = _session(c)
    c.put(f"/api/sessions/{sid}/fields/producer", json={"value": ""})
    q = next(q for q in c.get(f"/api/sessions/{sid}").json()["state"]["questions"] if q["custom_field"] == "producer")
    r = c.post(f"/api/sessions/{sid}/questions/{q['id']}/answer", json={"kind": "not_applicable"})
    assert r.status_code == 400  # a reason is required
    st = c.post(f"/api/sessions/{sid}/questions/{q['id']}/answer",
                json={"kind": "not_applicable", "note": "Private label; retailer address is printed"}).json()["state"]
    f = next(f for f in st["fields"] if f["key"] == "producer")
    assert f["absence"] == "not_applicable"
    assert q["id"] not in {x["id"] for x in st["questions"]}
    assert next(a for a in st["answered_questions"] if a["id"] == q["id"])["answer"].startswith("Not applicable")


def test_changing_an_answer_undoes_the_old_one(client):
    c = client
    sid = _session(c)
    st = c.get(f"/api/sessions/{sid}").json()["state"]
    original = next(f for f in st["fields"] if f["key"] == "net_weight")["value"]
    q = next(q for q in st["questions"] if "us.net_weight_oz" in q["issue_ids"])
    opt = next(o for o in q["options"] if o["updates"])
    url = f"/api/sessions/{sid}/questions/{q['id']}"
    assert c.post(f"{url}/change", json={"kind": "unknown"}).status_code == 404  # nothing answered yet
    c.post(f"{url}/answer", json={"option_id": opt["id"]})

    # A typed value replaces the chosen option
    st = c.post(f"{url}/change", json={"custom_value": "NET WT 17 OZ (482g)"}).json()["state"]
    assert next(f for f in st["fields"] if f["key"] == "net_weight")["value"] == "NET WT 17 OZ (482g)"
    rec = next(a for a in st["answered_questions"] if a["id"] == q["id"])
    assert rec["kind"] == "custom" and rec["options"]

    # "I don't know" puts the original value back and passes the issue on
    st = c.post(f"{url}/change", json={"kind": "unknown"}).json()["state"]
    assert next(f for f in st["fields"] if f["key"] == "net_weight")["value"] == original
    assert "us.net_weight_oz" in st["acknowledgements"]
    assert q["id"] not in {x["id"] for x in st["questions"]}

    # Going back to the computed option withdraws the hand-off
    st = c.post(f"{url}/change", json={"option_id": opt["id"]}).json()["state"]
    assert "us.net_weight_oz" not in st["acknowledgements"]
    assert next(f for f in st["fields"] if f["key"] == "net_weight")["value"].startswith("NET WT 16.9 OZ")
    assert c.post(f"{url}/change", json={"kind": "not_applicable"}).status_code == 400  # reason required, nothing changed
    assert next(a for a in c.get(f"/api/sessions/{sid}").json()["state"]["answered_questions"] if a["id"] == q["id"])["kind"] == "option"


def test_changing_not_applicable_restores_the_question(client):
    c = client
    sid = _session(c)
    c.put(f"/api/sessions/{sid}/fields/producer", json={"value": ""})
    q = next(q for q in c.get(f"/api/sessions/{sid}").json()["state"]["questions"] if q["custom_field"] == "producer")
    url = f"/api/sessions/{sid}/questions/{q['id']}"
    c.post(f"{url}/answer", json={"kind": "not_applicable", "note": "Private label"})
    st = c.post(f"{url}/change", json={"custom_value": "Acme Foods, 1 Main St, Springfield"}).json()["state"]
    f = next(f for f in st["fields"] if f["key"] == "producer")
    assert f["value"].startswith("Acme Foods") and not f["not_applicable"]


def test_designer_brief_follows_the_product_category(client):
    from app.services.designer import build_designer_brief
    from app.services.pipeline import recompute
    from app.session_store import store

    sid = _session(client)
    state, ctx, ex = store.load(sid)
    food = build_designer_brief(state, ex)
    assert food.nutrition and any(i.item == "Nutrition Facts panel" for i in food.items)

    home = state.model_copy(deep=True)
    home.category = "household"
    recompute(home, ctx.model_copy(deep=True))
    b = build_designer_brief(home, ex)
    assert not b.nutrition and not any("Nutrition" in i.item for i in b.items)
    copy = {c.field for c in b.final_copy}
    assert {"signal_word", "hazard_statements", "first_aid"} <= copy
