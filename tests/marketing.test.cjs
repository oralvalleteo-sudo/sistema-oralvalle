const test=require('node:test');
const assert=require('node:assert/strict');
const {prepare,calculate}=require('../crm/js/marketing-model.js');
const row=(id,parent_id,dados)=>({id,parent_id,dados,kind:'object'});
test('marketing attributes approved budgets and actual receipts once and separates unassigned spend',()=>{
 const data=prepare({
  leads:[
   {id:'1',created_at:'2026-11-02',source:'Google Ads',budget_id:'b'},
   {id:'2',created_at:'2026-11-05',source:'Instagram',budget_id:'b',stage:'Fechado'},
   {id:'3',created_at:'2026-11-06',source:'Google Ads',budget_id:'d'},
   {id:'4',created_at:'2026-12-01T02:00:00Z',source:'Google Ads'}
  ],
  budgets:[row('b','patient',{status:'Aprovado',desc:'50,00'}),row('d','other',{status:'Aprovado',archivedAt:'2026-11-10'})],
  budget_items:[row('a','b',{valor:600,paymentSaleId:'sale'}),row('b2','b',{valor:450,vid:'sale'})],
  sales:[row('physical-sale',null,{id:'sale'})],
  receipts:[row('r1','physical-sale',{valor:400,data:'2026-11-06'}),row('r2','physical-sale',{valor:250,data:'2026-12-06'})],
  expenses:[
   {category:'Marketing — Google Ads',paid_at:'2026-11-01',amount:100},
   {category:'Marketing',paid_at:'2026-11-01',amount:50},
   {category:'Google Ads',paid_at:null,amount:999},
   {category:'Google Ads',paid_at:'2026-11-01',voided_at:'2026-11-02',amount:999}
  ]
 });
 assert.deepEqual(calculate(data,{year:2026,month:'11',source:'google ads'}),{
  leads:3,converted:1,investment:10000,contracted:100000,received:40000,conversion:1/3,
  costLead:10000/3,costPatient:10000,roas:4,roi:3,unlinkedClosed:0
 });
 const all=calculate(data,{year:2026});
 assert.equal(all.leads,4);
 assert.equal(all.investment,15000);
 assert.equal(all.received,65000);
 assert.equal(all.unlinkedClosed,1);
});
test('missing permissions and malformed values stay unavailable instead of producing a zero return',()=>{
 const data=prepare({leads:[{created_at:'2026-11-01',source:'Indicação'}],budgets:[],budget_items:[],expenses:[
  {category:'Publicidade',paid_at:'2026-11-01',amount:'inválido'}
 ]});
 const totals=calculate(data,{year:2026});
 assert.equal(totals.leads,1);
 assert.equal(totals.investment,null);
 assert.equal(totals.received,null);
 assert.equal(totals.roas,null);
});
