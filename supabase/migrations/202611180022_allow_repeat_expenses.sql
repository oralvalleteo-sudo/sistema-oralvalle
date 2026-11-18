-- Permite compras iguais com IDs distintos. Mantém validação, permissões e auditoria.
begin;
create or replace function private.nexodent_expense_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog as $fn$
begin
 if auth.uid() is not null or current_setting('role',true) in ('authenticated','anon') then
  perform private.require_member(new.clinic_id);
  if private.level(new.clinic_id,'vd')<2 then raise insufficient_privilege using message='Edição do Financeiro necessária';end if;
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
notify pgrst,'reload schema';
commit;
