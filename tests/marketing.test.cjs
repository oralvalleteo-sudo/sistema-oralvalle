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
test('origin filters include legacy links, independent payment dates and budgets without attribution',()=>{
 const data=prepare({
  leads:[
   {id:'meta',created_at:'2026-10-01',source:'Meta',notes:'[NEXODENT_BUDGET:meta%20budget]'},
   {id:'google',created_at:'2026-11-01',source:' Google  -  Ads ',budget_id:'google-budget'},
   {id:'imported',created_at:'2026-10-02',source:'Outros',budget_id:'meta budget'}
  ],
  budgets:[
   row('meta budget','p1',{status:'Aprovado',data:'02/10/2026'}),
   row('google-budget','p2',{status:'Aprovado',data:'03/11/2026'}),
   row('direct','p3',{status:'Aprovado',data:'05/11/2026'})
  ],
  budget_items:[
   row('i1','meta budget',{valor:600,vid:'s1'}),
   row('i2','google-budget',{valor:500,vid:'s2'}),
   row('i3','direct',{valor:300,vid:'s3'})
  ],
  sales:[row('sale-1',null,{id:'s1'}),row('sale-2',null,{id:'s2'}),row('sale-3',null,{id:'s3'})],
  receipts:[
   row('r1','sale-1',{valor:250,data:'04/11/2026'}),
   row('r2','sale-2',{valor:100,data:'2026-11-04'}),
   row('r3','sale-3',{valor:300,data:'2026-11-05'})
  ],
  expenses:[
   {category:'Marketing',description:'Campanha Meta Ads',paid_at:'2026-11-01',amount:50},
   {category:'Publicidade',supplier:'Google',paid_at:'2026-11-01',amount:25}
  ]
 });
 const totals=source=>calculate(data,{year:2026,month:'11',source});
 assert.equal(totals('meta').received,25000);
 assert.equal(totals('meta').contracted,0);
 assert.equal(totals('meta').investment,5000);
 assert.equal(totals('google').contracted,50000);
 assert.equal(totals('google').investment,2500);
 assert.equal(totals('Orçamento').contracted,30000);
 assert.equal(totals('Orçamento').received,30000);
 assert.equal(totals('Orçamento').roas,null);
 assert.equal(totals('').roas,35000/7500);
});

test('recebimentos de todas as origens fecham com o total, incluindo orçamentos sem origem',()=>{
 const data=prepare({
  leads:[
   {id:'g',source:' Google   - Ads ',created_at:'2026-10-01',budget_id:'b1'},
   {id:'p',source:'Parceria - Local',created_at:'2026-10-01',budget_id:'b2'}
  ],
  budgets:['b1','b2','b3'].map(id=>row(id,id,{status:'Aprovado',data:'2026-10-01'})),
  budget_items:['b1','b2','b3'].map(id=>row('i'+id,id,{valor:200,vid:id})),
  sales:['b1','b2','b3'].map(id=>row('s'+id,null,{id})),
  receipts:['b1','b2','b3'].map((id,index)=>row('r'+id,'s'+id,{valor:index+90,data:'2026-11-01'}))
 });
 const period={year:2026,month:'11'}, breakdown=[];
 const all=calculate(data,period,[],breakdown);
 assert.equal(all.received,27300);
 assert.deepEqual(breakdown.map(row=>row.key),['google ads','parceria local','orcamento']);
 assert.equal(breakdown.reduce((sum,row)=>sum+row.received,0),all.received);
 for(const row of breakdown)assert.equal(calculate(data,{...period,source:row.key}).received,row.received);
});
