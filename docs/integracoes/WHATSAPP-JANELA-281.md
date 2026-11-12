# Abertura da autorização Meta na janela principal — build 281

Relato: após Continuar na Meta, o modal embutido mostrava Conclua a autorização, sem janela visível nem erro no Console fornecido. Não houve acesso a uma conta real da Meta para confirmar a causa externa. A inspeção mostra que o módulo era executado no documento embutido das integrações, acessado pelo CRM dentro do aplicativo.

## Ajuste

- Quando a página de integrações está em iframe da mesma origem, carrega o agente de autorização na janela principal. O diálogo, a inicialização do SDK, o clique FB.login e o recebimento dos eventos ficam no documento principal, preservando a ação explícita do usuário.
- A ponte não atravessa origens diferentes. Os dados passam somente em memória entre documentos da mesma origem, sem transmitir sessão em URL, localStorage adicional ou postMessage público.
- Antes de prosseguir, valida que os frames de origem continuam ativos e que o usuário da janela principal continua sendo o proprietário da tentativa. Verificações de clínica, usuário, estado e número no servidor permanecem obrigatórias.
- Informa a preparação da janela e, se a Meta não retornar em 15 segundos, exibe orientação específica em vez de afirmar que há uma janela aberta. Cancelamento e expiração continuam disponíveis; não anuncia conexão concluída.
- Não houve alteração de funções Supabase, Secrets, SQL, domínio permitido ou permissões Meta nesta versão.

## Validação

55 testes unitários passaram. Os testes de navegador do fluxo independente e de CRM sintético com dois iframes verificam execução do SDK/dialog na janela principal, conclusão com código/evento nas duas ordens, origem falsa e cancelamento/troca de conta sem vínculo indevido. As regressões de agenda/pacientes, chat, assinaturas, privacidade, fotos e mensagens de falha de WhatsApp também foram executadas; a verificação automatizada da publicação repete a suíte inteira.

Os testes de autorização usam SDK e respostas simulados, não uma conta Meta. Esta entrega não comprova aprovação do aplicativo, abertura da janela no ambiente específico do cliente, seleção/registro do número ou recebimento pelo webhook real. O próximo teste real deve ser feito em app.nexodents.com.br após atualizar a página.
