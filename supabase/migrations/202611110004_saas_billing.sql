begin;
create table public.nexodent_billing_checkouts(
 id uuid primary key default gen_random_uuid(),request_key uuid not null unique,clinic_id uuid not null references public.clinics(id),created_by uuid not null,
 plan_code text not null references public.nexodent_plans(code),cycle text not null check(cycle in ('monthly','annual')),method text not null check(method in ('PIX','CREDIT_CARD')),
 amount_cents integer not null check(amount_cents>0),installments integer not null default 1 check(installments in (1,12)),period_start date not null,
 terms_version text not null default '2026-11-11',mode text not null check(mode in ('sandbox','production')),status text not null default 'creating' check(status in ('creating','pending','confirmed','unknown','failed','canceled')),
 renewal_canceled boolean not null default false,superseded boolean not null default false,provider_customer_id text,provider_subscription_id text,provider_payment_id text,provider_installment_id text,checkout_url text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index nexodent_one_pending_checkout on public.nexodent_billing_checkouts(clinic_id) where status in ('creating','pending','unknown');
create table public.nexodent_billing_invoices(
 payment_id text primary key,checkout_id uuid not null references public.nexodent_billing_checkouts(id),amount_cents integer not null,status text not null,due_date date not null,
 period_ends_at timestamptz not null,payment_url text,updated_at timestamptz not null default now()
);
create table public.nexodent_billing_events(event_id text primary key,payment_id text not null,status text not null,processed_at timestamptz not null default now());
create table public.nexodent_billing_audit(id bigint generated always as identity primary key,clinic_id uuid not null references public.clinics(id),action text not null,details jsonb not null default '{}',created_at timestamptz not null default now());
do $$declare t text;begin
 foreach t in array array['nexodent_billing_checkouts','nexodent_billing_invoices','nexodent_billing_events','nexodent_billing_audit'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create function public.nexodent_prepare_checkout(p_clinic uuid,p_user uuid,p_request uuid,p_plan text,p_cycle text,p_method text,p_installments integer,p_mode text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare plan public.nexodent_plans;row public.nexodent_billing_checkouts;s public.nexodent_clinic_subscriptions;
begin
 if not exists(select 1 from public.clinic_members where clinic_id=p_clinic and user_id=p_user and active and admin) then raise insufficient_privilege;end if;
 perform 1 from public.clinics where id=p_clinic for update;
 select * into row from public.nexodent_billing_checkouts where request_key=p_request;
 if found then
 if row.clinic_id<>p_clinic or row.created_by<>p_user then raise insufficient_privilege;end if;
 return to_jsonb(row)||jsonb_build_object('owned',false);end if;
 select * into row from public.nexodent_billing_checkouts where clinic_id=p_clinic and status in ('creating','pending','unknown');
 if found then return to_jsonb(row)||jsonb_build_object('owned',false);end if;
 select * into plan from public.nexodent_plans where code=p_plan and active and monthly_cents>0;
 if not found or p_cycle not in ('monthly','annual') or p_method not in ('PIX','CREDIT_CARD') or p_installments not in (1,12) or (p_installments=12 and (p_cycle<>'annual' or p_method<>'CREDIT_CARD')) or p_mode not in ('sandbox','production') then raise exception 'Contratação inválida';end if;
 if (select count(*) from public.clinic_members where clinic_id=p_clinic and active)>plan.max_users then raise exception 'Reduza os usuários ativos antes de mudar para este plano';end if;
 select * into s from public.nexodent_clinic_subscriptions where clinic_id=p_clinic;
 insert into public.nexodent_billing_checkouts(request_key,clinic_id,created_by,plan_code,cycle,method,installments,mode,amount_cents,period_start)
 values(p_request,p_clinic,p_user,p_plan,p_cycle,p_method,p_installments,p_mode,round((case when p_cycle='annual' then plan.annual_cents else plan.monthly_cents end)*(100-coalesce(s.discount_percent,0))/100.0)::integer,
 greatest(current_date,s.paid_until::date,case when s.status='trial' then s.trial_ends_at::date end)) returning * into row;
 return to_jsonb(row)||jsonb_build_object('owned',true);
end $$;
create function public.nexodent_apply_billing_payment(p_event text,p_checkout uuid,p_payment text,p_status text,p_amount integer,p_due date,p_url text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare c public.nexodent_billing_checkouts;period_end timestamptz;old public.nexodent_billing_invoices;s public.nexodent_clinic_subscriptions;
begin
 select * into c from public.nexodent_billing_checkouts where id=p_checkout for update;
 if not found or c.status='failed' then raise exception 'Contratação desconhecida';end if;
 if p_amount not between floor(c.amount_cents::numeric/c.installments) and ceil(c.amount_cents::numeric/c.installments) then raise exception 'Valor diferente do contratado';end if;
 if p_due<c.period_start and c.installments=1 then raise exception 'Vencimento inválido';end if;
 if length(p_event)>255 or length(p_payment)>100 then raise exception 'Evento inválido';end if;
 if exists(select 1 from public.nexodent_billing_events where event_id=p_event) then return jsonb_build_object('duplicate',true);end if;
 period_end:=((case when c.installments=12 then c.period_start else p_due end)::timestamp at time zone 'UTC')+case when c.cycle='annual' then interval '1 year' else interval '1 month' end;
 select * into old from public.nexodent_billing_invoices where payment_id=p_payment;
 if found and old.checkout_id<>c.id then raise exception 'Cobrança pertence a outro contrato';end if;
 insert into public.nexodent_billing_invoices values(p_payment,c.id,p_amount,p_status,p_due,period_end,p_url,now())
 on conflict(payment_id) do update set status=excluded.status,payment_url=excluded.payment_url,updated_at=now();
 select * into s from public.nexodent_clinic_subscriptions where clinic_id=c.clinic_id for update;
 if not c.superseded and s.status is distinct from 'exempt' and p_status in ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH') then
  -- Pagamento de período antigo não rebaixa um plano renovado posteriormente.
  if coalesce(s.paid_until,'-infinity'::timestamptz)<=period_end then
   insert into public.nexodent_clinic_subscriptions(clinic_id,status,plan_code,billing_cycle,billing_enforced,current_period_ends_at,paid_until,provider_subscription_id,provider_customer_id)
   values(c.clinic_id,'active',c.plan_code,c.cycle,true,period_end,period_end,case when c.renewal_canceled then null else c.provider_subscription_id end,c.provider_customer_id)
   on conflict(clinic_id) do update set status='active',plan_code=excluded.plan_code,billing_cycle=excluded.billing_cycle,billing_enforced=true,current_period_ends_at=greatest(nexodent_clinic_subscriptions.current_period_ends_at,excluded.current_period_ends_at),paid_until=greatest(nexodent_clinic_subscriptions.paid_until,excluded.paid_until),provider_subscription_id=excluded.provider_subscription_id,provider_customer_id=excluded.provider_customer_id,cancel_at_period_end=(c.provider_subscription_id is null or c.renewal_canceled),updated_at=now();
  end if;
  update public.nexodent_billing_checkouts set superseded=true where clinic_id=c.clinic_id and id<>c.id and status='confirmed';
  update public.nexodent_billing_checkouts set status='confirmed',updated_at=now() where id=c.id;
 elsif not c.superseded and s.status is distinct from 'exempt' and p_status in ('REFUNDED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL') and coalesce(s.paid_until,'-infinity'::timestamptz)<=period_end then
  update public.nexodent_clinic_subscriptions set status='canceled',cancel_at_period_end=false,paid_until=least(paid_until,now()),current_period_ends_at=least(current_period_ends_at,now()),updated_at=now() where clinic_id=c.clinic_id;
 elsif not c.superseded and s.plan_code<>'gratis' and p_status='OVERDUE' and coalesce(s.paid_until, s.trial_ends_at,'-infinity'::timestamptz)<now() then
  update public.nexodent_clinic_subscriptions set status='past_due',updated_at=now() where clinic_id=c.clinic_id and status<>'exempt';
 end if;
 insert into public.nexodent_billing_events values(p_event,p_payment,p_status,now());
 insert into public.nexodent_billing_audit(clinic_id,action,details) values(c.clinic_id,'payment_status',jsonb_build_object('payment_id',p_payment,'status',p_status,'checkout_id',c.id));
 return jsonb_build_object('ok',true);
end $$;
create function public.nexodent_billing_cancel(p_clinic uuid,p_free boolean default false,p_keep uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_free and (select count(*) from public.clinic_members where clinic_id=p_clinic and active)>1 then raise exception 'Plano grátis permite um usuário';end if;
 update public.nexodent_clinic_subscriptions set cancel_at_period_end=not p_free,provider_subscription_id=null,
 plan_code=case when p_free then 'gratis' else plan_code end,status=case when p_free then 'active' else status end,billing_enforced=true,updated_at=now() where clinic_id=p_clinic;
 update public.nexodent_billing_checkouts set status=case when status in ('creating','pending','unknown') then 'canceled' else status end,renewal_canceled=true,superseded=case when p_free then true else superseded end where clinic_id=p_clinic and (p_keep is null or id<>p_keep);
 insert into public.nexodent_billing_audit(clinic_id,action) values(p_clinic,case when p_free then 'switch_free' else 'cancel_renewal' end);
 return jsonb_build_object('ok',true);
end $$;
create function public.nexodent_billing_history(p_clinic uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not exists(select 1 from public.clinic_members where clinic_id=p_clinic and user_id=auth.uid() and active and admin) then raise insufficient_privilege;end if;
 return jsonb_build_object('invoices',coalesce((select jsonb_agg(to_jsonb(i)) from (select i.* from public.nexodent_billing_invoices i join public.nexodent_billing_checkouts c on c.id=i.checkout_id where c.clinic_id=p_clinic order by i.due_date desc limit 100)i),'[]'),
 'pending',coalesce((select to_jsonb(c)-'created_by'-'provider_customer_id' from public.nexodent_billing_checkouts c where clinic_id=p_clinic and status in ('creating','pending','unknown') order by created_at desc limit 1),'null'));
end $$;
revoke all on function public.nexodent_prepare_checkout(uuid,uuid,uuid,text,text,text,integer,text),public.nexodent_apply_billing_payment(text,uuid,text,text,integer,date,text),public.nexodent_billing_cancel(uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.nexodent_prepare_checkout(uuid,uuid,uuid,text,text,text,integer,text),public.nexodent_apply_billing_payment(text,uuid,text,text,integer,date,text),public.nexodent_billing_cancel(uuid,boolean,uuid) to service_role;
revoke all on function public.nexodent_billing_history(uuid) from public,anon;
grant execute on function public.nexodent_billing_history(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
