/* Fluxo por pagamentos efetivos, sem alterar as fontes clínicas. Valores em centavos. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NexoCashModel=api;})(typeof window==='undefined'?globalThis:window,()=>{
 const numeric=v=>Number(typeof v==='string'&&v.includes(',')?v.replace(/\./g,'').replace(',','.'):v);
 const cents=v=>{const n=numeric(v);return Number.isFinite(n)&&n>0?Math.round(n*100):0};
 const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(new Date(d+'T12:00:00Z').getTime())&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 function calculate({sales=[],commissions=[],lab=[],expenses=[],from,to}){
  const warnings=[],all=[],seen=new Set();let openings=0;
  function amount(v,ref){const n=numeric(v);if(!Number.isFinite(n)||n<0)warnings.push('Valor inválido: '+ref);return cents(v);}
  function add(row){if(seen.has(row.id))return;seen.add(row.id);if(!row.cents)return;if(!validDate(row.date)){warnings.push('Pagamento sem data válida: '+row.id);return;}all.push(row)}
  for(const sale of sales)for(const [i,p] of (Array.isArray(sale.pg)?sale.pg:[]).entries())add({id:'IN-'+sale.id+'-'+(p.id||i),date:p.data,cents:amount(p.valor,'Recebimento '+sale.id),direction:1,source:'Paciente',description:sale.proc||'Recebimento de paciente'});
  for(const p of commissions)add({id:'CP-'+p.id,date:p.data,cents:amount(p.valor,'CP-'+p.id),direction:-1,source:'Dentista',description:p.obs||'Repasse pago ao dentista'});
  for(const p of lab){if(p.kind==='opening'){openings++;continue;}add({id:'LABPAY-'+p.id,date:p.paid_at,cents:amount(p.amount,'LABPAY-'+p.id),direction:-1,source:'Laboratório',description:'Pagamento ao laboratório · '+(p.source_order_id||'')})}
  const auto=new Map(all.filter(x=>x.direction<0).map(x=>[x.id,x])),refs=new Map();
  for(const e of expenses)if(e.external_reference){const ref=String(e.external_reference);refs.set(ref,(refs.get(ref)||0)+1)}
  for(const e of expenses){amount(e.amount,'EXP-'+e.id);if(!e.paid_at)continue;const ref=String(e.external_reference||''),match=auto.get(ref),value=cents(e.amount);
   if(match&&value===match.cents&&refs.get(ref)===1){if(e.paid_at!==match.date)warnings.push('Datas diferentes no vínculo '+ref+'; considerada a data do pagamento original.');continue;}
   if(ref)warnings.push('Confira o vínculo '+ref+': origem indisponível, repetida ou valor divergente.');
   add({id:'EXP-'+e.id,date:e.paid_at,cents:value,direction:-1,source:'Despesa manual',description:(e.category||'Outros')+' · '+e.description});
  }
  const rows=all.filter(x=>x.date>=from&&x.date<=to).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id)),income=rows.filter(x=>x.direction>0).reduce((s,x)=>s+x.cents,0),outcome=rows.filter(x=>x.direction<0).reduce((s,x)=>s+x.cents,0);
  const pending=expenses.filter(e=>!e.paid_at&&validDate(e.due_date)&&e.due_date<=to);
  return {rows,income,outcome,balance:income-outcome,pending:pending.reduce((s,e)=>s+cents(e.amount),0),warnings:[...new Set(warnings)],openings};
 }
 return {calculate,cents,validDate};
});
