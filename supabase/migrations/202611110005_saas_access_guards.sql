begin;
create function private.nexodent_member(p_clinic uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$ select auth.uid() is not null and exists(select 1 from public.clinic_members where clinic_id=p_clinic and user_id=auth.uid() and active) $$;
revoke all on function private.nexodent_member(uuid) from public,anon;
grant execute on function private.nexodent_member(uuid) to authenticated;
create function private.nexodent_feature(p_key text) returns text language sql immutable set search_path=pg_catalog as $$
 select case when p_key in ('crm','pf') then 'crm' when p_key in ('wa','integrations') then 'integrations'
 when p_key in ('cm','team') then 'team' when p_key in ('vd','sales','hc','mt','finance','laboratory') then 'finance'
 when p_key in ('budgets','pac.orc') then 'budgets'
 when p_key in ('files','models','records','pac.anam','pac.odo','pac.trat','pac.arquivos') then 'records' else 'core' end
$$;
-- Preserva os OIDs das funções de permissão e os direitos já concedidos.
do $$declare def text;begin
 select pg_get_functiondef('private.level(uuid,text)'::regprocedure) into def;
 execute regexp_replace(def,'\m[Bb][Ee][Gg][Ii][Nn]\M',E'BEGIN\n IF NOT private.nexodent_access(p_clinic,private.nexodent_feature(p_key)) THEN RETURN 0; END IF;');
 select pg_get_functiondef('private.table_level(uuid,text,text,boolean)'::regprocedure) into def;
 execute regexp_replace(def,'\m[Bb][Ee][Gg][Ii][Nn]\M',E'BEGIN\n IF NOT private.nexodent_access(p_clinic,private.nexodent_feature((select rule from private.entity_catalog where table_name=p_table))) THEN RETURN 0; END IF;');
end $$;
-- Políticas restritivas também protegem acessos REST diretos do CRM e extensões.
do $$declare t record;feature text;begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='clinic_id' and not a.attisdropped)
 and c.relname not in ('clinic_members','nexodent_clinic_subscriptions','nexodent_trial_requests')
 and c.relname not like 'nexodent_billing_%' and c.relname not like 'nexodent_subscription_%' loop
 feature:=case when t.relname like '%crm%' then 'crm' when t.relname like '%channel%' or t.relname like '%google%' or t.relname like '%meta%' then 'integrations' when t.relname like '%lab%' or t.relname like '%expense%' then 'finance' else 'core' end;
 execute format('alter table public.%I enable row level security',t.relname);
 execute format('create policy nexodent_subscription_gate on public.%I as restrictive for all to authenticated using (private.nexodent_member(clinic_id) and private.nexodent_access(clinic_id,%L)) with check (private.nexodent_member(clinic_id) and private.nexodent_access(clinic_id,%L))',t.relname,feature,feature);
 end loop;
end $$;
-- RLS chama funções privadas sem conceder acesso ao schema para consultas arbitrárias.
grant usage on schema private to authenticated;
grant execute on function private.nexodent_access(uuid,text) to authenticated;
-- RPCs SECURITY DEFINER com clínica explícita também precisam da guarda, pois contornam RLS.
-- As cópias privadas não são executáveis pelos clientes. Mantém as ACLs dos RPCs públicos.
do $$declare f record;def text;clone text;args text;body text;feature text;clinic_arg text;user_callable boolean;begin
 for f in select p.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef and p.prokind='f' and p.proargnames is not null
 and ('p_clinic'=any(p.proargnames) or 'p_clinic_id'=any(p.proargnames))
 and p.proname not like 'nexodent_admin_%' and p.proname not in ('nexodent_require_feature','nexodent_subscription_portal','nexodent_billing_history','nexodent_prepare_checkout','nexodent_apply_billing_payment','nexodent_billing_cancel') loop
 clone:='nexodent_original_'||f.oid;
 select pg_get_functiondef(f.oid) into def;
 execute replace(def,'FUNCTION public.'||f.proname||'(','FUNCTION private.'||clone||'(');
 execute format('revoke all on function private.%I(%s) from public,anon,authenticated,service_role',clone,pg_get_function_identity_arguments(f.oid));
 select string_agg(format('%I',name),',') into args from unnest(f.proargnames[1:f.pronargs]) name;
 clinic_arg:=case when 'p_clinic'=any(f.proargnames) then 'p_clinic' else 'p_clinic_id' end;
 feature:=case when f.proname like '%crm%' then 'crm' when f.proname like '%channel%' or f.proname like '%google%' then 'integrations' when f.proname like '%lab%' or f.proname like '%finance%' then 'finance' else 'core' end;
 select exists(select 1 from aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a where a.privilege_type='EXECUTE' and (a.grantee=0 or a.grantee=(select oid from pg_roles where rolname='authenticated'))) into user_callable;
 body:=format('BEGIN IF NOT private.nexodent_access(%I,%L) THEN RAISE insufficient_privilege USING MESSAGE=''SUBSCRIPTION_REQUIRED: regularize a assinatura ou altere o plano''; END IF; ',clinic_arg,feature);
 if user_callable then body:=body||format('IF NOT private.nexodent_member(%I) THEN RAISE insufficient_privilege USING MESSAGE=''Vínculo ativo com a clínica necessário''; END IF; ',clinic_arg);end if;
 if f.prorettype='void'::regtype then body:=body||format('PERFORM private.%I(%s); RETURN; END',clone,args);
 elsif f.proretset then body:=body||format('RETURN QUERY SELECT * FROM private.%I(%s); END',clone,args);
 else body:=body||format('RETURN private.%I(%s); END',clone,args);end if;
 execute format('CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS %s LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS %L',f.proname,pg_get_function_arguments(f.oid),pg_get_function_result(f.oid),body);
 end loop;
end $$;
-- Alterações administrativas continuam prevalecendo sobre o pagamento automático.
alter table public.nexodent_clinic_subscriptions add column if not exists admin_hold boolean not null default false;
create function private.nexodent_admin_hold() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is not null and exists(select 1 from public.nexodent_platform_admins where user_id=auth.uid()) then
 if new.status='canceled' then new.admin_hold:=true;elsif new.status in ('active','exempt','trial') then new.admin_hold:=false;end if;
 end if;return new;
end $$;
create trigger nexodent_admin_hold before update on public.nexodent_clinic_subscriptions for each row execute function private.nexodent_admin_hold();
-- Atualiza o predicado, sem encurtar datas e sem depender de cron para bloquear o vencido.
do $$declare def text;begin
 select pg_get_functiondef('private.nexodent_access(uuid,text)'::regprocedure) into def;
 execute replace(def,'-- Clinicas anteriores/isentas',E'IF s.admin_hold THEN RETURN false; END IF;\n -- Clinicas anteriores/isentas');
end $$;
notify pgrst,'reload schema';
commit;
