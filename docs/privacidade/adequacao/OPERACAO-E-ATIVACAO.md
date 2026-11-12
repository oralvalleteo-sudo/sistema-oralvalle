# Implantação e operação da adequação de privacidade

## Estado desta entrega

Implementação preparada e testável. Não é certificação jurídica ou substituição da decisão do controlador. As páginas factuais descrevem o produto; os termos de contratação permanecem como **minuta**, sem aceite ativo, enquanto não forem confirmados fornecedor e condições finais. Canal confirmado pelo responsável: **app.nexodents@gmail.com**.

### Frontend e site

- Avisos de privacidade, cookies/armazenamento e direitos acessíveis antes do cadastro e no rodapé.
- Link antigo de política do site encaminha à página atual.
- Fontes locais, biblioteca PDF local e SDK Supabase local/versionado. Licenças distribuídas com os arquivos. Não foi adicionado rastreador publicitário ou um falso consentimento para tecnologias essenciais.
- Site usa autenticação sem persistência automática entre recargas; o app mantém opção explícita de persistência.
- Notificações externas da agenda/Push passam a exibir texto genérico, sem nome/procedimento/tag clínica; a faixa dentro do app continua mostrando detalhes autorizados. **O remetente do Push também deve minimizar seu payload; esta alteração minimiza a exibição, não prova que o provedor deixou de receber dados no payload.**
- Navegação deixa de guardar ID do paciente e data de agenda.
- Central de privacidade no app, acessível a cada conta sem conceder acesso a outra clínica.

### Banco: aplicar em homologação e depois na produção

Este ambiente não possui acesso administrativo ao Supabase. A interface não deve anunciar um protocolo que não tenha sido confirmado pelo banco.

1. Fazer backup e confirmar restauração em ambiente separado.
2. Revisar as migrations anteriores e `202611110010_signed_file_protection.sql`, cuja instalação remota não foi comprovada no checkup.
3. Aplicar `202611110011_privacy_legal_records.sql`. Requer a base clínica e as colunas padrão `auth.users.email_confirmed_at` e `raw_user_meta_data`. O script é reaplicável e não concede acesso clínico a novos usuários.
4. A migration cria catálogo de documentos, recibos e solicitações em tabelas privadas com acesso direto revogado/RLS. O hash precisa corresponder ao conteúdo; versões e recibos não podem ser reescritos pela interface. Só documento publicado gera aceite autenticado; aviso informativo não é tratado como contrato.
5. Para acessar a fila, usar **administrador da plataforma já autorizado** em `nexodent_platform_admins`, não simplesmente administrador de uma clínica. Conferir manualmente a identidade do responsável; não promover automaticamente por nome/e-mail enviado pelo navegador.
6. Testar com duas contas: solicitação criada por uma só aparece para ela; somente equipe da plataforma vê a fila e registra andamento. Tentativas sem confirmação de e-mail, sem permissão e em excesso são rejeitadas. A fila administrativa fica em Visão geral do painel Admin.
7. A interface consulta a fila manualmente. **Não há envio automático de e-mail de alerta.** O responsável precisa monitorar fila e caixa oficial; o e-mail permanece disponível independentemente da migration.

## Ativação dos termos após aprovação

