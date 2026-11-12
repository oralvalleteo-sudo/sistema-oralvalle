-- Complemento da migration 013; não altera tokens ou conexões existentes.
begin;
alter table public.nexodent_whatsapp_oauth_states add column if not exists flow text not null default 'redirect' check(flow in ('redirect','embedded'));
alter table public.nexodent_whatsapp_credentials add column if not exists waba_id text check(waba_id ~ '^[0-9]{1,40}$');
alter table public.nexodent_whatsapp_credentials add column if not exists phone_number_id text check(phone_number_id ~ '^[0-9]{1,40}$');
commit;
