"""SQLAlchemy ORM models mapping the deployed Postgres schema (public).

Column names follow migrations 0000/0001/0002 exactly — do not rename here
without a migration.
"""
from __future__ import annotations

import uuid
from datetime import datetime, date
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def ts() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


# --- Profiles & roles -------------------------------------------------------

class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = pk()
    display_name: Mapped[str | None] = mapped_column(Text)
    preferred_language: Mapped[str] = mapped_column(String(8), server_default="en")
    created_at: Mapped[datetime] = ts()
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())


class UserRole(Base):
    __tablename__ = "user_roles"

    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    role: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = ts()


# --- Legal documents --------------------------------------------------------

class LegalSource(Base):
    __tablename__ = "legal_sources"

    id: Mapped[uuid.UUID] = pk()
    title: Mapped[str] = mapped_column(Text)
    document_type: Mapped[str] = mapped_column(String(32), server_default="act")
    source_url: Mapped[str | None] = mapped_column(Text)
    version: Mapped[str] = mapped_column(Text, server_default="v1")
    is_demo: Mapped[bool] = mapped_column(Boolean, server_default="false")
    verified: Mapped[bool] = mapped_column(Boolean, server_default="false")
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = ts()


class LegalDocument(Base):
    __tablename__ = "legal_documents"

    id: Mapped[uuid.UUID] = pk()
    title: Mapped[str] = mapped_column(Text)
    act_name: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(64), server_default="general")
    description: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), server_default="pending")  # pending|approved|rejected
    version: Mapped[str] = mapped_column(Text, server_default="v1")
    language: Mapped[str] = mapped_column(String(8), server_default="en")
    file_path: Mapped[str | None] = mapped_column(Text)
    source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("public.legal_sources.id", ondelete="SET NULL"))
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    is_demo: Mapped[bool] = mapped_column(Boolean, server_default="false")
    created_at: Mapped[datetime] = ts()


class LegalDocumentChunk(Base):
    __tablename__ = "legal_document_chunks"

    id: Mapped[uuid.UUID] = pk()
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.legal_documents.id", ondelete="CASCADE"))
    act_name: Mapped[str] = mapped_column(Text)
    section_number: Mapped[str | None] = mapped_column(Text)
    section_title: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(8), server_default="en")
    chunk_index: Mapped[int] = mapped_column(Integer, server_default="0")
    embedding: Mapped[Any] = mapped_column(Vector(settings.EMBEDDING_DIM))
    embedding_model: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = ts()

    __table_args__ = (Index("idx_chunks_document", "document_id"),)


class LegalDocumentVersion(Base):
    __tablename__ = "legal_document_versions"

    id: Mapped[uuid.UUID] = pk()
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.legal_documents.id", ondelete="CASCADE"))
    version: Mapped[str] = mapped_column(Text)
    replaced_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    source_title: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = ts()


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id: Mapped[uuid.UUID] = pk()
    document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    status: Mapped[str] = mapped_column(String(16), server_default="pending")  # pending|processing|completed|failed
    error: Mapped[str | None] = mapped_column(Text)
    chunks_created: Mapped[int] = mapped_column(Integer, server_default="0")
    embeddings_created: Mapped[int] = mapped_column(Integer, server_default="0")
    pages_processed: Mapped[int] = mapped_column(Integer, server_default="0")
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = ts()
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# --- Chat -------------------------------------------------------------------

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    title: Mapped[str] = mapped_column(Text, server_default="New conversation")
    language: Mapped[str] = mapped_column(String(8), server_default="en")
    created_at: Mapped[datetime] = ts()
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (Index("idx_sessions_user", "user_id", "created_at"),)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = pk()
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.chat_sessions.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    role: Mapped[str] = mapped_column(String(16))  # user|assistant
    content: Mapped[str] = mapped_column(Text)
    citations: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="[]")
    refused: Mapped[bool] = mapped_column(Boolean, server_default="false")
    is_demo: Mapped[bool] = mapped_column(Boolean, server_default="false")
    language: Mapped[str | None] = mapped_column(String(8))
    created_at: Mapped[datetime] = ts()

    __table_args__ = (Index("idx_messages_session", "session_id"), Index("idx_messages_user", "user_id", "created_at"))


