-- Foundation only: no client writes or clinical mutation RPC enabled.
begin;
create table if not exists public.nexodent_offline_operations (
  clinic_id uuid not null references public.clinics(id),
  operation_id uuid not null,
  user_id uuid not null,
  entity_type text not null check (length(entity_type) between 1 and 100),
  entity_id text not null check (length(entity_id) between 1 and 200),
  expected_revision bigint not null check (expected_revision >= 0),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz not null default now(),
  primary key (clinic_id, operation_id)
);
alter table public.nexodent_offline_operations enable row level security;
revoke all on public.nexodent_offline_operations from public, anon, authenticated;
-- A future transactional RPC must verify current membership and permissions,
-- compare revisions, apply the clinical mutation and insert the ledger row
-- in the same transaction. Never record success before the mutation commits.
commit;
