begin;
create or replace function public.nexodent_offline_apply(p_clinic uuid,p_operation uuid,p_revision bigint,p_changes jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare previous public.nexodent_offline_operations%rowtype; fingerprint text; result jsonb; actor uuid;
begin
  actor := auth.uid();
  perform private.require_member(p_clinic);
  if p_operation is null or p_revision is null or p_revision<0 or jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception using errcode='22023',message='INVALID_OFFLINE_OPERATION';
  end if;
  perform 1 from public.clinics where id=p_clinic for update;
  perform private.require_member(p_clinic);
  fingerprint := encode(sha256(convert_to(jsonb_build_array(p_revision,p_changes)::text,'UTF8')),'hex');
  select * into previous from public.nexodent_offline_operations where clinic_id=p_clinic and operation_id=p_operation;
  if found then
    if previous.user_id<>actor or previous.request_hash<>fingerprint then
      raise exception using errcode='22023',message='OFFLINE_OPERATION_ID_REUSED';
    end if;
    return jsonb_build_object('id',p_operation,'status','already_applied');
  end if;
  -- Existing RPC validates current permissions, row structure and clinic revision.
  result := public.clinic_apply(p_clinic,p_revision,p_changes);
  insert into public.nexodent_offline_operations(clinic_id,operation_id,user_id,entity_type,entity_id,expected_revision,request_hash)
  values(p_clinic,p_operation,actor,'clinic_batch',p_clinic::text,p_revision,fingerprint);
  return jsonb_build_object('id',p_operation,'status','applied','result',result);
end $$;
revoke all on function public.nexodent_offline_apply(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.nexodent_offline_apply(uuid,uuid,bigint,jsonb) to authenticated;
commit;
