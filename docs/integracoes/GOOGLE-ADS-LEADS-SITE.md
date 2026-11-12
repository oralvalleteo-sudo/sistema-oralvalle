# Conta Google vinculada e leads do site

## Evidência do código e relato

O responsável confirmou que a conta aparece vinculada, mas os leads não chegam, e que os anúncios direcionam ao site da clínica. O widget lê nexodent_channel_connections e mostrava Conectado diretamente a partir do registro status=connected. A autorização OAuth/seleção da conta, por si só, não captura contatos do site.

A revisão 285 troca o rótulo do Google para Conta vinculada e explica a distinção. Não altera campanhas, credenciais, vínculo ou dados e não simula recebimento de leads. A autenticação real da conta não foi validada com credenciais de produção neste ambiente.

## Caminho confirmado pelo responsável

Google Ads → oralvalle.com → botão WhatsApp → conversa com a clínica. Para esse caminho, não se deve criar ou presumir webhook de formulário Google. A captura da conversa e a criação/deduplicação do contato no CRM dependem do WhatsApp oficial e do webhook correspondente. A origem Google também não fica comprovada apenas pelo vínculo OAuth; requer atribuição pelo site/mensagem/evento compatível, sem prometer identificar visitantes anônimos.

A conexão de coexistência continua sem homologação real: o teste do configurador Meta também abriu cadastro SMS/ligação em vez do QR, e houve erro 2655115 em tentativa anterior. Não foram executadas exclusões, registro de número ou migração para contornar essa recusa.

## Caminhos distintos

- Formulário no site: envio do formulário precisa de uma integração com o CRM; GA4/conversão de anúncio não fornece automaticamente nome/telefone de visitantes.
- Botão WhatsApp no site: identidade/conversa depende da integração oficial do número e da entrada pelo webhook de mensagens. O vínculo OAuth do Google não dá acesso a conversas do WhatsApp.
- Formulário nativo do Google Ads: pode ter entrega de leads por webhook própria, distinta da navegação ao site.

A função nexodent-google-ads-leads foi vista anteriormente na lista de funções do Supabase remoto, mas seu código não está neste checkout. Não foi substituída nem considerada funcional apenas por aparecer no painel. Não registrar uma nova função ou chave de entrega sem conferir a existente e sua ligação com o CRM.

## Próxima verificação necessária

O URL e o uso do botão WhatsApp já foram informados: oralvalle.com. Conferir o destino efetivo desse botão, a elegibilidade/ativação do número, o código do webhook remoto, a associação da clínica e a deduplicação. Homologar uma mensagem real autorizada antes de afirmar que novos leads serão criados. A implementação depende do sistema que serve o site; nexodents.com.br é o site comercial do produto, não foi presumido como site da clínica.

Não há credenciais administrativas Supabase disponíveis. Não foram alteradas funções/tabelas de produção, enviado contato real, importado lead ou executada mensagem externa. A entrada real permanece pendente de verificar/integrar o site informado pelo responsável.
