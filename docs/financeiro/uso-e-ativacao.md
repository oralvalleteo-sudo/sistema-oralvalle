# Financeiro — versão 332

Resumo gerencial mensal de entradas, despesas pagas e contas a pagar. A permissão é compartilhada com Vendas e Pagamentos recebidos: Oculto / Só ver / Ver e alterar. O plano da clínica precisa liberar Financeiro. Recebimentos individuais permanecem nas áreas de pacientes; esta aba e o CSV trazem totais de entradas e detalhamento de gastos.

## Ativação

Executar inteiro `supabase/migrations/202611170020_expense_duplicates_and_schedule.sql` depois da migração `202611170019_general_expenses.sql`, já usada pelo cadastro de despesas. Após a 202611170020, executar `supabase/migrations/202611170021_allow_future_expense_payments.sql` para permitir datas futuras no pagamento. O ambiente desta revisão não tem credencial administrativa do banco real: não aplicou SQL nem alterou os registros da clínica.

A migração acrescenta mês de referência, data prevista, revisão concorrente, cancelamento lógico e auditoria privada. O vencimento deixa de ser obrigatório. Registros antigos recebem mês de referência a partir da data de criação, no fuso de São Paulo. Não muda valores, quitações ou vencimentos existentes automaticamente e não exclui contas fisicamente. As permissões de DELETE são revogadas; a ação Excluir utiliza uma RPC que preserva o original na auditoria.

## Uso

- Escolher mês inicial e final. Despesas manuais seguem seu mês de referência, mesmo quando pagas atrasadas ou em outro mês. Entradas dos pacientes e pagamentos automáticos usam suas datas efetivas. O saldo é um resumo gerencial; não representa saldo bancário nem inclui saldo inicial.
- Nova despesa: descrição, categoria escolhida na lista ou criada em Nova categoria, mês e valor. Vencimento e pagamento previsto são opcionais. Fornecedor sai do formulário; dados antigos desse campo são preservados nas edições.
- Pagamento registrado marca a conta como paga e aceita datas passadas, atuais ou futuras, inclusive adiantamentos; exige uma data válida e forma de pagamento. Sem esse campo, fica a pagar. Previsão futura não quita a conta quando chega ao calendário.
- Ao registrar pagamento, a conta sai das pendentes e entra em Gastos do período. O histórico permite consultar e editar pagas e outros meses. A lista tem soma automática.
- O painel de categorias tem gráfico e tabela com Pagas / A pagar / Total. Nomes equivalentes são agrupados na visualização. Unir categorias renomeia as categorias manuais selecionadas em toda a clínica, inclusive meses anteriores, depois de confirmação. Valores e pagamentos permanecem preservados e as alterações são auditadas.
- Editar e Excluir foram preservados. A edição usa revisão concorrente; se outro usuário mudou o lançamento, é necessário atualizar. Excluir retira dos totais e mantém histórico de auditoria. Não apaga o registro físico.
- O CSV contém totais e gastos, com data do pagamento e mês de referência, sem listar recebimentos individuais de pacientes.

## CEMIG e duplicidades

Após ativar os SQLs e atualizar o aplicativo, consultar ou editar as contas no Financeiro. Se a CEMIG ainda estiver marcada como paga, mas a intenção for apenas prever 22/11, usar Editar, deixar Pagamento registrado vazio e preencher Pagamento previsto. A data futura, por si só, não permite presumir que um pagamento registrado seja apenas previsão. Mantém o vencimento original; não presume que o vencimento de outubro deveria ser novembro.

Se ainda houver cópias idênticas, Manter uma conta e corrigir cópias deixa somente uma ativa e preserva as outras na auditoria. A interface não propõe esse procedimento sobre pagamentos registrados, com data passada ou futura, nem sobre contas vinculadas: eles exigem revisão individual. Registros apagados antes desta versão não são recriados nem presumidos recuperáveis.

Uma mesma conta ativa (descrição normalizada, categoria, fornecedor histórico, valor, vencimento e mês) não pode ser inserida de novo. A interface confere antes de enviar; o servidor serializa a verificação por clínica. Contas realmente diferentes devem ser identificadas pela descrição/documento adequado. A correção da versão 330 também mantém o identificador de uma tentativa e verifica o registro se a resposta de gravação ficar incerta.

## Fontes automáticas e limites

Laboratório usa parcelas individuais efetivamente registradas em `nexodent_lab_payment_events`. Saldos de abertura não são dinheiro novo. Repasses vêm dos pagamentos em `db.cp`, nunca de comissões apenas calculadas. Não há criação duplicada de despesas manuais para representar esses pagamentos. O Financeiro consulta fontes novamente ao entrar e reage a eventos de pagamento laboratorial. Uma atualização antiga não pode sobrepor o recarregamento depois de uma gravação.

Recebimentos são brutos; taxas bancárias precisam ser lançadas quando aplicável. Valores estimados de precificação e obrigações ainda não pagas não são saídas efetivas. Fontes sem acesso ou com consulta incompleta aparecem como parciais. Para consultar laboratório, são necessários Laboratório e Pacientes; para repasses, Comissões e módulo ativo. As regras de servidor continuam protegendo os dados.

Vínculos antigos explícitos CP-ID ou LABPAY-ID eliminam duplicidade apenas quando únicos, pagos e com valor idêntico; o pagamento original prevalece. Divergências exigem conferência. Valores coincidentes, sem vínculo, não são deduzidos por suposição. Os testes usam dados sintéticos e verificam cálculos, permissões, isolamento de clínica, rollback, auditoria, formulários e atualização das fontes; não certificam os registros reais nem todo o produto.

## Categoria e datas futuras — versão 332

O campo principal agora é uma lista de seleção: basta escolher outra categoria, sem apagar texto. A opção + Nova categoria mostra um campo separado. Ao editar, a categoria e a data de pagamento já registradas são preservadas. Não há limite de data passada no cadastro nem na baixa. Pagamento previsto e pagamento registrado são campos distintos: apenas a previsão não cria saída, enquanto o pagamento registrado é contabilizado mesmo com data futura, conforme o mês de referência manual ou a data da origem automática. A versão não reescreve o estado de contas existentes nem converte previsões em pagamentos.
