begin;

create table private.offline_write_receipts (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null,
  operation_id uuid not null,
  base_revision bigint not null,
  fingerprint text not null,
  result jsonb not null,
  primary key (clinic_id, user_id, operation_id)
);

revoke all on private.offline_write_receipts from public, anon, authenticated;

create function public.clinic_apply_offline(
  p_clinic uuid, p_revision bigint, p_changes jsonb, p_operation uuid
) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
  actor uuid := auth.uid();
  receipt private.offline_write_receipts%rowtype;
  digest text;
  applied jsonb;
begin
  perform private.require_member(p_clinic);
  if actor is null or p_operation is null or p_revision is null
     or jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) > 50000 then
    raise exception using errcode = '22023', message = 'INVALID_OFFLINE_OPERATION';
  end if;
  perform 1 from public.clinics where id = p_clinic for update;
  perform private.require_member(p_clinic);
  digest := encode(sha256(convert_to(p_changes::text, 'UTF8')), 'hex');
  select * into receipt from private.offline_write_receipts
    where clinic_id = p_clinic and user_id = actor and operation_id = p_operation;
  if found then
    if receipt.base_revision <> p_revision or receipt.fingerprint <> digest then
      raise exception using errcode = '22023', message = 'OFFLINE_OPERATION_MISMATCH';
    end if;
    return receipt.result;
  end if;
  applied := public.clinic_apply(p_clinic, p_revision, p_changes);
  insert into private.offline_write_receipts values (p_clinic, actor, p_operation, p_revision, digest, applied);
  return applied;
end;
$$;
revoke all on function public.clinic_apply_offline(uuid,bigint,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.clinic_apply_offline(uuid,bigint,jsonb,uuid) to authenticated;

create function public.clinic_offline_capabilities(p_clinic uuid) returns integer
language plpgsql stable security definer set search_path = pg_catalog as $$
begin
  perform private.require_member(p_clinic);
  return 1;
end;
$$;
revoke all on function public.clinic_offline_capabilities(uuid) from public, anon, authenticated;
grant execute on function public.clinic_offline_capabilities(uuid) to authenticated;

commit;
