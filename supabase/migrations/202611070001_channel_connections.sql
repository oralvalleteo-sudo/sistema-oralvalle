-- NexoDent: metadados de conexões por clínica. SEM tokens, senhas ou segredos.
-- Aplicar no Supabase SQL Editor antes de publicar a página de status.
create table if not exists public.nexodent_channel_connections (
 clinic_id uuid not null references public.clinics(id) on delete cascade,
 provider text not null check (provider in ('google_ads','meta_ads','whatsapp_business')),
 status text not null default 'disconnected' check (status in ('disconnected','pending','connected','error')),
 external_account_label text,
 external_account_id text,
 updated_at timestamptz not null default now(),
 primary key (clinic_id,provider)
);
alter table public.nexodent_channel_connections enable row level security;
revoke all on public.nexodent_channel_connections from public,anon,authenticated;
grant select on public.nexodent_channel_connections to authenticated;
drop policy if exists nexodent_channel_connections_select on public.nexodent_channel_connections;
create policy nexodent_channel_connections_select on public.nexodent_channel_connections
 for select to authenticated using (
  exists (select 1 from public.clinic_members m
          where m.clinic_id=nexodent_channel_connections.clinic_id
          and m.user_id=(select auth.uid()) and m.active is true)
 );
-- Não há permissão de INSERT/UPDATE/DELETE no navegador.
-- Um backend autorizado deverá verificar o administrador da clínica,
-- executar OAuth, armazenar credenciais fora desta tabela e atualizar o status.
