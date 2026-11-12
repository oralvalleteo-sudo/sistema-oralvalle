# Operação do Nexo Admin — versão 288

Endereço: https://app.nexodents.com.br/admin/

O administrador da plataforma é validado no servidor. Ser administrador de uma clínica não concede esse acesso.

## Áreas

- Visão geral: cadastros, assinaturas, alertas e histórico de alterações.
- Clínicas: pesquisa, situação contratual, vencimentos, ações auditadas de assinatura e ficha operacional com contagem de membros ativos e chamados abertos.
- Comercial: planos, cobranças manuais, testes e preferências de módulos. As preferências não bloqueiam recursos automaticamente.
- Suporte: fila por clínica, área, prioridade, descrição técnica e andamento. Registra responsável, data e justificativa em cada mudança; permite reabrir chamados. Lista até 200 chamados recentes; histórico até 100 eventos por chamado.
- Privacidade: atendimento dos protocolos existentes, separado da operação comercial.
- Diagnóstico e relatórios: verificações do navegador atual, sem atribuir disponibilidade global às clínicas.

A correção de assinatura pode ser feita pelo painel. Bugs de código precisam de alteração testada e publicação. O painel não fornece SQL arbitrário, acesso remoto, troca de identidade ou alteração de prontuários. Não registre dados de pacientes, tokens ou senhas em chamados.

## Ativação necessária no Supabase

Aplicar `supabase/migrations/202611120015_admin_operations.sql` no SQL Editor do projeto correto, após a fundação administrativa existente. É SQL, não código TypeScript de Edge Function. A migração é reaplicável, cria tabelas próprias e não modifica dados clínicos ou assinaturas.

A publicação do site não executa a migração. Sem ela, chamados e ficha complementar mostram indisponibilidade; as outras áreas continuam utilizáveis. Não adicionar usuários à tabela de administradores como parte desta ativação. Fazer teste com uma clínica sintética e conferir o histórico; confirmar que um administrador de clínica comum continua sem acesso.

## Limites e próximos requisitos de comercialização

Ainda não há evidência de último acesso por clínica, versão em uso, backup concluído, disponibilidade contínua ou entrega de mensagens. Não inferir esses indicadores a partir de conta vinculada ou navegador online. As integrações precisam de validação de ponta a ponta.

Antes de cobrança automatizada, integrar confirmação bancária, conciliação e aplicação de direitos de acesso no servidor. Definir política de retenção dos chamados, procedimento de suporte e contato comercial verificado. Alertas proativos, métricas de uso e atualização assistida dependem de implementação adicional com coleta mínima e autorização por clínica. Os testes contratados existentes não são encurtados por esta versão.
