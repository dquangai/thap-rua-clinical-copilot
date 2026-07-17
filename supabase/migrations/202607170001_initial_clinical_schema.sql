create extension if not exists pgcrypto;

create type public.patient_sex as enum ('FEMALE', 'MALE', 'OTHER');
create type public.encounter_status as enum ('WAITING', 'IN_PROGRESS', 'RESULT_READY', 'COMPLETED', 'CANCELLED');
create type public.clinical_note_type as enum ('PROGRESS', 'ASSESSMENT', 'PLAN', 'DISCHARGE');
create type public.clinical_note_source as enum ('HUMAN', 'AI_DRAFT');

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  department_id uuid references public.departments(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  medical_record_number text not null unique,
  full_name text not null,
  date_of_birth date not null,
  sex public.patient_sex not null,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  department_id uuid not null references public.departments(id),
  status public.encounter_status not null default 'WAITING',
  reason text not null,
  attending_clinician_id uuid references public.profiles(id),
  queue_number text,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint encounter_time_order check (ended_at is null or started_at is null or ended_at >= started_at)
);

create table public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete restrict,
  type public.clinical_note_type not null,
  content text not null,
  authored_by uuid not null references public.profiles(id),
  authored_at timestamptz not null default now(),
  source public.clinical_note_source not null default 'HUMAN'
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  reason text not null,
  changes jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index encounters_patient_id_idx on public.encounters(patient_id);
create index encounters_department_status_idx on public.encounters(department_id, status, created_at);
create index clinical_notes_encounter_id_idx on public.clinical_notes(encounter_id, authored_at);
create index audit_events_entity_idx on public.audit_events(entity_type, entity_id, occurred_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger patients_set_updated_at before update on public.patients
for each row execute function public.set_updated_at();
create trigger encounters_set_updated_at before update on public.encounters
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.encounters enable row level security;
alter table public.clinical_notes enable row level security;
alter table public.audit_events enable row level security;

create or replace function public.is_active_doctor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and active = true
  );
$$;

create policy "authenticated can read departments" on public.departments for select to authenticated using (true);
create policy "users can read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "doctors can read patients" on public.patients for select to authenticated
using (public.is_active_doctor());
create policy "doctors can create patients" on public.patients for insert to authenticated
with check (public.is_active_doctor());
create policy "doctors can read encounters" on public.encounters for select to authenticated
using (public.is_active_doctor());
create policy "doctors can create encounters" on public.encounters for insert to authenticated
with check (created_by = auth.uid() and public.is_active_doctor());
create policy "doctors can update encounters" on public.encounters for update to authenticated
using (public.is_active_doctor()) with check (public.is_active_doctor());
create policy "doctors can read notes" on public.clinical_notes for select to authenticated
using (public.is_active_doctor());
create policy "doctors can create notes" on public.clinical_notes for insert to authenticated
with check (authored_by = auth.uid() and public.is_active_doctor());
create policy "doctors can read own audit events" on public.audit_events for select to authenticated
using (actor_id = auth.uid() and public.is_active_doctor());

revoke update, delete on public.audit_events from anon, authenticated;
revoke delete on public.patients, public.encounters, public.clinical_notes from anon, authenticated;
