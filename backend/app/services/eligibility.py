"""Rule-based scheme eligibility grouping.

DB format: government_schemes.eligibility is a JSONB ARRAY of rules:
    {"field": "age_band", "values": ["46_60", "above_60"], "note": "..."}

Three buckets: potentially_eligible, needs_verification, not_matching — each
with a plain-language reason. Never guarantees eligibility.
"""
from __future__ import annotations

from app.models import GovernmentScheme
from app.schemas import EligibilityAnswers, EligibilityResult, SchemeEligibilityRule, SchemeOut

ANSWER_LABELS = {
    "state": "the state you live in",
    "age_band": "your age band",
    "marital_status": "your marital status",
    "social_category": "your social category",
    "income_band": "your income band",
    "occupation": "your occupation",
    "has_disability": "whether you have a disability",
    "housing": "your housing situation",
}


def _check(rule: SchemeEligibilityRule, answers: dict) -> bool | None:
    """True = satisfied, False = explicitly not matching, None = user skipped."""
    value = answers.get(rule.field)
    if value is None or value == "":
        return None
    if rule.values:
        return str(value) in [str(v) for v in rule.values]
    if rule.min is not None or rule.max is not None:
        try:
            v = float(value)
        except (TypeError, ValueError):
            return None
        if rule.min is not None and v < rule.min:
            return False
        if rule.max is not None and v > rule.max:
            return False
        return True
    return None


def _scheme_bucket(scheme: GovernmentScheme, answers: dict) -> tuple[str, str]:
    rules_raw = scheme.eligibility or []
    try:
        rules = [SchemeEligibilityRule(**r) for r in rules_raw if isinstance(r, dict)]
    except Exception:
        return "needs_verification", "Eligibility criteria are listed on the official page — verify there."
    if not rules:
        return "needs_verification", "Eligibility criteria are listed on the official page — verify there."

    skipped: list[str] = []
    for rule in rules:
        result = _check(rule, answers)
        if result is None:
            skipped.append(ANSWER_LABELS.get(rule.field, rule.field))
            continue
        if result is False:
            reason = rule.note or f"Not matching: this scheme has different criteria for {ANSWER_LABELS.get(rule.field, rule.field)}."
            return "not_matching", reason
    if skipped:
        return (
            "needs_verification",
            "You did not answer everything this scheme asks about ("
            + ", ".join(skipped)
            + ") — check the official criteria.",
        )
    return "potentially_eligible", "Your answers match the stated eligibility criteria for this scheme."


def to_out(scheme: GovernmentScheme) -> SchemeOut:
    return SchemeOut(
        id=str(scheme.id),
        name=scheme.name,
        description=scheme.description,
        department=scheme.department,
        level=scheme.level,  # type: ignore[arg-type]
        state_name=scheme.state_name,
        category=scheme.category,
        beneficiaries=scheme.beneficiaries,
        eligibility=[SchemeEligibilityRule(**r) for r in (scheme.eligibility or []) if isinstance(r, dict)],
        benefits=scheme.benefits,
        required_documents=scheme.required_documents,
        application_process=scheme.application_process,
        official_url=scheme.official_url,
        source_reference=scheme.source_reference,
        last_verified_date=scheme.last_verified_date,
        is_demo=scheme.is_demo,
    )


def group_eligibility(
    schemes: list[GovernmentScheme], answers: EligibilityAnswers
) -> dict[str, list[EligibilityResult]]:
    a = answers.model_dump()
    buckets: dict[str, list[EligibilityResult]] = {
        "potentially_eligible": [],
        "needs_verification": [],
        "not_matching": [],
    }
    for scheme in schemes:
        bucket, reason = _scheme_bucket(scheme, a)
        result = EligibilityResult(scheme_id=str(scheme.id), name=scheme.name, bucket=bucket, reason=reason)
        buckets[bucket].append(result)
    return buckets
