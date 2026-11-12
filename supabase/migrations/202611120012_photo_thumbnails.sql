-- Retorna miniatura pequena já existente; não altera originais nem assinaturas.
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
        'assinadoEm',contents->'assinadoEm','dentistaNome',contents->'dentistaNome','dentistaCro',contents->'dentistaCro',
        'thumb',case when coalesce(contents->>'tipo','') like 'image/%'
          and length(coalesce(contents->>'thumb','')) between 1 and 32768
          and (contents->>'thumb') ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'
          then contents->'thumb' else null end);
    else contents:='null'::jsonb;
    end if;
  end if;
  return jsonb_set(p_row,'{dados}',contents);
end $$;

commit;
