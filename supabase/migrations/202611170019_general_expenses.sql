-- Execute inteiro no SQL Editor do Supabase. Não importa nem duplica pagamentos.
begin;
create table if not exists public.nexodent_general_expenses (
 id uuid primary key default gen_random_uuid(),
 clinic_id uuid not null references public.clinics(id),
 description text not null check(length(trim(description)) between 2 and 200),
 category text not null default 'Outros',supplier text not null default '',
 amount numeric(14,2) not null check(amount>0),due_date date not null,
 paid_at date,payment_method text,external_reference text,
 created_at timestamptz not null default now()
);
alter table public.nexodent_general_expenses enable row level security;
create index if not exists nexodent_general_expenses_clinic_due on public.nexodent_general_expenses(clinic_id,due_date);
create or replace function private.nexodent_expenses_access(p_clinic uuid,p_write boolean default false)
returns boolean language sql stable security definer set search_path=pg_catalog as $fn$
 select private.level(p_clinic,'vd') >= case when p_write then 2 else 1 end
$fn$;
revoke all on function private.nexodent_expenses_access(uuid,boolean) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.nexodent_expenses_access(uuid,boolean) to authenticated;
revoke all on public.nexodent_general_expenses from public,anon,authenticated;
grant select,insert,update on public.nexodent_general_expenses to authenticated;
-- Restrições impedem que políticas antigas liberem outra clínica ou edição sem acesso.
drop policy if exists nexodent_expenses_scope on public.nexodent_general_expenses;
create policy nexodent_expenses_scope on public.nexodent_general_expenses as restrictive
 for all to authenticated using(private.nexodent_expenses_access(clinic_id,false))
 with check(private.nexodent_expenses_access(clinic_id,true));
drop policy if exists nexodent_expenses_read on public.nexodent_general_expenses;
create policy nexodent_expenses_read on public.nexodent_general_expenses for select to authenticated
 using(private.nexodent_expenses_access(clinic_id,false));
drop policy if exists nexodent_expenses_add on public.nexodent_general_expenses;
create policy nexodent_expenses_add on public.nexodent_general_expenses for insert to authenticated
 with check(private.nexodent_expenses_access(clinic_id,true));
drop policy if exists nexodent_expenses_change on public.nexodent_general_expenses;
create policy nexodent_expenses_change on public.nexodent_general_expenses for update to authenticated
 using(private.nexodent_expenses_access(clinic_id,true)) with check(private.nexodent_expenses_access(clinic_id,true));
-- UPDATE precisa de restrição própria: SELECT autorizado não concede edição.
drop policy if exists nexodent_expenses_write_guard on public.nexodent_general_expenses;
create policy nexodent_expenses_write_guard on public.nexodent_general_expenses as restrictive for update to authenticated
 using(private.nexodent_expenses_access(clinic_id,true)) with check(private.nexodent_expenses_access(clinic_id,true));
notify pgrst,'reload schema';
commit;
