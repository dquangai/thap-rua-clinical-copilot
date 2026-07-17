-- Structured storage for clinical conclusion records received from HIS/EMR or AI pipelines.
alter table public.patients alter column date_of_birth drop not null;

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (department_id, name)
);

alter table public.encounters
  add column external_record_id text unique,
  add column visit_code text unique,
  add column visit_datetime timestamptz,
  add column clinic_id uuid references public.clinics(id),
  add column reported_age smallint check (reported_age between 0 and 130),
  add column attending_doctor_name text,
  add column signed_at timestamptz;

create table public.vital_signs (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null unique references public.encounters(id) on delete restrict,
  pulse_per_minute smallint check (pulse_per_minute between 0 and 300),
  temperature_c numeric(4,1) check (temperature_c between 25 and 45),
  systolic_bp_mmhg smallint check (systolic_bp_mmhg between 0 and 300),
  diastolic_bp_mmhg smallint check (diastolic_bp_mmhg between 0 and 200),
  respiratory_rate_per_minute smallint check (respiratory_rate_per_minute between 0 and 100),
  height_cm numeric(5,1) check (height_cm between 0 and 300),
  weight_kg numeric(6,2) check (weight_kg between 0 and 700),
  bmi numeric(5,2) check (bmi between 0 and 100),
  blood_glucose_mg_dl numeric(7,2) check (blood_glucose_mg_dl between 0 and 2000),
  recorded_at timestamptz not null default now()
);

create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete restrict,
  icd10_code text not null,
  description text not null,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  unique (encounter_id, icd10_code)
);

create table public.clinical_conclusions (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null unique references public.encounters(id) on delete restrict,
  disease_progress text not null,
  treatment_plan text not null,
  signed_by_name text not null,
  signed_at timestamptz not null,
  source_payload jsonb not null,
  payload_schema_version text not null default '1.0',
  created_at timestamptz not null default now()
);

create index encounters_visit_datetime_idx on public.encounters(visit_datetime desc);
create index diagnoses_icd10_code_idx on public.diagnoses(icd10_code);

alter table public.clinics enable row level security;
alter table public.vital_signs enable row level security;
alter table public.diagnoses enable row level security;
alter table public.clinical_conclusions enable row level security;

create policy "doctors can read clinics" on public.clinics for select to authenticated
using (public.is_active_doctor());
create policy "doctors can read vital signs" on public.vital_signs for select to authenticated
using (public.is_active_doctor());
create policy "doctors can create vital signs" on public.vital_signs for insert to authenticated
with check (public.is_active_doctor());
create policy "doctors can read diagnoses" on public.diagnoses for select to authenticated
using (public.is_active_doctor());
create policy "doctors can create diagnoses" on public.diagnoses for insert to authenticated
with check (public.is_active_doctor());
create policy "doctors can read conclusions" on public.clinical_conclusions for select to authenticated
using (public.is_active_doctor());
create policy "doctors can create conclusions" on public.clinical_conclusions for insert to authenticated
with check (public.is_active_doctor());

