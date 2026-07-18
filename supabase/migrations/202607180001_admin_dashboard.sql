create type public.user_role as enum ('SUPER_ADMIN', 'ADMIN', 'DOCTOR');

alter table public.profiles
  add column role public.user_role not null default 'DOCTOR',
  add column last_login_at timestamptz,
  add column deactivated_at timestamptz;

create table public.api_usage_events (
  id bigint generated always as identity primary key,
  request_id uuid not null default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  endpoint text not null,
  method text not null,
  status_code integer not null,
  status text not null,
  model text,
  pipeline_version text,
  latency_ms numeric(12,2) not null default 0,
  runtime_ms numeric(12,2) not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  api_calls integer not null default 0,
  cost_usd numeric(14,8) not null default 0,
  occurred_at timestamptz not null default now()
);

create index api_usage_occurred_at_idx on public.api_usage_events(occurred_at desc);
create index api_usage_actor_idx on public.api_usage_events(actor_id, occurred_at desc);

alter table public.patients
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id),
  add column deletion_reason text;
alter table public.encounters
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id),
  add column deletion_reason text;
alter table public.clinical_notes
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id),
  add column deletion_reason text;

create table public.record_versions (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id text not null,
  operation text not null check (operation in ('CREATE', 'UPDATE', 'DELETE', 'RESTORE')),
  actor_id uuid references auth.users(id) on delete set null,
  reason text not null,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now()
);
create index record_versions_entity_idx on public.record_versions(entity_type, entity_id, occurred_at desc);

alter table public.api_usage_events enable row level security;
alter table public.record_versions enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true and role in ('ADMIN', 'SUPER_ADMIN')
  );
$$;

create policy "admins can read profiles" on public.profiles for select to authenticated
using (public.is_admin());
create policy "admins can read audit events" on public.audit_events for select to authenticated
using (public.is_admin());
create policy "admins can read api usage" on public.api_usage_events for select to authenticated
using (public.is_admin());
create policy "admins can read record versions" on public.record_versions for select to authenticated
using (public.is_admin());

revoke insert, update, delete on public.api_usage_events from anon, authenticated;
revoke insert, update, delete on public.record_versions from anon, authenticated;

-- Promote the first administrator explicitly after applying this migration:
-- update public.profiles set role = 'SUPER_ADMIN' where id = '<auth-user-uuid>';
