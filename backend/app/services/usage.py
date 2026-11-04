"""Usage event logging (including refusals). usage_events.user_id is NOT NULL
in the schema; anonymous events are skipped."""
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models import UsageEvent


def log_event(db: Session, user_id: str | None, event_type: str) -> None:
    if not user_id:
        return
    try:
        db.add(
            UsageEvent(
                user_id=uuid.UUID(user_id),
                event_type=event_type,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
