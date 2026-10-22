"""Designer blueprint and Agency Simulator: every check passes and fails on crafted briefs; the score is code."""

import pytest

from app.services import agency_simulator as sim
from app.services.agency_simulator import Check, score_and_status
from app.services.blueprint import build_blueprint, clean_ingredients, parse_dimensions
from app.services.designer import build_designer_brief
from test_chat import FakeModel
from test_sample_pack import client  # noqa: F401  (isolated session store)
from test_sample_pack_extra import _session


@pytest.fixture()
def sample(client):
    from app.session_store import store

    sid = _session(client)
    state, _, ex = store.load(sid)
    return sid, state.model_copy(deep=True), ex


def _run(check, state, ex, tweak_brief=None):
    brief = build_designer_brief(state, ex)
    if tweak_brief:
        tweak_brief(brief)
    return check(state, brief, build_blueprint(state, ex, brief))


def _set(state, key, value):
    f = state.field(key)
    f.value = value
    return state


def _drop_issues(state, *prefixes):
    state.issues = [i for i in state.issues if not any(i.check.startswith(p) for p in prefixes)]
    return state


# ---------------------------------------------------------------- each check, both ways


def test_copy_on_panels(sample):
    _, st, ex = sample
    def place_all(b):
        for i in b.items:
            i.panel = i.panel or "front"
    assert _run(sim.check_copy_on_panels, st, ex, place_all).passed
    def lose_one(b):
        next(i for i in b.items if i.action in ("change", "add")).panel = None
    assert not _run(sim.check_copy_on_panels, st, ex, lose_one).passed
    st.case = "new_product"  # no dieline: generic layout
    assert not _run(sim.check_copy_on_panels, st, ex).passed


def test_net_quantity(sample):
    _, st, ex = sample
    ok = _run(sim.check_net_quantity, _set(st, "net_weight", "NET WT 16.9 OZ (480g)"), ex)
    assert ok.passed and ok.clause_id == "US-FDA/21CFR101.7" and "bottom 30%" in ok.detail
    assert not _run(sim.check_net_quantity, _set(st, "net_weight", "480g"), ex).passed
    assert not _run(sim.check_net_quantity, _set(st, "net_weight", None), ex).passed


def test_info_panel(sample):
    _, st, ex = sample
    assert not _run(sim.check_info_panel, st, ex).passed  # the sample splits nutrition from ingredients
    for key in ("ingredients", "allergen_statement", "producer", "calories", "total_fat"):
        for c in st.field(key).candidates:
            if c.source.kind == "pdf":
                c.source.panel = "left"
    assert _run(sim.check_info_panel, st, ex).passed
    st.market = "FR"
    assert _run(sim.check_info_panel, st, ex).severity == "info"  # not a rule there


def test_barcode(sample):
    _, st, ex = sample
    assert _run(sim.check_barcode, st, ex).passed  # 12-digit valid GTIN -> UPC-A with its quiet zone
    assert not _run(sim.check_barcode, _set(st, "barcode", "12345"), ex).passed
    assert not _run(sim.check_barcode, _set(st, "barcode", None), ex).passed


def test_allergens(sample):
    _, st, ex = sample
    assert not _run(sim.check_allergens, st, ex).passed  # open allergen findings
    assert _run(sim.check_allergens, _drop_issues(st, "allergen."), ex).passed
    st.category = "household"
    assert _run(sim.check_allergens, st, ex).severity == "info"


def test_type_sizes(sample):
    _, st, ex = sample
    c = _run(sim.check_type_sizes, st, ex)
    assert not c.passed and "Dimensions needed" in c.detail  # only estimated from the dieline
    assert _run(sim.check_type_sizes, _set(st, "pdp_dimensions", "190 x 280 mm"), ex).passed


def test_open_blocking(sample):
    _, st, ex = sample
    assert not _run(sim.check_open_blocking, st, ex).passed
    st.readiness.blocking_open = 0
    assert _run(sim.check_open_blocking, st, ex).passed


def test_serving(sample):
    _, st, ex = sample
    assert not _run(sim.check_serving, st, ex).passed
    _drop_issues(st, "math.servings", "us.serving_size_format", "math.mass")
    assert _run(sim.check_serving, _set(st, "serving_size", "2/3 cup (60g)"), ex).passed
    assert not _run(sim.check_serving, _set(st, "serving_size", "2/3 cup"), ex).passed


def test_language(sample):
    _, st, ex = sample
    assert _run(sim.check_language, st, ex).passed  # English copy, US market
    st.market = "FR"
    c = _run(sim.check_language, st, ex)
    assert not c.passed and c.severity == "blocking" and "French" in c.detail
    for k in ("statement_of_identity", "ingredients", "marketing_copy", "dietary_info", "storage", "allergen_statement"):
        _set(st, k, None)
    assert not _run(sim.check_language, st, ex).passed  # nothing to tell from


def test_print_spec(sample):
    _, st, ex = sample
    assert not _run(sim.check_print, st, ex).passed
    assert _run(sim.check_print, _set(st, "print_spec", "Flexo, CMYK + 1 Pantone"), ex).passed