- Confirmar fornecedor (pessoa física ou empresa), identidade comercial e condições reais da oferta. Não usar CNPJ, endereço, prazo de serviço ou aprovação jurídica inventados.
- Revisar `legal/termos.html` e o instrumento de tratamento de dados. Alterar o corpo canônico em `legal/documents.json`, gerar nova versão/hashes e manter o mesmo conteúdo no site/app e catálogo do banco. Atualizar o seed por nova migration se a versão anterior já tiver sido aplicada.
- Publicar a nova versão aprovada no catálogo e só então mudar o catálogo/configuração da interface. Até essa etapa, `accountTerms.published=false` mantém o contrato como minuta, sem checkbox de aceite obrigatório ou recibo falso.
- No cadastro, quando ativo, a caixa específica de Termos é obrigatória na interface. A informação vai para metadados de cadastro e o trigger registra `signup_submitted`. Isso é evidência declarada de uma submissão, **não identidade confirmada**. Após confirmação de e-mail, registra-se evento separado `email_confirmed`.
- Aceites posteriores usam RPC autenticada, com e-mail confirmado, versão/hash publicados e data de servidor. Contrato de clínica exige administrador ativo dessa clínica **e autorização de representação previamente verificada** em `private.nexodent_legal_signers`. Administração de acesso não comprova poderes civis de contratar. O operador autorizado registra a referência da verificação; não existe autoatribuição pelo navegador. Os termos gerais de conta não promovem o colaborador a representante comercial da clínica.
- Não usar “aceito a privacidade” como consentimento universal para saúde/marketing. Não há autorização automática de publicidade neste fluxo.

## Atendimento a solicitações de titulares

1. Monitorar diariamente o e-mail oficial e a fila; indicar responsável e substituto.
2. Registrar chegada, conta/canal, natureza do pedido e prazo aplicável. Pedidos por e-mail precisam ser incluídos no controle operacional, mesmo sem protocolo no app.
3. Verificar identidade de forma proporcional. Não pedir senha, PFX ou cópia integral de prontuário por e-mail. Solicitar somente o necessário, por canal apropriado.
4. Distinguir dados próprios da plataforma de dados assistenciais sob controle da clínica. Encaminhar/cooperar com a clínica de forma segura; não deixar o paciente sem resposta por não ser assinante.
5. Analisar guarda, correção por nova versão, restrição e eliminação cabível. O pedido de exclusão **não apaga dados automaticamente**.
6. Responder com segurança e registrar fundamento, data e andamento. O status “Respondido” só deve ser selecionado após resposta efetiva; o sistema não envia a resposta ao alterar status.
7. Confirmar os prazos legais aplicáveis com o jurídico. Não aplicar indiscriminadamente o prazo de acesso do art. 19 a todos os direitos.

## Incidente com dados pessoais

- Designar responsável técnico, responsável pela comunicação e contato de cada clínica.
- Distinguir falha funcional de incidente envolvendo dados. Conter acesso indevido, preservar evidências mínimas e revogar credenciais expostas sem apagar rastros.
- Registrar quando houve ciência, dados afetados, pessoas, sistemas, contenção, avaliações, responsáveis e decisões. Não copiar prontuários para logs/chamados.
- Informar a clínica controladora em tempo hábil. Proposta de SLA interno a aprovar: comunicação inicial sem demora injustificada e, quando viável, em até 24 horas da ciência confirmada; isso **não é um prazo legal universal nem contrato já assumido**.
- O controlador deve avaliar risco/dano relevante e comunicação à autoridade e titulares segundo regra vigente. A referência identificada na avaliação foi a Resolução CD/ANPD 15/2024 (a conferir juridicamente), incluindo prazos e conservação do registro.
- Ensaiar o plano com dados fictícios, documentar e revisar após cada ocorrência relevante.

## Acesso, fornecedores e dispositivos

- Contas individuais; administração mínima; revisão de vínculos e desligamento. Verificar MFA e recuperação segura para administração nos provedores.
- Confirmar RLS/RPCs instaladas para clínica, CRM, laboratório, documentos e módulos fora do schema testado.
- Listar fornecedores e contratos, regiões e transferências; incluir GitHub Actions/Artifacts que processa backups reais, além de Supabase/Pages/e-mail/Push.
- Rodar restauração de banco e objetos separadamente; controlar chaves `age`, exportações JSON legíveis e dispositivos compartilhados. Não apagar resíduos clínicos locais sem cópia e plano de migração.
- Não anunciar criptografia ponta a ponta, residência exclusiva no Brasil, ISO/SOC, ICP-Brasil ou ausência de risco sem evidência correspondente.
