-- Catálogo e testes novos de 7 dias. Não reduz prazos já concedidos.
begin;
create table public.nexodent_plans(
 code text primary key, name text not null, monthly_cents integer not null check(monthly_cents>=0),annual_cents integer not null check(annual_cents>=0),
 features jsonb not null, max_users integer not null check(max_users>0),active boolean not null default true
);
insert into public.nexodent_plans values
 ('gratis','Grátis',0,0,'{"core":true,"agenda":true,"patients":true}',1,true),
 ('basico','Básico',3990,38304,'{"core":true,"agenda":true,"patients":true,"records":true,"budgets":true}',1,true),
 ('profissional','Profissional',7990,76704,'{"core":true,"agenda":true,"patients":true,"records":true,"budgets":true,"finance":true,"crm":true}',3,true),
 ('premium','Premium',11990,115104,'{"core":true,"agenda":true,"patients":true,"records":true,"budgets":true,"finance":true,"crm":true,"team":true,"integrations":true}',10,true);
alter table public.nexodent_plans enable row level security;
revoke all on public.nexodent_plans from public,anon,authenticated;
create function public.nexodent_public_plans() returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(to_jsonb(p) order by monthly_cents),'[]') from public.nexodent_plans p where active
$$;
revoke all on function public.nexodent_public_plans() from public;
grant execute on function public.nexodent_public_plans() to anon,authenticated,service_role;
alter table public.nexodent_clinic_subscriptions add column if not exists plan_code text references public.nexodent_plans(code);
alter table public.nexodent_clinic_subscriptions add column if not exists billing_cycle text not null default 'monthly' check(billing_cycle in ('monthly','annual'));
alter table public.nexodent_clinic_subscriptions add column if not exists billing_enforced boolean not null default false;
-- Preserva as linhas existentes, mas caminhos antigos de cadastro também devem criar assinaturas controladas.
alter table public.nexodent_clinic_subscriptions alter column billing_enforced set default true;
alter table public.nexodent_clinic_subscriptions alter column plan_code set default 'profissional';
alter table public.nexodent_clinic_subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table public.nexodent_clinic_subscriptions add column if not exists provider_subscription_id text;
alter table public.nexodent_clinic_subscriptions add column if not exists provider_customer_id text;
alter table public.nexodent_clinic_subscriptions add column if not exists paid_until timestamptz;
alter table public.nexodent_clinic_subscriptions add column if not exists grace_days integer not null default 0;
alter table public.nexodent_clinic_subscriptions add column if not exists discount_percent integer not null default 0 check(discount_percent between 0 and 99);
create function private.nexodent_access(p_clinic uuid,p_feature text default 'core') returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare s public.nexodent_clinic_subscriptions;p public.nexodent_plans;valid boolean;
begin
 select * into s from public.nexodent_clinic_subscriptions where clinic_id=p_clinic;
 -- Clinicas anteriores/isentas precisam ser migradas explicitamente pelo administrador.
 if not found or not s.billing_enforced or s.status='exempt' then return true;end if;
 valid:=case when s.plan_code='gratis' and s.status='active' then true
 when s.status='trial' then coalesce(s.trial_ends_at>now(),false)
 when s.status in ('active','past_due') then coalesce(greatest(s.paid_until,s.current_period_ends_at)+make_interval(days=>s.grace_days)>now(),false)
 when s.cancel_at_period_end then coalesce(s.paid_until>now(),false) else false end;
 if not valid then return false;end if;
 select * into p from public.nexodent_plans where code=s.plan_code;
 return coalesce((p.features->>p_feature)::boolean,false);
end $$;
create function public.nexodent_require_feature(p_clinic uuid,p_feature text default 'core') returns void language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not exists(select 1 from public.clinic_members where clinic_id=p_clinic and user_id=auth.uid() and active) then raise insufficient_privilege using message='Vínculo necessário';end if;
 if not private.nexodent_access(p_clinic,p_feature) then raise insufficient_privilege using message='SUBSCRIPTION_REQUIRED: regularize sua assinatura ou escolha um plano compatível';end if;
