# Contas dos laboratórios — versão 290

Na aba **Laboratório**, abrir **Contas dos laboratórios**. Os custos são preenchidos em **Trabalhos → Novo trabalho/Editar → Custo do laboratório**, com paciente e laboratório responsável.

A nova tela apresenta pacientes distintos e trabalhos por laboratório, custo, pago e saldo pendente, incluindo trabalhos entregues e sem data prevista. Filtros permitem consultar um laboratório, paciente/trabalho e situação de pagamento. O CSV usa o filtro atual; os indicadores e o resumo geral consideram todos os trabalhos não cancelados.

- Custos zero são destacados como não informados; não representam um preço acordado.
- Cada trabalho calcula o seu saldo antes da soma. Pagamento acima do custo de um trabalho não quita outro trabalho.
- Saldo legado e evento de abertura representam a mesma origem: usa-se o maior deles uma vez, somando somente parcelas posteriores.
- Trabalhos cancelados com pagamentos são destacados para conferência de crédito/devolução; cancelar não estorna dinheiro.
- Pagamentos parciais exigem valor, data já ocorrida e forma, confirmação e acesso de edição ao financeiro. A tela bloqueia duplo envio e exige atualização quando não consegue confirmar a resposta.
- Os registros são os mesmos dos relatórios, sem criação automática de despesas adicionais no caixa ou de transferências bancárias.

## Dependências existentes

Usa `nexodent_lab_orders`, `nexodent_lab_settlements`, `nexodent_lab_payment_events` e a RPC existente `nexodent_add_lab_payment_event`. Nenhum novo esquema ou política foi criado. As RLS/RPCs no Supabase devem validar clínica, usuário e permissões, além de impedir pagamentos acima do saldo e escritas concorrentes indevidas. O código da RPC de pagamentos não consta neste checkout: seus controles no projeto real não foram verificados nesta alteração.

Se uma fonte financeira falha ou está ausente, os totais ficam indisponíveis, em vez de mostrar valores pagos fictícios iguais a zero. As consultas são paginadas, com limite de segurança de 20 mil registros por fonte; atingido o limite, o fechamento é bloqueado. Os custos exibidos são os valores cadastrados, não uma conferência de faturas do fornecedor. Não existe vencimento financeiro separado da data de entrega nesta versão.

## Validação

Testes de cálculo: abertura/legado não duplicados, parcelas, pacientes únicos, custos ausentes, excesso e saldos separados por laboratório. Teste de navegador: pagamento parcial sem duplo clique, consulta sem escrita, erro sem total fictício, 1.201 trabalhos, troca de clínica e limpeza na saída. Foram usados dados sintéticos; nenhum pagamento real foi registrado pelo agente.
