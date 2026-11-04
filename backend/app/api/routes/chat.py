"""Chat routes: ask (RAG with strict refusal + citation validation), history."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.rate_limit import enforce_guest_chat_limit
from app.core.security import CurrentUser, OptionalUser
from app.db import get_db, get_public_db
from app.schemas import (
    AskRequest,
    ChatAnswer,
    ChatMessageOut,
    ChatSessionSummary,
    ChatThreadOut,
    Citation,
    NextStepOption,
)
from app.services import citation_validation, llm_generation, rag_retrieval, refusal_confidence
from app.services import translation as translation_service
from app.services import usage

router = APIRouter(prefix="/api/chat", tags=["chat"])

EMERGENCY_KEYWORDS = ("violence", "beat", "attack", "threat", "burn", "throw", "hurt", "danger", "assault")
DRAFTER_KEYWORDS = ("complaint", "draft", "letter", "application", "petition", "police")

NEXT_STEP_OPTIONS: dict[str, NextStepOption] = {
    "legal-aid": NextStepOption(
        label="Free legal aid",
        description="Contact NALSA or your State/District Legal Services Authority for free help.",
        link="/legal-aid",
    ),
    "emergency": NextStepOption(
        label="Emergency help",
        description="If you are in immediate danger, call 112 or 181 now.",
        link="/emergency",
    ),
    "drafter": NextStepOption(
        label="Draft a complaint",
        description="Prepare a written complaint or application you can review and submit yourself.",
        link="/drafter",
    ),
}


def _session_exists(db: Session, session_id: str, user_id: str) -> bool:
    row = db.execute(
        text("select 1 from public.chat_sessions where id = :sid and user_id = :uid"),
        {"sid": session_id, "uid": user_id},
    ).first()
    return bool(row)


def _insert_message(
    db: Session,
    session_id: str,
    user_id: str,
    role: str,
    content: str,
    *,
    citations: list[dict] | None = None,
    refused: bool = False,
    is_demo: bool = False,
    language: str | None = None,
) -> str:
    row_id = db.execute(
        text(
            "insert into public.chat_messages (session_id, user_id, role, content, citations, refused, is_demo, language) "
            "values (:sid, :uid, :role, :content, cast(:citations as jsonb), :refused, :is_demo, :language) "
            "returning id"
        ),
        {
            "sid": session_id,
            "uid": user_id,
            "role": role,
            "content": content,
            "citations": json.dumps(citations) if citations is not None else "[]",
            "refused": refused,
            "is_demo": is_demo,
            "language": language,
        },
    ).scalar_one()
    db.execute(
        text("update public.chat_sessions set updated_at = now() where id = :sid"),
        {"sid": session_id},
    )
    db.commit()
    return str(row_id)


def _next_steps(question: str, refused: bool) -> list[NextStepOption]:
    keys = ["legal-aid"]
    q = question.lower()
    if any(k in q for k in EMERGENCY_KEYWORDS):
        keys.append("emergency")
    if refused or any(k in q for k in DRAFTER_KEYWORDS):
        keys.append("drafter")
    return [NEXT_STEP_OPTIONS[k] for k in keys]


@router.post("/ask", response_model=ChatAnswer)
def ask(
    payload: AskRequest,
    request: Request,
    user: OptionalUser,
    db: Session = Depends(get_public_db),
) -> ChatAnswer:
    """RAG answer for signed-in users AND guests.

    The same approved-only retrieval, similarity threshold, context-only LLM
    and citation validation run for everyone. Guests (no valid token) are
    rate limited per IP and NOTHING is stored for them: no session, no
    messages, no usage events. The guest conversation lives in the browser.
    """
    guest = user is None
    uid = None if guest else user.id
    session_id: str | None = payload.session_id

    if guest:
        enforce_guest_chat_limit(request)
        session_id = None  # guests never read or write stored conversations
    elif session_id:
        if not _session_exists(db, session_id, uid):
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        title = payload.question[:60]
        row_id = db.execute(
            text("insert into public.chat_sessions (user_id, title, language) values (:uid, :title, :lang) returning id"),
            {"uid": uid, "title": title, "lang": payload.language},
        ).scalar_one()
        session_id = str(row_id)
        db.commit()

    def store(role: str, content: str, **kwargs) -> str | None:
        if guest or session_id is None:
            return None
        return _insert_message(db, session_id, uid, role, content, **kwargs)

    store("user", payload.question, language=payload.language)
    usage.log_event(db, uid, "chat_question")

    try:
        result = rag_retrieval.retrieve_for_question(db, payload.question)
    except Exception:
        usage.log_event(db, uid, "chat_refusal")
        raise

    if not result.chunks:
        refusal = refusal_confidence.refusal_for(result.chunks, result.best_similarity)
        kind = "out_of_scope" if result.best_similarity is not None else "no_retrieval"
        message_id = store("assistant", refusal, refused=True, language=payload.language)
        usage.log_event(db, uid, "chat_refusal")
        return ChatAnswer(
            session_id=session_id,
            message_id=message_id,
            refused=True,
            refusal_reason=kind,
            explanation=refusal,
            language=payload.language,  # type: ignore[arg-type]
            next_steps=_next_steps(payload.question, True),
        )

    try:
        generated = llm_generation.generate_answer(payload.question, result.chunks)
        validated = citation_validation.validate_citations(generated, result.chunks)
    except llm_generation.LLMNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except (ValueError, citation_validation.CitationValidationError):
        # Fabricated or invalid output → the same safe refusal, logged.
        refusal = refusal_confidence.REFUSAL_VALIDATION
        message_id = store("assistant", refusal, refused=True, language=payload.language)
        usage.log_event(db, uid, "chat_refusal_validation")
        usage.log_event(db, uid, "chat_refusal")
        return ChatAnswer(
            session_id=session_id,
            message_id=message_id,
            refused=True,
            refusal_reason="citation_validation_failed",
            explanation=refusal,
            language=payload.language,  # type: ignore[arg-type]
            next_steps=_next_steps(payload.question, True),
        )

    explanation = str(generated.get("explanation", "")).strip()
    explanation, _translated = translation_service.translate_text(explanation, payload.language)

    chunk_by_id = {c.chunk_id: c for c in result.chunks}
    citations = [
        Citation(
            chunk_id=c.chunk_id,
            act=c.act,
            section=c.section,
            section_title=chunk_by_id[c.chunk_id].section_title,
            document_title=chunk_by_id[c.chunk_id].document_title or chunk_by_id[c.chunk_id].act_name,
            document_version=chunk_by_id[c.chunk_id].document_version or "v1",
            is_demo=chunk_by_id[c.chunk_id].is_demo,
            similarity=chunk_by_id[c.chunk_id].similarity,
            snippet=chunk_by_id[c.chunk_id].content[:220],
        )
        for c in validated
    ]
    is_demo = any(c.is_demo for c in citations)
    act_name = citations[0].act if citations else None
    section_number = citations[0].section if citations else None

    message_id = store(
        "assistant", explanation,
        citations=[c.model_dump() for c in citations],
        refused=False, is_demo=is_demo, language=payload.language,
    )
    usage.log_event(db, uid, "chat_answered")

    return ChatAnswer(
        session_id=session_id,
        message_id=message_id,
        explanation=explanation,
        act_name=act_name,
        section_number=section_number,
        citations=citations,
        is_demo=is_demo,
        refused=False,
        refusal_reason=None,
        language=payload.language,  # type: ignore[arg-type]
        next_steps=_next_steps(payload.question, False),
    )


@router.get("/history", response_model=list[ChatSessionSummary])
def history(user: CurrentUser, db: Session = Depends(get_db)) -> list[ChatSessionSummary]:
    rows = db.execute(
        text(
            "select id, title, language, created_at, updated_at "
            "from public.chat_sessions where user_id = :uid order by created_at desc limit 100"
        ),
        {"uid": user.id},
    ).mappings().all()
    return [
        ChatSessionSummary(
            id=str(r["id"]), title=r["title"], language=r["language"],
            created_at=r["created_at"], updated_at=r["updated_at"] or r["created_at"],
        )
        for r in rows
    ]


@router.get("/history/{session_id}", response_model=ChatThreadOut)
def thread(session_id: str, user: CurrentUser, db: Session = Depends(get_db)) -> ChatThreadOut:
    if not _session_exists(db, session_id, user.id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    session_row = db.execute(
        text("select id, title, language, created_at, updated_at from public.chat_sessions where id = :sid"),
        {"sid": session_id},
    ).mappings().one()
    message_rows = db.execute(
        text(
            "select id, session_id, role, content, citations, refused, created_at "
            "from public.chat_messages where session_id = :sid order by created_at asc"
        ),
        {"sid": session_id},
    ).mappings().all()
    return ChatThreadOut(
        session=ChatSessionSummary(
            id=str(session_row["id"]),
            title=session_row["title"],
            language=session_row["language"],
            created_at=session_row["created_at"],
            updated_at=session_row["updated_at"] or session_row["created_at"],
        ),
        messages=[
            ChatMessageOut(
                id=str(r["id"]),
                session_id=str(r["session_id"]),
                role=r["role"],  # type: ignore[arg-type]
                content=r["content"],
                citations=[Citation(**c) for c in (r["citations"] or []) if isinstance(c, dict)] or {},
                refused=bool(r["refused"]),
                created_at=r["created_at"],
            )
            for r in message_rows
        ],
    )


@router.delete("/history/{session_id}")
def delete_thread(session_id: str, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    result = db.execute(
        text("delete from public.chat_sessions where id = :sid and user_id = :uid"),
        {"sid": session_id, "uid": user.id},
    )
    db.commit()
    if (result.rowcount or 0) == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"deleted": True}


@router.delete("/history")
def delete_all_threads(user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    db.execute(text("delete from public.chat_sessions where user_id = :uid"), {"uid": user.id})
    db.commit()
    return {"deleted": True}
