const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(accepted=true){
 const o={id:'o1',data:'17/11/2026',status:'Aprovado',itens:[{id:'i1',vid:'v1'},{id:'i2',vid:'v2'},{id:'i3'}]};
 const p={id:'p1',orcs:[o],trat:[{id:'t1',oid:'o1',oiid:'i1',vid:'v1',status:'Concluído',rep:15,data:'2026-11-17'}],evol:[{id:'e1',vid:'v1',auto:true,txt:'Evolução assinada',signature:'preservar'}]};
 const db={p:[p,{id:'p2',orcs:[]}],ag:[{id:'a1',vid:'v1',st:'Compareceu'},{id:'a2',vid:'other',st:'Compareceu'}],vd:[
 {id:'v1',pid:'p1',valor:150,rep:15,pg:[{id:'pg1',valor:100,taxaValor:2},{id:'pg2',valor:50}],plano:[{id:'par1',pgid:'pg1'}]},
 {id:'v2',pid:'p1',valor:170,rep:17,pg:[{id:'pg3',valor:70}]},
 {id:'other',pid:'p1',valor:50,pg:[{id:'pg4',valor:50}]}]};
 let saves=0,renders=0,prompt='',serial=0;
 const ctx=vm.createContext({window:{addEventListener(){}},document:{addEventListener(){}},db,ME:{id:'u1',nome:'Recepção'},view:{},uid:()=> 'new-'+(++serial),tdy:()=> '2026-11-17',getO:(p,id)=>p.orcs.find(o=>o.id===id),
 num:Number,r2:n=>Math.round(n*100)/100,brl:n=>'R$ '+n,recebido:v=>v.pg.reduce((s,x)=>s+x.valor,0),
 confirm:s=>{prompt=s;return accepted},toast(){},save(){saves++},render(){renders++}});
 vm.runInContext(fs.readFileSync('assets/js/features/actions.js','utf8'),ctx);
 return {ctx,db,p,o,run:()=>vm.runInContext("A.obundoall(null,{o:'o1'},db.p[0])",ctx),saves:()=>saves,renders:()=>renders,prompt:()=>prompt};
}
test('desfaz orçamento inteiro, preservando outros lançamentos e histórico clínico',()=>{
 const s=setup(),original=JSON.stringify(s.db.vd.slice(0,2)),evol=JSON.stringify(s.p.evol[0]);
 s.run();
 assert.deepEqual(s.db.vd.map(v=>v.id),['other']);
 assert.ok(s.o.itens.every(i=>!i.vid));
 assert.equal(s.p.trat[0].status,'Pendente');assert.equal(s.p.trat[0].rep,0);assert.equal(s.p.trat[0].vid,null);
 assert.equal(s.db.ag[0].st,'Confirmado');assert.equal(s.db.ag[0].vid,undefined);assert.equal(s.db.ag[1].vid,'other');
 assert.equal(JSON.stringify(s.p.evol[0]),evol);assert.equal(s.p.evol.length,2);
 assert.equal(JSON.stringify(s.o.baixasDesfeitas[0].vendas),original);
 assert.equal(s.o.baixasDesfeitas[0].usuario,'Recepção');assert.equal(s.o.baixasDesfeitas[0].recebido,220);
 assert.match(s.prompt(),/3 recebimento/);assert.match(s.prompt(),/R\$ 220/);
 assert.equal(s.saves(),1);assert.equal(s.renders(),1);
 s.run();assert.equal(s.saves(),1);assert.equal(s.o.baixasDesfeitas.length,1);
});
test('cancelar não altera nenhum dado',()=>{
 const s=setup(false),before=JSON.stringify(s.db);s.run();assert.equal(JSON.stringify(s.db),before);assert.equal(s.saves(),0);
});
test('vínculos ausentes, repetidos, de outro paciente ou compartilhados não geram alterações parciais',()=>{
 for(const mutate of [
  s=>s.db.vd.shift(),
  s=>s.o.itens[1].vid='v1',
  s=>s.db.vd[0].pid='p2',
  s=>s.db.p[1].orcs.push({id:'o2',itens:[{vid:'v1'}]}),
  s=>s.p.trat.push({oid:'outro',vid:'v1'})
 ]){
  const s=setup();mutate(s);const before=JSON.stringify(s.db);s.run();assert.equal(JSON.stringify(s.db),before);assert.equal(s.saves(),0);
 }
});
test('exibe ação apenas quando existem baixas e mantém o histórico após desfazer',()=>{
 const s=setup();s.ctx.esc=x=>String(x);vm.runInContext(fs.readFileSync('assets/js/features/patients.js','utf8'),s.ctx);
 assert.match(vm.runInContext('obUndoHtml(db.p[0].orcs[0])',s.ctx),/data-act="obundoall"/);
 s.run();const html=vm.runInContext('obUndoHtml(db.p[0].orcs[0])',s.ctx);
 assert.doesNotMatch(html,/data-act="obundoall"/);assert.match(html,/Histórico de baixas desfeitas/);
});
