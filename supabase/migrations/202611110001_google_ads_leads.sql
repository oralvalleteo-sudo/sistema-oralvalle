-- Requer nexodent_crm_leads existente e a migration channel_connections.
begin;
-- Tokens e estados do OAuth usado pelas funções existentes: acesso somente servidor.
create table if not exists public.nexodent_google_oauth_states (
 state_hash text primary key, clinic_id uuid not null references public.clinics(id) on delete cascade,
 user_id uuid not null, verifier_cipher text not null, expires_at timestamptz not null
);
create table if not exists public.nexodent_google_ads_credentials (
 clinic_id uuid primary key references public.clinics(id) on delete cascade,
 user_id uuid not null, refresh_token_cipher text not null, updated_at timestamptz not null default now()
);
alter table public.nexodent_google_oauth_states enable row level security;
alter table public.nexodent_google_ads_credentials enable row level security;
revoke all on public.nexodent_google_oauth_states,public.nexodent_google_ads_credentials from public,anon,authenticated;
grant all on public.nexodent_google_oauth_states,public.nexodent_google_ads_credentials to service_role;

create table public.nexodent_google_lead_delivery (
 clinic_id uuid primary key references public.clinics(id) on delete cascade,
 key_hash text not null check(key_hash ~ '^[0-9a-f]{64}$'),
 account_id text not null,
 activated_at timestamptz not null default now(),
 last_test_at timestamptz,
 last_received_at timestamptz
);
create table public.nexodent_google_lead_events (
 clinic_id uuid not null references public.clinics(id) on delete cascade,
 external_id text not null,
 lead_id uuid not null,
 received_at timestamptz not null default now(),
 primary key(clinic_id,external_id)
);
alter table public.nexodent_google_lead_delivery enable row level security;
alter table public.nexodent_google_lead_events enable row level security;
revoke all on public.nexodent_google_lead_delivery,public.nexodent_google_lead_events from public,anon,authenticated;
create function public.nexodent_google_leads_setup(p_clinic uuid,p_key_hash text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare account text; delivery public.nexodent_google_lead_delivery; count_leads bigint;
begin
 select external_account_id into account from public.nexodent_channel_connections where clinic_id=p_clinic and provider='google_ads' and status='connected';
 if account is null then raise exception 'Conta não vinculada'; end if;
 if p_key_hash is not null then
  insert into public.nexodent_google_lead_delivery(clinic_id,key_hash,account_id) values(p_clinic,p_key_hash,account)
  on conflict(clinic_id) do update set key_hash=excluded.key_hash,account_id=excluded.account_id,activated_at=now(),last_test_at=null,last_received_at=null;
 end if;
 select * into delivery from public.nexodent_google_lead_delivery where clinic_id=p_clinic and account_id=account;
 select count(*) into count_leads from public.nexodent_google_lead_events where clinic_id=p_clinic;
 return jsonb_build_object('configured',delivery.clinic_id is not null,'tested',delivery.last_test_at is not null,'last_received_at',delivery.last_received_at,'lead_count',count_leads);
end $$;
create function public.nexodent_google_lead_receive(p_clinic uuid,p_key_hash text,p_lead jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare delivery public.nexodent_google_lead_delivery; new_id uuid:=gen_random_uuid(); existing_id uuid;
begin
 select d.* into delivery from public.nexodent_google_lead_delivery d join public.nexodent_channel_connections c on c.clinic_id=d.clinic_id and c.provider='google_ads' and c.status='connected' and c.external_account_id=d.account_id
 where d.clinic_id=p_clinic and d.key_hash=p_key_hash for update of d;
 if not found then raise insufficient_privilege using message='Entrega não autorizada'; end if;
 if coalesce(p_lead->>'account_id','')<>'' and p_lead->>'account_id'<>delivery.account_id then raise insufficient_privilege using message='Conta incorreta'; end if;
 if p_lead->>'is_test'='true' then
  update public.nexodent_google_lead_delivery set last_test_at=now() where clinic_id=p_clinic;
  return jsonb_build_object('test',true,'accepted',true);
 end if;
 if coalesce(p_lead->>'lead_id','')='' or length(p_lead->>'lead_id')>200 or coalesce(p_lead->>'name','')='' or (coalesce(p_lead->>'phone','')='' and coalesce(p_lead->>'email','')='') then raise exception 'Lead inválido'; end if;
 select lead_id into existing_id from public.nexodent_google_lead_events where clinic_id=p_clinic and external_id=p_lead->>'lead_id';
 if found then return jsonb_build_object('accepted',true,'duplicate',true); end if;
 insert into public.nexodent_crm_leads(id,clinic_id,name,phone,source,stage,estimated_value,notes)
 values(new_id,p_clinic,left(p_lead->>'name',140),left(p_lead->>'phone',35),'Google Ads','Novo lead',0,case when coalesce(p_lead->>'email','')<>'' then 'E-mail: '||left(p_lead->>'email',254) else '' end);
 insert into public.nexodent_google_lead_events(clinic_id,external_id,lead_id) values(p_clinic,p_lead->>'lead_id',new_id);
 update public.nexodent_google_lead_delivery set last_received_at=now() where clinic_id=p_clinic;
 return jsonb_build_object('accepted',true,'duplicate',false);
end $$;
revoke all on function public.nexodent_google_leads_setup(uuid,text),public.nexodent_google_lead_receive(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nexodent_google_leads_setup(uuid,text),public.nexodent_google_lead_receive(uuid,text,jsonb) to service_role;
commit;
