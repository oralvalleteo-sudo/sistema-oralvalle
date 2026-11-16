-- Central de contatos manuais: não envia mensagens nem altera agenda/prontuários.
begin;
create table if not exists public.nexodent_wa_contacts(
 id uuid primary key default gen_random_uuid(),clinic_id uuid not null references public.clinics(id),
 patient_id text not null check(length(patient_id) between 1 and 500),
 kind text not null check(kind in ('appointment','return','aftercare','birthday','manual')),
 context_key text not null check(length(context_key) between 1 and 160),
 status text not null check(status in ('pending','contacted','waiting','scheduled','closed')),
 revision integer not null default 1 check(revision>0),updated_at timestamptz not null default now(),
 unique(clinic_id,patient_id,kind,context_key)
);
create table if not exists public.nexodent_wa_contact_events(
 id uuid primary key default gen_random_uuid(),clinic_id uuid not null references public.clinics(id),
 contact_id uuid not null references public.nexodent_wa_contacts(id),patient_id text not null,
 kind text not null,context_key text not null,status text not null,
 actor_id uuid not null references auth.users(id),client_nonce uuid not null,
 created_at timestamptz not null default now(),unique(clinic_id,actor_id,client_nonce)
);
create index if not exists nexodent_wa_contact_lookup on public.nexodent_wa_contact_events(clinic_id,patient_id,created_at desc);
alter table public.nexodent_wa_contacts enable row level security;
alter table public.nexodent_wa_contact_events enable row level security;
revoke all on public.nexodent_wa_contacts,public.nexodent_wa_contact_events from public,anon,authenticated;
create or replace function private.nexodent_wa_require(p_clinic uuid,p_write boolean default false,p_patient text default null,p_agenda boolean default false)
returns void language plpgsql stable security definer set search_path=pg_catalog as $$
declare m public.clinic_members;
begin
 perform private.require_member(p_clinic);
 select * into m from public.clinic_members where clinic_id=p_clinic and user_id=auth.uid() and active;
 if not found then raise insufficient_privilege;end if;
 if not m.admin and m.perms is not null then
  if coalesce(m.perms->>'pac','none') not in ('view','edit') or coalesce(m.perms->>'wa','none') not in ('view','edit') or (p_write and m.perms->>'wa'<>'edit') or (p_agenda and coalesce(m.perms->>'ag','none') not in ('view','edit')) then raise insufficient_privilege using message='Sem permissão para este contato';end if;
 end if;
 if p_patient is not null and not exists(select 1 from public.patients where clinic_id=p_clinic and slot='p' and kind='object' and dados->>'id'=p_patient) then raise insufficient_privilege using message='Paciente indisponível nesta clínica';end if;
end $$;
revoke all on function private.nexodent_wa_require(uuid,boolean,text,boolean) from public,anon,authenticated;
create or replace function public.nexodent_wa_contacts_list(p_clinic uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 perform private.nexodent_wa_require(p_clinic);
 select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc,t.id),'[]'::jsonb),'truncated',count(*)>10000) into result from(select id,patient_id,kind,context_key,status,revision,updated_at from public.nexodent_wa_contacts where clinic_id=p_clinic and (kind in ('manual','birthday') or exists(select 1 from public.clinic_members m where m.clinic_id=p_clinic and m.user_id=auth.uid() and m.active and (m.admin or m.perms is null or m.perms->>'ag' in ('view','edit')))) order by updated_at desc,id limit 10001)t;
 return result;
end $$;
create or replace function public.nexodent_wa_contacts_history(p_clinic uuid,p_patient text) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform private.nexodent_wa_require(p_clinic,false,p_patient);
 return coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('actor_name',coalesce((select nullif(m.nome,'') from public.clinic_members m where m.clinic_id=p_clinic and m.user_id=t.actor_id),'Integrante da equipe')) order by t.created_at desc,t.id) from(select id,kind,context_key,status,actor_id,created_at from public.nexodent_wa_contact_events where clinic_id=p_clinic and patient_id=p_patient and(kind in ('manual','birthday') or exists(select 1 from public.clinic_members m where m.clinic_id=p_clinic and m.user_id=auth.uid() and m.active and(m.admin or m.perms is null or m.perms->>'ag' in ('view','edit')))) order by created_at desc,id limit 30)t),'[]'::jsonb);
end $$;
create or replace function public.nexodent_wa_contact_record(p_clinic uuid,p_patient text,p_kind text,p_context text,p_status text,p_expected integer,p_nonce uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare c public.nexodent_wa_contacts;old_event public.nexodent_wa_contact_events;
begin
 perform private.nexodent_wa_require(p_clinic,true,p_patient,p_kind in ('appointment','return','aftercare'));
 if p_kind is null or p_kind not in ('appointment','return','aftercare','birthday','manual') or p_status is null or p_status not in ('pending','contacted','waiting','scheduled','closed') or p_context is null or length(p_context) not between 1 and 160 or p_nonce is null or p_expected is null or p_expected<0 then raise exception 'Dados de andamento inválidos' using errcode='22023';end if;
 if p_kind in ('appointment','aftercare') and not exists(select 1 from public.appointments where clinic_id=p_clinic and kind='object' and dados->>'id'=p_context and dados->>'pid'=p_patient and coalesce(dados->>'tipoRegistro','')<>'aluguel') then raise exception 'Consulta não encontrada para este paciente' using errcode='22023';end if;
 if p_kind in ('manual','birthday','return') then
  if p_context !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data de referência inválida' using errcode='22023';end if;
  perform p_context::date;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_clinic::text||':'||p_patient||':'||p_kind||':'||p_context,0));
 select * into old_event from public.nexodent_wa_contact_events where clinic_id=p_clinic and actor_id=auth.uid() and client_nonce=p_nonce;
 if found then
  if old_event.patient_id<>p_patient or old_event.kind<>p_kind or old_event.context_key<>p_context or old_event.status<>p_status then raise exception 'Identificador já utilizado' using errcode='22023';end if;
  return(select to_jsonb(t) from public.nexodent_wa_contacts t where id=old_event.contact_id);
 end if;
 select * into c from public.nexodent_wa_contacts where clinic_id=p_clinic and patient_id=p_patient and kind=p_kind and context_key=p_context for update;
 if found then
  if c.revision<>p_expected then raise exception 'Outro usuário atualizou o andamento. Atualize antes de tentar novamente.' using errcode='40001';end if;
  if c.status=p_status then return to_jsonb(c);end if;
  update public.nexodent_wa_contacts set status=p_status,revision=revision+1,updated_at=now() where id=c.id returning * into c;
 else
  if p_expected<>0 then raise exception 'Andamento desatualizado' using errcode='40001';end if;
  insert into public.nexodent_wa_contacts(clinic_id,patient_id,kind,context_key,status) values(p_clinic,p_patient,p_kind,p_context,p_status) returning * into c;
 end if;
 insert into public.nexodent_wa_contact_events(clinic_id,contact_id,patient_id,kind,context_key,status,actor_id,client_nonce) values(p_clinic,c.id,p_patient,p_kind,p_context,p_status,auth.uid(),p_nonce);
 return to_jsonb(c);
end $$;
revoke all on function public.nexodent_wa_contacts_list(uuid),public.nexodent_wa_contacts_history(uuid,text),public.nexodent_wa_contact_record(uuid,text,text,text,text,integer,uuid) from public,anon;
grant execute on function public.nexodent_wa_contacts_list(uuid),public.nexodent_wa_contacts_history(uuid,text),public.nexodent_wa_contact_record(uuid,text,text,text,text,integer,uuid) to authenticated;
commit;
