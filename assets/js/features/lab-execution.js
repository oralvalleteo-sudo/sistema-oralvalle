/* Local de execução compatível com o histórico JSON já compartilhado pelo laboratório. */
(function(root){
'use strict';
const values=['laboratory','clinic'];
function get(order){
 if(values.includes(order?.execution_location))return order.execution_location;
 const history=Array.isArray(order?.history)?order.history:[];
 for(let i=history.length-1;i>=0;i--)if(values.includes(history[i]?.execution_location))return history[i].execution_location;
 const name=String(order?.laboratory||'').trim().toLocaleLowerCase('pt-BR');
 if(name==='na clínica'||name==='na clinica')return 'clinic';
 return name&&name!=='a definir'?'laboratory':'';
}
const label=location=>location==='clinic'?'Na clínica':location==='laboratory'?'Laboratório externo':'A definir';
const stages=(all,location)=>location==='clinic'?all.filter(stage=>!['Enviado ao laboratório','Recebido na clínica'].includes(stage)):all.slice();
const states=(all,location)=>location==='clinic'?all.filter(state=>!['Aguardando laboratório','Recebido'].includes(state)):all.slice();
const api={get,label,stages,states,valid:value=>values.includes(value)};
if(typeof module==='object'&&module.exports)module.exports=api;else root.NexoLabExecution=api;
})(typeof window!=='undefined'?window:globalThis);