# ---------------------------------------------------------------- score, status, AI


def _c(passed, severity):
    return Check(id="x", name="x", passed=passed, severity=severity, detail="d")


def test_score_and_status_come_from_the_checks():
    assert score_and_status([_c(True, "blocking"), _c(True, "warning"), _c(True, "info")]) == (100, "READY_FOR_STUDIO")
    assert score_and_status([_c(True, "blocking"), _c(False, "warning")]) == (60, "CHANGES_REQUIRED")
    assert score_and_status([_c(False, "blocking"), _c(True, "warning")]) == (40, "BLOCKED")
    assert score_and_status([_c(False, "info")]) == (100, "CHANGES_REQUIRED")  # n/a checks carry no weight


def test_ai_failure_returns_the_code_report(sample, monkeypatch):
    sid, st, ex = sample
    monkeypatch.setattr(sim, "chain", lambda role: [FakeModel(fail=True)])
    r = sim.simulate(sid + "-fail", st, ex)
    assert r.llm_unavailable and r.ambiguities == [] and r.designer_summary and len(r.checks) == 10


def test_ai_ambiguities_are_validated_and_deduplicated(sample, monkeypatch):
    sid, st, ex = sample
    model = FakeModel({"ambiguities": [
        {"topic": "Barcode size", "question": "What size should the barcode be?"},  # a code check covers it
        {"topic": "Finish", "question": "Is the carton matt or gloss laminated?", "panel": "front"},
        {"topic": "Finish", "question": "Is the carton matt or gloss laminated?"},  # duplicate
        {"question": ""}, "not a dict",
    ], "designer_summary": "The studio cannot start yet. The score is 999."})
    monkeypatch.setattr(sim, "chain", lambda role: [model])
    r = sim.simulate(sid + "-ai", st, ex)
    assert [a.question for a in r.ambiguities] == ["Is the carton matt or gloss laminated?"]
    assert r.ambiguities[0].panel == "front"
    assert "999" not in r.designer_summary and not r.llm_unavailable  # a number not in the brief is dropped


# ---------------------------------------------------------------- endpoints and helpers


def test_endpoints(client):
    sid = _session(client)
    r = client.post(f"/api/sessions/{sid}/agency-simulator").json()
    assert 0 <= r["score"] <= 100 and r["status"] in ("READY_FOR_STUDIO", "CHANGES_REQUIRED", "BLOCKED")
    assert len(r["checks"]) == 10
    bp = client.get(f"/api/sessions/{sid}/blueprint").json()
    assert bp["pdp_panel"] == "front" and not bp["generic"]
    assert any(o["kind"] == "zone" and "101.7" in o["citation"] for o in bp["overlays"])
    assert all(o["verified"] is False for o in bp["overlays"])
    assert client.post("/api/sessions/0123456789ab/agency-simulator").status_code == 404
    assert client.get("/api/sessions/0123456789ab/blueprint").status_code == 404


def test_fixing_a_spec_raises_the_score(client):
    sid = _session(client)
    before = client.post(f"/api/sessions/{sid}/agency-simulator").json()["score"]
    client.put(f"/api/sessions/{sid}/fields/print_spec", json={"value": "Offset, CMYK + 1 Pantone, matt varnish"})
    after = client.post(f"/api/sessions/{sid}/agency-simulator").json()
    assert after["score"] > before
    assert next(c for c in after["checks"] if c["id"] == "print_spec")["passed"]


def test_dimensions_and_copy_helpers():
    w, h, unit = parse_dimensions("190 x 280 mm")
    assert unit == "mm" and round(w, 2) == 7.48 and round(h, 2) == 11.02
    assert parse_dimensions("7.5in x 11in")[:2] == (7.5, 11.0)
    assert parse_dimensions("no size") is None
    assert clean_ingredients("INGREDIENTS:  Oats ,honey , salt.") == "Ingredients: Oats, honey, salt."


def test_layout_rules_keep_us_and_eu_apart_and_skip_general_only():
    from app.services.blueprint import layout_rules

    us = {r["id"] for r in layout_rules("US", "food")}
    fr = {r["id"] for r in layout_rules("FR", "food")}
    assert "us_food.net_quantity_type" in us and "eu_food.x_height" not in us
    assert "eu_food.x_height" in fr and "us_food.net_quantity_type" not in fr
    assert {r["id"] for r in layout_rules("US", "retail")} == {"gs1.quiet_zone"}
    assert {r["citation"].split()[2] for r in layout_rules("US", "cosmetics") if r["kind"] == "type_table"} == {"701.13"}


def test_a_brief_saved_before_new_fields_gets_them(client):
    import json

    from app.session_store import store

    sid = _session(client)
    path = store.dir(sid) / "state.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["fields"] = [f for f in data["fields"] if f["key"] != "print_spec"]
    path.write_text(json.dumps(data), encoding="utf-8")
    store._cache.pop(sid)
    r = client.put(f"/api/sessions/{sid}/fields/print_spec", json={"value": "Flexo, CMYK"})
    assert r.status_code == 200
