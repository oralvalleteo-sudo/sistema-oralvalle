# Correção de origens — revisão 280 das funções WhatsApp

O responsável informou Origin=https://app.nexodents.com.br e observou OPTIONS 204/POST 403 com Origem não autorizada. A captura confirma resposta do serviço, mas não permite provar quais variáveis/versão cada instância remota utilizou. O teste remoto daqui foi bloqueado pelo proxy de saída; não houve confirmação direta de resposta da função em produção.

As duas funções agora mantêm uma lista exata dos endereços conhecidos desta instalação:

- https://app.nexodents.com.br
- https://oralvalleteo-sudo.github.io

OPTIONS e POST usam a mesma lista; Vary: Origin evita compartilhar uma resposta entre origens no cache. Não há wildcard, liberação de domínio parecido, HTTP, origem null ou origem ausente. O retorno replica apenas uma origem que já passou nessa lista. Autenticação, administrador ativo, estado de uso único, clínica/usuário e validação do número na Meta continuam obrigatórios.

Espaços nas extremidades dos Secrets são removidos. O valor configurado de NEXODENT_APP_ORIGIN é validado como uma das duas origens; uma barra final nesse valor de configuração pode ser normalizada. NEXODENT_APP_URL deve apontar para uma origem autorizada, sem credenciais, query ou fragmento. O diagnóstico de configuração lista somente NOMES dos campos ausentes/inválidos, nunca seus valores. Não ampliar a lista a partir de um Origin recebido.

O cabeçalho público X-Nexodent-Function-Version: 280 identifica a revisão executada. Isso não é número de versão do frontend.

## Aplicar

Substituir TODO o index.ts e publicar novamente as DUAS funções existentes a partir do código atual do repositório:

1. nexodent-whatsapp-connect-start
2. nexodent-whatsapp-connect-callback

Manter Verify JWT with legacy secret desligado somente nessas duas funções, que validam autorização internamente. Não há SQL adicional nesta revisão e não é necessário recriar Secrets, IDs ou chave de criptografia.

Testar pelo endereço app.nexodents.com.br. Se restar um erro de configuração, a mensagem deve citar o nome exato a conferir. Se houver ainda Origem não autorizada e o cabeçalho 280 não aparecer na resposta da tentativa nova, conferir o deploy/código da função correta e o projeto antes de trocar valores novamente.

Publicação no GitHub não substitui o deploy das Edge Functions. Não houve acesso administrativo ao Supabase neste ambiente, e essa atualização remota não foi executada daqui. O vínculo segue pending até validar o webhook e recebimento real; esta revisão não promete funcionamento ponta a ponta com Meta.
