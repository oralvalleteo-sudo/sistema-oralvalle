-- Envio oficial: metadados privados de solicitação e janela confirmada por webhook.
-- Requer fundação clínica e migrations WhatsApp 013/014. Não envia mensagens ao executar SQL.
begin;
create unique index if not exists nexodent_whatsapp_unique_phone on public.nexodent_whatsapp_credentials(phone_number_id) where phone_number_id is not null;
create table if not exists public.nexodent_wa_inbound_receipts(
 clinic_id uuid not null references public.clinics(id),phone_number_id text not null,message_id text not null,
 contact_phone text not null,last_inbound_at timestamptz not null,created_at timestamptz not null default now(),
 primary key(phone_number_id,message_id)
);
create index if not exists nexodent_wa_window_lookup on public.nexodent_wa_inbound_receipts(clinic_id,phone_number_id,contact_phone,last_inbound_at desc);
create table if not exists public.nexodent_wa_outbox(
 id uuid primary key,clinic_id uuid not null references public.clinics(id),actor_id uuid not null references auth.users(id),
 patient_id text not null,phone_number_id text not null,to_phone text not null,payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
 mode text not null check(mode in ('text','template')),
 request_state text not null default 'sending' check(request_state in ('sending','accepted','rejected','uncertain')),
 delivery_state text not null default 'unknown' check(delivery_state in ('unknown','sent','delivered','read','failed')),
 provider_message_id text,provider_error integer,provider_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists nexodent_wa_outbox_clinic_created on public.nexodent_wa_outbox(clinic_id,created_at desc);
create index if not exists nexodent_wa_outbox_dedup on public.nexodent_wa_outbox(clinic_id,patient_id,payload_hash,created_at desc);
create unique index if not exists nexodent_wa_outbox_message on public.nexodent_wa_outbox(provider_message_id) where provider_message_id is not null;
alter table public.nexodent_wa_inbound_receipts enable row level security;
alter table public.nexodent_wa_outbox enable row level security;
revoke all on public.nexodent_wa_inbound_receipts,public.nexodent_wa_outbox from public,anon,authenticated;
create or replace function private.nexodent_wa_sender_require(p_clinic uuid,p_user uuid,p_write boolean) returns void language plpgsql stable security definer set search_path=pg_catalog as $$
declare m public.clinic_members;
begin
 if p_user is null then raise insufficient_privilege;end if;
 select * into m from public.clinic_members where clinic_id=p_clinic and user_id=p_user and active;
 if not found then raise insufficient_privilege;end if;
 if not m.admin and m.perms is not null and(coalesce(m.perms->>'pac','none') not in ('view','edit') or coalesce(m.perms->>'wa','none') not in ('view','edit') or (p_write and coalesce(m.perms->>'wa','none')<>'edit')) then raise insufficient_privilege;end if;
end $$;
revoke all on function private.nexodent_wa_sender_require(uuid,uuid,boolean) from public,anon,authenticated;
create or replace function private.nexodent_wa_destination(p_clinic uuid,p_patient text) returns text language plpgsql stable security definer set search_path=pg_catalog as $$
declare value text;matches integer;
begin
 select count(*),min(regexp_replace(coalesce(dados->>'tel',''),'[^0-9]','','g')) into matches,value from public.patients where clinic_id=p_clinic and slot='p' and kind='object' and dados->>'id'=p_patient;
 if matches<>1 then raise insufficient_privilege using message='Paciente indisponível nesta clínica';end if;
 if length(value) in (10,11) then value:='55'||value;end if;
 if value !~ '^55[1-9][0-9]([2-9][0-9]{7}|9[0-9]{8})$' then raise exception 'Confira o telefone do paciente com DDD' using errcode='22023';end if;
 return value;
end $$;
revoke all on function private.nexodent_wa_destination(uuid,text) from public,anon,authenticated;
create or replace function public.nexodent_wa_messaging_context(p_clinic uuid,p_patient text default null,p_write boolean default false) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare destination text;sender text;window_end timestamptz;
begin
 perform private.require_member(p_clinic);perform private.nexodent_wa_sender_require(p_clinic,auth.uid(),p_write);
 select phone_number_id into sender from public.nexodent_whatsapp_credentials where clinic_id=p_clinic;
 if p_patient is not null then
  destination:=private.nexodent_wa_destination(p_clinic,p_patient);
  select max(last_inbound_at)+interval '24 hours' into window_end from public.nexodent_wa_inbound_receipts where clinic_id=p_clinic and phone_number_id=sender and contact_phone=destination;
 end if;
 return jsonb_build_object('user_id',auth.uid(),'patient_id',p_patient,'to',destination,'phone_number_id',sender,'window_until',window_end,'can_text',coalesce(window_end>now(),false));
end $$;
create or replace function public.nexodent_wa_message_receipt(p_clinic uuid,p_request uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare r public.nexodent_wa_outbox;
begin
 perform private.require_member(p_clinic);perform private.nexodent_wa_sender_require(p_clinic,auth.uid(),false);
 select * into r from public.nexodent_wa_outbox where clinic_id=p_clinic and id=p_request;
 if not found then return null;end if;
 return jsonb_build_object('id',r.id,'state',r.request_state,'delivery',r.delivery_state,'message_id',r.provider_message_id,'error_code',r.provider_error,'created_at',r.created_at);
end $$;
create or replace function public.nexodent_wa_message_claim(p_clinic uuid,p_user uuid,p_patient text,p_request uuid,p_hash text,p_mode text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare r public.nexodent_wa_outbox;sender text;destination text;
begin
 perform private.nexodent_wa_sender_require(p_clinic,p_user,true);
 if p_request is null or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_mode is null or p_mode not in ('text','template') then raise exception 'Solicitação inválida' using errcode='22023';end if;
 destination:=private.nexodent_wa_destination(p_clinic,p_patient);
 select phone_number_id into sender from public.nexodent_whatsapp_credentials where clinic_id=p_clinic and (expires_at is null or expires_at>now());
 if sender is null then raise exception 'Conexão não autorizada ou expirada' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_clinic::text,0));
 select * into r from public.nexodent_wa_outbox where id=p_request;
 if found then
  if r.clinic_id<>p_clinic or r.patient_id<>p_patient or r.actor_id<>p_user or r.payload_hash<>p_hash then raise exception 'Identificador já utilizado em outra solicitação' using errcode='22023';end if;
  return jsonb_build_object('claimed',false,'receipt',to_jsonb(r));
 end if;
 select * into r from public.nexodent_wa_outbox where clinic_id=p_clinic and patient_id=p_patient and payload_hash=p_hash and (request_state in ('sending','uncertain') or (request_state='accepted' and created_at>now()-interval '5 minutes')) order by created_at desc limit 1;
 if found then return jsonb_build_object('claimed',false,'receipt',to_jsonb(r));end if;
 if (select count(*) from public.nexodent_wa_outbox where clinic_id=p_clinic and created_at>now()-interval '1 minute')>=60 then raise exception 'Limite temporário de envios. Aguarde antes de tentar.' using errcode='54000';end if;
 if p_mode='text' and not exists(select 1 from public.nexodent_wa_inbound_receipts where clinic_id=p_clinic and phone_number_id=sender and contact_phone=destination and last_inbound_at>now()-interval '24 hours') then raise exception 'Use um modelo aprovado fora da janela de atendimento' using errcode='22023';end if;
 insert into public.nexodent_wa_outbox(id,clinic_id,actor_id,patient_id,phone_number_id,to_phone,payload_hash,mode) values(p_request,p_clinic,p_user,p_patient,sender,destination,p_hash,p_mode) returning * into r;
 return jsonb_build_object('claimed',true,'receipt',to_jsonb(r));
end $$;
create or replace function public.nexodent_wa_message_finish(p_request uuid,p_state text,p_message text default null,p_error integer default null) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_state not in ('accepted','rejected','uncertain') or (p_state='accepted' and (p_message is null or length(p_message)>1024 or p_message not like 'wamid.%')) then raise exception 'Resultado inválido' using errcode='22023';end if;
 update public.nexodent_wa_outbox set request_state=p_state,provider_message_id=coalesce(provider_message_id,p_message),provider_error=p_error,updated_at=now() where id=p_request and request_state in ('sending','uncertain') and delivery_state='unknown';
end $$;
create or replace function public.nexodent_wa_inbound_record(p_clinic uuid,p_phone text,p_from text,p_message text,p_at timestamptz) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not exists(select 1 from public.nexodent_whatsapp_credentials where clinic_id=p_clinic and phone_number_id=p_phone) or p_from !~ '^[1-9][0-9]{7,14}$' or length(p_message) not between 1 and 1024 or p_at>now()+interval '5 minutes' or p_at<now()-interval '7 days' then raise exception 'Recebimento inválido' using errcode='22023';end if;
 insert into public.nexodent_wa_inbound_receipts(clinic_id,phone_number_id,contact_phone,message_id,last_inbound_at) values(p_clinic,p_phone,p_from,p_message,least(p_at,now())) on conflict do nothing;
end $$;
create or replace function public.nexodent_wa_delivery_record(p_clinic uuid,p_phone text,p_to text,p_message text,p_status text,p_at timestamptz,p_request uuid default null,p_error integer default null) returns void language plpgsql security definer set search_path=pg_catalog as $$
declare r public.nexodent_wa_outbox;old_rank integer;new_rank integer;
begin
 if p_status not in ('sent','delivered','read','failed') or p_at>now()+interval '5 minutes' or p_at<now()-interval '30 days' or p_message is null or length(p_message)>1024 or p_message not like 'wamid.%' then raise exception 'Confirmação inválida' using errcode='22023';end if;
 select * into r from public.nexodent_wa_outbox where clinic_id=p_clinic and phone_number_id=p_phone and to_phone=p_to and (provider_message_id=p_message or (id=p_request and provider_message_id is null)) for update;
 if not found then return;end if;
 old_rank:=case r.delivery_state when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 0 end;
 new_rank:=case p_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 0 end;
 if r.provider_at is not null and p_at<r.provider_at and (r.delivery_state='failed' or new_rank<=old_rank) then return;end if;
 if p_status='failed' and old_rank>=2 then return;end if;
 if p_status<>'failed' and new_rank<old_rank then return;end if;
 update public.nexodent_wa_outbox set request_state='accepted',provider_message_id=p_message,delivery_state=p_status,provider_error=p_error,provider_at=p_at,updated_at=now() where id=r.id;
end $$;
revoke all on function public.nexodent_wa_messaging_context(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.nexodent_wa_messaging_context(uuid,text,boolean) to authenticated;
revoke all on function public.nexodent_wa_message_receipt(uuid,uuid) from public,anon,authenticated;
grant execute on function public.nexodent_wa_message_receipt(uuid,uuid) to authenticated;
revoke all on function public.nexodent_wa_message_claim(uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.nexodent_wa_message_claim(uuid,uuid,text,uuid,text,text) to service_role;
revoke all on function public.nexodent_wa_message_finish(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.nexodent_wa_message_finish(uuid,text,text,integer) to service_role;
revoke all on function public.nexodent_wa_inbound_record(uuid,text,text,text,timestamp with time zone) from public,anon,authenticated;
grant execute on function public.nexodent_wa_inbound_record(uuid,text,text,text,timestamp with time zone) to service_role;
revoke all on function public.nexodent_wa_delivery_record(uuid,text,text,text,text,timestamp with time zone,uuid,integer) from public,anon,authenticated;
grant execute on function public.nexodent_wa_delivery_record(uuid,text,text,text,text,timestamp with time zone,uuid,integer) to service_role;
commit;
