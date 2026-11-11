-- Comunicação privada dentro da clínica. Requer a base clínica; usa a guarda de assinatura quando instalada.
begin;
create table public.nexodent_chat_rooms(
 id uuid primary key default gen_random_uuid(),clinic_id uuid not null references public.clinics(id),
 kind text not null check(kind in ('direct','group')),title text not null default '' check(length(title)<=100),
 direct_key text,created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(clinic_id,direct_key),unique(id,clinic_id)
);
create table public.nexodent_chat_members(
 room_id uuid not null,clinic_id uuid not null,user_id uuid not null,last_read_id bigint not null default 0,
 primary key(room_id,user_id),foreign key(room_id,clinic_id) references public.nexodent_chat_rooms(id,clinic_id) on delete cascade,
 foreign key(clinic_id,user_id) references public.clinic_members(clinic_id,user_id) on delete cascade
);
create index nexodent_chat_member_lookup on public.nexodent_chat_members(clinic_id,user_id,room_id);
create table public.nexodent_chat_messages(
 id bigint generated always as identity primary key,room_id uuid not null,clinic_id uuid not null,author_id uuid not null,
 body text not null check(length(body)<=4000),client_nonce uuid not null,created_at timestamptz not null default now(),
 foreign key(room_id,clinic_id) references public.nexodent_chat_rooms(id,clinic_id) on delete cascade,
 unique(clinic_id,author_id,client_nonce),unique(id,clinic_id)
);
create index nexodent_chat_message_page on public.nexodent_chat_messages(room_id,id);
create index nexodent_chat_send_rate on public.nexodent_chat_messages(clinic_id,author_id,created_at);
create table public.nexodent_chat_files(
 message_id bigint primary key,clinic_id uuid not null,name text not null,mime text not null,size_bytes integer not null check(size_bytes between 1 and 1048576),
 sha256 text not null,content bytea not null,foreign key(message_id,clinic_id) references public.nexodent_chat_messages(id,clinic_id) on delete cascade
);
create index nexodent_chat_files_quota on public.nexodent_chat_files(clinic_id);
do $$declare t text;begin
 foreach t in array array['nexodent_chat_rooms','nexodent_chat_members','nexodent_chat_messages','nexodent_chat_files'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;
create function private.nexodent_chat_level(p_clinic uuid) returns integer language plpgsql stable security definer set search_path=pg_catalog as $$
declare member public.clinic_members;v text;
begin
 perform private.require_member(p_clinic);
 select * into member from public.clinic_members where clinic_id=p_clinic and user_id=auth.uid() and active;
 if not found then return 0;end if;
 if member.admin then return 2;end if;
 v:=member.perms->>'chat';return case when v is null or v='edit' then 2 when v='view' then 1 else 0 end;
end $$;
create function private.nexodent_chat_require(p_clinic uuid,p_room uuid default null,p_write boolean default false) returns void language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if private.nexodent_chat_level(p_clinic)<(case when p_write then 2 else 1 end) then raise insufficient_privilege using message='Sem permissão para comunicação nesta clínica';end if;
 if p_room is not null and not exists(select 1 from public.nexodent_chat_members where clinic_id=p_clinic and room_id=p_room and user_id=auth.uid()) then raise insufficient_privilege using message='Você não participa desta conversa';end if;
end $$;
revoke all on function private.nexodent_chat_level(uuid),private.nexodent_chat_require(uuid,uuid,boolean) from public,anon,authenticated;
create function public.nexodent_chat_people(p_clinic uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform private.nexodent_chat_require(p_clinic);
 return jsonb_build_object('user_id',auth.uid(),'can_write',private.nexodent_chat_level(p_clinic)=2,'people',coalesce((select jsonb_agg(jsonb_build_object('id',user_id,'name',coalesce(nullif(nome,''),'Usuário da clínica')) order by nome,user_id) from public.clinic_members where clinic_id=p_clinic and active and (admin or coalesce(perms->>'chat','edit') in ('view','edit'))),'[]'));
end $$;
create function public.nexodent_chat_create(p_clinic uuid,p_kind text,p_title text,p_users uuid[]) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare members uuid[];room uuid;key text;
begin
 perform private.nexodent_chat_require(p_clinic,null,true);
 select array_agg(distinct u order by u) into members from unnest(array_append(p_users,auth.uid()))u where u is not null;
 if p_kind not in ('direct','group') or coalesce(array_length(members,1),0) not between 2 and 50 then raise exception 'Selecione de 1 a 49 colegas da clínica';end if;
 if (select count(*) from public.clinic_members where clinic_id=p_clinic and user_id=any(members) and active and (admin or coalesce(perms->>'chat','edit') in ('edit','view')))<>array_length(members,1) then raise insufficient_privilege using message='Participante não autorizado nesta clínica';end if;
 if p_kind='direct' then
 if array_length(members,1)<>2 then raise exception 'Conversa individual exige um colega';end if;key:=array_to_string(members,':');
 elsif length(trim(coalesce(p_title,''))) not between 1 and 100 then raise exception 'Informe um nome de grupo de até 100 caracteres';end if;
 insert into public.nexodent_chat_rooms(clinic_id,kind,title,direct_key,created_by) values(p_clinic,p_kind,case when p_kind='group' then trim(p_title) else '' end,key,auth.uid())
 on conflict(clinic_id,direct_key) do update set direct_key=excluded.direct_key returning id into room;
 insert into public.nexodent_chat_members(room_id,clinic_id,user_id) select room,p_clinic,unnest(members) on conflict do nothing;
 return room;
end $$;
create function public.nexodent_chat_rooms_list(p_clinic uuid,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 perform private.nexodent_chat_require(p_clinic);
 if p_offset<0 or p_offset>10000 then raise exception 'Página inválida';end if;
 select coalesce(jsonb_agg(row order by updated_at desc,id),'[]') into result from (
 select r.id,r.kind,r.created_by,r.updated_at,
 case when r.kind='group' then r.title else coalesce((select nullif(c.nome,'') from public.nexodent_chat_members m join public.clinic_members c on c.clinic_id=m.clinic_id and c.user_id=m.user_id where m.room_id=r.id and m.user_id<>auth.uid() limit 1),'Colega da clínica') end title,
 (select count(*) from public.nexodent_chat_messages x where x.room_id=r.id and x.id>own.last_read_id and x.author_id<>auth.uid()) unread,
 (select jsonb_build_object('body',left(x.body,100),'has_file',exists(select 1 from public.nexodent_chat_files f where f.message_id=x.id)) from public.nexodent_chat_messages x where x.room_id=r.id order by x.id desc limit 1) last_message
 from public.nexodent_chat_rooms r join public.nexodent_chat_members own on own.room_id=r.id and own.user_id=auth.uid()
 where r.clinic_id=p_clinic order by r.updated_at desc,r.id limit 100 offset p_offset)row;
 return jsonb_build_object('rooms',result,'has_more',jsonb_array_length(result)=100);
end $$;
create function public.nexodent_chat_unread(p_clinic uuid) returns text language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform private.nexodent_chat_require(p_clinic);
 return (select count(*)::text from public.nexodent_chat_messages x join public.nexodent_chat_members m on m.room_id=x.room_id and m.user_id=auth.uid() where x.clinic_id=p_clinic and x.id>m.last_read_id and x.author_id<>auth.uid());
end $$;
create function public.nexodent_chat_detail(p_clinic uuid,p_room uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform private.nexodent_chat_require(p_clinic,p_room);
 return jsonb_build_object('room',(select to_jsonb(r)-'direct_key' from public.nexodent_chat_rooms r where id=p_room),'members',(select jsonb_agg(jsonb_build_object('id',m.user_id,'name',c.nome,'active',c.active) order by c.nome) from public.nexodent_chat_members m join public.clinic_members c on c.clinic_id=m.clinic_id and c.user_id=m.user_id where m.room_id=p_room));
end $$;
create function public.nexodent_chat_group_members(p_clinic uuid,p_room uuid,p_users uuid[]) returns void language plpgsql security definer set search_path=pg_catalog as $$
declare creator uuid;users uuid[];
begin
 perform private.nexodent_chat_require(p_clinic,p_room,true);
 select created_by into creator from public.nexodent_chat_rooms where id=p_room and kind='group' for update;
 if creator is null or creator<>auth.uid() then raise insufficient_privilege using message='Somente o criador pode alterar participantes';end if;
 select array_agg(distinct u) into users from unnest(array_append(p_users,creator))u where u is not null;
 if array_length(users,1) not between 2 and 50 then raise exception 'Grupo exige pelo menos dois participantes';end if;
 if (select count(*) from public.clinic_members where clinic_id=p_clinic and user_id=any(users) and active and (admin or coalesce(perms->>'chat','edit') in ('edit','view')))<>array_length(users,1) then raise insufficient_privilege;end if;
 delete from public.nexodent_chat_members where room_id=p_room and not(user_id=any(users));
 insert into public.nexodent_chat_members(room_id,clinic_id,user_id) select p_room,p_clinic,unnest(users) on conflict do nothing;
 update public.nexodent_chat_rooms set updated_at=now() where id=p_room;
end $$;
create function public.nexodent_chat_messages_page(p_clinic uuid,p_room uuid,p_before bigint default null,p_after bigint default null) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 perform private.nexodent_chat_require(p_clinic,p_room);
 if p_before is not null and p_after is not null then raise exception 'Cursor inválido';end if;
 select coalesce(jsonb_agg(row order by sort_id),'[]') into result from (
 select x.id::text id,x.id sort_id,x.author_id,coalesce(nullif(c.nome,''),'Usuário removido') author_name,x.body,x.created_at,
 (select jsonb_build_object('name',f.name,'mime',f.mime,'size',f.size_bytes,'sha256',f.sha256) from public.nexodent_chat_files f where f.message_id=x.id) attachment
 from public.nexodent_chat_messages x left join public.clinic_members c on c.clinic_id=x.clinic_id and c.user_id=x.author_id
 where x.room_id=p_room and (p_before is null or x.id<p_before) and (p_after is null or x.id>p_after)
 order by case when p_after is not null then x.id end asc,case when p_after is null then x.id end desc limit 50)row;
 return jsonb_build_object('messages',(select coalesce(jsonb_agg(v-'sort_id'),'[]') from jsonb_array_elements(result)v),'has_more',jsonb_array_length(result)=50);
end $$;
create function public.nexodent_chat_send(p_clinic uuid,p_room uuid,p_nonce uuid,p_body text,p_file jsonb default null) returns text language plpgsql security definer set search_path=pg_catalog as $$
declare message_id bigint;previous public.nexodent_chat_messages;data bytea;filename text;mime text;digest text;
begin
 perform private.nexodent_chat_require(p_clinic,p_room,true);
 perform 1 from public.nexodent_chat_rooms where id=p_room for update;
 perform private.nexodent_chat_require(p_clinic,p_room,true);
 if p_nonce is null or length(coalesce(p_body,''))>4000 or (trim(coalesce(p_body,''))='' and p_file is null) then raise exception 'Escreva uma mensagem de até 4.000 caracteres ou selecione um arquivo';end if;
 if p_file is not null then
 filename:=p_file->>'name';mime:=p_file->>'mime';
 if filename is null or length(filename) not between 1 and 160 or filename ~ '[/\\[:cntrl:]]' or coalesce(length(p_file->>'base64'),0) not between 1 and 1398104 then raise exception 'Arquivo inválido ou acima de 1 MB';end if;
 if mime not in ('application/pdf','image/png','image/jpeg','image/webp','text/plain') or
 not(case mime when 'application/pdf' then filename ~* '\.pdf$' when 'image/png' then filename ~* '\.png$' when 'image/jpeg' then filename ~* '\.jpe?g$' when 'image/webp' then filename ~* '\.webp$' when 'text/plain' then filename ~* '\.txt$' else false end) then raise exception 'Use PDF, PNG, JPG, WebP ou TXT';end if;
 begin data:=decode(p_file->>'base64','base64');exception when others then raise exception 'Arquivo inválido';end;
 if octet_length(data) not between 1 and 1048576 then raise exception 'Arquivo acima de 1 MB';end if;
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
create function public.nexodent_chat_mark_read(p_clinic uuid,p_room uuid,p_message bigint) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform private.nexodent_chat_require(p_clinic,p_room);
 if not exists(select 1 from public.nexodent_chat_messages where id=p_message and room_id=p_room) then raise exception 'Mensagem inválida';end if;
 update public.nexodent_chat_members set last_read_id=greatest(last_read_id,p_message) where room_id=p_room and user_id=auth.uid();
end $$;
create function public.nexodent_chat_download(p_clinic uuid,p_room uuid,p_message bigint) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform private.nexodent_chat_require(p_clinic,p_room);
 return (select jsonb_build_object('name',f.name,'mime',f.mime,'sha256',f.sha256,'base64',encode(f.content,'base64')) from public.nexodent_chat_files f join public.nexodent_chat_messages m on m.id=f.message_id where m.room_id=p_room and f.message_id=p_message and f.clinic_id=p_clinic);
end $$;
do $$declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like 'nexodent_chat_%' loop
 execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
-- Compatibilidade com a validação de permissões antiga, inclusive cópias protegidas pela assinatura.
do $$declare f record;definition text;begin
 for f in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosrc like '%INVALID_MEMBER_PATCH: invalid permission%' and p.prosrc like '%jsonb_each%' loop
 if f.prosrc not like '%''chat''%' then
 select pg_get_functiondef(f.oid) into definition;
 execute regexp_replace(definition,'if k not in \(','if k not in (''chat'',''crm'',''wa'',');
 end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
