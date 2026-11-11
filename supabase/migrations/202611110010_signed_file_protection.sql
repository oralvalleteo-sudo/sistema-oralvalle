-- Proteção do histórico de documentos. Requer base clínica e protocolo de arquivos de 202610200002.
-- Não apaga dados. Restauração que substitua documentos assinados requer revisão administrativa fora do app.
begin;
create or replace function private.read_row(p_clinic uuid,p_table text,p_row jsonb,p_metadata boolean) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare contents jsonb:=p_row->'dados';
begin
  if p_table='patients' and p_row->>'kind'='object'
    and least(private.level(p_clinic,'pac'),private.level(p_clinic,'pac.dados'))<1 then
    contents:=contents-array(select jsonb_object_keys(contents) except select unnest(array['id','nome']));
  elsif p_metadata and p_table='patient_files' then
    if p_row->>'slot'='arquivos' and p_row->>'kind'='object' then
      contents:=jsonb_build_object('id',contents->'id','nome',contents->'nome','tipo',contents->'tipo',
        'categoria',contents->'categoria','dataEnvio',contents->'dataEnvio',
        'sha256',contents->'sha256','assinaturaTipo',contents->'assinaturaTipo',
        'assinadoEm',contents->'assinadoEm','dentistaNome',contents->'dentistaNome','dentistaCro',contents->'dentistaCro');
    else contents:='null'::jsonb;
    end if;
  end if;
  return jsonb_set(p_row,'{dados}',contents);
end $$;

create or replace function private.guard_signed_file() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if (coalesce(old.dados->>'assinaturaTipo','')<>'' or coalesce(old.dados->>'sha256','')<>''
     or coalesce(old.dados->>'categoria','') ~* 'assinad'
     or (old.slot in ('sign','evolSign') and old.kind='value' and old.dados not in ('null'::jsonb,'""'::jsonb))) then
   if tg_op='DELETE' then raise insufficient_privilege using message='SIGNED_FILE_PROTECTED: documento assinado não pode ser excluído. Preserve o histórico e crie uma nova versão';end if;
   if new.dados is distinct from old.dados or new.parent_id is distinct from old.parent_id
       or new.clinic_id is distinct from old.clinic_id or new.slot is distinct from old.slot or new.id is distinct from old.id then
     raise insufficient_privilege using message='SIGNED_FILE_PROTECTED: documento assinado não pode ser alterado. Crie uma nova versão';
   end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function private.guard_signed_file() from public,anon,authenticated;
drop trigger if exists nexodent_signed_file_guard on public.patient_files;
create trigger nexodent_signed_file_guard before update or delete on public.patient_files
for each row execute function private.guard_signed_file();
notify pgrst,'reload schema';
commit;
