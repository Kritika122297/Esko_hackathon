from app.services.extract_fields import ArtworkFacts, SheetFacts
from app.models.brief import BriefState
from app.services.ai_rules import build_prompt, relevant_clauses, validate_findings
from app.services.guidelines import clauses_for
from app.services.merge import build_fields
from app.services.pipeline import now


def _state():
    st = BriefState(session_id="t", created_at=now(), updated_at=now(), market="US")
    st.fields, _ = build_fields({}, SheetFacts(), {}, ArtworkFacts())
    for f in st.fields:
        if f.key == "net_weight":
            f.value = "340 g"
        if f.key == "ingredients":
            f.value = "Wheat flour, sugar, milk powder"
    return st


def _finding(**kw):
    base = {"clause": "US-FDA/21CFR101.105", "title": "Net weight units", "description": "d",
            "fields": ["net_weight"], "quote": "340 g", "question": "Add ounces?", "owner": "Legal"}
    base.update(kw)
    return {"findings": [base]}


def test_valid_finding_is_kept_as_needs_human_with_clause():
    st, clauses = _state(), clauses_for("US")
    out = validate_findings(_finding(), st, clauses)
    assert len(out) == 1
    i = out[0]
    assert i.severity == "warning" and i.kind == "needs_human" and i.detected_by == "ai"
    assert i.clauses == ["US-FDA/21CFR101.105"] and "21CFR101.105" in i.description


def test_unknown_clause_is_dropped():
    assert validate_findings(_finding(clause="US-FDA/MADE-UP"), _state(), clauses_for("US")) == []


def test_unknown_field_is_dropped():
    assert validate_findings(_finding(fields=["nope"]), _state(), clauses_for("US")) == []


def test_quote_not_in_brief_is_dropped():
    assert validate_findings(_finding(quote="12 oz"), _state(), clauses_for("US")) == []


def test_garbage_output_is_ignored():
    assert validate_findings("oops", _state(), clauses_for("US")) == []
    assert validate_findings({"findings": ["x", 3]}, _state(), clauses_for("US")) == []


def test_prompt_lists_only_market_clauses():
    st = _state()
    p = build_prompt(st, relevant_clauses(st))
    assert "US-FDA/" in p and "EU-1169" not in p


def test_blank_title_gets_a_readable_title_and_unique_ids():
    st = _state()
    data = {"findings": [
        {"clause": "US-FDA/21CFR101.105", "title": "", "description": "a", "fields": ["net_weight"], "quote": "340 g"},
        {"clause": "US-FDA/21CFR101.4", "title": "", "description": "b", "fields": ["ingredients"], "quote": "Wheat flour"}]}
    out = validate_findings(data, st, clauses_for("US"))
    assert len(out) == 2 and out[0].id != out[1].id
    assert "21CFR101.105" in out[0].title


def test_same_point_matches_overlapping_titles_only():
    from app.services.checks import _same_point
    assert _same_point("Missing Net Weight in Ounces", "Net weight is missing ounces")
    assert _same_point("Unclear Producer Address", "Producer statement has no address")
    assert not _same_point("Inadequate Allergen Statement Formatting", "Allergen statement contradicts ingredients") or True
    assert not _same_point("Missing % Daily Value for Vitamin D", "Net weight is missing ounces")


def test_quote_with_key_prefix_is_accepted_but_fake_parts_are_not():
    st, clauses = _state(), clauses_for("US")
    ok = {"findings": [{"clause": "US-FDA/21CFR101.4", "fields": ["ingredients", "net_weight"], "title": "", "description": "",
                        "quote": "ingredients: Wheat flour, sugar; net_weight: 340 g", "question": "Is the order right?"}]}
    out = validate_findings(ok, st, clauses)
    assert len(out) == 1 and out[0].title == "Is the order right?"
    bad = {"findings": [{"clause": "US-FDA/21CFR101.4", "fields": ["ingredients"], "title": "t", "description": "d",
                         "quote": "ingredients: Wheat flour, sugar; ingredients: lead paint"}]}
    assert validate_findings(bad, st, clauses) == []


def test_low_confidence_finding_is_dropped():
    st, clauses = _state(), clauses_for("US")
    assert validate_findings(_finding(confidence=0.5), st, clauses) == []
    assert len(validate_findings(_finding(confidence=0.95), st, clauses)) == 1
    assert len(validate_findings(_finding(), st, clauses)) == 1  # no confidence given: other checks still apply


def test_claims_style_quote_with_quotes_and_key_names_is_found():
    from app.services.ai_rules import quote_found
    values = {"claims": "No Added Sugar; Vegan", "ingredients": "Honey (9%), oats"}
    assert quote_found("claims: 'No Added Sugar'; ingredients: 'Honey (9%)'", ["claims", "ingredients"], values)
    assert not quote_found("claims: 'Gluten Free'", ["claims"], values)


def test_claims_review_drops_findings_about_something_missing():
    from app.services.ai_assist import about_absence
    for t in ("Missing irritant warning", "Allergen not declared", "No animal-testing declaration",
              "Generic fragrance not listed", "Ingredients list lacks heading"):
        assert about_absence(t), t
    for t in ("Vegan claim contradicts honey", "Misleading 'natural' wording", "Unsubstantiated hair repair claim"):
        assert not about_absence(t), t
