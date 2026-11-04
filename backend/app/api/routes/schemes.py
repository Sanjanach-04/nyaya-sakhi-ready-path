"""Schemes routes: browse, detail, rule-based eligibility recommendation."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import CurrentUser
from app.db import get_db
from app.models import GovernmentScheme
from app.schemas import EligibilityAnswers, EligibilityRecommendation, SchemeOut
from app.services import eligibility as eligibility_service
from app.services import usage

router = APIRouter(prefix="/api/schemes", tags=["schemes"])


@router.get("", response_model=list[SchemeOut])
def list_schemes(
    user: CurrentUser,
    q: str | None = None,
    level: str | None = None,
    state: str | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
) -> list[SchemeOut]:
    sql = "select * from public.government_schemes where true"
    params: dict = {}
    if q:
        sql += " and (name ilike :pat or description ilike :pat or category ilike :pat or beneficiaries ilike :pat)"
        params["pat"] = f"%{q}%"
    if level:
        sql += " and level = :level"
        params["level"] = level
    if state:
        sql += " and (state_name = :state or level = 'central')"
        params["state"] = state
    if category:
        sql += " and category = :category"
        params["category"] = category
    sql += " order by name limit 200"
    rows = db.execute(text(sql), params).mappings().all()
    return [eligibility_service.to_out(GovernmentScheme(**dict(r))) for r in rows]


@router.get("/{scheme_id}", response_model=SchemeOut)
def scheme_detail(scheme_id: str, user: CurrentUser, db: Session = Depends(get_db)) -> SchemeOut:
    row = db.execute(
        text("select * from public.government_schemes where id = :sid"), {"sid": scheme_id}
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Scheme not found")
    return eligibility_service.to_out(GovernmentScheme(**dict(row)))


@router.post("/recommend", response_model=EligibilityRecommendation)
def recommend(
    payload: EligibilityAnswers, user: CurrentUser, db: Session = Depends(get_db)
) -> EligibilityRecommendation:
    rows = db.execute(text("select * from public.government_schemes order by name")).mappings().all()
    schemes = [GovernmentScheme(**dict(r)) for r in rows]
    buckets = eligibility_service.group_eligibility(schemes, payload)
    usage.log_event(db, user.id, "scheme_recommendation")

    recommendation = EligibilityRecommendation(
        results=buckets["potentially_eligible"] + buckets["needs_verification"] + buckets["not_matching"],
        potentially_eligible=buckets["potentially_eligible"],
        needs_verification=buckets["needs_verification"],
        not_matching=buckets["not_matching"],
    )
    # Store the questionnaire response for the user's history.
    try:
        db.execute(
            text(
                "insert into public.scheme_eligibility_responses (user_id, responses, recommended_scheme_ids) "
                "values (:uid, cast(:responses as jsonb), cast(:recommended as jsonb))"
            ),
            {
                "uid": user.id,
                "responses": json.dumps(payload.model_dump()),
                "recommended": json.dumps([r.scheme_id for r in buckets["potentially_eligible"]]),
            },
        )
        db.commit()
    except Exception:
        db.rollback()
    return recommendation
