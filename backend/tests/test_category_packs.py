import pytest

from app.models.brief import BriefState
from app.services.catalog import FIELD_BY_KEY
from app.services.checks import CheckContext
from app.services.extract_fields import ArtworkFacts, SheetFacts
from app.services.guidelines import checklist, load_standards, standards_for
from app.services.merge import build_fields
from app.services.pipeline import now, recompute


def _brief(market, category, **values):
    st = BriefState(session_id="t", created_at=now(), updated_at=now(), market=market, category=category)
    st.fields, _ = build_fields({}, SheetFacts(), {}, ArtworkFacts())
    for f in st.fields:
        if f.key in values:
            f.value = values[f.key]
    recompute(st, CheckContext())
    return st


def test_every_pack_is_draft_cites_a_source_and_uses_known_fields():
    for std in load_standards().values():
        assert std.status == "draft"
        for c in std.clauses:
            if std.standard != "base":
                assert c.source and c.source["url"].startswith("https://"), c.id
            for r in c.requires:
                assert r.field in FIELD_BY_KEY and all(a in FIELD_BY_KEY for a in r.any_of), (c.id, r.field)


@pytest.mark.parametrize("market,category,pack", [
    ("US", "cosmetics", "us_cosmetics"), ("FR", "cosmetics", "eu_cosmetics"), ("IN", "cosmetics", "in_cosmetics"),
    ("IN", "food", "in_fssai"), ("US", "pharma", "us_drug"), ("DE", "pharma", "eu_medicines"),
    ("FR", "medical_device", "eu_mdr"), ("US", "household", "us_fhsa"), ("US", "pet_food", "us_pet_food"),
])
def test_market_and_category_pick_the_right_pack(market, category, pack):
    assert pack in {s.standard for s in standards_for(market, category)}


def test_a_category_without_a_pack_falls_back_to_base():
    assert {s.standard for s in standards_for("US", "industrial")} == {"base"}


def test_cosmetics_are_asked_for_cosmetic_fields_not_nutrition():
    st = _brief("FR", "cosmetics")
    missing = {i.id for i in st.issues if i.id.startswith("missing:")}
    assert "missing:responsible_person" in missing and "missing:inci_ingredients" in missing
    assert "missing:calories" not in missing and "missing:allergen_statement" not in missing
    assert not any(i.check.startswith("math.") for i in st.issues)  # Nutrition maths is food only


def test_either_field_satisfies_the_durability_rule():
    assert "missing:expiry_date" in {i.id for i in _brief("FR", "cosmetics").issues}
    assert "missing:expiry_date" not in {i.id for i in _brief("FR", "cosmetics", pao_symbol="12M").issues}
    assert "missing:expiry_date" not in {i.id for i in _brief("FR", "cosmetics", expiry_date="2027-06").issues}


def test_issue_cites_the_clause_of_its_own_market():
    st = _brief("IN", "cosmetics")
    clauses = {c for i in st.issues for c in i.clauses}
    assert "IN-COSM/licence" in clauses and not any(c.startswith(("US-", "EU-")) for c in clauses)


def test_checklist_lists_alternatives():
    rows = {r["key"]: r for r in checklist("FR", "cosmetics")}
    assert rows["expiry_date"]["or"] == ["Period after opening (PAO)"]
