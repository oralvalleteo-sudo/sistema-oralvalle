-- Aumenta o limite por arquivo sem apagar mensagens/anexos existentes.
-- Requer 202611110008_internal_communication.sql. Pode ser reaplicada.
begin;
alter table public.nexodent_chat_files drop constraint if exists nexodent_chat_files_size_bytes_check;
alter table public.nexodent_chat_files add constraint nexodent_chat_files_size_bytes_check check(size_bytes between 1 and 10485760);
create or replace function public.nexodent_chat_send(p_clinic uuid,p_room uuid,p_nonce uuid,p_body text,p_file jsonb default null) returns text language plpgsql security definer set search_path=pg_catalog as $$
declare message_id bigint;previous public.nexodent_chat_messages;data bytea;filename text;mime text;digest text;
begin
 perform private.nexodent_chat_require(p_clinic,p_room,true);
 perform 1 from public.nexodent_chat_rooms where id=p_room for update;
 perform private.nexodent_chat_require(p_clinic,p_room,true);
 if p_nonce is null or length(coalesce(p_body,''))>4000 or (trim(coalesce(p_body,''))='' and p_file is null) then raise exception 'Escreva uma mensagem de até 4.000 caracteres ou selecione um arquivo';end if;
 if p_file is not null then
 filename:=p_file->>'name';mime:=p_file->>'mime';
 if filename is null or length(filename) not between 1 and 160 or filename ~ '[/\\[:cntrl:]]' or coalesce(length(p_file->>'base64'),0) not between 1 and 13981016 then raise exception 'Arquivo inválido ou acima de 10 MB';end if;
 if mime not in ('application/pdf','image/png','image/jpeg','image/webp','text/plain') or
 not(case mime when 'application/pdf' then filename ~* '\.pdf$' when 'image/png' then filename ~* '\.png$' when 'image/jpeg' then filename ~* '\.jpe?g$' when 'image/webp' then filename ~* '\.webp$' when 'text/plain' then filename ~* '\.txt$' else false end) then raise exception 'Use PDF, PNG, JPG, WebP ou TXT';end if;
 begin data:=decode(p_file->>'base64','base64');exception when others then raise exception 'Arquivo inválido';end;
 if octet_length(data) not between 1 and 10485760 then raise exception 'Arquivo acima de 10 MB';end if;
 if (mime='application/pdf' and substring(data from 1 for 5)<>decode('255044462d','hex')) or
 (mime='image/png' and substring(data from 1 for 8)<>decode('89504e470d0a1a0a','hex')) or
 (mime='image/jpeg' and substring(data from 1 for 3)<>decode('ffd8ff','hex')) or
 (mime='image/webp' and (substring(data from 1 for 4)<>decode('52494646','hex') or substring(data from 9 for 4)<>decode('57454250','hex'))) then raise exception 'O conteúdo não corresponde ao tipo de arquivo';end if;
 digest:=encode(sha256(data),'hex');
 end if;
 select * into previous from public.nexodent_chat_messages where clinic_id=p_clinic and author_id=auth.uid() and client_nonce=p_nonce;
 if found then
 if previous.room_id<>p_room or previous.body<>coalesce(p_body,'') or (select f.sha256 from public.nexodent_chat_files f where f.message_id=previous.id) is distinct from digest then raise exception 'A tentativa já foi registrada com outro conteúdo. Atualize a conversa';end if;
 return previous.id::text;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_clinic::text,37));
 if (select count(*) from public.nexodent_chat_messages where clinic_id=p_clinic and author_id=auth.uid() and created_at>now()-interval '1 minute')>=30 then raise exception 'Aguarde antes de enviar novas mensagens';end if;
 if data is not null and coalesce((select sum(size_bytes) from public.nexodent_chat_files where clinic_id=p_clinic),0)+octet_length(data)>104857600 then raise exception 'Limite de arquivos da comunicação atingido. Contate o suporte';end if;
 insert into public.nexodent_chat_messages(room_id,clinic_id,author_id,body,client_nonce) values(p_room,p_clinic,auth.uid(),coalesce(p_body,''),p_nonce) returning id into message_id;
 if data is not null then insert into public.nexodent_chat_files values(message_id,p_clinic,filename,mime,octet_length(data),digest,data);end if;
 update public.nexodent_chat_rooms set updated_at=now() where id=p_room;
 update public.nexodent_chat_members set last_read_id=message_id where room_id=p_room and user_id=auth.uid();
 return message_id::text;
end $$;
notify pgrst,'reload schema';
commit;
