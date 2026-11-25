/* Fluxo por pagamentos efetivos, sem alterar as fontes clínicas. Valores em centavos. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NexoCashModel=api;})(typeof window==='undefined'?globalThis:window,()=>{
 const numeric=v=>Number(typeof v==='string'&&v.includes(',')?v.replace(/\./g,'').replace(',','.'):v);
 const cents=v=>{const n=numeric(v);return Number.isFinite(n)&&n>0?Math.round(n*100):0};
 const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(new Date(d+'T12:00:00Z').getTime())&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 function referenceMonth(e,today){const raw=e.reference_month||e.created_at||e.paid_at||e.due_date||today;return String(raw||'').slice(0,7);}
 function inReference(e,from,to,today){const month=referenceMonth(e,today);return month>=from.slice(0,7)&&month<=to.slice(0,7);}
 function categoryLabel(value){
  const lower=(String(value||'').trim()||'Outros').normalize('NFC').replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
  return lower[0].toLocaleUpperCase('pt-BR')+lower.slice(1);
 }
 function categoryKey(s){return categoryLabel(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
 const isLaboratoryCategory=value=>['laboratorio','laboratorios'].includes(categoryKey(value));
 const isDentistCategory=value=>['dentista','dentistas','repasse dentista','repasse dentistas',
  'repasse ao dentista','repasse aos dentistas','repasse de dentista','repasse de dentistas',
  'repasses aos dentistas','repasses de dentistas'].includes(categoryKey(value));
 const isDentistPayment=row=>row.direction<0&&(row.source==='Dentista'||row.source==='Despesa manual'&&isDentistCategory(row.category));
 const isLabPayment=row=>row.direction<0&&(row.source==='Laboratório'||row.source==='Despesa manual'&&isLaboratoryCategory(row.category));
 function groupedCategory(label){
  const key=categoryKey(label);
  if(['salario','salarios'].includes(key))return 'Salários';
  if(isDentistCategory(label))return 'Dentista';
  if(isLaboratoryCategory(label))return 'Laboratório';
  return label;
 }
 function calculate({sales=[],commissions=[],lab=[],labAccounts=[],expenses=[],from,to,labelForCategory=categoryLabel,today=new Date().toLocaleDateString('en-CA')}){
  const labById=new Map(labAccounts.map(account=>[String(account.id),account]));
  const labDescription=account=>[account?.laboratory,account?.work_description].filter(Boolean).join(' · ');
  expenses=expenses.filter(e=>!e.voided_at);
  const warnings=[],all=[],seen=new Set();let openings=0;
  function amount(v,ref){const n=numeric(v);if(!Number.isFinite(n)||n<0)warnings.push('Valor inválido: '+ref);return cents(v);}
  function add(row){if(seen.has(row.id))return;seen.add(row.id);if(!row.cents)return;if(!validDate(row.date)){warnings.push('Pagamento sem data válida: '+row.id);return;}all.push(row)}
  for(const sale of sales)for(const [i,p] of (Array.isArray(sale.pg)?sale.pg:[]).entries())add({id:'IN-'+sale.id+'-'+(p.id||i),date:p.data,cents:amount(p.valor,'Recebimento '+sale.id),direction:1,source:'Paciente',description:sale.proc||'Recebimento de paciente'});
  for(const p of commissions)add({id:'CP-'+p.id,date:p.data,cents:amount(p.valor,'CP-'+p.id),direction:-1,source:'Dentista',description:p.obs||'Repasse pago ao dentista'});
  for(const p of lab){if(p.kind==='opening'){openings++;continue;}add({id:'LABPAY-'+p.id,date:p.paid_at,cents:amount(p.amount,'LABPAY-'+p.id),direction:-1,source:'Laboratório',description:labDescription(labById.get(String(p.source_order_id)))||'Pagamento ao laboratório · '+(p.source_order_id||'')})}
  const auto=new Map(all.filter(x=>x.direction<0).map(x=>[x.id,x])),refs=new Map(),matchedManual=new Map();
  for(const e of expenses)if(e.external_reference){const ref=String(e.external_reference);refs.set(ref,(refs.get(ref)||0)+1)}
  for(const e of expenses){amount(e.amount,'EXP-'+e.id);if(!e.paid_at)continue;const ref=String(e.external_reference||''),match=auto.get(ref),value=cents(e.amount);
   if(match&&value===match.cents&&refs.get(ref)===1){matchedManual.set(match.id,e);if(e.paid_at!==match.date)warnings.push('Datas diferentes no vínculo '+ref+'; considerada a data do pagamento original.');continue;}
   if(ref)warnings.push('Confira o vínculo '+ref+': origem indisponível, repetida ou valor divergente.');
   const category=labelForCategory(e.category);
   add({id:'EXP-'+e.id,date:e.paid_at,cents:value,direction:-1,source:'Despesa manual',category,reference_month:isLaboratoryCategory(e.category)||isDentistCategory(e.category)?null:referenceMonth(e,today),description:e.description,expense:e});
  }
  const rows=all.filter(x=>x.reference_month?(x.reference_month>=from.slice(0,7)&&x.reference_month<=to.slice(0,7)):(x.date>=from&&x.date<=to)).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id)),income=rows.filter(x=>x.direction>0).reduce((s,x)=>s+x.cents,0),outcome=rows.filter(x=>x.direction<0).reduce((s,x)=>s+x.cents,0);
  const entries=rows.filter(row=>row.direction<0).map(row=>({
   ...row,expense:row.expense||matchedManual.get(row.id),paid:true,
   month:row.reference_month||row.date.slice(0,7),category:labelForCategory(row.category||row.source)
  }));
  const pendingManual=expenses.filter(e=>!e.paid_at&&inReference(e,from,to,today));
  let undatedLabAccounts=0;
  for(const account of labAccounts){
   if(account.canceled||!account.balance)continue;
   const date=String(account.reference_date||'').slice(0,10);
   if(!validDate(date)){undatedLabAccounts++;continue;}
   if(!inReference({reference_month:date},from,to,today))continue;
   const reference='LAB-'+account.id;
   entries.push({id:reference,paid:false,source:'Laboratório',category:labelForCategory('Laboratório'),
    month:date.slice(0,7),date,description:labDescription(account)||'Trabalho de laboratório',cents:account.balance});
  }
  for(const e of pendingManual){
   entries.push({id:e.id,expense:e,paid:false,source:'Despesa manual',category:labelForCategory(e.category),
    month:referenceMonth(e,today),date:e.due_date||e.planned_paid_at||'',description:e.description,cents:cents(e.amount)});
  }
  const groupMap=new Map();
  for(const row of entries){
   const label=groupedCategory(row.category),key=categoryKey(label);
   if(!groupMap.has(key))groupMap.set(key,{key,label,paid:0,pending:0,entries:[]});
   const group=groupMap.get(key);
   group[row.paid?'paid':'pending']+=row.cents;
   group.entries.push(row);
  }
  const categories=[...groupMap.values()].map(g=>({...g,total:g.paid+g.pending})).sort((a,b)=>b.total-a.total||a.label.localeCompare(b.label,'pt-BR'));
  const pending=categories.reduce((sum,g)=>sum+g.pending,0);
  return {rows,entries,undatedLabAccounts,matchedManual,income,outcome,balance:income-outcome,categories,registered:outcome+pending,pending,warnings:[...new Set(warnings)],openings};
 }
 function billKey(e){const normal=s=>String(s||'').trim().toLowerCase();return JSON.stringify([normal(e.description).replace(/\s+/g,' '),normal(e.category),normal(e.supplier),cents(e.amount),e.due_date||null,referenceMonth(e)]);}
 function reviews(expenses,today){const groups=new Map();for(const e of expenses){if(e.voided_at||e.external_reference||e.paid_at)continue;const key=billKey(e)+JSON.stringify([e.paid_at||null,e.planned_paid_at||null,e.payment_method||null]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}return [...groups.values()].filter(g=>g.length>1).map(g=>g.sort((a,b)=>String(a.id).localeCompare(String(b.id))));}
 return {calculate,cents,isLabPayment,isLaboratoryCategory,isDentistPayment,isDentistCategory,validDate,billKey,reviews,referenceMonth,inReference,categoryKey,categoryLabel};
});
