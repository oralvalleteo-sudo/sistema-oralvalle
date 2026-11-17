-- Execute inteiro. Nenhum registro existente é removido ou corrigido automaticamente.
begin;
drop trigger if exists nexodent_expense_guard on public.nexodent_general_expenses;
alter table public.nexodent_general_expenses add column if not exists planned_paid_at date;
alter table public.nexodent_general_expenses add column if not exists voided_at timestamptz;
alter table public.nexodent_general_expenses add column if not exists void_reason text;
alter table public.nexodent_general_expenses alter column due_date drop not null;
alter table public.nexodent_general_expenses add column if not exists reference_month date;
alter table public.nexodent_general_expenses add column if not exists revision bigint not null default 0;
update public.nexodent_general_expenses set reference_month=date_trunc('month',coalesce(created_at,now()) at time zone 'America/Sao_Paulo')::date where reference_month is null;
alter table public.nexodent_general_expenses alter column reference_month set default (date_trunc('month',now() at time zone 'America/Sao_Paulo')::date);
alter table public.nexodent_general_expenses alter column reference_month set not null;
revoke delete on public.nexodent_general_expenses from public,anon,authenticated;
create table if not exists private.nexodent_expense_review_audit(
 id bigint generated always as identity primary key,clinic_id uuid not null,
 expense_id uuid not null,actor uuid not null,action text not null,before_data jsonb not null,
 reviewed_at timestamptz not null default now()
);
alter table private.nexodent_expense_review_audit add column if not exists after_data jsonb;
revoke all on private.nexodent_expense_review_audit from public,anon,authenticated;
create or replace function private.nexodent_expense_fingerprint(r public.nexodent_general_expenses)
returns text language sql immutable set search_path=pg_catalog as $fn$
 select jsonb_build_array(lower(regexp_replace(trim(r.description),'\s+',' ','g')),
 lower(trim(r.category)),lower(trim(r.supplier)),r.amount,r.due_date,r.reference_month)::text
$fn$;
revoke all on function private.nexodent_expense_fingerprint(public.nexodent_general_expenses) from public,anon,authenticated;
create or replace function private.nexodent_expense_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog as $fn$
begin
 if auth.uid() is not null or current_setting('role',true) in ('authenticated','anon') then
  perform private.require_member(new.clinic_id);
  if private.level(new.clinic_id,'vd')<2 then raise insufficient_privilege using message='Edição do Financeiro necessária';end if;
 end if;
 if new.paid_at > (now() at time zone 'America/Sao_Paulo')::date then
  if tg_op='INSERT' then raise exception using errcode='22023',message='Pagamento ainda não realizado: use Pagamento previsto, não Data do pagamento realizado.';
  elsif new.paid_at is distinct from old.paid_at then raise exception using errcode='22023',message='Data futura deve ser registrada como pagamento previsto.';end if;
 end if;
 if (tg_op='INSERT' or private.nexodent_expense_fingerprint(new) is distinct from private.nexodent_expense_fingerprint(old)) and new.voided_at is null then
  perform 1 from public.clinics where id=new.clinic_id for update;
  if exists(select 1 from public.nexodent_general_expenses e where e.clinic_id=new.clinic_id and e.voided_at is null and e.id<>new.id
   and private.nexodent_expense_fingerprint(e)=private.nexodent_expense_fingerprint(new)) then
   raise exception using errcode='23505',message='Esta conta já está cadastrada com a mesma descrição, fornecedor, valor e vencimento. Atualize e utilize o registro existente.';
  end if;
 end if;
 if new.reference_month<>date_trunc('month',new.reference_month)::date or length(trim(new.category)) not between 1 and 100 then raise invalid_parameter_value using message='Confira o mês de referência e a categoria';end if;
 if tg_op='UPDATE' then
  new.revision:=old.revision+1;
  if auth.uid() is not null then
   insert into private.nexodent_expense_review_audit(clinic_id,expense_id,actor,action,before_data,after_data)
   values(old.clinic_id,old.id,auth.uid(),case when new.voided_at is not null and old.voided_at is null then 'void' else 'update' end,to_jsonb(old),to_jsonb(new));
  end if;
 end if;
 return new;
end $fn$;
revoke all on function private.nexodent_expense_guard() from public,anon,authenticated;
drop trigger if exists nexodent_expense_guard on public.nexodent_general_expenses;
create trigger nexodent_expense_guard before insert or update on public.nexodent_general_expenses for each row execute function private.nexodent_expense_guard();
drop policy if exists nexodent_expense_active on public.nexodent_general_expenses;
create policy nexodent_expense_active on public.nexodent_general_expenses as restrictive for all to authenticated
 using(voided_at is null) with check(voided_at is null);
