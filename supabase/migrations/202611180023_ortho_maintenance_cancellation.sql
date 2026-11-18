begin;

create or replace function public.nexodent_can_cancel_maintenance(p_clinic uuid)
returns boolean
language sql stable security definer set search_path=pg_catalog
as $$
  select auth.uid() is not null and coalesce(private.is_admin(p_clinic), false);
$$;

revoke all on function public.nexodent_can_cancel_maintenance(uuid) from public, anon;
grant execute on function public.nexodent_can_cancel_maintenance(uuid) to authenticated;

create or replace function private.guard_ortho_maintenance_cancellation()
returns trigger
language plpgsql security definer set search_path=pg_catalog
as $$
declare cancellation jsonb;
begin
  if tg_op in ('UPDATE','DELETE') and old.dados ? 'maintenanceCancellation' then
    if tg_op='DELETE' then
      raise exception 'Manutenção cancelada permanece no histórico.' using errcode='22023';
    end if;
    if new.dados is distinct from old.dados then
      raise exception 'Manutenção cancelada permanece no histórico.' using errcode='22023';
    end if;
    return new;
  end if;

  if tg_op='DELETE' then return old; end if;
  if not coalesce(new.dados ? 'maintenanceCancellation', false) then return new; end if;

  if not public.nexodent_can_cancel_maintenance(new.clinic_id) then
    raise exception 'Somente administradores podem cancelar manutenções.' using errcode='42501';
  end if;

  cancellation := new.dados->'maintenanceCancellation';
  if tg_op<>'UPDATE' or old.kind<>'object' or old.slot<>'evol'
    or coalesce(old.dados->>'txt','') !~* '^\[Ortodontia\] '
    or coalesce(old.dados->>'txt','') ~* 'Tratamento finalizado / alta registrada\.'
    or old.dados->>'auto'='true'
    or new.dados - 'maintenanceCancellation' is distinct from old.dados
    or jsonb_typeof(cancellation) is distinct from 'object'
    or jsonb_typeof(cancellation->'reason') is distinct from 'string'
    or length(btrim(cancellation->>'reason')) not between 1 and 500
    or cancellation->>'by' is distinct from auth.uid()::text
    or coalesce(cancellation->>'at','') !~ '^\d{4}-\d{2}-\d{2}T'
  then
    raise exception 'Cancelamento de manutenção inválido.' using errcode='22023';
  end if;
  return new;
end $$;

revoke all on function private.guard_ortho_maintenance_cancellation() from public, anon, authenticated;
drop trigger if exists ortho_maintenance_cancellation on public.patient_evolutions;
create trigger ortho_maintenance_cancellation
after insert or update of dados or delete on public.patient_evolutions
for each row execute function private.guard_ortho_maintenance_cancellation();

commit;
