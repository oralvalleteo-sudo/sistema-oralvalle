-- Operação SaaS: nenhum acesso a pacientes ou prontuários. Requer fundação administrativa.
begin;
create table if not exists public.nexodent_support_cases (
 id uuid primary key default gen_random_uuid(),
 clinic_id uuid not null references public.clinics(id) on delete restrict,
 area text not null check(area in ('access','billing','integration','interface','other')),
 priority text not null check(priority in ('normal','high','critical')),
 description text not null check(length(description) between 5 and 500),
 status text not null default 'open' check(status in ('open','investigating','waiting','resolved')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists nexodent_support_clinic_status on public.nexodent_support_cases(clinic_id,status);
create table if not exists public.nexodent_support_history (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.nexodent_support_cases(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 status text not null, reason text not null check(length(reason) between 5 and 500),
 created_at timestamptz not null default now()
);
create index if not exists nexodent_support_history_case on public.nexodent_support_history(case_id,created_at);
alter table public.nexodent_support_cases enable row level security;
alter table public.nexodent_support_history enable row level security;
revoke all on public.nexodent_support_cases,public.nexodent_support_history from public,anon,authenticated;

create or replace function public.nexodent_admin_support_list() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$

begin
if auth.uid() is null or not exists(select 1 from public.nexodent_platform_admins where user_id=auth.uid()) then
 raise exception 'Acesso administrativo não autorizado' using errcode='42501'; end if;
return coalesce((select jsonb_agg(to_jsonb(t) order by t.updated_at desc,t.id) from (select id,clinic_id,area,priority,description,status,created_at,updated_at from public.nexodent_support_cases order by updated_at desc,id limit 200)t),'[]'::jsonb);
end;
$$;
revoke all on function public.nexodent_admin_support_list() from public,anon;
grant execute on function public.nexodent_admin_support_list() to authenticated;

create or replace function public.nexodent_admin_support_create(p_clinic uuid,p_area text,p_priority text,p_description text) returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare v_id uuid;
begin
if auth.uid() is null or not exists(select 1 from public.nexodent_platform_admins where user_id=auth.uid()) then
 raise exception 'Acesso administrativo não autorizado' using errcode='42501'; end if;
if p_area is null or p_area not in ('access','billing','integration','interface','other') or p_priority is null or p_priority not in ('normal','high','critical') or p_description is null or length(btrim(p_description)) not between 5 and 500 then raise exception 'Dados do chamado inválidos' using errcode='22023'; end if;
insert into public.nexodent_support_cases(clinic_id,area,priority,description) values(p_clinic,p_area,p_priority,btrim(p_description)) returning id into v_id;
insert into public.nexodent_support_history(case_id,actor_id,status,reason) values(v_id,auth.uid(),'open','Chamado registrado');
return v_id;
end;
$$;
revoke all on function public.nexodent_admin_support_create(uuid,text,text,text) from public,anon;
grant execute on function public.nexodent_admin_support_create(uuid,text,text,text) to authenticated;

create or replace function public.nexodent_admin_support_change(p_case uuid,p_status text,p_reason text) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare v_before text;
begin
if auth.uid() is null or not exists(select 1 from public.nexodent_platform_admins where user_id=auth.uid()) then
 raise exception 'Acesso administrativo não autorizado' using errcode='42501'; end if;
if p_status is null or p_status not in ('open','investigating','waiting','resolved') or p_reason is null or length(btrim(p_reason)) not between 5 and 500 then raise exception 'Status e justificativa obrigatórios' using errcode='22023'; end if;
select status into v_before from public.nexodent_support_cases where id=p_case for update;
if not found then raise exception 'Chamado não encontrado' using errcode='22023'; end if;
if v_before=p_status then raise exception 'O chamado já está neste status' using errcode='22023'; end if;
update public.nexodent_support_cases set status=p_status,updated_at=now() where id=p_case;
insert into public.nexodent_support_history(case_id,actor_id,status,reason) values(p_case,auth.uid(),p_status,btrim(p_reason));
end;
$$;
revoke all on function public.nexodent_admin_support_change(uuid,text,text) from public,anon;
grant execute on function public.nexodent_admin_support_change(uuid,text,text) to authenticated;

create or replace function public.nexodent_admin_support_history(p_case uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$

begin
if auth.uid() is null or not exists(select 1 from public.nexodent_platform_admins where user_id=auth.uid()) then
 raise exception 'Acesso administrativo não autorizado' using errcode='42501'; end if;
return coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id) from(select id,actor_id,status,reason,created_at from public.nexodent_support_history where case_id=p_case order by created_at desc,id limit 100)t),'[]'::jsonb);
end;
$$;
revoke all on function public.nexodent_admin_support_history(uuid) from public,anon;
grant execute on function public.nexodent_admin_support_history(uuid) to authenticated;

create or replace function public.nexodent_admin_clinic_operations(p_clinic uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$

begin
if auth.uid() is null or not exists(select 1 from public.nexodent_platform_admins where user_id=auth.uid()) then
 raise exception 'Acesso administrativo não autorizado' using errcode='42501'; end if;
if not exists(select 1 from public.clinics where id=p_clinic) then raise exception 'Clínica não encontrada' using errcode='22023'; end if;
return jsonb_build_object('active_members',(select count(*) from public.clinic_members where clinic_id=p_clinic and active),'open_cases',(select count(*) from public.nexodent_support_cases where clinic_id=p_clinic and status<>'resolved'),'measured_at',now());
end;
$$;
revoke all on function public.nexodent_admin_clinic_operations(uuid) from public,anon;
grant execute on function public.nexodent_admin_clinic_operations(uuid) to authenticated;
commit;
