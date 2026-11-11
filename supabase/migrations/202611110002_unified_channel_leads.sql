begin;
alter table public.nexodent_crm_leads add column if not exists email text;
alter table public.nexodent_crm_leads add column if not exists acquisition_sources jsonb not null default '[]';
alter table public.nexodent_crm_leads add column if not exists last_inbound_at timestamptz;
create function public.nexodent_contact_phone(p_phone text) returns text language sql immutable set search_path=public,pg_temp as $$
 with v as (select regexp_replace(coalesce(p_phone,''),'[^0-9]','','g') n)
 select case when length(n)<10 or length(n)>15 then null
 when left(trim(p_phone),1)='+' then n
 when left(n,2)='00' then substring(n from 3)
 when length(n) in (10,11) then '55'||n else n end from v
$$;
create index nexodent_crm_contact_phone_idx on public.nexodent_crm_leads(clinic_id,public.nexodent_contact_phone(phone));
create index nexodent_crm_contact_email_idx on public.nexodent_crm_leads(clinic_id,lower(trim(email)));
create table public.nexodent_channel_identities(
 clinic_id uuid not null references public.clinics(id) on delete cascade,
 kind text not null check(kind in ('phone','email')), value text not null,
 lead_id uuid not null references public.nexodent_crm_leads(id) on delete cascade,
 primary key(clinic_id,kind,value)
);
create table public.nexodent_channel_events(
 clinic_id uuid not null references public.clinics(id) on delete cascade,
 channel text not null check(channel in ('google_ads','meta_ads','whatsapp_business')),
 external_id text not null,lead_id uuid references public.nexodent_crm_leads(id) on delete set null,
 metadata jsonb not null default '{}',received_at timestamptz not null default now(),
 primary key(clinic_id,channel,external_id)
);
create table public.nexodent_channel_assets(
 provider text not null check(provider in ('meta_ads','whatsapp_business')),
 external_id text not null,clinic_id uuid not null references public.clinics(id) on delete cascade,
 label text not null,parent_id text,token_cipher text,
 primary key(provider,external_id),unique(clinic_id,provider)
);
create table public.nexodent_meta_oauth_states(
 state_hash text primary key,clinic_id uuid not null references public.clinics(id) on delete cascade,
 user_id uuid not null,provider text not null check(provider in ('meta_ads','whatsapp_business')),expires_at timestamptz not null
);
create table public.nexodent_meta_credentials(
 clinic_id uuid not null references public.clinics(id) on delete cascade,
 provider text not null,token_cipher text not null,expires_at timestamptz,updated_at timestamptz not null default now(),primary key(clinic_id,provider)
);
do $$declare t text;begin
 foreach t in array array['nexodent_channel_identities','nexodent_channel_events','nexodent_channel_assets','nexodent_meta_oauth_states','nexodent_meta_credentials'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create function public.nexodent_channel_lead_receive(p_clinic uuid,p_channel text,p_event text,p_contact jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare target uuid;phone_id uuid;email_id uuid;phone text;email text;origin text;touch jsonb;old_event public.nexodent_channel_events;created boolean:=false;conflict boolean:=false;
begin
 if p_channel not in ('google_ads','meta_ads','whatsapp_business') or coalesce(p_event,'')='' or length(p_event)>255 then raise exception 'Evento inválido';end if;
 -- Serializa entradas de canais diferentes da mesma clínica, inclusive duas entregas simultâneas.
 perform pg_advisory_xact_lock(hashtextextended(p_clinic::text,0));
 select * into old_event from public.nexodent_channel_events where clinic_id=p_clinic and channel=p_channel and external_id=p_event;
 if found then return jsonb_build_object('accepted',true,'duplicate',true,'lead_id',old_event.lead_id);end if;
 phone:=public.nexodent_contact_phone(p_contact->>'phone');
 email:=nullif(lower(trim(p_contact->>'email')),'');
 if email is not null and (length(email)>254 or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then email:=null;end if;
 if phone is null and email is null then raise exception 'Contato sem identificação';end if;
 if phone is not null then
 select lead_id into phone_id from public.nexodent_channel_identities where clinic_id=p_clinic and kind='phone' and value=phone;
 if phone_id is null then select id into phone_id from public.nexodent_crm_leads where clinic_id=p_clinic and public.nexodent_contact_phone(nexodent_crm_leads.phone)=phone order by id limit 1;end if;
 end if;
 if email is not null then
 select lead_id into email_id from public.nexodent_channel_identities where clinic_id=p_clinic and kind='email' and value=email;
 if email_id is null then select id into email_id from public.nexodent_crm_leads where clinic_id=p_clinic and lower(trim(nexodent_crm_leads.email))=email order by id limit 1;end if;
 end if;
 conflict:=phone_id is not null and email_id is not null and phone_id<>email_id;
 target:=coalesce(phone_id,email_id);
 origin:=case p_channel when 'google_ads' then 'Google Ads' when 'meta_ads' then 'Meta Ads' else case when p_contact->>'ad_origin'='meta_ads' then 'Meta Ads' else 'WhatsApp' end end;
 if target is null then
 target:=gen_random_uuid();created:=true;
 insert into public.nexodent_crm_leads(id,clinic_id,name,phone,email,source,stage,estimated_value,notes)
 values(target,p_clinic,left(coalesce(nullif(trim(p_contact->>'name'),''),'Contato '||origin),140),coalesce(phone,''),email,origin,'Novo lead',0,'');
 end if;
 if phone is not null then insert into public.nexodent_channel_identities values(p_clinic,'phone',phone,target) on conflict do nothing;end if;
 if email is not null and not conflict then insert into public.nexodent_channel_identities values(p_clinic,'email',email,target) on conflict do nothing;end if;
 touch:=jsonb_strip_nulls(jsonb_build_object('channel',p_channel,'origin',origin,'ad_id',left(p_contact->>'ad_id',100),'campaign_id',left(p_contact->>'campaign_id',100)));
 update public.nexodent_crm_leads l set last_inbound_at=now(),
 phone=case when coalesce(l.phone,'')='' then coalesce(phone,'') else l.phone end,
 email=case when coalesce(l.email,'')='' and not conflict then email else l.email end,
 acquisition_sources=case when l.acquisition_sources @> jsonb_build_array(touch) then l.acquisition_sources else l.acquisition_sources||jsonb_build_array(touch) end
 where l.id=target and l.clinic_id=p_clinic;
 insert into public.nexodent_channel_events(clinic_id,channel,external_id,lead_id,metadata)
 values(p_clinic,p_channel,p_event,target,touch||jsonb_build_object('identity_conflict',conflict));
 return jsonb_build_object('accepted',true,'duplicate',false,'created',created,'lead_id',target,'identity_conflict',conflict);
end $$;
revoke all on function public.nexodent_channel_lead_receive(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.nexodent_channel_lead_receive(uuid,text,text,jsonb) to service_role;
-- O webhook Google mantém sua autenticação e passa a usar a mesma identidade dos outros canais.
create or replace function public.nexodent_google_lead_receive(p_clinic uuid,p_key_hash text,p_lead jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare delivery public.nexodent_google_lead_delivery;result jsonb;previous uuid;
begin
 select d.* into delivery from public.nexodent_google_lead_delivery d join public.nexodent_channel_connections c on c.clinic_id=d.clinic_id and c.provider='google_ads' and c.status='connected' and c.external_account_id=d.account_id
 where d.clinic_id=p_clinic and d.key_hash=p_key_hash for update of d;
 if not found then raise insufficient_privilege using message='Entrega não autorizada';end if;
 if coalesce(p_lead->>'account_id','')<>'' and p_lead->>'account_id'<>delivery.account_id then raise insufficient_privilege using message='Conta incorreta';end if;
 if p_lead->>'is_test'='true' then update public.nexodent_google_lead_delivery set last_test_at=now() where clinic_id=p_clinic;return jsonb_build_object('test',true,'accepted',true);end if;
 select lead_id into previous from public.nexodent_google_lead_events where clinic_id=p_clinic and external_id=p_lead->>'lead_id';
 if found then return jsonb_build_object('accepted',true,'duplicate',true,'lead_id',previous);end if;
 result:=public.nexodent_channel_lead_receive(p_clinic,'google_ads',p_lead->>'lead_id',p_lead);
 insert into public.nexodent_google_lead_events(clinic_id,external_id,lead_id) values(p_clinic,p_lead->>'lead_id',(result->>'lead_id')::uuid);
 update public.nexodent_google_lead_delivery set last_received_at=now() where clinic_id=p_clinic;
 return result;
end $$;
commit;

begin;
create function public.nexodent_channel_asset_bind(p_clinic uuid,p_provider text,p_external text,p_label text,p_parent text,p_token text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_provider not in ('meta_ads','whatsapp_business') or p_external !~ '^[0-9]+$' then raise exception 'Ativo inválido';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_provider||':'||p_external,0));
 if exists(select 1 from public.nexodent_channel_assets where provider=p_provider and external_id=p_external and clinic_id<>p_clinic) then raise exception 'Ativo já vinculado';end if;
 delete from public.nexodent_channel_assets where clinic_id=p_clinic and provider=p_provider;
 insert into public.nexodent_channel_assets(provider,external_id,clinic_id,label,parent_id,token_cipher) values(p_provider,p_external,p_clinic,p_label,p_parent,p_token);
 insert into public.nexodent_channel_connections(clinic_id,provider,status,external_account_id,external_account_label,updated_at) values(p_clinic,p_provider,'connected',p_external,p_label,now())
 on conflict(clinic_id,provider) do update set status=excluded.status,external_account_id=excluded.external_account_id,external_account_label=excluded.external_account_label,updated_at=excluded.updated_at;
 return jsonb_build_object('connected',true);
end $$;
revoke all on function public.nexodent_channel_asset_bind(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.nexodent_channel_asset_bind(uuid,text,text,text,text,text) to service_role;
commit;
