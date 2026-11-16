# Envio direto pelo NexoDent — versão 305

O envio direto usa a API oficial da Meta, no servidor. A tela permite revisar o destinatário e o texto antes de cada envio. Não há envio em massa, automação de campanhas ou envio real feito pelos testes.

## Estado da entrega

Código, migração e testes estão preparados. Publicar o site não publica Edge Functions, não executa SQL, não autoriza o número na Meta e não altera o webhook existente. Não foi possível testar a conta real, pois o ambiente do agente não dispõe de credenciais administrativas do Supabase/Meta. O número anteriormente encontrou uma restrição de cadastro na Meta; esta implementação não contorna elegibilidade, análise do app ou registro do número.

## Ativação

1. No SQL Editor do projeto correto, executar **todo** `supabase/migrations/202611160017_whatsapp_direct_messaging.sql`, de `begin;` até `commit;`. Requer a fundação clínica e migrations `202611120013_whatsapp_oauth.sql` e `202611120014_whatsapp_embedded.sql`. A migration 016 continua sendo usada pelo andamento manual, mas não é pré-requisito do envio oficial. Não cria ou substitui credenciais, nem registra/migra números. Se houver o mesmo `phone_number_id` vinculado a mais de uma clínica, o índice único recusará a ativação; revisar o vínculo correto, sem apagar registros às cegas.
2. Em **Edge Functions**, publicar os arquivos `supabase/functions/nexodent-whatsapp-messaging/index.ts` e `supabase/functions/nexodent-whatsapp-messaging-webhook/index.ts`, cada um com o nome da própria pasta. **TypeScript não deve ser colado no SQL Editor.** As duas funções validam a autenticação no próprio código; configurar a verificação JWT do gateway como desativada somente para elas. O envio valida o JWT do usuário no Auth e permissões no banco; o webhook valida HMAC oficial da Meta.
3. Conferir os segredos do servidor: `META_APP_SECRET`, `META_GRAPH_VERSION` e `META_WHATSAPP_ENCRYPTION_KEY` são os mesmos usados no callback existente. **Não gerar outra chave de criptografia**: precisa ser a mesma que cifrou o token. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos pela plataforma Supabase. Adicionar `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` com um valor aleatório forte e privado, que será usado na confirmação do webhook da Meta. Nenhuma chave privada deve ir ao navegador, GitHub público ou chat.
4. Concluir a autorização oficial na aba Integrações. É preciso haver `waba_id`, `phone_number_id`, token válido e número verificado. A função confirma que o número pertence à conta autorizada. A capacidade efetiva de enviar é confirmada pela resposta da Meta; o código não registra o número, não pede OTP e não exclui o WhatsApp do celular. Manter o uso no celular depende da elegibilidade de coexistência na Meta.
5. No Gerenciador do WhatsApp da Meta, ter pelo menos um modelo aprovado de texto simples. São suportados corpo com parâmetros numéricos consecutivos (`{{1}}`, `{{2}}`...), cabeçalho e rodapé estáticos de texto. Modelos com mídia, botões, parâmetros nomeados ou cabeçalho variável não são exibidos nesta etapa. Confira idioma e texto no momento da confirmação. A aprovação e eventuais cobranças são da Meta.
6. Para habilitar texto livre e confirmações de entrega, integrar o receptor de metadados ao webhook já usado pela conta, habilitar o campo `messages` e a assinatura do app na WABA conforme o procedimento oficial da Meta. A URL do novo receptor é `https://<projeto>.supabase.co/functions/v1/nexodent-whatsapp-messaging-webhook`. O segredo de verificação deve coincidir com `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`.

### Webhook existente do CRM

