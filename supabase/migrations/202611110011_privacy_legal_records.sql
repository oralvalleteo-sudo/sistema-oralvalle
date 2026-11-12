-- Catálogo de documentos, evidência de aceite e solicitações de direitos.
-- Documentos de contratação em minuta permanecem published=false: não podem gerar aceite válido.
begin;
create table if not exists private.nexodent_legal_documents(
 document_key text not null,version text not null,sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 content text not null,check(sha256=encode(pg_catalog.sha256(convert_to(content,'UTF8')),'hex')),scope text not null check(scope in ('information','account','clinic')),
 published boolean not null default false,created_at timestamptz not null default now(),
 primary key(document_key,version),unique(document_key,version,sha256)
);
insert into private.nexodent_legal_documents(document_key,version,sha256,content,scope,published) values
('privacy','2026-11-11.1','459aa2a8a176b1f93bdb59cef1a310369c4c23489415ecb149d0aa7a608e4ca3','<p>Este aviso explica o tratamento de dados no site e no NexoDent. Versão 2026-11-11.1.</p>
<h2>1. Responsável e contato</h2><p>Responsável informado pela plataforma: <strong>Ricardo Silva Junior</strong>. Canal de privacidade: <a href="mailto:app.nexodents@gmail.com">app.nexodents@gmail.com</a>. A identificação definitiva do fornecedor na contratação será informada nos termos aprovados, antes da contratação paga.</p>
<h2>2. Clínica e plataforma têm responsabilidades diferentes</h2><p>Em regra, a clínica ou profissional decide as finalidades assistenciais e é responsável pelos prontuários de seus pacientes. O NexoDent trata esses dados em nome da clínica para prestar o serviço. Para sua própria conta, suporte, segurança e operação comercial, a plataforma também possui responsabilidades próprias sobre os dados que utiliza. O contrato e as instruções da clínica devem definir essas atividades.</p>
<h2>3. Dados utilizados</h2><ul><li>Conta e equipe: nome, e-mail, telefone, clínica e informações necessárias ao acesso.</li><li>Pacientes: dados cadastrais inseridos pela clínica, agenda, orçamento, recebimentos, documentos e informações de atendimento.</li><li>Dados sensíveis: anamnese, condições de saúde, odontograma, evolução, exames, imagens e documentos que revelem saúde. Quando necessário, informações do responsável legal do paciente.</li><li>Comunicação: mensagens e anexos compartilhados com os participantes autorizados da clínica, além de contatos comerciais conforme os recursos efetivamente usados.</li><li>Registros operacionais: alterações de dados, identificadores de usuário e clínica, contexto de navegação e preferências. A telemetria automática de erros do código publicado envia categoria, área e versão, sem mensagem clínica ou stack.</li></ul>
<h2>4. Finalidades e bases</h2><p>Os dados são usados para administrar contas e permissões, prestar as funcionalidades solicitadas, organizar o atendimento, manter documentos e registros necessários, atender suporte e proteger a operação. As hipóteses legais dependem da finalidade e do dado: dados de saúde seguem as regras específicas do art. 11 da LGPD, não uma autorização genérica para qualquer uso. A clínica deve informar ao paciente os fundamentos e finalidades do seu atendimento.</p><p>O consentimento ao procedimento clínico, a contratação do sistema e a ciência deste aviso são atos distintos. A leitura deste aviso não autoriza publicidade nem venda de prontuários. O NexoDent não oferece dados de saúde de pacientes como produto publicitário.</p>
<h2>5. Fornecedores e compartilhamento</h2><p>A infraestrutura atual utiliza Supabase para autenticação e dados, e pode utilizar GitHub Pages para hospedagem e GitHub Actions/Artifacts nas rotinas de backup configuradas. E-mail e notificações dependem de seus provedores técnicos. As fontes e bibliotecas das telas desta versão são hospedadas junto ao produto para reduzir consultas desnecessárias a terceiros.</p><p>WhatsApp/Meta, Google Ads, pagamentos e um assinador Node/Vercel só participam conforme o recurso realmente conectado e utilizado. O envio manual pelo WhatsApp ocorre após uma ação da clínica e deve ser revisado antes do envio. Não coloque prontuário, diagnóstico, senha ou certificado em uma mensagem ou chamado de suporte sem necessidade e canal adequado.</p><p>Fornecedores podem processar dados em outros países. A região efetiva, os suboperadores e os instrumentos aplicáveis devem ser verificados nos contratos e na configuração do serviço. Este aviso não declara armazenamento exclusivo no Brasil nem certificação de terceiros.</p>
<h2>6. Segurança e limites</h2><p>O produto possui autenticação, permissões e controles de acesso por clínica no código e nos componentes de banco previstos. Sua eficácia também depende da configuração em produção, das contas autorizadas, dos dispositivos e dos procedimentos da clínica. Use contas individuais, restrinja administração e não mantenha sessão em aparelho compartilhado.</p><p>Hash de documento não é criptografia nem prova independente de identidade. A assinatura presencial é uma imagem no PDF, não assinatura qualificada ICP-Brasil. Nenhum sistema é livre de risco; mantenha o canal de contato atualizado para tratamento de ocorrências.</p>
<h2>7. Guarda, exportação e encerramento</h2><p>A guarda deve respeitar a finalidade, as obrigações clínicas, legais e regulatórias e a defesa de direitos. Os prazos variam entre prontuário, contatos comerciais, contas, mensagens e registros técnicos. Cancelar uma assinatura ou revogar um consentimento não implica apagar imediatamente todos os documentos que precisem ser mantidos por outro fundamento legítimo.</p><p>Pedidos de correção ou eliminação serão avaliados com a clínica responsável. Documentos assinados podem exigir nova versão, preservação do histórico ou restrição de acesso em vez de substituição. Exportações e backups também contêm dados pessoais e exigem custódia segura. O contrato aprovado deve informar a entrega e o acesso aos dados no encerramento.</p>
<h2>8. Direitos e atendimento</h2><p>Você pode solicitar confirmação, acesso, correção, informações sobre compartilhamento e os demais direitos cabíveis na LGPD, inclusive eliminação ou restrição quando aplicáveis e revogação de consentimento quando essa for a base usada. Para dados do prontuário, procure a clínica responsável; o NexoDent deve cooperar no atendimento das solicitações relacionadas ao serviço.</p><p>Use a <a href="direitos.html">central de privacidade</a> ou escreva ao canal informado. Para proteger o titular, poderá ser necessária uma verificação proporcional de identidade. Não envie senhas, PFX, laudos ou cópias completas de documentos no primeiro contato. O recebimento de uma solicitação não é uma confirmação automática de exclusão de dados.</p>
<h2>9. Crianças e adolescentes</h2><p>O melhor interesse deve ser observado. A clínica deve conferir a representação legal e os requisitos aplicáveis ao cadastro e atendimento. Ter campos de responsável no sistema não substitui essa conferência nem autorizações específicas quando necessárias.</p>
<h2>10. Tecnologias do navegador e atualizações</h2><p>O produto utiliza armazenamento para autenticação, navegação e preferências. Confira <a href="cookies.html">cookies e armazenamento</a>. Mudanças materiais neste aviso terão versão e data identificadas. As condições contratuais e suas alterações serão apresentadas no documento correspondente; este aviso não substitui um contrato de prestação do serviço.</p>','information',true),
('account_terms','2026-11-11.1','b18c863a6961328de477711305a1f2d8e98d6c8bf9f601bcbe7bb0f0046e6ec9','<aside class="draft" role="note"><strong>Minuta para revisão — contratação não ativada por este documento.</strong><p>Falta confirmar a identificação definitiva do fornecedor e aprovar as condições comerciais. Esta versão não é apresentada como contrato aceito.</p></aside><h2>Proposta de condições de uso</h2><p>O NexoDent é uma ferramenta de apoio à organização odontológica. O uso não substitui avaliação, responsabilidade profissional ou deveres de guarda e sigilo da clínica. Cada pessoa deve usar conta própria e somente os acessos autorizados.</p><h2>Disponibilidade e recursos</h2><p>Os recursos, limites, suporte, preço e disponibilidade devem ser definidos na oferta confirmada antes da contratação paga. A presença de telas de Pix, cartão, integrações ou A1 em testes não significa que esses serviços estejam operacionais ou certificados.</p><h2>Dados e responsabilidades</h2><p>O instrumento de tratamento de dados deverá definir as instruções da clínica, suboperadores, incidentes, segurança e assistência aos direitos. A clínica não autoriza reutilização independente de prontuários apenas por utilizar a hospedagem.</p><h2>Encerramento e pagamentos</h2><p>As condições definitivas deverão especificar cobrança, renovação, cancelamento, eventual direito de arrependimento aplicável, suporte e como solicitar exportação e acesso aos documentos. Teste grátis de sete dias não substitui os direitos legais cabíveis. Não se deve prever exclusão indiscriminada do prontuário por falta de pagamento.</p><h2>Conduta</h2><p>Não compartilhe senha, tente acessar outra clínica, insira conteúdo sem autorização ou use os dados de saúde para publicidade sem análise e fundamento adequados. Documentos e mensagens devem respeitar a finalidade informada.</p><h2>Revisão pendente</h2><p>Identificação comercial, condições finais de suporte e serviço, tratamento de dados e versão de contratação precisam de aprovação antes de habilitar o registro de aceite como contrato ativo. O <a href="privacidade.html">aviso de privacidade</a> e o <a href="direitos.html">canal de atendimento</a> já podem ser consultados separadamente.</p>','account',false)
on conflict(document_key,version) do nothing;
create or replace function private.nexodent_legal_document_guard() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' then raise insufficient_privilege using message='Preserve a versão do documento; arquive seu estado de publicação';end if;
 if new.document_key is distinct from old.document_key or new.version is distinct from old.version or new.sha256 is distinct from old.sha256 or new.content is distinct from old.content or new.scope is distinct from old.scope or new.created_at is distinct from old.created_at then raise insufficient_privilege using message='Crie uma nova versão do documento; não altere o conteúdo de uma versão existente';end if;
 return new;
end $$;
revoke all on function private.nexodent_legal_document_guard() from public,anon,authenticated;
drop trigger if exists nexodent_legal_document_guard on private.nexodent_legal_documents;
create trigger nexodent_legal_document_guard before update or delete on private.nexodent_legal_documents for each row execute function private.nexodent_legal_document_guard();
-- Administração técnica da clínica não comprova, sozinha, poderes de representação contratual.
create table if not exists private.nexodent_legal_signers(
 clinic_id uuid not null references public.clinics(id),user_id uuid not null references auth.users(id),
 verified_by uuid not null references auth.users(id),verified_at timestamptz not null default clock_timestamp(),
 verification_reference text not null check(length(verification_reference)between 5 and 200),primary key(clinic_id,user_id)
);
revoke all on private.nexodent_legal_signers from public,anon,authenticated;
alter table private.nexodent_legal_signers enable row level security;
create table if not exists private.nexodent_legal_receipts(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),clinic_id uuid references public.clinics(id),
 document_key text not null,version text not null,sha256 text not null,
 event text not null check(event in ('signup_submitted','email_confirmed','accepted_authenticated')),
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(document_key,version,sha256) references private.nexodent_legal_documents(document_key,version,sha256),
 unique nulls not distinct(user_id,clinic_id,document_key,version,event)
);
create table if not exists private.nexodent_privacy_requests(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 kind text not null check(kind in ('access','correction','deletion','sharing','objection','other')),
 description text not null check(length(description) between 5 and 1000),
 status text not null default 'received' check(status in ('received','reviewing','waiting_identity','answered','closed')),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
revoke all on private.nexodent_legal_documents,private.nexodent_legal_receipts,private.nexodent_privacy_requests from public,anon,authenticated;
alter table private.nexodent_legal_documents enable row level security;
alter table private.nexodent_legal_receipts enable row level security;
alter table private.nexodent_privacy_requests enable row level security;
create or replace function private.nexodent_receipt_immutable() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin raise insufficient_privilege using message='LEGAL_RECEIPT_IMMUTABLE: preserve o registro e registre um novo evento';end $$;
drop trigger if exists nexodent_legal_receipt_guard on private.nexodent_legal_receipts;
create trigger nexodent_legal_receipt_guard before update or delete on private.nexodent_legal_receipts for each row execute function private.nexodent_receipt_immutable();
create or replace function public.nexodent_legal_catalog() returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(jsonb_build_object('document',document_key,'version',version,'sha256',sha256,'scope',scope) order by document_key,created_at),'[]') from private.nexodent_legal_documents where published;
$$;
create or replace function public.nexodent_legal_accept(p_document text,p_version text,p_sha256 text,p_clinic uuid default null) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare doc private.nexodent_legal_documents;receipt uuid;begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)then raise insufficient_privilege using message='Confirme seu e-mail e entre para registrar o aceite';end if;
 select * into doc from private.nexodent_legal_documents where document_key=p_document and version=p_version and sha256=p_sha256 and published;
 if not found or doc.scope='information' then raise exception using errcode='22023',message='Documento indisponível para aceite ou versão inválida';end if;
 if doc.scope='clinic' then
  if p_clinic is null or not exists(select 1 from public.clinic_members where clinic_id=p_clinic and user_id=auth.uid() and active and admin)or not exists(select 1 from private.nexodent_legal_signers where clinic_id=p_clinic and user_id=auth.uid())then raise insufficient_privilege using message='Somente o responsável autorizado da clínica pode aceitar este contrato';end if;
 elsif p_clinic is not null then raise exception using errcode='22023',message='Aceite da conta não admite clínica arbitrária';end if;
 insert into private.nexodent_legal_receipts(user_id,clinic_id,document_key,version,sha256,event) values(auth.uid(),p_clinic,p_document,p_version,p_sha256,'accepted_authenticated')on conflict do nothing;
 select id into receipt from private.nexodent_legal_receipts where user_id=auth.uid() and clinic_id is not distinct from p_clinic and document_key=p_document and version=p_version and event='accepted_authenticated';return receipt;
