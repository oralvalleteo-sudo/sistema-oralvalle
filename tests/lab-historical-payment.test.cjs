const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('historical completion records the payment atomically and rolls back on rejection', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE TABLE nexodent_lab_orders (
        clinic_id uuid, id uuid PRIMARY KEY, status text, stage text, received_at date,
        laboratory text, laboratory_cost numeric, history jsonb, updated_at timestamptz
      );
      CREATE TABLE nexodent_lab_payment_events (
        clinic_id uuid, source_order_id text, paid_at date, amount numeric
      );
      CREATE FUNCTION nexodent_add_lab_payment_event(
        p_clinic uuid,p_order_id text,p_amount numeric,p_paid_at date,p_method text
      ) RETURNS void LANGUAGE plpgsql AS $$
      BEGIN
        IF p_method = 'Outro' THEN RAISE EXCEPTION 'Pagamento recusado'; END IF;
        INSERT INTO public.nexodent_lab_payment_events VALUES(p_clinic,p_order_id,p_paid_at,p_amount);
      END;
      $$;
      GRANT SELECT, UPDATE ON nexodent_lab_orders TO authenticated;
      GRANT SELECT, INSERT ON nexodent_lab_payment_events TO authenticated;
    `);
    await db.exec(fs.readFileSync('supabase/migrations/202611240025_lab_historical_payment.sql','utf8'));
    const clinic='11111111-1111-4111-8111-111111111111', order='22222222-2222-4222-8222-222222222222';
    const revision='2025-10-01T12:00:00Z';
    await db.query("INSERT INTO nexodent_lab_orders VALUES ($1,$2,'Pendente','Planejamento',null,'A definir',0,'[]',$3)",[clinic,order,revision]);
    await db.exec('SET ROLE authenticated');
    const complete=method=>db.query("SELECT nexodent_complete_lab_with_payment($1,$2,$3,'2025-10-08',150,'2025-09-30',$4,'Lab Exemplo')",[clinic,order,revision,method]);
    await assert.rejects(complete('Outro'),/Pagamento recusado/);
    assert.equal((await db.query('SELECT status,laboratory_cost FROM nexodent_lab_orders')).rows[0].status,'Pendente');
    assert.equal((await db.query('SELECT * FROM nexodent_lab_payment_events')).rows.length,0);
    await complete('Pix');
    const job=(await db.query('SELECT status,received_at::text AS date,laboratory_cost FROM nexodent_lab_orders')).rows[0];
    assert.deepEqual(job,{status:'Entregue',date:'2025-10-08',laboratory_cost:'150'});
    await assert.rejects(complete('Pix'),/já foi baixado/);
    const events=(await db.query('SELECT paid_at::text AS date,amount FROM nexodent_lab_payment_events')).rows;
    assert.deepEqual(events,[{date:'2025-09-30',amount:'150'}]);
  } finally { await db.close(); }
});
