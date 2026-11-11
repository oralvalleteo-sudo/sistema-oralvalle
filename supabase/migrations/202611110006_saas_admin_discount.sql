begin;
create function public.nexodent_admin_set_discount(p_clinic uuid,p_percent integer,p_reason text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not exists(select 1 from public.nexodent_platform_admins where user_id=auth.uid()) then raise insufficient_privilege;end if;
 if p_percent not between 0 and 99 or length(trim(p_reason)) not between 5 and 500 then raise exception 'Percentual ou justificativa inválida';end if;
 update public.nexodent_clinic_subscriptions set discount_percent=p_percent,updated_at=now() where clinic_id=p_clinic;
 if not found then raise exception 'Configure a assinatura da clínica antes';end if;
 insert into public.nexodent_billing_audit(clinic_id,action,details) values(p_clinic,'admin_discount',jsonb_build_object('actor',auth.uid(),'percent',p_percent,'reason',p_reason));
 return jsonb_build_object('ok',true,'applies_to','new_checkouts');
end $$;
revoke all on function public.nexodent_admin_set_discount(uuid,integer,text) from public,anon;
grant execute on function public.nexodent_admin_set_discount(uuid,integer,text) to authenticated;
commit;