create or replace function public.nexodent_review_expense(p_clinic uuid,p_keep uuid,p_copies uuid[],p_planned date default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare keep_row public.nexodent_general_expenses%rowtype;r public.nexodent_general_expenses%rowtype;copies uuid[]:=coalesce(p_copies,'{}'::uuid[]);n integer:=0;
begin
 perform private.require_member(p_clinic);
 if private.level(p_clinic,'vd')<2 then raise insufficient_privilege using message='Edição do Financeiro necessária';end if;
 perform 1 from public.clinics where id=p_clinic for update;
 if cardinality(copies)>20 or p_keep=any(copies) or cardinality(copies)<>(select count(distinct x) from unnest(copies) x) then raise invalid_parameter_value using message='Seleção de cópias inválida';end if;
 select * into keep_row from public.nexodent_general_expenses where clinic_id=p_clinic and id=p_keep and voided_at is null for update;
 if not found then raise exception using errcode='P0002',message='Conta não encontrada. Atualize o Financeiro.';end if;
 if keep_row.external_reference is not null or (keep_row.paid_at is not null and keep_row.paid_at<=(now() at time zone 'America/Sao_Paulo')::date) then
  raise invalid_parameter_value using message='Pagamento realizado ou vinculado exige revisão individual; nenhuma alteração aplicada';end if;
 if p_planned is distinct from coalesce(keep_row.paid_at,keep_row.planned_paid_at) then raise invalid_parameter_value using message='A data prevista mudou. Atualize os dados.';end if;
 for r in select * from public.nexodent_general_expenses where clinic_id=p_clinic and id=any(copies) and voided_at is null for update loop
  if private.nexodent_expense_fingerprint(r)<>private.nexodent_expense_fingerprint(keep_row)
    or r.paid_at is distinct from keep_row.paid_at or r.planned_paid_at is distinct from keep_row.planned_paid_at
    or r.external_reference is not null or r.payment_method is distinct from keep_row.payment_method then
   raise invalid_parameter_value using message='As contas não são cópias idênticas. Nenhuma alteração aplicada';end if;
  update public.nexodent_general_expenses set voided_at=now(),void_reason='Cópia duplicada; registro mantido: '||p_keep::text where id=r.id and clinic_id=p_clinic;
  n:=n+1;
 end loop;
 if n<>cardinality(copies) then raise invalid_parameter_value using message='Uma cópia mudou ou pertence a outra clínica. Nenhuma alteração aplicada';end if;
 update public.nexodent_general_expenses set paid_at=null,planned_paid_at=p_planned,payment_method=null where clinic_id=p_clinic and id=p_keep;
 return jsonb_build_object('kept',p_keep,'voided',n,'planned_paid_at',p_planned);
end $fn$;
revoke all on function public.nexodent_review_expense(uuid,uuid,uuid[],date) from public,anon;
grant execute on function public.nexodent_review_expense(uuid,uuid,uuid[],date) to authenticated;
create or replace function public.nexodent_void_expense(p_clinic uuid,p_id uuid,p_revision bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare r public.nexodent_general_expenses%rowtype;
begin
 perform private.require_member(p_clinic);
 if private.level(p_clinic,'vd')<2 then raise insufficient_privilege using message='Edição do Financeiro necessária';end if;
 perform 1 from public.clinics where id=p_clinic for update;
 select * into r from public.nexodent_general_expenses where clinic_id=p_clinic and id=p_id and voided_at is null for update;
 if not found or r.revision is distinct from p_revision then raise invalid_parameter_value using message='O lançamento mudou. Atualize antes de cancelar.';end if;
 update public.nexodent_general_expenses set voided_at=now(),void_reason='Cancelado pelo usuário; original preservado na auditoria' where clinic_id=p_clinic and id=p_id;
 return jsonb_build_object('voided',p_id);
end $fn$;
revoke all on function public.nexodent_void_expense(uuid,uuid,bigint) from public,anon;
grant execute on function public.nexodent_void_expense(uuid,uuid,bigint) to authenticated;
create or replace function public.nexodent_merge_expense_categories(p_clinic uuid,p_sources text[],p_target text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare n integer;
begin
 perform private.require_member(p_clinic);
 if private.level(p_clinic,'vd')<2 then raise insufficient_privilege using message='Edição do Financeiro necessária';end if;
 if p_target is null or length(trim(p_target)) not between 1 and 100 or coalesce(cardinality(p_sources),0) not between 1 and 100 then raise invalid_parameter_value using message='Selecione as categorias e o nome final';end if;
 perform 1 from public.clinics where id=p_clinic for update;
 update public.nexodent_general_expenses set category=trim(p_target) where clinic_id=p_clinic and voided_at is null and category=any(p_sources) and category is distinct from trim(p_target);
 get diagnostics n=row_count;
 return jsonb_build_object('updated',n,'category',trim(p_target));
end $fn$;
revoke all on function public.nexodent_merge_expense_categories(uuid,text[],text) from public,anon;
grant execute on function public.nexodent_merge_expense_categories(uuid,text[],text) to authenticated;
notify pgrst,'reload schema';
commit;