# --- Saved items ------------------------------------------------------------

class SavedItem(Base):
    __tablename__ = "saved_items"

    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    item_type: Mapped[str] = mapped_column(String(32))  # act|scheme|chat_message
    ref_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    title: Mapped[str] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = ts()

    __table_args__ = (Index("idx_saved_user", "user_id", "created_at"),)


# --- Schemes ----------------------------------------------------------------

class GovernmentScheme(Base):
    __tablename__ = "government_schemes"

    id: Mapped[uuid.UUID] = pk()
    name: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    department: Mapped[str] = mapped_column(Text, server_default="Not specified")
    level: Mapped[str] = mapped_column(String(16), server_default="central")  # central|state
    state_name: Mapped[str | None] = mapped_column(String(64))
    category: Mapped[str] = mapped_column(String(64), server_default="general")
    beneficiaries: Mapped[str | None] = mapped_column(Text)
    eligibility: Mapped[list | None] = mapped_column(JSONB, server_default="[]")
    benefits: Mapped[str | None] = mapped_column(Text)
    required_documents: Mapped[str | None] = mapped_column(Text)
    application_process: Mapped[str | None] = mapped_column(Text)
    official_url: Mapped[str | None] = mapped_column(Text)
    source_reference: Mapped[str] = mapped_column(Text, server_default="myScheme.gov.in")
    last_verified_date: Mapped[date | None] = mapped_column(Date)
    is_demo: Mapped[bool] = mapped_column(Boolean, server_default="false")
    created_at: Mapped[datetime] = ts()


class SchemeEligibilityResponse(Base):
    __tablename__ = "scheme_eligibility_responses"

    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    responses: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")
    recommended_scheme_ids: Mapped[list | None] = mapped_column(JSONB, server_default="[]")
    created_at: Mapped[datetime] = ts()


# --- Complaints / drafts ----------------------------------------------------

class ComplaintDraft(Base):
    __tablename__ = "complaint_drafts"

    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    document_type: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(Text)
    form_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")
    draft_content: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(8), server_default="en")
    created_at: Mapped[datetime] = ts()
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (Index("idx_drafts_user", "user_id", "created_at"),)


# --- Usage ------------------------------------------------------------------

class UsageEvent(Base):
    __tablename__ = "usage_events"

    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    event_type: Mapped[str] = mapped_column(String(48))
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, server_default="{}")
    created_at: Mapped[datetime] = ts()

    __table_args__ = (Index("idx_usage_user", "user_id", "created_at"),)


# --- Directory data ---------------------------------------------------------

class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    id: Mapped[uuid.UUID] = pk()
    name: Mapped[str] = mapped_column(Text)
    purpose: Mapped[str] = mapped_column(Text)
    phone_number: Mapped[str] = mapped_column(Text)
    availability: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(32), server_default="national")
    source_reference: Mapped[str] = mapped_column(Text, server_default="Official government listing")
    is_demo: Mapped[bool] = mapped_column(Boolean, server_default="false")
    display_order: Mapped[int] = mapped_column(Integer, server_default="0")
    created_at: Mapped[datetime] = ts()


class LegalAidAuthority(Base):
    __tablename__ = "legal_aid_authorities"

    id: Mapped[uuid.UUID] = pk()
    name: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(String(16))  # national|state|district
    state: Mapped[str | None] = mapped_column(String(64))
    district: Mapped[str | None] = mapped_column(String(64))
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(Text)
    source_reference: Mapped[str] = mapped_column(Text)
    last_verified_date: Mapped[date | None] = mapped_column(Date)
    is_demo: Mapped[bool] = mapped_column(Boolean, server_default="false")
    display_order: Mapped[int] = mapped_column(Integer, server_default="0")
    created_at: Mapped[datetime] = ts()
