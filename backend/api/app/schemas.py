from datetime import date, datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from pydantic import EmailStr


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)


class Sex(str, Enum):
    female = "FEMALE"
    male = "MALE"
    other = "OTHER"


class EncounterStatus(str, Enum):
    waiting = "WAITING"
    in_progress = "IN_PROGRESS"
    result_ready = "RESULT_READY"
    completed = "COMPLETED"
    cancelled = "CANCELLED"


class PatientCreate(ApiModel):
    medical_record_number: str = Field(min_length=1, max_length=40)
    full_name: str = Field(min_length=1, max_length=200)
    date_of_birth: date
    sex: Sex
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = None


class Patient(PatientCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime


class EncounterCreate(ApiModel):
    patient_id: UUID
    department_id: UUID
    reason: str = Field(min_length=1)
    attending_clinician_id: UUID | None = None
    queue_number: str | None = Field(default=None, max_length=30)


class Encounter(ApiModel):
    id: UUID
    patient_id: UUID
    department_id: UUID
    status: EncounterStatus
    reason: str
    attending_clinician_id: UUID | None
    queue_number: str | None
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime
    updated_at: datetime


class EncounterStatusUpdate(ApiModel):
    status: EncounterStatus
    reason: str = Field(min_length=1, description="Reason recorded in the audit event")


class ClinicalNoteCreate(ApiModel):
    type: str = Field(pattern="^(PROGRESS|ASSESSMENT|PLAN|DISCHARGE)$")
    content: str = Field(min_length=1)
    source: str = Field(default="HUMAN", pattern="^(HUMAN|AI_DRAFT)$")
    reason: str = Field(min_length=1)


class ClinicalNote(ApiModel):
    id: UUID
    encounter_id: UUID
    type: str
    content: str
    authored_by: UUID
    authored_at: datetime
    source: str


class Workspace(ApiModel):
    patient: dict[str, Any]
    encounter: dict[str, Any]
    notes: list[dict[str, Any]]
    vital_signs: dict[str, Any] | None = None
    diagnoses: list[dict[str, Any]] = Field(default_factory=list)
    conclusion: dict[str, Any] | None = None


class ClinicalRecordImport(ApiModel):
    record_id: str = Field(min_length=1, max_length=100)
    visit: dict[str, Any]
    patient: dict[str, Any]
    vital_signs: dict[str, Any]
    clinical_note: dict[str, Any]
    diagnosis: dict[str, Any]
    doctor: str = Field(min_length=1)
    signed_at: datetime


class ClinicalRecordImportResult(ApiModel):
    encounter_id: UUID


class LoginRequest(ApiModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class RefreshTokenRequest(ApiModel):
    refresh_token: str = Field(min_length=1)


class AuthTokens(ApiModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    expires_at: int | None = None


class AuthUser(ApiModel):
    id: UUID
    email: EmailStr | None = None
