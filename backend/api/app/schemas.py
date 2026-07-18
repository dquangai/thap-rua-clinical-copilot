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


<<<<<<< HEAD
class ClinicalRecord(ClinicalRecordCreate):
    id: str
    patient_id: str
    created_at: datetime
    updated_at: datetime
=======
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
    role: str = "DOCTOR"
    active: bool = True


class AdminUserCreate(ApiModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=200)
    department_id: UUID | None = None
    role: str = Field(default="DOCTOR", pattern="^(ADMIN|DOCTOR)$")


class AdminUserUpdate(ApiModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    department_id: UUID | None = None
    role: str | None = Field(default=None, pattern="^(ADMIN|DOCTOR)$")
    active: bool | None = None


class AdminRecordAction(ApiModel):
    reason: str = Field(min_length=3, max_length=500)
>>>>>>> db90767f961a5f7159500429b95e69d6ca7049f6
