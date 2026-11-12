# Inicialização do SDK Meta — build 282

O cliente confirmou a chegada do build 281, mas não observou janela Meta após Continuar; o aviso de 15 segundos foi exibido. A mudança de contexto da versão anterior, portanto, não comprovou resolução no ambiente real.

A revisão encontrou um defeito independente no loader: aceitava window.FB.init/login assim que o script disparava onload. O bootstrap pode expor esses métodos como stubs antes de o SDK completo estar inicializado; isso não é um sinal de prontidão para chamar o login.

## Correção

- Registra fbAsyncInit antes de carregar o script e aguarda esse sinal para liberar o diálogo e seu botão de autorização.
- Não considera a presença de FB.init/login nem script.onload como sinal suficiente de inicialização.
- Preserva o callback anterior, mantém coalescência das chamadas e limpa handlers/timers ao concluir ou falhar.
- Carregamento parcial sem sinal de prontidão resulta em META_SDK_NOT_READY após 15 segundos; falha ao baixar o bootstrap resulta em META_SDK_DOWNLOAD_FAILED. Não apresenta autorização fictícia nem altera permissões/Secrets.
- Mantém o login por clique explícito na janela principal, sem carregar SDK na entrada geral do aplicativo. Diálogo distingue o botão de continuar desativado do cancelamento disponível.

## Validação e limites

Novo teste browser com bootstrap incompleto que já expõe init/login: confirma ausência de diálogo e ausência de chamada aos stubs; depois dispara fbAsyncInit com o SDK simulado completo e confirma que somente esse SDK recebe o login. Também testa download bloqueado e timeout do estágio completo. Os testes de conexão independente/aninhada passaram com carregamento assíncrono atualizado.

Os testes continuam simulados. A resolução da tentativa real, as respostas da Meta, o estado do aplicativo e a entrega pelo webhook precisam de validação no ambiente do cliente. Nenhum token ou conta real Meta foi usado. Esta publicação não modifica Edge Functions nem SQL e não exige refazer credenciais.
