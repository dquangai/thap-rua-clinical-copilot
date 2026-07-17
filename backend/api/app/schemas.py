from datetime import date, datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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
