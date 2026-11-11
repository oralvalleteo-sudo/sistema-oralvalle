# Ativar o chat publicado

O botão flutuante e a central são publicados pelo GitHub Pages. O envio de mensagens depende da instalação do banco.

No projeto Supabase usado pelo NexoDent, faça backup e execute no SQL Editor o conteúdo de `supabase/migrations/202611110008_internal_communication.sql`. Essa migration requer a base de clínicas já existente; não exige instalar as migrations de cobrança SaaS. Execute uma única vez. Não use a chave pública do site como credencial de administração.

Depois, entre com duas contas ativas da mesma clínica, abra o botão de chat, crie uma conversa e valide envio, leitura e anexo. Uma conta de outra clínica não deve acessar a conversa. Nenhuma mensagem ou migration foi enviada ao banco de produção por esta entrega.

Para liberar anexos de até **10 MB**, execute depois `supabase/migrations/202611110009_chat_file_limit_10mb.sql`. Se o chat já está instalado, execute somente essa atualização. Ela preserva as mensagens e os arquivos existentes. A publicação no GitHub não executa SQL no Supabase. A quota total de anexos continua em 100 MB por clínica.
