"""Pydantic v2 request/response schemas. Shapes mirror the frontend client in
src/lib/api.ts — keep the two in sync."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

# --- Shared -----------------------------------------------------------------

class Citation(BaseModel):
    chunk_id: str
    act: str
    section: str | None = None
    section_title: str | None = None
    document_title: str
    document_version: str
    is_demo: bool = False
    similarity: float = 0.0
    snippet: str | None = None


class NextStepOption(BaseModel):
    label: str
    description: str
    link: str


# --- Auth -------------------------------------------------------------------

class ProfileOut(BaseModel):
    id: str
    email: str | None = None
    display_name: str | None = None
    preferred_language: Literal["en", "hi", "kn"] = "en"
    created_at: datetime | None = None
    is_admin: bool = False


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    preferred_language: Literal["en", "hi", "kn"] | None = None


# --- Chat -------------------------------------------------------------------

class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    language: Literal["en", "hi", "kn"] = "en"
    session_id: str | None = None


class ChatAnswer(BaseModel):
    # None for guests: guest answers are never stored.
    session_id: str | None = None
    message_id: str | None = None
    refused: bool = False
    refusal_reason: str | None = None
    explanation: str
    act_name: str | None = None
    section_number: str | None = None
    citations: list[Citation] = []
    disclaimer: str = "This answer is for legal literacy, not professional legal advice."
    next_steps: list[NextStepOption] = []
    language: Literal["en", "hi", "kn"] = "en"


class ChatMessageOut(BaseModel):
    id: str
    session_id: str
    role: Literal["user", "assistant"]
    content: str
    citations: list[Citation] | dict = []
    refused: bool = False
    created_at: datetime


class ChatSessionSummary(BaseModel):
    id: str
    title: str
    language: str
    created_at: datetime
    updated_at: datetime


class ChatThreadOut(BaseModel):
    session: ChatSessionSummary
    messages: list[ChatMessageOut]


# --- Legal ------------------------------------------------------------------

class LegalActSummary(BaseModel):
    id: str
    title: str
    act_name: str
    category: str
    description: str | None = None
    summary: str | None = None
    version: str
    language: str
    is_demo: bool = False
    updated_at: datetime | None = None


class LegalProvision(BaseModel):
    chunk_id: str
    act_name: str
    section_number: str | None = None
    section_title: str | None = None
    content: str
    plain_explanation: str | None = None


class LegalActDetail(BaseModel):
    id: str
    title: str
    act_name: str
    category: str
    description: str | None = None
    summary: str | None = None
    version: str
    language: str
    is_demo: bool = False
    updated_at: datetime | None = None
    source_title: str | None = None
    source_url: str | None = None
    source_version: str | None = None
    provisions: list[LegalProvision] = []


# --- Schemes ----------------------------------------------------------------

class SchemeEligibilityRule(BaseModel):
    field: str
    values: list[str] | None = None
    min: float | None = None
    max: float | None = None
    note: str | None = None


class SchemeOut(BaseModel):
    id: str
    name: str
    description: str
    department: str
    level: Literal["central", "state"]
    state_name: str | None = None
    category: str
    beneficiaries: str | None = None
    eligibility: list[SchemeEligibilityRule] = []
    benefits: str | None = None
    required_documents: str | None = None
    application_process: str | None = None
    official_url: str | None = None
    source_reference: str
    last_verified_date: datetime | None = None
    is_demo: bool = False


class EligibilityAnswers(BaseModel):
    state: str | None = Field(default=None, max_length=64)
    age_band: Literal["below_18", "18_30", "31_45", "46_60", "above_60"] | None = None
    marital_status: Literal["single", "married", "widowed", "divorced"] | None = None
    social_category: Literal["general", "sc", "st", "obc"] | None = None
    income_band: Literal["below_1l", "1l_3l", "3l_6l", "above_6l"] | None = None
    occupation: Literal["student", "homemaker", "farmer", "daily_wage", "salaried", "self_employed", "unemployed"] | None = None
    has_disability: bool | None = None
    housing: Literal["own", "rented", "kacha", "homeless"] | None = None


class EligibilityResult(BaseModel):
    scheme_id: str
    name: str
    bucket: Literal["potentially_eligible", "needs_verification", "not_matching"]
    reason: str


class EligibilityRecommendation(BaseModel):
    results: list[EligibilityResult] = []
    potentially_eligible: list[EligibilityResult] = []
    needs_verification: list[EligibilityResult] = []
    not_matching: list[EligibilityResult] = []
    disclaimer: str = (
        "This is only an indication based on your answers. Eligibility is decided by the "
        "scheme authority — always confirm on the official page."
    )


# --- Complaints -------------------------------------------------------------

class ComplaintTemplateField(BaseModel):
    key: str
    label: str
    required: bool = False
    multiline: bool = False
    personal: bool = False
    placeholder: str | None = None


class ComplaintTemplate(BaseModel):
    type: str
    title: str
    description: str
    fields: list[ComplaintTemplateField]


class ComplaintGenerateRequest(BaseModel):
    document_type: str = Field(min_length=1, max_length=64)
    fields: dict[str, Any]
    language: Literal["en", "hi", "kn"] = "en"


class ComplaintDraftCreate(BaseModel):
    document_type: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=250)
    form_data: dict[str, Any] = {}
    draft_content: str = Field(min_length=1)
    language: Literal["en", "hi", "kn"] = "en"


class ComplaintDraftOut(BaseModel):
    id: str
    document_type: str
    title: str
    form_data: dict[str, Any] = {}
    draft_content: str
    language: str
    created_at: datetime
    updated_at: datetime | None = None


class ComplaintDraftUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=250)
    draft_content: str | None = None
    form_data: dict[str, Any] | None = None
    language: Literal["en", "hi", "kn"] | None = None


# --- Emergency / legal aid / saved ------------------------------------------

class EmergencyContactOut(BaseModel):
    id: str
    name: str
    purpose: str
    phone_number: str
    availability: str | None = None
    category: str
    is_demo: bool = False
    source_reference: str
    display_order: int = 0


class LegalAidAuthorityOut(BaseModel):
    id: str
    name: str
    level: Literal["national", "state", "district"]
    state: str | None = None
    district: str | None = None
    address: str | None = None
    phone: str | None = None
    website: str | None = None
    source_reference: str
    last_verified_date: datetime | None = None
    is_demo: bool = False


class SavedItemOut(BaseModel):
    id: str
    item_type: Literal["act", "scheme", "chat_message"]
    ref_id: str | None = None
    title: str
    note: str | None = None
    created_at: datetime


class SavedItemCreate(BaseModel):
    item_type: Literal["act", "scheme", "chat_message"]
    ref_id: str | None = None
    title: str = Field(min_length=1, max_length=300)
    note: str | None = None


# --- Speech -----------------------------------------------------------------

class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    language: Literal["en", "hi", "kn"] = "en"


class TTSSuccess(BaseModel):
    audio_base64: str
    media_type: str = "audio/mpeg"


class STTSuccess(BaseModel):
    text: str


# --- Admin ------------------------------------------------------------------

class AdminDocumentOut(BaseModel):
    id: str
    title: str
    act_name: str
    category: str
    description: str | None = None
    summary: str | None = None
    status: Literal["pending", "approved", "rejected"]
    version: str
    language: str
    file_path: str | None = None
    is_demo: bool = False
    chunk_count: int = 0
    created_at: datetime
    updated_at: datetime | None = None


class AdminDocumentList(BaseModel):
    documents: list[AdminDocumentOut]


class AdminActionOut(BaseModel):
    id: str
    status: str


class IngestionJobOut(BaseModel):
    id: str
    document_id: str | None = None
    status: Literal["pending", "processing", "completed", "failed"]
    error: str | None = None
    chunks_created: int = 0
    embeddings_created: int = 0
    pages_processed: int = 0
    created_at: datetime
    completed_at: datetime | None = None


class AdminSchemeIn(BaseModel):
    name: str = Field(min_length=2, max_length=250)
    description: str = Field(min_length=2)
    department: str = Field(min_length=1, max_length=200, default="Not specified")
    level: Literal["central", "state"] = "central"
    state_name: str | None = Field(default=None, max_length=64)
    category: str = "general"
    beneficiaries: str | None = None
    eligibility: list[SchemeEligibilityRule] | None = None
    benefits: str | None = None
    required_documents: str | None = None
    application_process: str | None = None
    official_url: str | None = Field(default=None, max_length=500)
    source_reference: str = "myScheme.gov.in"
    is_demo: bool = False


class AdminEmergencyIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    purpose: str = Field(min_length=2, max_length=300)
    phone_number: str = Field(min_length=3, max_length=32)
    availability: str | None = Field(default=None, max_length=120)
    category: str = "national"
    source_reference: str = Field(min_length=2, max_length=300)
    is_demo: bool = False
    display_order: int = 0


class AdminLegalAidIn(BaseModel):
    name: str = Field(min_length=2, max_length=250)
    level: Literal["national", "state", "district"]
    state: str | None = Field(default=None, max_length=64)
    district: str | None = Field(default=None, max_length=64)
    address: str | None = None
    phone: str | None = Field(default=None, max_length=32)
    website: str | None = Field(default=None, max_length=500)
    source_reference: str = Field(min_length=2, max_length=300)
    is_demo: bool = False
    display_order: int = 0


class UsageStats(BaseModel):
    users: int
    chat_sessions: int
    chat_messages: int
    drafts: int
    refusals: int
    questions: int
    approved_documents: int
    pending_documents: int
    schemes: int
