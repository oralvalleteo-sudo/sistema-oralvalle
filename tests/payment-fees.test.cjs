const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(db={},admin=false){let saves=0;const inputs=[];const ctx=vm.createContext({db,ME:{admin},document:{addEventListener(){},querySelectorAll(){return inputs}},window:{},r2:n=>Math.round(n*100)/100,num:Number,uid:()=> 'receipt-test',save(){saves++},toast(){},render(){}});vm.runInContext(fs.readFileSync('assets/js/payment-fees.js','utf8'),ctx);return {ctx,db,inputs,saves:()=>saves,run:s=>vm.runInContext(s,ctx)}}
test('consultar taxas e criar recebimentos não cria nem modifica configurações administrativas',()=>{
 for(const rates of [undefined,null,[],{Pix:2.5}]){const initial=rates===undefined?{}:{taxasPagamento:rates};const before=JSON.stringify(initial),s=setup(initial);s.run("ovFeePct('Pix')");const p=s.run("ovFeeMake(100,'Pix','2026-11-16')");assert.equal(p.taxaValor,rates?.Pix===2.5?2.5:0);assert.equal(JSON.stringify(initial),before);assert.equal(s.saves(),0)}
});
test('apenas administrador salva taxas e valida tudo antes de alterar os dados',()=>{
 const s=setup({taxasPagamento:{Pix:2}},false);s.inputs.push({value:'3',dataset:{feeRate:'Pix'}});s.run('ovFeeSaveAction()');s.run('ovFinanceSaveAction()');assert.equal(s.db.taxasPagamento.Pix,2);assert.equal(s.saves(),0);
 const a=setup({taxasPagamento:{Pix:2}},true);a.inputs.push({value:'3',dataset:{feeRate:'Pix'}},{value:'101',dataset:{feeRate:'Débito'}});a.run('ovFeeSaveAction()');assert.equal(a.db.taxasPagamento.Pix,2);assert.equal(a.saves(),0);a.inputs[1].value='1';a.run('ovFeeSaveAction()');assert.equal(a.db.taxasPagamento.Pix,3);assert.equal(a.db.taxasPagamento['Débito'],1);assert.equal(a.saves(),1);
});

test('taxas históricas com percentual conhecido são recuperadas e valores ausentes são sinalizados',()=>{
 const s=setup({taxasPagamento:{Pix:'1,5','Débito':2,'Crédito à vista':3,'Crédito 3x':4}});
 assert.equal(s.run("ovFeeMake(100,'PIX','2026-11-16').taxaValor"),1.5);
 assert.equal(s.run("ovFeeMake(100,'Cartão de débito','2026-11-16').taxaValor"),2);
 assert.equal(s.run("ovFeeMake(100,'Cartão de crédito 3 parcelas','2026-11-16').taxaValor"),4);
 assert.equal(s.run("ovFeeMake(100,'Crédito parcelado','2026-11-16').taxaOrigem"),'sem_configuracao');
 assert.equal(s.run("ovFeeTax({valor:100,taxaPct:'2,5',taxaValor:0})"),2.5);
 assert.equal(s.run("ovFeeNeedsReview({forma:'Pix',valor:100,taxaValor:0})"),true);
 assert.equal(s.run("ovFeeNeedsReview(ovFeeMake(100,'Pix','2026-11-16',null,0))"),false);
});
