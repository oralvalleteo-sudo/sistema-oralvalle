begin;
-- Limita crescimento da fila anônima, além dos controles de cadastro do Supabase Auth.
create table private.nexodent_registration_limits(bucket text primary key,window_start timestamptz not null,hits integer not null);
revoke all on private.nexodent_registration_limits from public,anon,authenticated,service_role;
create function private.nexodent_limit_registration(p_email text) returns void language plpgsql security definer set search_path=pg_catalog as $$
declare h jsonb;ip text;k text;counter integer;win timestamptz:=date_trunc('minute',now());
begin
 h:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 ip:=left(coalesce(h->>'x-forwarded-for','unknown'),200);
 -- O limite global independe de cabeçalhos do cliente. IP é defesa adicional, não autenticação.
 foreach k in array array['global:'||win::text,'ip:'||md5(ip)||':'||win::text,'email:'||md5(lower(p_email))||':'||date_trunc('hour',now())::text] loop
 insert into private.nexodent_registration_limits values(k,now(),1) on conflict(bucket) do update set hits=nexodent_registration_limits.hits+1 returning hits into counter;
 if counter>(case when left(k,7)='global:' then 100 when left(k,3)='ip:' then 10 else 3 end) then raise exception 'TOO_MANY_REQUESTS: aguarde antes de solicitar outro cadastro';end if;
 end loop;
 delete from private.nexodent_registration_limits where window_start<now()-interval '1 day';
end $$;
revoke all on function private.nexodent_limit_registration(text) from public,anon,authenticated,service_role;
do $$declare def text;begin
 select pg_get_functiondef('public.nexodent_request_trial(text,text,text,text)'::regprocedure) into def;
 execute replace(def,'insert into public.nexodent_trial_requests',E'perform private.nexodent_limit_registration(p_email);\n insert into public.nexodent_trial_requests');
end $$;
-- Assinador/inspeção A1 não podem ser utilizados só com uma conta Auth sem acesso à clínica.
create function public.nexodent_certificate_access(p_clinic uuid) returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform private.require_member(p_clinic);
 if not private.nexodent_access(p_clinic,'records') or least(private.level(p_clinic,'pac'),private.level(p_clinic,'pac.arquivos'))<2 then raise insufficient_privilege using message='Sem permissão para documentos nesta clínica';end if;
 return true;
end $$;
revoke all on function public.nexodent_certificate_access(uuid) from public,anon;
grant execute on function public.nexodent_certificate_access(uuid) to authenticated;
commit;
