-- Requer clínicas e 202611070001_channel_connections.sql. Não armazena tokens na tabela pública de status.
begin;
create table if not exists public.nexodent_whatsapp_oauth_states (
 state_hash text primary key check(state_hash ~ '^[a-f0-9]{64}$'),
 clinic_id uuid not null references public.clinics(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index if not exists nexodent_whatsapp_oauth_expiry on public.nexodent_whatsapp_oauth_states(expires_at);
create table if not exists public.nexodent_whatsapp_credentials (
 clinic_id uuid primary key references public.clinics(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 access_token_cipher text not null,
 expires_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.nexodent_whatsapp_oauth_states enable row level security;
alter table public.nexodent_whatsapp_credentials enable row level security;
revoke all on public.nexodent_whatsapp_oauth_states,public.nexodent_whatsapp_credentials from public,anon,authenticated;
grant select,insert,delete on public.nexodent_whatsapp_oauth_states to service_role;
grant select,insert,update,delete on public.nexodent_whatsapp_credentials to service_role;
grant select,insert,update on public.nexodent_channel_connections to service_role;
commit;
