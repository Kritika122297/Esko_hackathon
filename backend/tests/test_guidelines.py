from app.services.guidelines import clauses_for, has_market_rules, requirements, standards_for


def test_us_market_loads_base_and_fda():
    names = [s.standard for s in standards_for("US")]
    assert names == ["base", "us_fda"] or set(names) == {"base", "us_fda"}


def test_fr_market_loads_eu_not_fda():
    names = {s.standard for s in standards_for("fr")}
    assert names == {"base", "eu_1169"}


def test_unknown_market_falls_back_to_base_only():
    assert {s.standard for s in standards_for("ZZ")} == {"base"}
    assert not has_market_rules("ZZ")


def test_explicit_selection_overrides_market():
    assert {s.standard for s in standards_for("FR", selected=["us_fda"])} == {"base", "us_fda"}


def test_requirements_cite_clauses():
    req = requirements("US")
    assert [c.id for c, _ in req["net_weight"]] == ["US-FDA/21CFR101.7"]
    assert "added_sugars" in req and "barcode" in req


def test_clause_fields_exist_in_catalog():
    from app.services.catalog import FIELD_BY_KEY
    for c in clauses_for("US") + clauses_for("FR"):
        for r in c.requires:
            assert r.field in FIELD_BY_KEY, (c.id, r.field)


def test_missing_field_issue_cites_clause_and_follows_market(tmp_path):
    from app.config import settings
    # blank a required field and re-run the checks against the saved facts
    from app.services.pipeline import analyze, now, read_files, recompute
    from app.models.brief import BriefState

    st = BriefState(session_id="t2", created_at=now(), updated_at=now(), market="US")
    ex = read_files([(p, p.name) for p in sorted(settings.SAMPLES_DIR.glob("*"))], tmp_path)
    ctx = analyze(st, ex)
    for f in st.fields:
        if f.key == "added_sugars":
            f.candidates, f.value = [], None
    recompute(st, ctx)
    issue = next(i for i in st.issues if i.id == "missing:added_sugars")
    assert "US-FDA/21CFR101.9-nutrients" in issue.clauses
    assert issue.severity == "blocking"

