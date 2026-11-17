# Financeiro — versão 328

Nova entrada Financeiro no menu da clínica, com permissão compartilhada com Vendas e Pagamentos recebidos. Níveis Oculto / Só ver / Ver e alterar permanecem no editor de acessos. O plano da clínica precisa liberar o módulo financeiro.

## Ativar despesas compartilhadas

Execute inteiro `supabase/migrations/202611170019_general_expenses.sql` no SQL Editor como postgres. Foi testado em banco local; não foi aplicado ao banco real por falta de credencial administrativa neste ambiente. Se a tabela já existe, os dados não são apagados. Caso uma instalação anterior tenha colunas diferentes, revise a mensagem do banco antes de alterar dados.

O arquivo cria o cadastro de despesas gerais usado também pelos relatórios existentes, habilita RLS e restringe consulta/edição por clínica e permissão financeira. Usuários autenticados não recebem permissão de DELETE. A versão atual permite cadastrar e registrar pagamento; não oferece exclusão de despesas financeiras.

## Operação

- Escolha o período e consulte Entradas recebidas, Saídas pagas, Saldo do período e Despesas manuais a pagar até a data final.
- Nova despesa: descrição, categoria, favorecido, valor e vencimento. Data de pagamento em branco significa conta a pagar. Se já foi paga, informe data e forma.
- Registrar pagamento: confirme a data, forma e valor. Contas pendentes não reduzem o saldo antes desse registro.
- Exportar CSV respeita o período e inclui avisos de dados parciais.

## Fontes e limites

Recebimentos são os registros de pagamentos dos pacientes, mesmo quando a venda ocorreu antes do período. Laboratório usa parcelas individuais registradas em `nexodent_lab_payment_events`; eventos de abertura não são dinheiro novo. Repasses usam os pagamentos registrados em `db.cp`, nunca apenas comissões geradas. Valores são brutos; despesas de taxas bancárias precisam ser registradas quando aplicável. Custos estimados de precificação e obrigações ainda não pagas não entram como saídas efetivas.

Os dados clínicos/financeiros já carregados são usados conforme a sessão autorizada. Para incluir laboratório, o usuário precisa de Laboratório e Pacientes; para repasses, de Comissões. Falhas de carregamento ou fontes sem permissão exibem aviso e saldo PARCIAL. Não apresentar o saldo como extrato bancário: não inclui saldo inicial nem transações que a clínica não registrou.

Vínculos antigos explícitos CP-ID ou LABPAY-ID eliminam duplicidade apenas quando únicos, pagos e com valor idêntico. A data do pagamento original prevalece; divergências geram avisos. Despesas sem vínculo não são deduzidas por coincidência de valor. Conferir cadastros históricos que já tenham pagamentos duplicados antes de usar o saldo para decisões.

## Visualização a partir da versão 329

Os recebimentos individuais dos pacientes não aparecem na lista de gastos nem no CSV desta aba. Continuam compondo o total de entradas e o saldo do período. A lista detalha apenas saídas pagas; o CSV traz os totais e os gastos. Os registros originais permanecem nas áreas de pagamentos.

## Correção de confirmação — versão 330

O cliente HTTP descartava o cabeçalho Prefer, e o Supabase podia gravar uma despesa sem retornar seu conteúdo. A interface então apresentava falha de confirmação. O transporte agora preserva Prefer sem permitir substituir as credenciais. Antes de reenviar a mesma tentativa, a interface confere seu identificador; após uma resposta incompleta, consulta o registro e valida seus dados. Tentativas anteriores podem já estar gravadas: usar Atualizar e Mostrar todas as despesas cadastradas antes de recadastrar. Não remover nem recriar registros financeiros por suposição. Despesas com pagamento no período também aparecem na lista mesmo se o vencimento foi anterior. A opção Mostrar todas e a confirmação após salvar deixam visíveis registros fora do filtro, sem alterar os totais do período.

A política compartilhada de campos solicita autocomplete=off nos formulários e campos operacionais, sem renomear campos, alterar dados ou retirar datalists próprios. Login/senha mantêm suas configurações. A interface não apaga o histórico pessoal do navegador nem controla extensões externas. Nenhum novo SQL é necessário.
