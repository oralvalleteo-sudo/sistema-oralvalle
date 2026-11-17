-- Execute este arquivo inteiro no SQL Editor do Supabase como postgres.
-- Não promove usuários automaticamente nem altera acessos já escolhidos.
begin;

-- Amplia a validação existente sem substituir wrappers de proteção de documentos.
do $migration$
declare f record; definition text; patched integer := 0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private')
 and p.prosrc like '%INVALID_MEMBER_PATCH: invalid permission%' and p.prosrc like '%jsonb_each%' loop
  definition:=pg_get_functiondef(f.oid);
  if definition not like '%''lab''%' then
   definition:=regexp_replace(definition,'if k not in \(',
    'if k not in (''lab'',''ortho'',''impl'',''prot'',''sigdoc'',''reports'',''chat'',''crm'',''wa'',');
   execute definition;
  end if;
  patched:=patched+1;
 end loop;
 if patched=0 then raise exception 'Validador de permissões não encontrado. Nenhuma alteração aplicada.';end if;
end $migration$;

-- Compatibilidade com instalações anteriores que retornavam void ou boolean.
-- Sem CASCADE: dependências inesperadas abortam a transação, preservando o banco.
drop function if exists public.nexodent_set_clinic_admin(uuid,uuid,boolean);
create function public.nexodent_set_clinic_admin(p_clinic_id uuid,p_user_id uuid,p_make_admin boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $function$
declare member public.clinic_members%rowtype;
begin
 perform private.require_member(p_clinic_id);
 perform 1 from public.clinics where id=p_clinic_id for update;
 if not private.is_admin(p_clinic_id) then raise insufficient_privilege using message='Somente administrador pode alterar perfis';end if;
 if p_make_admin is null or p_user_id is null then raise invalid_parameter_value using message='Perfil ou usuário inválido';end if;
 if p_user_id=auth.uid() then raise insufficient_privilege using message='Não é permitido alterar o próprio perfil administrativo';end if;
 select * into member from public.clinic_members where clinic_id=p_clinic_id and user_id=p_user_id for update;
 if not found or not member.active then raise exception using errcode='P0002',message='Usuário ativo não encontrado nesta clínica';end if;
 if member.admin and not p_make_admin and not exists(select 1 from public.clinic_members
   where clinic_id=p_clinic_id and active and admin and user_id<>p_user_id) then
  raise insufficient_privilege using message='A clínica precisa manter um administrador ativo';
 end if;
 if member.admin is distinct from p_make_admin then
  update public.clinic_members set admin=p_make_admin where clinic_id=p_clinic_id and user_id=p_user_id;
  update public.clinics set revision=revision+1 where id=p_clinic_id;
 end if;
 return public.clinic_members_list(p_clinic_id);
end $function$;
revoke all on function public.nexodent_set_clinic_admin(uuid,uuid,boolean) from public,anon;
grant execute on function public.nexodent_set_clinic_admin(uuid,uuid,boolean) to authenticated;

-- Restrições adicionais do laboratório, mantendo as políticas anteriores de clínica.
-- Sem chave lab em cadastros antigos, mantém a dependência histórica de Pacientes.
create or replace function private.nexodent_lab_access(p_clinic uuid,p_write boolean default false)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $function$
declare m public.clinic_members%rowtype; lv integer;
begin
 select * into m from public.clinic_members where clinic_id=p_clinic and user_id=auth.uid() and active;
 if not found then return false;end if;
 if m.admin then return true;end if;
 lv:=case when m.perms is null then 2 when not (m.perms ? 'lab') then private.level(p_clinic,'pac')
   else case m.perms->>'lab' when 'edit' then 2 when 'view' then 1 else 0 end end;
 return least(lv,private.level(p_clinic,'pac'),private.level(p_clinic,'pac.dados')) >= case when p_write then 2 else 1 end;
end $function$;
revoke all on function private.nexodent_lab_access(uuid,boolean) from public,anon,authenticated;
-- Políticas executam a função com os privilégios do chamador.
grant usage on schema private to authenticated;
grant execute on function private.nexodent_lab_access(uuid,boolean) to authenticated;
do $migration$
declare t text;
begin
 foreach t in array array['nexodent_lab_orders','nexodent_lab_comments','nexodent_lab_photos'] loop
  if to_regclass('public.'||t) is not null and exists(select 1 from information_schema.columns
    where table_schema='public' and table_name=t and column_name='clinic_id') then
   execute format('drop policy if exists nexodent_lab_module_read on public.%I',t);
   execute format('create policy nexodent_lab_module_read on public.%I as restrictive for select to authenticated using(private.nexodent_lab_access(clinic_id,false))',t);
   execute format('drop policy if exists nexodent_lab_module_insert on public.%I',t);
   execute format('create policy nexodent_lab_module_insert on public.%I as restrictive for insert to authenticated with check(private.nexodent_lab_access(clinic_id,true))',t);
   execute format('drop policy if exists nexodent_lab_module_update on public.%I',t);
   execute format('create policy nexodent_lab_module_update on public.%I as restrictive for update to authenticated using(private.nexodent_lab_access(clinic_id,true)) with check(private.nexodent_lab_access(clinic_id,true))',t);
   execute format('drop policy if exists nexodent_lab_module_delete on public.%I',t);
   execute format('create policy nexodent_lab_module_delete on public.%I as restrictive for delete to authenticated using(private.nexodent_lab_access(clinic_id,true))',t);
  end if;
 end loop;
end $migration$;
notify pgrst,'reload schema';
commit;
