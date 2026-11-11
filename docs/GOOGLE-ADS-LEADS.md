# Google Ads → CRM

## Fluxo da clínica

1. Integrações → Conectar Google Ads. Autorizar com a conta que acessa os anúncios.
2. Havendo uma única conta de anúncios, ela é vinculada automaticamente. Com várias contas, escolher a clínica correta. Contas de administrador são excluídas da seleção.
3. “Gerar dados de conexão”: copiar endereço e chave para a integração webhook de entrega de leads de cada formulário no Google Ads. Enviar o teste do Google e clicar “Verificar teste e recebimentos”.
4. Novas submissões entram em Novo lead, origem Google Ads. O CRM aberto atualiza a cada minuto, sem interromper edição. Reenvios com o mesmo lead_id não duplicam o contato. Formulários com telefone ou e-mail são aceitos.

A autorização Google não configura sozinha a entrega dos formulários. Esta implementação recebe formulários nativos Google Ads, não cliques, contatos do WhatsApp, formulários de landing pages ou histórico anterior. A etapa de webhook precisa ser feita no Google por formulário. O vínculo OAuth é separado do teste de captação: “Conectado” não prova que um lead foi entregue.

## Ativação única pela plataforma

- Confirmar o schema real de nexodent_crm_leads (UUID id, clinic_id, name, phone, source, stage, estimated_value, notes) antes da migration. A definição base do CRM não está neste repositório. Os testes usam um schema representativo isolado; não substituem validação no Supabase real.
- Aplicar primeiro 202611070001_channel_connections.sql, depois 202611110001_google_ads_leads.sql e 202611110002_unified_channel_leads.sql para unificar os contatos dos canais. Não reaplicar migrations antigas. Estados OAuth e tokens criptografados ficam sem acesso do navegador.
- Configurar no servidor GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_ENCRYPTION_KEY (64 caracteres hexadecimais), GOOGLE_ADS_DEVELOPER_TOKEN, NEXODENT_APP_ORIGIN. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são bindings do Supabase. Nunca expor chaves no frontend. GOOGLE_ADS_API_VERSION pode selecionar uma versão suportada; o código preserva o padrão preexistente v26, que precisa ser confirmado no projeto real.
- Configurar consentimento OAuth Google para usuários externos, escopo adwords e callback HTTPS exato: SUPABASE_URL/functions/v1/nexodent-google-ads-callback. Publicação/verificação do aplicativo e aprovação do developer token dependem do Google. No modo de teste, somente usuários autorizados no Google Cloud conseguem conectar.
- Publicar as funções nexodent-google-ads-start, nexodent-google-ads-callback, nexodent-google-ads-accounts, nexodent-google-leads-setup e nexodent-google-leads-webhook. O callback e o webhook recebem chamadas externas sem JWT Supabase. As demais validam o JWT da sessão via Auth e o administrador ativo da clínica dentro da função; configurar o gateway de acordo com o tipo de chave/JWT do projeto. A chave Google do webhook é obrigatória e verificada pelo hash no banco, com vínculo por clínica/conta.
- Publicar integracoes/, crm/ e assets/ juntos. O workflow Pages foi ajustado para incluir as duas primeiras pastas, que estavam ausentes.
- Testar OAuth com duas clínicas, seleção de conta, teste do Google e submissão real de um contato sintético. Confirmar apenas um lead após reenvio. Chaves geradas novamente invalidam as anteriores; atualizar todos os formulários ao rotacionar.

As funções não registram payloads nem segredos em logs. Somente nome, telefone e e-mail (em notas) são importados. Identificador externo é usado para deduplicação; dados clínicos não são enviados ao Google. A plataforma deve definir retenção e operação do canal. Nenhuma migration, função remota ou configuração Google foi aplicada automaticamente nesta entrega.
