const test=require('node:test');
const assert=require('node:assert/strict');
const {prepare}=require('../assets/js/features/budget-billing');
const input={id:'draft-1',amountCents:10001,method:'credit_card',dueDate:'2026-01-31',installments:3};
test('distribui centavos e preserva vencimentos no fim do mês',()=>{
 const draft=prepare(input);
 assert.deepEqual(draft.schedule.map(s=>s.amountCents),[3334,3334,3333]);
 assert.deepEqual(draft.schedule.map(s=>s.dueDate),['2026-01-31','2026-02-28','2026-03-31']);
 assert.equal(draft.status,'awaiting_integration');assert.equal(draft.providerChargeId,null);assert.equal(draft.pix,null);assert.equal(draft.checkoutUrl,null);
});
test('Pix e débito são preparados à vista sem simular emissão',()=>{
 for(const method of ['pix','debit_card']){
  const draft=prepare({...input,method,installments:1});assert.equal(draft.schedule[0].amountCents,10001);assert.equal(draft.status,'awaiting_integration');
  assert.throws(()=>prepare({...input,method}),/apenas para cartão/);
 }
});
test('recusa valores e datas inválidos',()=>{
 for(const amountCents of [0,-1,1.5,NaN,Infinity])assert.throws(()=>prepare({...input,amountCents}));
 for(const dueDate of ['2026-02-30','','31/01/2026'])assert.throws(()=>prepare({...input,dueDate}));
 for(const installments of [0,61,1.5])assert.throws(()=>prepare({...input,installments}));
 assert.throws(()=>prepare({...input,method:'cash'}));
});
test('API fecha emissão enquanto não houver integração',async()=>{
 const handler=require('../api/budget-charge');let status,body;
 const response={setHeader(){},status(n){status=n;return this},json(v){body=v;return this}};
 await handler({method:'POST',body:{status:'paid'}},response);assert.equal(status,503);assert.equal(body.code,'PAYMENTS_NOT_CONFIGURED');
 await handler({method:'GET'},response);assert.equal(status,405);
});