end $$;
create or replace function private.nexodent_legal_auth_event() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare acceptance jsonb;doc private.nexodent_legal_documents;begin
 if tg_op='INSERT' then
  acceptance:=new.raw_user_meta_data->'legal_acceptance';
  if acceptance is not null then
   select * into doc from private.nexodent_legal_documents where document_key=acceptance->>'document' and version=acceptance->>'version' and sha256=acceptance->>'sha256' and scope='account' and published;
   if not found then raise exception using errcode='22023',message='Versão dos termos indisponível para cadastro';end if;
   insert into private.nexodent_legal_receipts(user_id,document_key,version,sha256,event)values(new.id,doc.document_key,doc.version,doc.sha256,'signup_submitted')on conflict do nothing;
  end if;
 end if;
 if new.email_confirmed_at is not null then
  insert into private.nexodent_legal_receipts(user_id,document_key,version,sha256,event)
   select new.id,r.document_key,r.version,r.sha256,'email_confirmed' from private.nexodent_legal_receipts r where r.user_id=new.id and r.event='signup_submitted' on conflict do nothing;
 end if;
 return new;
end $$;
drop trigger if exists nexodent_legal_auth_receipt on auth.users;
create trigger nexodent_legal_auth_receipt after insert or update of email_confirmed_at on auth.users for each row execute function private.nexodent_legal_auth_event();
create or replace function public.nexodent_privacy_request_create(p_kind text,p_description text) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare request_id uuid;begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)then raise insufficient_privilege using message='Entre com e-mail confirmado para registrar uma solicitação';end if;
 if p_kind is null or p_kind not in ('access','correction','deletion','sharing','objection','other')or length(trim(coalesce(p_description,''))) not between 5 and 1000 then raise exception using errcode='22023',message='Revise o tipo e a descrição, de 5 a 1.000 caracteres';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,71));
 if(select count(*)from private.nexodent_privacy_requests where user_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception using errcode='54000',message='Você já registrou solicitações recentes. Acompanhe os protocolos ou use o canal de privacidade';end if;
 insert into private.nexodent_privacy_requests(user_id,kind,description)values(auth.uid(),p_kind,trim(p_description))returning id into request_id;return request_id;
end $$;
create or replace function public.nexodent_privacy_requests_mine() returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin if auth.uid() is null then raise insufficient_privilege using message='Sessão necessária';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'status',status,'created_at',created_at,'updated_at',updated_at)order by created_at desc),'[]')from(select * from private.nexodent_privacy_requests where user_id=auth.uid()order by created_at desc limit 100)r);
end $$;
create table if not exists private.nexodent_privacy_request_events(
 id bigint generated always as identity primary key,request_id uuid not null references private.nexodent_privacy_requests(id),
 actor_id uuid not null references auth.users(id),previous_status text,new_status text not null,recorded_at timestamptz not null default clock_timestamp()
);
revoke all on private.nexodent_privacy_request_events from public,anon,authenticated;
alter table private.nexodent_privacy_request_events enable row level security;
create or replace function public.nexodent_privacy_requests_admin(p_action text default 'list',p_request uuid default null,p_status text default null)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare allowed boolean;previous text;begin
 if auth.uid() is null or to_regclass('public.nexodent_platform_admins')is null then raise insufficient_privilege using message='Acesso restrito à equipe autorizada de privacidade';end if;
 execute 'select exists(select 1 from public.nexodent_platform_admins where user_id=$1)'into allowed using auth.uid();
 if not allowed then raise insufficient_privilege using message='Acesso restrito à equipe autorizada de privacidade';end if;
 if p_action='update' then
  if p_request is null or p_status is null or p_status not in ('reviewing','waiting_identity','answered','closed')then raise exception using errcode='22023',message='Status ou solicitação inválidos';end if;
  select status into previous from private.nexodent_privacy_requests where id=p_request for update;
  if not found then raise exception using errcode='22023',message='Solicitação não encontrada';end if;
  update private.nexodent_privacy_requests set status=p_status,updated_at=clock_timestamp()where id=p_request;
  insert into private.nexodent_privacy_request_events(request_id,actor_id,previous_status,new_status)values(p_request,auth.uid(),previous,p_status);
 elsif p_action<>'list' or p_action is null then raise exception using errcode='22023',message='Ação inválida';end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'email',u.email,'kind',r.kind,'description',r.description,'status',r.status,'created_at',r.created_at,'updated_at',r.updated_at)order by r.created_at desc),'[]')from(select * from private.nexodent_privacy_requests order by created_at desc limit 100)r join auth.users u on u.id=r.user_id);
end $$;
revoke all on function public.nexodent_privacy_requests_admin(text,uuid,text)from public,anon;
grant execute on function public.nexodent_privacy_requests_admin(text,uuid,text)to authenticated;
revoke all on function private.nexodent_receipt_immutable(),private.nexodent_legal_auth_event() from public,anon,authenticated;
revoke all on function public.nexodent_legal_catalog(),public.nexodent_legal_accept(text,text,text,uuid),public.nexodent_privacy_request_create(text,text),public.nexodent_privacy_requests_mine()from public,anon;
grant execute on function public.nexodent_legal_catalog()to anon,authenticated;
grant execute on function public.nexodent_legal_accept(text,text,text,uuid),public.nexodent_privacy_request_create(text,text),public.nexodent_privacy_requests_mine()to authenticated;
notify pgrst,'reload schema';
commit;
