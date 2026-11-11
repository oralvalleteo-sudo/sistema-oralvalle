# Estrutura de cobrança de orçamentos

Na ficha do paciente, abra Orçamentos e expanda uma proposta. A seção “Cobrança por Pix ou cartão” permite preparar a entrada e o saldo como registros separados, informar vencimento e planejar parcelas de crédito. Os centavos são distribuídos sem alterar o valor total. A soma preparada não pode ultrapassar o orçamento. Remover uma preparação permite refazer valores antes da emissão.

Os registros `billingDrafts` pertencem ao orçamento e seguem sua persistência existente, inclusive no Supabase (atributos JSONB). Não são vendas, pagamentos, cobranças emitidas ou reservas no provedor. O status inicial é `awaiting_integration`. Não há QR fictício, baixa automática ou solicitação de dados do cartão. As datas e parcelas representam planejamento; regras e taxas dependerão do serviço contratado.

`POST /api/budget-charge` retorna 503 `PAYMENTS_NOT_CONFIGURED`. Este endpoint não chama provedores e não aceita emissão real. Hospedagem apenas estática não executa APIs Node.

## Contrato para a futura integração

- Entrada do servidor: ID da clínica, paciente, orçamento e preparação; chave de idempotência. Verificar JWT, vínculo, permissão financeira e valores autoritativos no banco. Não confiar em valor/status enviados pelo navegador.
- Adaptador do provedor: criar/consultar/cancelar cobrança. Valores em centavos, BRL, método `pix`, `credit_card` ou `debit_card`. Débito depende do suporte do provedor.
- Resposta Pix: ID externo, status, payload copia e cola, imagem QR e expiração fornecidos pelo provedor. Cartão: URL HTTPS de checkout hospedado. Não coletar PAN/CVV na aplicação.
- Persistência de emissão: transação com chave única por clínica e idempotência, reserva do valor e tratamento de timeout sem duplicar cobrança. Preparações atuais não garantem exclusividade entre aparelhos.
- Webhook: assinatura/autenticidade, deduplicação do evento e reconciliação por consulta ao provedor. Estados: awaiting_integration → pending → paid/expired/cancelled; refund deve ter histórico próprio. Nunca baixar pelo retorno do navegador. Vincular o recebimento ao financeiro existente uma única vez, sem duplicar vendas nem comissões.
- Segredos apenas no servidor, por clínica, via configuração segura. Configurar URLs de retorno/webhook e validar em sandbox antes da produção.

Sem provedor contratado, esta entrega permite preparar e salvar condições; não emite Pix, link ou cobrança e não confirma pagamentos.
