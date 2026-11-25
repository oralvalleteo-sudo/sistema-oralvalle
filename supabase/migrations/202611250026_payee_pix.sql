begin;

create table if not exists public.nexodent_payee_pix (
 clinic_id uuid not null references public.clinics(id) on delete cascade,
 payee_type text not null check (payee_type in ('dentist','laboratory')),
 payee_id text not null check (char_length(payee_id) between 1 and 200),
 pix_key text not null check (char_length(pix_key) <= 200 and pix_key = trim(pix_key)),
 primary key (clinic_id, payee_type, payee_id)
);

alter table public.nexodent_payee_pix enable row level security;
revoke all on public.nexodent_payee_pix from public, anon, authenticated;
grant select, insert, update on public.nexodent_payee_pix to authenticated;

create or replace function private.nexodent_payee_pix_access(p_clinic uuid,p_type text,p_write boolean)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select private.level(p_clinic,'vd') >= case when p_write then 2 else 1 end
  and case p_type
   when 'dentist' then private.level(p_clinic,'dt') >= case when p_write then 2 else 1 end
   when 'laboratory' then least(private.level(p_clinic,'lab'),private.level(p_clinic,'pac')) >= 1
   else false end
$$;
revoke all on function private.nexodent_payee_pix_access(uuid,text,boolean) from public, anon;
grant execute on function private.nexodent_payee_pix_access(uuid,text,boolean) to authenticated;

drop policy if exists payee_pix_read on public.nexodent_payee_pix;
create policy payee_pix_read on public.nexodent_payee_pix for select to authenticated
 using (private.nexodent_payee_pix_access(clinic_id,payee_type,false));
drop policy if exists payee_pix_insert on public.nexodent_payee_pix;
create policy payee_pix_insert on public.nexodent_payee_pix for insert to authenticated
 with check (private.nexodent_payee_pix_access(clinic_id,payee_type,true));
drop policy if exists payee_pix_update on public.nexodent_payee_pix;
create policy payee_pix_update on public.nexodent_payee_pix for update to authenticated
 using (private.nexodent_payee_pix_access(clinic_id,payee_type,true))
 with check (private.nexodent_payee_pix_access(clinic_id,payee_type,true));

notify pgrst, 'reload schema';
commit;
