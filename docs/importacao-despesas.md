# Importação de despesas

No Financeiro, aguarde o carregamento e clique em **Importar despesas**. Selecione um CSV ou Excel `.xlsx` de até 10 MB. O processamento do arquivo ocorre no navegador; somente as despesas selecionadas são enviadas ao Supabase ao confirmar.

No Excel, selecione a aba de gastos desejada. Confira a situação: quando a planilha não informa se a despesa foi paga, escolha **Despesas já pagas — Data é o pagamento** ou **Despesas ainda a pagar**. As datas futuras também são aceitas. A forma de pagamento ausente fica como “Não informada na planilha”; vencimentos ausentes permanecem vazios.

A prévia exige descrição, categoria e valor, ignora totais e linhas vazias e apresenta erros para revisão. Despesas já cadastradas e repetições ficam impedidas de importar. Coincidências de valor e data com pagamentos automáticos ou outras despesas ficam desmarcadas; confira antes de selecionar. Não importe novamente despesas de laboratório ou repasses já registrados automaticamente.

Confirme a quantidade, o total, as datas e a clínica. Cada linha recebe um identificador estável por clínica para evitar duplicações em novas tentativas. Se houver interrupção, os lançamentos confirmados permanecem gravados; atualize a prévia antes de continuar. A confirmação depende da resposta ou de uma consulta ao registro salvo, nunca somente de um envio sem retorno.

O CSV pode conter: Descrição, Categoria, Valor, Mês de referência, Situação, Data do pagamento, Vencimento, Pagamento previsto e Forma de pagamento. Use UTF-8 e separador ponto e vírgula para valores brasileiros. Excel aceita a tabela Data (ou N), Gastos, Descrição, Valor. Não há execução de fórmulas: o leitor usa valores armazenados na planilha. Arquivos `.xls` devem ser salvos como `.xlsx`.

Requer acesso de edição ao Financeiro e a tabela de despesas já instalada. Não exige nova migração SQL. A gravação usa a sessão e as regras de acesso da clínica.
