const test=require('node:test'),assert=require('node:assert/strict');
const {calculate,group}=require('../assets/js/features/lab-payables.js');
test('contas laboratoriais contam abertura uma vez, parcelas e saldo por trabalho sem compensar excesso',()=>{
 const rows=calculate([{id:'a',patient_id:'p',laboratory:'Lab A',laboratory_cost:100,status:'Entregue'},{id:'b',patient_id:'p',laboratory:'Lab A',laboratory_cost:200},{id:'c',patient_id:'q',laboratory:'Lab B',laboratory_cost:50,status:'Cancelado'},{id:'d',patient_id:'r',laboratory:'Lab A',laboratory_cost:0}], [{source_order_id:'a',paid_amount:30}], [{source_order_id:'a',amount:30,kind:'opening'},{source_order_id:'a',amount:20,kind:'payment'},{source_order_id:'b',amount:220,kind:'payment'},{source_order_id:'c',amount:10,kind:'payment'}]);
 assert.equal(rows[0].paid,5000);assert.equal(rows[0].balance,5000);assert.equal(rows[1].balance,0);assert.equal(rows[1].excess,2000);assert.equal(rows[2].canceled,true);
 const labs=group(rows);assert.equal(labs.length,1);assert.equal(labs[0].patients.size,2);assert.equal(labs[0].works,3);assert.equal(labs[0].cost,30000);assert.equal(labs[0].paid,27000);assert.equal(labs[0].balance,5000);assert.equal(labs[0].unpriced,1);
});
test('laboratórios não misturam saldos; valores inválidos não viram zero',()=>{
 const rows=calculate([{id:'a',patient_id:'p',laboratory:'Lab A',laboratory_cost:'0.30'},{id:'b',patient_id:'q',laboratory:'Lab B',laboratory_cost:'100'}],[],[{source_order_id:'a',amount:'0.10',kind:'payment'},{source_order_id:'a',amount:'0.20',kind:'payment'}]);assert.equal(rows[0].balance,0);assert.equal(group(rows)[1].balance,10000);
 assert.throws(()=>calculate([{id:'bad',laboratory_cost:'corrompido'}],[],[]),/inválido/);assert.throws(()=>calculate([{id:'a'}],[],[{source_order_id:'a',amount:-10}]),/inválido/);
});