Há referência anterior a um webhook fora deste repositório; seu código e configuração em produção não foram verificados. **Não substituir o callback atual sem revisar seu processamento do CRM.** É possível incorporar a lógica de metadados ao receptor atual ou encaminhar o corpo bruto e o cabeçalho `X-Hub-Signature-256` ao novo receptor. A assinatura depende dos bytes originais: não reconstruir JSON após ler e interpretar o corpo. O processamento existente e o novo devem ser idempotentes antes de habilitar repetição por erro. Enquanto essa integração não estiver concluída, texto livre fica bloqueado por falta de janela comprovada, mas modelos aprovados podem ser usados se a Meta autorizar o envio. Nenhuma assinatura de WABA nem URL de callback é alterada automaticamente pelo código.

## Funcionamento

- O destinatário vem do paciente da clínica no banco, não de um telefone informado pelo navegador. Telefone ambíguo, inválido ou alterado após a revisão bloqueia o envio. O token fica cifrado no banco e só é decifrado na Edge Function.
- Fora da janela, usar modelo aprovado. A função relê a aprovação e a revisão do modelo no envio; se o texto mudou, é necessário revisar novamente. A mensagem livre acima do painel não é enviada no lugar do modelo.
- Texto livre exige uma mensagem real do cliente, autenticada por HMAC no webhook, nas últimas 24 horas. Eventos de sistema, status de entrega ou simples abertura de conversa não abrem essa janela. A regra é novamente conferida no banco e antes da chamada à Meta.
- Cada envio exige confirmação humana, pode ter cobrança e gera protocolo. O botão é bloqueado durante a solicitação. As permissões de WhatsApp e pacientes são validadas no servidor; texto e tokens não entram no histórico técnico.
- HTTP de sucesso com `wamid` significa **aceite pela Meta**, não entrega. Entrega/leitura só são apresentadas com recibo validado do webhook. O receptor grava apenas identificadores, telefone e horários necessários, nunca o texto das respostas. Esta etapa não é uma caixa de entrada de conversas.
- Timeout ou falha de confirmação é **resultado incerto**, não uma falha que permita reenviar automaticamente. Consultar o protocolo. Solicitações iguais ainda em processamento ou incertas são bloqueadas mesmo com outro identificador; solicitações aceitas iguais são reutilizadas por 5 minutos. Isso também evita duplicidade entre operadores e após recarregar a página.
- Metadados têm RLS, sem leitura/escrita direta pelo cliente. Claim, conclusão e recebimento são RPCs somente de `service_role`. Um usuário comum não consegue forjar janela, aceite, entrega ou leitura. O status público não inclui hash do conteúdo, token ou corpo de mensagens.

## Conferência antes de uso real

Usar um destinatário de teste autorizado, com confirmação do responsável. Selecionar modelo aprovado, revisar texto, idioma e telefone; enviar uma vez e conferir o protocolo e o aceite no Gerenciador do WhatsApp. Testar recibo de entrega e resposta do destinatário; só depois conferir a liberação da janela de texto livre. Verificar também a chegada do lead/mensagem no fluxo de CRM existente. Nenhum teste automático deste repositório envia mensagens reais.

Não há credencial genérica que resolva a restrição `2655115`; é preciso concluir o cadastro/eligibilidade com a Meta. Erro `133010` indica número ainda não registrado para envio por API: não excluir o WhatsApp do celular como tentativa de correção. O administrador deve seguir o cadastro oficial/coexistência. Erros `190`, `132001` e `131047` são apresentados com orientações de autorização, modelo e janela.

## Operação e dados

Incluir as tabelas `nexodent_wa_outbox` e `nexodent_wa_inbound_receipts` nos processos de backup, retenção e direitos dos titulares. Definir retenção dos registros técnicos e limpeza de recibos antigos conforme a política da clínica; não purgar solicitações incertas antes de reconciliá-las com a Meta. Esta versão não apaga histórico automaticamente nem altera prontuários, cobranças, agenda ou andamento manual de contatos.

Documentação oficial: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages e https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks . Campos e políticas devem ser conferidos na versão configurada em `META_GRAPH_VERSION`.
