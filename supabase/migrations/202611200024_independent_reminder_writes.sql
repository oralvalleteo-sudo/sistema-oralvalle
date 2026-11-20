begin;

create or replace function public.clinic_apply_independent_reminders(
  p_clinic uuid, p_revision bigint, p_changes jsonb, p_expected jsonb
) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare
  revision_now bigint;
  change jsonb;
  existing jsonb;
  expected jsonb;
  row_id text;
begin
  perform private.require_member(p_clinic);
  if p_revision is null or jsonb_typeof(p_changes) is distinct from 'array'
    or jsonb_typeof(p_expected) is distinct from 'object' then
    raise exception using errcode='22023', message='INVALID_CHANGES: reminder changes and baseline required';
  end if;
  if jsonb_array_length(p_changes) not between 1 and 50000 then
    raise exception using errcode='22023', message='INVALID_CHANGES: expected one or more reminder changes';
  end if;
  select revision into revision_now from public.clinics where id=p_clinic for update;
  perform private.require_member(p_clinic);
  if private.table_level(p_clinic,'reminders','lem',true)<2 then
    raise exception using errcode='42501', message='CLOUD_PERMISSION_DENIED: reminders not editable';
  end if;
  if p_revision>revision_now then
    raise exception using errcode='40001', message='CLOUD_CONFLICT: invalid clinic revision';
  end if;
  for change in select value from jsonb_array_elements(p_changes) loop
    row_id:=change->>'id';
    if change->>'table' is distinct from 'reminders' or row_id is null or not (p_expected ? row_id)
      or (
        change->'delete' is distinct from 'true'::jsonb
        and (
          change->'row'->>'slot' is distinct from 'lem'
          or (
            change->'row'->>'kind' is distinct from 'object'
            and not (
              row_id='[null,"lem"]'
              and change->'row'->>'kind'='array'
              and change->'row'->>'position'='-1'
              and change->'row'->'dados'='null'::jsonb
            )
          )
        )
      )
      or (row_id='[null,"lem"]' and change->'delete'='true'::jsonb) then
      raise exception using errcode='22023', message='INVALID_CHANGES: only independent reminder records are supported';
    end if;
    expected:=p_expected->row_id;
    if jsonb_typeof(expected) not in ('null','object') then
      raise exception using errcode='22023', message='INVALID_CHANGES: malformed reminder baseline';
    end if;
    select dados into existing from public.reminders where clinic_id=p_clinic and id=row_id;
    if coalesce(existing,'null'::jsonb) is distinct from expected then
      raise exception using errcode='40001', message='CLOUD_CONFLICT: reminder changed; reload before saving';
    end if;
  end loop;
  -- The clinic lock keeps validation and the standard write in one transaction.
  return public.clinic_apply(p_clinic,revision_now,p_changes)
    || jsonb_build_object('rebased',revision_now<>p_revision);
end $$;

revoke all on function public.clinic_apply_independent_reminders(uuid,bigint,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.clinic_apply_independent_reminders(uuid,bigint,jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';

commit;
