CREATE OR REPLACE FUNCTION public.nexodent_complete_lab_with_payment(
  p_clinic uuid, p_order_id uuid, p_revision timestamptz, p_reference date,
  p_amount numeric, p_paid_at date, p_method text, p_laboratory text
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  job public.nexodent_lab_orders%ROWTYPE;
  entry jsonb;
  lab text := trim(coalesce(p_laboratory, ''));
  today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF p_reference IS NULL OR p_reference > today OR p_paid_at IS NULL OR p_paid_at > today
    OR p_amount IS NULL OR p_amount NOT BETWEEN 0.01 AND 999999999999.99
    OR round(p_amount, 2) <> p_amount
    OR p_method IS NULL OR p_method NOT IN ('Pix','Dinheiro','Transferência','Cartão','Boleto','Outro')
    OR char_length(lab) NOT BETWEEN 1 AND 160 OR lower(lab) IN ('a definir','na clínica','na clinica')
  THEN
    RAISE EXCEPTION 'Confira laboratório, datas, valor e forma de pagamento.';
  END IF;

  SELECT * INTO job FROM public.nexodent_lab_orders
  WHERE clinic_id = p_clinic AND id = p_order_id FOR UPDATE;

  IF NOT FOUND OR job.status IN ('Entregue','Cancelado') OR job.updated_at IS DISTINCT FROM p_revision THEN
    RAISE EXCEPTION 'O trabalho mudou ou já foi baixado. Atualize a lista antes de tentar novamente.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.nexodent_lab_payment_events e
    WHERE e.clinic_id = p_clinic AND e.source_order_id::text = p_order_id::text
      AND e.paid_at = p_paid_at AND e.amount = p_amount
  ) THEN
    RAISE EXCEPTION 'Já existe pagamento com esse valor e data. Confira o histórico em Contas dos laboratórios.';
  END IF;

  entry := jsonb_build_object('at', now(), 'text',
    'Baixa retroativa. Data de referência: ' || p_reference::text ||
    CASE WHEN job.received_at IS NOT NULL AND job.received_at <> p_reference
      THEN ' • Recebimento registrado anteriormente: ' || job.received_at::text ELSE '' END);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(job.history, '[]'::jsonb)) AS h
      WHERE h->>'execution_location' IN ('clinic','laboratory'))
    AND lower(trim(coalesce(job.laboratory,''))) IN ('na clínica','na clinica') THEN
    entry := entry || jsonb_build_object('execution_location', 'clinic');
  END IF;

  UPDATE public.nexodent_lab_orders SET
    stage = 'Entregue ao paciente', status = 'Entregue', received_at = p_reference,
    laboratory = lab,
    laboratory_cost = CASE WHEN coalesce(job.laboratory_cost, 0) = 0 THEN p_amount ELSE job.laboratory_cost END,
    history = coalesce(job.history,'[]'::jsonb) || jsonb_build_array(entry), updated_at = now()
  WHERE clinic_id = p_clinic AND id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sem permissão para atualizar o trabalho.'; END IF;

  -- A RPC existente aplica as permissões financeiras e confere o saldo.
  -- Literais tipados pela assinatura instalada permitem o ID legado em texto ou UUID.
  EXECUTE format(
    'SELECT public.nexodent_add_lab_payment_event(p_clinic => %L, p_order_id => %L, p_amount => %L, p_paid_at => %L, p_method => %L)',
    p_clinic, p_order_id, p_amount, p_paid_at, p_method);
END;
$$;
REVOKE ALL ON FUNCTION public.nexodent_complete_lab_with_payment(uuid,uuid,timestamptz,date,numeric,date,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nexodent_complete_lab_with_payment(uuid,uuid,timestamptz,date,numeric,date,text,text) TO authenticated;
