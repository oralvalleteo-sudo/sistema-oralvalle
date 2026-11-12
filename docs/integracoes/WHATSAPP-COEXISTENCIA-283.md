# Coexistência com WhatsApp Business no celular — build 283

O responsável confirmou que deseja preservar o mesmo número no aplicativo WhatsApp Business e que a opção Conectar à plataforma abre um leitor de QR no celular. O fluxo anterior solicitava cadastro Cloud padrão (featureType vazio), sem selecionar a experiência específica de coexistência.

## Alteração

- A integração oferece Já uso WhatsApp Business no celular (padrão) e Número exclusivo para a plataforma. O modo é capturado no início de cada tentativa, sem troca automática se houver erro.
- Para coexistência, FB.login recebe extras.featureType=whatsapp_business_app_onboarding, sessionInfoVersion=3 e os parâmetros de código de autorização já existentes. O modo atravessa a ponte para a janela principal.
- Aceita o retorno FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING, além de FINISH, somente no modo de coexistência. Os IDs continuam sendo validados no servidor contra a WABA/número acessíveis pelo token oficial; evento de origem desconhecida não cria vínculo.
- QR code é fornecido pela Meta em sua janela durante o fluxo, quando disponível para a conta. Não é gerado, capturado ou armazenado pelo NexoDent.
- Erro 2655115, cancelamento ou retorno sem número não provocam fallback, migração, exclusão ou registro automático do telefone. O fluxo padrão Cloud continua disponível apenas por escolha explícita.

## Limites e ativação

Não há SQL ou atualização de Edge Functions nesta entrega: o callback já existente valida o número e mantém status pending. O frontend não chama registro/unregister de número, inscrição de webhook, envio ou importação de histórico.

A liberação para coexistência depende da Meta, do aplicativo, da conta, do número e da configuração do cadastro. A alteração corrige a solicitação do fluxo; não comprova elegibilidade nem que o erro 2655115 será removido. Não excluir WhatsApp, número ou WABA para tentar contornar esse erro.

Para testar: atualizar app.nexodents.com.br, selecionar Já uso WhatsApp Business no celular, clicar Conectar WhatsApp/Continuar na Meta e seguir a experiência indicada pela Meta. Somente se ela oferecer o QR, ler no WhatsApp Business do celular pelo menu de conexão à plataforma. Não compartilhar o QR nem códigos de verificação.

Após autorização e validação do número, ainda é necessário verificar o webhook real, o roteamento por clínica, os eventos de coexistência/histórico e uma mensagem de teste antes de considerar a integração ativa. A presença da função nexodent-whatsapp-webhook no painel não comprova compatibilidade com as credenciais por clínica. Seu código remoto ainda não foi inspecionado neste ambiente.

Testes isolados do navegador conferem featureType, repasse pelo CRM, retorno específico, origem inválida, recusa 2655115 e cadastro sem número. Não usam número real, QR real ou conta Meta e não substituem homologação oficial.