-- Called by the trusted backend with the Supabase secret key. The payload is retained
-- verbatim for traceability while clinically searchable fields are normalized.
create or replace function public.import_clinical_record(payload jsonb, actor_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_department_id uuid;
  v_clinic_id uuid;
  v_patient_id uuid;
  v_encounter_id uuid;
  v_gender public.patient_sex;
begin
  if nullif(payload ->> 'record_id', '') is null
     or nullif(payload #>> '{visit,visit_code}', '') is null
     or nullif(payload #>> '{patient,full_name}', '') is null then
    raise exception 'record_id, visit.visit_code and patient.full_name are required';
  end if;

  if exists (select 1 from public.encounters where external_record_id = payload ->> 'record_id') then
    raise exception 'record_id % already exists', payload ->> 'record_id';
  end if;

  insert into public.departments (code, name)
  values (
    upper(regexp_replace(payload #>> '{visit,department}', '[^[:alnum:]]+', '-', 'g')),
    payload #>> '{visit,department}'
  )
  on conflict (code) do update set name = excluded.name
  returning id into v_department_id;

  insert into public.clinics (department_id, name)
  values (v_department_id, payload #>> '{visit,clinic}')
  on conflict (department_id, name) do update set name = excluded.name
  returning id into v_clinic_id;

  v_gender := case lower(payload #>> '{patient,gender}')
    when 'nữ' then 'FEMALE'::public.patient_sex
    when 'nam' then 'MALE'::public.patient_sex
    else 'OTHER'::public.patient_sex
  end;

  -- The sample has no durable patient identifier or date of birth. A synthetic MRN
  -- is scoped to this source record; production integrations should send both.
  insert into public.patients (
    medical_record_number, full_name, date_of_birth, sex, phone, address
  ) values (
    'SRC-' || payload ->> 'record_id',
    payload #>> '{patient,full_name}',
    null,
    v_gender,
    payload #>> '{patient,phone}',
    payload #>> '{patient,address}'
  ) returning id into v_patient_id;

  insert into public.encounters (
    patient_id, department_id, clinic_id, external_record_id, visit_code,
    visit_datetime, reported_age, reason, status, attending_doctor_name,
    signed_at, created_by, started_at, ended_at
  ) values (
    v_patient_id, v_department_id, v_clinic_id, payload ->> 'record_id',
    payload #>> '{visit,visit_code}', (payload #>> '{visit,visit_datetime}')::timestamptz,
    nullif(payload #>> '{patient,age}', '')::smallint, payload #>> '{visit,reason}',
    'COMPLETED', payload ->> 'doctor', (payload ->> 'signed_at')::timestamptz,
    actor_id, (payload #>> '{visit,visit_datetime}')::timestamptz,
    (payload ->> 'signed_at')::timestamptz
  ) returning id into v_encounter_id;

  insert into public.vital_signs (
    encounter_id, pulse_per_minute, temperature_c, systolic_bp_mmhg,
    diastolic_bp_mmhg, respiratory_rate_per_minute, height_cm, weight_kg,
    bmi, blood_glucose_mg_dl, recorded_at
  ) values (
    v_encounter_id,
    nullif(payload #>> '{vital_signs,mach_lan_phut}', '')::smallint,
    nullif(payload #>> '{vital_signs,nhiet_do_c}', '')::numeric,
    nullif(payload #>> '{vital_signs,huyet_ap_tam_thu_mmhg}', '')::smallint,
    nullif(payload #>> '{vital_signs,huyet_ap_tam_truong_mmhg}', '')::smallint,
    nullif(payload #>> '{vital_signs,nhip_tho_lan_phut}', '')::smallint,
    nullif(payload #>> '{vital_signs,chieu_cao_cm}', '')::numeric,
    nullif(payload #>> '{vital_signs,can_nang_kg}', '')::numeric,
    nullif(payload #>> '{vital_signs,bmi}', '')::numeric,
    nullif(payload #>> '{vital_signs,duong_huyet_mg_dl}', '')::numeric,
    (payload #>> '{visit,visit_datetime}')::timestamptz
  );

  insert into public.diagnoses (encounter_id, icd10_code, description)
  values (
    v_encounter_id, payload #>> '{diagnosis,icd10}', payload #>> '{diagnosis,mo_ta}'
  );

  insert into public.clinical_conclusions (
    encounter_id, disease_progress, treatment_plan, signed_by_name,
    signed_at, source_payload
  ) values (
    v_encounter_id, payload #>> '{clinical_note,dien_bien}',
    payload #>> '{clinical_note,huong_xu_tri}', payload ->> 'doctor',
    (payload ->> 'signed_at')::timestamptz, payload
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, reason, changes
  ) values (
    actor_id, 'IMPORT', 'clinical_record', v_encounter_id::text,
    'Import structured clinical conclusion',
    jsonb_build_object('record_id', payload ->> 'record_id')
  );

  return v_encounter_id;
end;
$$;

revoke all on function public.import_clinical_record(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.import_clinical_record(jsonb, uuid) to service_role;
