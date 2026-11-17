/* Projeção visual dos registros existentes; não grava nem conclui procedimentos. */
(function(root){
'use strict';
const normal=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function teeth(value){return [...new Set(String(value||'').match(/\b(?:[1-4][1-8]|[5-8][1-5])\b/g)||[])];}
function toolFor(value){const text=normal(value);if(/exodont|extrac/.test(text))return 'extracao';if(/restaur/.test(text))return 'restauracao';if(/endodont|canal/.test(text))return 'canal';if(/implante/.test(text))return 'implante';if(/coroa|protese|onlay|inlay|faceta/.test(text))return 'coroa';if(/selante/.test(text))return 'selante';return 'outros';}
function recordsFor(patient){
 const p=patient||{},treatments=Array.isArray(p.trat)?p.trat:[],budgets=Array.isArray(p.orcs)?p.orcs:[],records={};
 function add(item,status,key){if(!item||item.status==='Cancelado')return;const proc=String(item.proc||'').trim();if(!proc)return;for(const tooth of teeth(item.dente)){(records[tooth]||=[]).push({id:key+':'+tooth,tool:toolFor(proc),surface:'',status,price:0,procedureName:proc,linked:true});}}
 treatments.forEach((t,index)=>{const o=budgets.find(o=>String(o.id)===String(t.oid));const done=Boolean(t.vid)||t.status==='Concluído';if(!done&&o?.status==='Recusado')return;const item=o?.itens?.find(i=>(t.oiid&&String(i.id)===String(t.oiid))||(i.tid&&String(i.tid)===String(t.id)));const visual=!done&&item?{...t,proc:item.proc||t.proc,dente:item.dente??t.dente}:t;add(visual,done?'finalizado':o&&o.status!=='Aprovado'?'proposta':'a_realizar','t:'+String(t.id??index));});
 budgets.filter(o=>o.status!=='Recusado').forEach((o,index)=>{(o.itens||[]).forEach((item,i)=>{const linked=treatments.some(t=>(item.tid&&String(t.id)===String(item.tid))||(t.oiid&&String(t.oiid)===String(item.id)&&String(t.oid)===String(o.id)));if(linked)return;add(item,item.vid||item.status==='Concluído'?'finalizado':o.status==='Aprovado'?'a_realizar':'proposta','o:'+String(o.id??index)+':'+String(item.id??i));});});
 return records;
}
const api={recordsFor,teeth,toolFor};if(typeof module==='object'&&module.exports)module.exports=api;else root.NexoOdontogramBudget=api;
})(typeof window!=='undefined'?window:globalThis);