end $$;
revoke all on function private.nexodent_access(uuid,text),public.nexodent_require_feature(uuid,text) from public,anon,authenticated;
grant execute on function public.nexodent_require_feature(uuid,text) to authenticated;
create function public.nexodent_subscription_portal(p_clinic uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare s public.nexodent_clinic_subscriptions;
begin
 if not exists(select 1 from public.clinic_members where clinic_id=p_clinic and user_id=auth.uid() and active) then raise insufficient_privilege;end if;
 select * into s from public.nexodent_clinic_subscriptions where clinic_id=p_clinic;
 return jsonb_build_object('subscription',to_jsonb(s)-'provider_customer_id','allowed',private.nexodent_access(p_clinic),'can_manage',exists(select 1 from public.clinic_members where clinic_id=p_clinic and user_id=auth.uid() and active and admin),'plans',public.nexodent_public_plans());
end $$;
revoke all on function public.nexodent_subscription_portal(uuid) from public,anon;
grant execute on function public.nexodent_subscription_portal(uuid) to authenticated;
create function public.nexodent_start_trial(p_plan text default 'profissional',p_cycle text default 'monthly') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u auth.users;r public.nexodent_trial_requests;clinic uuid;
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 select * into u from auth.users where id=auth.uid() for update;
 if u.email_confirmed_at is null or u.deleted_at is not null or coalesce(u.is_anonymous,false) then raise insufficient_privilege using message='Confirme o e-mail';end if;
 if not exists(select 1 from public.nexodent_plans where code=p_plan and active) or p_cycle not in ('monthly','annual') then raise exception 'Plano inválido';end if;
 select clinic_id into clinic from public.clinic_members where user_id=u.id and active order by admin desc,clinic_id limit 1;
 if clinic is not null then return jsonb_build_object('ok',true,'clinic_id',clinic,'already_activated',true);end if;
 select * into r from public.nexodent_trial_requests where lower(email)=lower(u.email) and status in ('pending','approved') order by created_at desc limit 1 for update;
 if not found or r.activated_clinic_id is not null then raise exception 'Solicite o cadastro antes de ativar';end if;
 insert into public.clinics(nome) values(r.clinica) returning id into clinic;
 insert into public.clinic_members(clinic_id,user_id,nome,login,admin,perms,active) values(clinic,u.id,r.nome,u.email,true,null,true);
 insert into public.nexodent_clinic_subscriptions(clinic_id,status,plan_code,billing_cycle,billing_enforced,trial_started_at,trial_ends_at)
 values(clinic,case when p_plan='gratis' then 'active' else 'trial' end,p_plan,p_cycle,true,now(),now()+interval '7 days');
 update public.nexodent_trial_requests set activated_clinic_id=clinic,activated_at=now(),status='approved' where id=r.id;
 return jsonb_build_object('ok',true,'clinic_id',clinic,'trial_days',7,'plan_code',p_plan);
end $$;
revoke all on function public.nexodent_start_trial(text,text) from public,anon;
grant execute on function public.nexodent_start_trial(text,text) to authenticated;
create or replace function public.nexodent_activate_self_service_trial() returns jsonb language sql security definer set search_path=pg_catalog as $$ select public.nexodent_start_trial() $$;
revoke all on function public.nexodent_activate_self_service_trial() from public,anon;
grant execute on function public.nexodent_activate_self_service_trial() to authenticated;
do $$declare def text;begin
 if to_regprocedure('public.nexodent_activate_approved_trial()') is not null then
 select pg_get_functiondef('public.nexodent_activate_approved_trial()'::regprocedure) into def;
 execute replace(def,'interval ''15 days''','interval ''7 days''');
 end if;
end $$;
-- Guarda comum dos RPCs clínicos; portal/cadastro seguem acessíveis para regularizar.
create or replace function private.require_member(p_clinic uuid) returns void language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or not exists(select 1 from public.clinic_members where clinic_id=p_clinic and user_id=auth.uid() and active) then raise insufficient_privilege using message='Vínculo necessário';end if;
 if not private.nexodent_access(p_clinic) then raise insufficient_privilege using message='SUBSCRIPTION_REQUIRED: regularize sua assinatura';end if;
end $$;
-- Limites de usuários valem para novas inclusões, sem remover equipe existente.
create function private.nexodent_limit_members() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare s public.nexodent_clinic_subscriptions;lim integer;
begin
 if not new.active or (tg_op='UPDATE' and old.active and old.clinic_id=new.clinic_id) then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.clinic_id::text,19));
 select * into s from public.nexodent_clinic_subscriptions where clinic_id=new.clinic_id;
 if not found or not s.billing_enforced or s.status='exempt' then return new;end if;
 select max_users into lim from public.nexodent_plans where code=s.plan_code;
 if (select count(*) from public.clinic_members where clinic_id=new.clinic_id and active)>=lim then raise exception 'Limite de usuários do plano atingido';end if;
 return new;
end $$;
create trigger nexodent_members_limit before insert or update on public.clinic_members for each row execute function private.nexodent_limit_members();
notify pgrst,'reload schema';
commit;
