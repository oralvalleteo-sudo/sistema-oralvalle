# Correção da autorização WhatsApp — build 278

## Diagnóstico e limite

O frontend chamava `nexodent-whatsapp-connect-start`, sem implementação dessa função no repositório. `Failed to fetch` sozinho não prova a causa no ambiente remoto: pode ser endpoint inexistente, preflight/CORS, rede ou serviço indisponível. Não houve acesso administrativo ao projeto remoto para confirmar sua implantação/configuração.

Foram implementados início e retorno OAuth com estado aleatório de dez minutos, hash no banco, consumo único, administrador ativo conferido antes e depois da autorização, token cifrado AES-GCM somente no servidor e CORS restrito à origem configurada. A autorização retorna **pending**, sem anunciar número conectado ou mensagens funcionando.

O frontend agora explica erros de rede/implantação, mostra erros JSON do servidor, preserva o subdiretório do Pages e permite tentar novamente. Nenhum código ou token OAuth é processado pela página estática antiga. Somente a função callback processa o código.

## Para ativar no Supabase

1. Conferir base clínica e `202611070001_channel_connections.sql`; aplicar `202611120013_whatsapp_oauth.sql`. Tabelas de estados/credenciais não dão acesso a anon/authenticated; service_role é somente do servidor. A migration não expõe tokens na tabela de status.
2. Configurar Secrets das funções no painel Supabase, sem colocar valores em HTML, repositório ou chat:
   - `META_APP_ID`, `META_APP_SECRET` do aplicativo Meta correto.
   - `META_WHATSAPP_CONFIG_ID` de uma configuração de Login para Empresas compatível com o fluxo de autorização por redirecionamento e permissões WhatsApp necessárias. Configurações exclusivas de SDK/Embedded Signup exigem adaptação ao fluxo oficial correspondente; não presumir compatibilidade.
   - `META_GRAPH_VERSION`: versão da Graph API atualmente suportada pelo aplicativo. Nenhuma versão fictícia é usada como padrão.
   - `META_WHATSAPP_ENCRYPTION_KEY`: chave aleatória de 32 bytes em hexadecimal (64 caracteres), guardada de forma segura e separada dos dados. Perder a chave impede decifrar credenciais; trocar exige estratégia de rotação.
   - `NEXODENT_APP_ORIGIN=https://oralvalleteo-sudo.github.io` (sem caminho ou barra final).
   - `NEXODENT_APP_URL=https://oralvalleteo-sudo.github.io/sistema-oralvalle/`.
   - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são variáveis administrativas do runtime das Edge Functions; nunca disponibilizar a service role ao navegador.
3. Publicar, pelo painel/CLI do projeto correto, ambas as pastas:
   - `nexodent-whatsapp-connect-start`
   - `nexodent-whatsapp-connect-callback`
   O `supabase/config.toml` deixa a verificação JWT do gateway desativada nessas duas funções: a inicial autentica manualmente via `/auth/v1/user` e verifica administrador ativo; o retorno valida estado de uso único. Não aplicar essa configuração indiscriminadamente a outras funções.
4. No aplicativo Meta, cadastrar como URI de redirecionamento exata `https://<projeto>.supabase.co/functions/v1/nexodent-whatsapp-connect-callback`; conferir domínio, produto e permissões/revisão exigidos pela Meta. Usar apenas as permissões necessárias. Um aplicativo ainda em desenvolvimento pode restringir quem consegue autorizar.
5. Homologar com administrador de clínica de teste: verificar OPTIONS com origem correta; 401 para sessão inválida; 403 para usuário não administrador; autorização cancelada/expirada; retorno à clínica correta. Não registrar cabeçalhos, códigos de autorização, tokens ou segredos nos logs de suporte.

## O que ainda é outra etapa

A autorização Meta não equivale a número registrado/selecionado, inscrição de webhooks ou funil recebendo mensagens. A seleção e verificação de WABA/número, tratamento de webhook com assinatura e idempotência, deduplicação CRM, expiração/renovação, desconexão e exclusão de credenciais precisam de implementação/homologação antes de mudar o status para connected. Esta entrega não inventa essas validações nem muda o status para connected.

Definir rotina administrativa de remoção de estados expirados, retenção/rotação de credenciais e monitoramento sem dados sensíveis. Estados expirados são rejeitados pelo callback, mas não existe tarefa agendada de limpeza nesta entrega.

**Publicar o GitHub Pages não aplica migrations, não configura Secrets nem publica Edge Functions.** Não havia credenciais administrativas neste ambiente; nenhuma função ou tabela de produção foi alterada daqui. A falha de conexão real só pode ser encerrada após essas ativações e teste real com Meta.
