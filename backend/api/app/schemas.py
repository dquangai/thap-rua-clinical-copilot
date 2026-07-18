from datetime import date, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)


class Sex(str, Enum):
    female = "FEMALE"
    male = "MALE"
    other = "OTHER"


class PatientCreate(ApiModel):
    medical_record_number: str = Field(min_length=1, max_length=40)
    full_name: str = Field(min_length=1, max_length=200)
    date_of_birth: date | None = None
    sex: Sex
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = None


class Patient(PatientCreate):
    id: str
    created_at: datetime
    updated_at: datetime


class ClinicalRecordCreate(ApiModel):
    record_id: str | None = Field(default=None, max_length=100)
    visit: dict[str, Any] = Field(default_factory=dict)
    vital_signs: dict[str, Any] = Field(default_factory=dict)
    clinical_note: dict[str, Any] = Field(default_factory=dict)
    diagnosis: dict[str, Any] = Field(default_factory=dict)
    doctor: str | None = None
    signed_at: datetime | None = None


class ClinicalRecordUpdate(ApiModel):
    record_id: str | None = Field(default=None, max_length=100)
    visit: dict[str, Any] | None = None
    vital_signs: dict[str, Any] | None = None
    clinical_note: dict[str, Any] | None = None
    diagnosis: dict[str, Any] | None = None
    doctor: str | None = None
    signed_at: datetime | None = None


class ClinicalRecord(ClinicalRecordCreate):
    id: str
    patient_id: str
    current_version: int = 1
    content_hash: str = ""
    updated_by: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ClinicalRecordVersion(ApiModel):
    id: str
    record_id: str
    patient_id: str
    version: int
    snapshot: dict[str, Any]
    content_hash: str
    changed_fields: list[str] = Field(default_factory=list)
    created_by: dict[str, Any]
    created_at: datetime
    restored_from_version: int | None = None


class ClinicalRecordRestore(ApiModel):
    expected_version: int = Field(ge=1)


class ClinicalRecordDiff(ApiModel):
    record_id: str
    from_version: int | None
    to_version: int
    changed_fields: list[str] = Field(default_factory=list)
    changes: dict[str, dict[str, Any]] = Field(default_factory=dict)
