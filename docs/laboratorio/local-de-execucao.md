# Local de execução dos trabalhos

A equipe escolhe “Laboratório externo” ou “Na clínica” ao cadastrar ou editar um trabalho. O local aparece no cartão, na consulta compartilhada e no CSV, com filtro próprio. A seleção não conclui procedimentos clínicos e não registra pagamentos.

A versão atual usa o histórico JSON já existente em `nexodent_lab_orders`: cada salvamento inclui `execution_location: "laboratory" | "clinic"` no evento de atualização. Eventos posteriores de etapa e comentários preservam a última seleção. Não há nova coluna ou migration a executar. O campo derivado no espelho `NexoLabRead.orders` é de consulta; não deve ser enviado como coluna nova à API.

Trabalhos antigos com laboratório identificado continuam como externos; “Na clínica” identifica execução interna e “A definir” permanece sem local escolhido até a equipe editar. O fluxo interno usa as mesmas etapas existentes, retirando envio ao laboratório e recebimento externo. Não são criadas datas fictícias de envio/recebimento.

O valor financeiro continua representando o valor a pagar ao laboratório, independentemente do local físico. Por exemplo, um prestador externo pode executar o trabalho na clínica. Alterar o local mantém os custos e pagamentos existentes. Trabalhos internos sem valor externo nem pagamentos não aparecem como contas pendentes; valores positivos e qualquer pagamento já registrado continuam visíveis para conferência. Custos internos de produção não são convertidos automaticamente em obrigações de laboratório.
