# Google Ads, Meta Ads e WhatsApp no mesmo funil

## Comportamento

- Formulário Google Ads: segue o assistente descrito em GOOGLE-ADS-LEADS.md.
- Formulário Meta Ads: autorizar a Meta e selecionar a página da clínica. Se houver apenas uma, ela é escolhida automaticamente e a aplicação assina `leadgen`.
- WhatsApp: autorizar a conta empresarial e escolher um número existente da API oficial Cloud API. A aplicação assina a WABA e usa o phone_number_id para encaminhar mensagens recebidas à clínica correta.
- O aplicativo WhatsApp/WhatsApp Business de celular, sozinho, não envia esses webhooks. Onboarding de um novo número, portabilidade ou coexistência precisam ser habilitados na Meta; esta implementação conecta ativos Cloud API já disponíveis ao usuário autorizado, não implementa Embedded Signup para criar números.

Cada evento autenticado passa pela mesma função transacional. Uma clínica tem uma identidade por telefone normalizado e por e-mail. Telefones brasileiros sem código recebem 55; telefones internacionais devem usar +código do país. A função também procura telefones de cadastros manuais antigos antes de criar um contato. E-mail é alternativa quando não há telefone. Não há comparação aproximada por nome. Sem identificador comum entre canais não é possível garantir que se trata da mesma pessoa.

O contato mantém nome, etapa, responsável, valores e notas existentes. `acquisition_sources` reúne canais e referências de anúncios; `last_inbound_at` indica a última entrada. E-mail e canais aparecem na ficha do CRM. A origem inicial é preservada para não atribuir a mesma oportunidade novamente. Não são copiadas conversas inteiras, mídias ou confirmações de entrega para o funil; apenas mensagens de entrada do contato geram eventos. Duplicidade de evento é verificada separadamente da identidade do contato.

O mesmo telefone em clínicas distintas representa contatos distintos. Telefone e e-mail que apontam para dois cadastros existentes não são mesclados: o telefone prevalece e o evento registra `identity_conflict`. Não há fusão destrutiva dos duplicados históricos. Número compartilhado pode representar mais de uma pessoa; a política adotada é identidade por telefone na clínica.

Anúncios Click-to-WhatsApp da Meta podem fornecer `referral.source_id`, registrado como referência Meta Ads. O WhatsApp não fornece automaticamente a origem Google de todo clique. Se o telefone já entrou pelo Google, a origem Google é preservada. Se só existir uma conversa sem referência rastreável, a origem será WhatsApp, sem inferir Google. Formulários externos precisam de integração própria.

## Instalação da plataforma

1. Verificar schema CRM real e aplicar, em ordem, channel_connections, 202611110001_google_ads_leads e 202611110002_unified_channel_leads. As definições originais completas do CRM não estão no repositório: testes usam schema representativo isolado.
2. Configurar no servidor META_APP_ID, META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN (aleatório), NEXODENT_CHANNEL_ENCRYPTION_KEY (64 hexadecimais), NEXODENT_APP_ORIGIN e META_GRAPH_VERSION (versão suportada; padrão v23.0). Manter bindings SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY. Valores não vão no frontend nem no Git. A chave de criptografia não pode ser trocada sem migrar credenciais armazenadas.
3. Publicar nexodent-meta-connect-start, nexodent-meta-connect-callback, nexodent-meta-connect-assets e nexodent-meta-webhook com a configuração de gateway em supabase/config.toml. Start/assets validam sessão Supabase e administrador ativo; callback consome state uma única vez; webhook exige assinatura HMAC SHA-256 da Meta.
4. No app Meta, cadastrar callback OAuth exato `SUPABASE_URL/functions/v1/nexodent-meta-connect-callback`. Configurar o webhook `SUPABASE_URL/functions/v1/nexodent-meta-webhook`, verification token e assinaturas para Page/leadgen e WhatsApp Business Account/messages. Ativar produtos e permissões com revisão/Advanced Access para clientes externos. Sem isso, o modo desenvolvimento só funciona com usuários e ativos de teste autorizados.
5. Permissões do fluxo Meta: pages_show_list, pages_read_engagement, pages_manage_metadata, leads_retrieval. WhatsApp: business_management, whatsapp_business_management, whatsapp_business_messaging. O usuário deve poder gerenciar a página/formulários/número; não basta ter acesso ao anúncio. Aplicação usa token longo e tokens de página criptografados no servidor; revogação/expiração exige reconectar. Não existe bypass das aprovações da Meta.
6. Publicar integracoes/, crm/ e assets/ juntos. A contratação pode expor só os botões Conectar e a seleção do ativo; a configuração do app e do webhook é da plataforma.
7. Validar com dois clientes de teste antes de produção: lead de formulário, anúncio para WhatsApp, conversa orgânica nova, reenvio do mesmo evento, mesmo telefone nos três canais, usuário sem administração, ativo de outra clínica, assinatura alterada e revogação da credencial. Testar também concorrência de eventos e necessidades de monitoramento/retenção no ambiente real.

## Limites operacionais

O envio HTTP só recebe 200 após processamento; falhas transitórias recebem 503 para reenvio pelo provedor. Há deduplicação transacional no banco, assinatura dos eventos e separação por ativo autorizado. Ainda não há fila própria/dead-letter, painel de resolução de conflitos históricos, onboarding Embedded Signup, histórico de conversas, envio automático de mensagens ou refresh periódico de credenciais. Campos/tokens/permissões e as versões de API precisam ser aceitos pela conta Meta real.

Nenhuma configuração da Meta, função remota ou migration foi aplicada no serviço real nesta entrega. Os testes locais não demonstram aprovação do aplicativo nem captação em produção.
