# Comunicação interna do NexoDent

## Uso

Após a instalação, entrar no NexoDent e abrir **Clínica → Comunicação**. A central abre em outra aba do mesmo sistema, preservando a tela de atendimento. Também é acessível por `/comunicacao/index.html`. Reutiliza a sessão de login; se ela tiver expirado, solicita autenticação.

Escolher a clínica quando houver mais de uma. Nova conversa → Individual → selecionar um colega; ou Grupo → dar um nome e selecionar participantes. Os destinatários são somente usuários ativos dessa clínica. A conversa individual do mesmo par de usuários é reutilizada, sem criar várias cópias.

Mensagens aceitam até 4.000 caracteres. É possível anexar um arquivo de até 10 MB por mensagem, em PDF, PNG, JPG, WebP ou TXT. Mensagens e anexos são compartilhados com todos os participantes da conversa. O criador do grupo pode alterar participantes; novos participantes acessam o histórico, e removidos deixam de acessar. Não existe acesso automático do administrador da clínica às conversas de terceiros.

A central atualiza conversas a cada 8 segundos enquanto visível. O menu do sistema mostra um contador de mensagens não lidas, atualizado a cada 20 segundos. Não há notificação push com navegador fechado, indicação de presença, áudio/chamada ou confirmação de leitura do destinatário nesta versão. O contador indica o que o próprio usuário ainda não leu.

## Botão flutuante em todas as telas de uso

O botão laranja de chat aparece para usuários autenticados na tela principal, CRM, administração, integrações, assinatura, ativação e central de comunicação. Em módulos embutidos existe apenas o botão da janela principal, evitando duplicatas.

- O botão fica fixo no canto inferior direito, com 8 px de distância das bordas e respeito à área segura do celular. Posições antigas salvas são ignoradas.
- Clicar abre o painel; fechar preserva o rascunho enquanto a página estiver aberta.
- A janela compacta usa a mesma sessão da página principal, evitando outra instância de renovação de credenciais. Quando a tela informa uma clínica válida, a seleção fica travada a esse contexto no painel. A central completa continua permitindo selecionar as próprias clínicas autorizadas.
- “Abrir central” abre a página completa em outra aba. Escape fecha o painel.
- A posição é ajustada ao tamanho visível da tela. Painéis fechados/inativos pausam a atualização e não marcam novas mensagens como lidas. Sair ou trocar de conta remove as janelas privadas da sessão anterior.
- Rascunhos ficam em memória enquanto a página está aberta. Não há garantia de recuperação após recarregar/fechar a página ou sair da conta; o navegador avisa sobre mensagem não enviada ao sair da página.

Para validar a interface, com Playwright e Chromium disponíveis: `node tests/browser/chat-widget.cjs`. O script aceita PLAYWRIGHT_MODULE e CHROMIUM_BIN para instalações fora do projeto e usa somente dados sintéticos. É um teste visual separado da suíte padrão de banco/CI.

## Permissões e segurança

- Cada chamada valida sessão, vínculo ativo, clínica e participação na conversa. Sem gravações REST diretas nas tabelas. Um ID de conversa/arquivo conhecido não concede acesso.
- Permissão `chat`: `edit` permite ler/enviar/criar; `view` permite somente leitura e download; `none` bloqueia. Usuários antigos sem essa chave recebem acesso de comunicação; novos perfis configurados pela interface recebem `edit` para comunicação por padrão. O administrador pode alterar em Configurações → Acessos.
- A guarda clínica existente é reutilizada: se o controle de assinatura estiver instalado, a suspensão também impede operar o chat. A página Minha assinatura continua sendo a forma de regularizar.
- Não há cópia automática de prontuários, permissões clínicas ou dados de outra clínica. Arquivos enviados manualmente são uma nova cópia compartilhada com os participantes escolhidos; as permissões do prontuário original não são herdadas pelo arquivo. Escolher os destinatários faz parte do compartilhamento.
- Mensagens são exibidas como texto, sem HTML executável. Tipos/extensões e conteúdo básico dos arquivos são validados; downloads exigem autorização e são entregues como arquivo, sem renderizar conteúdo arbitrário em HTML. SHA-256 detecta inconsistência do download, não comprova autoria legal nem substitui antivírus.
- Reenvios usam identificador de tentativa e não duplicam mensagens. O servidor define autor e data; o cliente não escolhe outro remetente. Há limite de 30 mensagens por usuário/minuto/clínica e quota inicial de 100 MB de anexos de comunicação por clínica, para controlar uso. Não há execução de arquivos nem importação automática de seus dados.
- Desativar usuário bloqueia consultas/envios futuros. Não revoga cópias legitimamente baixadas. Operadores com acesso administrativo ao banco mantêm as capacidades de administração do serviço; isto não é criptografia ponta a ponta.

## Instalação

1. Fazer backup e testar a migration `202611110008_internal_communication.sql` em homologação. Requer a base de clínicas/membros e `private.require_member`; se a assinatura SaaS estiver instalada, a mesma guarda é aplicada. No rollout da branch completa, seguir a ordem das migrations anteriores descrita em SAAS-ATIVACAO.md.
2. Publicar `comunicacao/`, scripts modificados em `assets/js/`, `index.html` e o manifesto de versão juntos. O workflow Pages inclui a pasta nova. Não são necessárias chaves de provedor de mensagens ou um serviço pago de chat para esta versão.
3. Validar com duas contas da mesma clínica e uma de outra: conversa, grupo, arquivo, remoção, desativação e permissões. Verificar disponibilidade de espaço no Supabase e políticas de backup/retenção. Arquivos ficam privados no banco e consomem seu armazenamento; não foi configurado um bucket público.
4. Revisar quem recebe a permissão de comunicação. Antes de liberar para a equipe, confirmar que cada conta tem vínculo com a clínica correta.

## Limites operacionais

Histórico é paginado. A primeira versão não oferece edição/exclusão de mensagens, pesquisa textual, encaminhamento, gravação de áudio, videoconferência, envio por WhatsApp ou e-mail, nem comunicação entre clínicas. Não há arquivamento/exclusão de anexos pela interface ou transferência de criador de grupo. Retenção, eventual expansão da quota e administração de grupos sem criador ativo devem ser tratados pelo operador com procedimento autorizado, sem editar/destruir histórico cegamente.

Os testes usam banco isolado e navegador local. Nenhuma mensagem foi enviada a usuários reais e a migration não foi aplicada ao Supabase de produção nesta entrega. Publicar apenas a página não instala as funções de conversa.

## Avisos sonoros

Novas mensagens e avisos de agenda emitem um sinal curto, após a primeira interação no sistema. O chat oferece “Som ligado/desligado”; a preferência vale para o usuário naquele aparelho. Ao ligar, toca um teste. O histórico carregado ao entrar e as próprias mensagens não disparam o som. Sinais próximos são agrupados por 2 segundos para evitar repetição entre abas. O contador consulta novas mensagens a cada 20 segundos; abas em segundo plano podem ser limitadas pelo navegador. Com o sistema fechado, o som das notificações Push depende do navegador, volume e configurações do aparelho.
