# Cadastro incorporado WhatsApp — build 279

A configuração conferida pelo responsável na Meta é de Cadastro incorporado do WhatsApp, WhatsApp Cloud API, usuário do sistema, com whatsapp_business_management e whatsapp_business_messaging. A versão visível no painel era v27.0; o runtime usa a variável configurada, sem versão fictícia como padrão.

## O que mudou

- Início recebe flow=embedded; após autenticação/administração, gera uma tentativa de dez minutos, de uso único e vinculada a clínica e usuário. Retorna apenas App ID, Config ID, versão e estado; nunca chave ou token de acesso.
- O frontend carrega o SDK da Meta somente após clicar em Conectar. Desativa eventos automáticos do aplicativo e usa um botão explícito Continuar na Meta para abrir a janela na ação do usuário. Não deve haver requisição automática ao SDK na visita às outras telas ou à entrada.
- O código de autorização e o evento de conclusão podem chegar em qualquer ordem. São aceitos eventos de FINISH de www.facebook.com/web.facebook.com com IDs válidos. Outros eventos/origens não produzem vínculo. Cancelamento, troca de usuário/clínica e timeout encerram a tentativa na interface.
- O callback aceita POST autenticado, consome apenas estado embedded da mesma clínica e usuário e verifica via Graph que o número existe na WABA autorizada. Inclui appsecret_proof na leitura Graph. Os IDs do navegador não são considerados prova de acesso.
- Token é cifrado no servidor. Número e WABA são guardados na tabela privada de credenciais; metadados públicos preservam isolamento por clínica. Conexão já ativa não é substituída automaticamente pelo novo POST.
- Status continua pending: esta versão autoriza e identifica o número, mas não comprova inscrição de webhooks, roteamento do webhook existente, registro do número, envio/recebimento ou deduplicação de leads. Coexistência com WhatsApp Business e outros tipos de evento que não fornecem número precisam de homologação específica; não foram certificados aqui.

## Aplicar no Supabase — necessário além do GitHub

1. Aplicar 202611120014_whatsapp_embedded.sql depois da migration 013. Adiciona flow, waba_id e phone_number_id, sem apagar dados ou trocar permissões.
2. Atualizar TODO o index.ts das duas funções com os arquivos atuais do repositório e publicar novamente:
   - nexodent-whatsapp-connect-start
   - nexodent-whatsapp-connect-callback
   Manter Verify JWT with legacy secret desligado apenas nessas duas funções: a inicial e o POST do callback validam sessão/administração no código; o GET legado mantém estado de uso único. O frontend novo recusa a resposta antiga que só contém authorization_url.
3. Conferir os Secrets já cadastrados. ORIGIN deve ser exatamente https://oralvalleteo-sudo.github.io, sem subdiretório; APP_URL é https://oralvalleteo-sudo.github.io/sistema-oralvalle/. Não expor valores privados em capturas ou no repositório.
4. Na Meta, Login do Facebook para Empresas > configurações OAuth: confirmar login pelo SDK JavaScript e autorizar a origem HTTPS do sistema em Domínios permitidos para o SDK JavaScript. Conservar a configuração Embedded Signup e as restrições exigidas pela Meta. Não publicar o aplicativo indiscriminadamente nem adicionar permissões de anúncios para resolver erros de WhatsApp.
5. Testar com administrador autorizado da clínica e conta/número de teste. Aplicativo em desenvolvimento pode restringir participantes às funções do app. Validar também bloqueio de pop-up, cancelamento, número sem acesso e retorno de erro. Nenhum teste aqui usa conta real da Meta.
6. Conferir o código/configuração do nexodent-whatsapp-webhook já existente em produção antes de implementar inscrição/roteamento por clínica. Sua presença no painel não comprova compatibilidade com as credenciais por clínica desta versão. Nunca mudar para connected apenas por completar o login.

## Evidência e limites

Testes isolados verificam parâmetros públicos, autenticação, estado vinculado/replay/expiração, validação do número no Graph simulado, RLS e cifragem, além de SDK simulado no Chromium com retorno nas duas ordens, origem falsa, cancelamento e troca de clínica. Não constituem homologação oficial Meta nem teste de entrega de mensagens.

Não há acesso administrativo remoto disponível neste ambiente: não foram aplicadas a migration 014 nem a atualização das Edge Functions daqui. As instruções da versão 278 referentes apenas a redirect não completam a configuração Embedded Signup; usar este complemento.
