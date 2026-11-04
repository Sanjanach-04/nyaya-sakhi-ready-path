"""Tests for the rule-based eligibility grouping."""
from __future__ import annotations

import uuid

from app.models import GovernmentScheme
from app.schemas import EligibilityAnswers
from app.services.eligibility import group_eligibility


def scheme(name, rules):
    return GovernmentScheme(
        id=uuid.uuid4(), name=name, description="demo", department="demo",
        level="central", state_name=None, category="demo", beneficiaries=None,
        eligibility=rules, benefits=None, required_documents=None,
        application_process=None, official_url=None, source_reference="demo",
    )


def answers(**overrides):
    base = dict(
        state="Karnataka", age_band="46_60", marital_status="married",
        social_category="obc", income_band="below_1l", occupation="homemaker",
        has_disability=False, housing="own",
    )
    base.update(overrides)
    return EligibilityAnswers(**base)


def test_matching_scheme_is_potentially_eligible():
    schemes = [scheme("Pension", [{"field": "age_band", "values": ["46_60", "above_60"]}])]
    buckets = group_eligibility(schemes, answers())
    assert len(buckets["potentially_eligible"]) == 1
    assert buckets["potentially_eligible"][0].scheme_id == str(schemes[0].id)


def test_non_matching_goes_to_not_matching_with_reason():
    schemes = [scheme("Pension", [{"field": "age_band", "values": ["above_60"], "note": "Only for 60+"}])]
    buckets = group_eligibility(schemes, answers(age_band="18_30"))
    assert len(buckets["not_matching"]) == 1
    assert "60+" in buckets["not_matching"][0].reason


def test_unanswered_field_goes_to_needs_verification():
    schemes = [scheme("Pension", [{"field": "income_band", "values": ["below_1l"]}])]
    buckets = group_eligibility(schemes, answers(income_band=None))
    assert len(buckets["needs_verification"]) == 1


def test_scheme_without_rules_needs_verification():
    schemes = [scheme("Mystery", [])]
    buckets = group_eligibility(schemes, answers())
    assert len(buckets["needs_verification"]) == 1


def test_bucket_totals_cover_all_schemes():
    schemes = [
        scheme("A", [{"field": "age_band", "values": ["46_60"]}]),
        scheme("B", [{"field": "age_band", "values": ["above_60"]}]),
        scheme("C", []),
    ]
    buckets = group_eligibility(schemes, answers())
    total = sum(len(v) for v in buckets.values())
    assert total == 3
    assert len(buckets["potentially_eligible"]) == 1
    assert len(buckets["not_matching"]) == 1
    assert len(buckets["needs_verification"]) == 1
