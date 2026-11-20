(()=>{
 'use strict';
 const root=document.getElementById('crm-marketing');
 if(!root)return;
 const $=selector=>root.querySelector(selector);
 const clinicSelect=document.getElementById('clinic');
 const model=window.NexoMarketingModel;
 const cloud=window.OralCloud;
 const months=new Intl.DateTimeFormat('pt-BR',{month:'long',timeZone:'UTC'});
 const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
 const percent=new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1});
 const times=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
 const currentYear=Number(new Intl.DateTimeFormat('pt-BR',{year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date()));
 const names=new Map([['google ads','Google Ads'],['instagram','Instagram / Meta Ads'],['whatsapp','WhatsApp'],
  ['indicacao','Indicação'],['outros','Outros'],['sem origem','Sem origem identificada']]);
 const year=$('#crm-marketing-year'),month=$('#crm-marketing-month'),source=$('#crm-marketing-origin');
 month.replaceChildren(new Option('Todos os meses',''),...Array.from({length:12},(_,i)=>new Option(months.format(Date.UTC(2020,i,1)),String(i+1).padStart(2,'0'))));
 let state=null;
 function optionList(select,options,fallback){
  const previous=select.value||fallback;
  select.replaceChildren(...options.map(([key,label])=>new Option(label,key)));
  select.value=options.some(([key])=>String(key)===String(previous))?previous:fallback;
 }
 function populate(){
  const years=new Set([currentYear,currentYear-1]);
  const origins=new Map(names);
  for(const lead of state?.result?.leads||[]){
   years.add(Number(lead.day.slice(0,4)));
   if(!origins.has(lead.origin))origins.set(lead.origin,lead.source);
  }
  for(const expense of state?.result?.spending||[]){
   years.add(Number(expense.day.slice(0,4)));
   if(!origins.has(expense.origin))origins.set(expense.origin,expense.origin);
  }
  optionList(year,[...years].filter(value=>value>=1900&&value<=2099).sort((a,b)=>b-a).map(value=>[value,value]),currentYear);
  optionList(source,[['','Todas as origens'],...[...origins].sort((a,b)=>String(a[1]).localeCompare(String(b[1]),'pt-BR'))],'');
 }
 const monetary=value=>value===null?'—':currency.format(value/100);
 function draw(){
  const status=$('#crm-marketing-status'),cards=$('#crm-marketing-cards');
  if(!state?.result){cards.replaceChildren();status.textContent=state?.error||(state?.loading?'Carregando dados de marketing…':'Selecione uma clínica.');return}
  const totals=model.calculate(state.result,{year:year.value,month:month.value,source:source.value});
  const metrics=[
   ['Investimentos publicitários',monetary(totals.investment)],['Leads',totals.leads],['Pacientes convertidos',totals.converted],
   ['Valores contratados',monetary(totals.contracted)],['Pagamentos recebidos',monetary(totals.received)],
   ['Conversão de leads',totals.conversion===null?null:percent.format(totals.conversion)],
   ['Custo por lead',monetary(totals.costLead)],['Custo por paciente convertido',monetary(totals.costPatient)],
   ['Retorno sobre anúncios',totals.roas===null?null:times.format(totals.roas)+'×'],['Retorno após investimento',totals.roi===null?null:percent.format(totals.roi)]
  ];
  cards.replaceChildren(...metrics.map(([label,value])=>{
   const card=document.createElement('div'),title=document.createElement('dt'),amount=document.createElement('dd');
   title.textContent=label;amount.textContent=value??'—';card.append(title,amount);return card;
  }));
  const notes=[...state.warnings];
  if(state.loading)notes.unshift('Atualizando dados de marketing…');
  if(totals.unlinkedClosed)notes.push(totals.unlinkedClosed+' lead(s) fechado(s) sem orçamento aprovado atribuído.');
  status.textContent=notes.join(' ');
 }
 async function list(table,clinic,fields,extra=''){
  const rows=[];
  for(let offset=0;offset<20000;offset+=500){
   const query=await cloud.request('/rest/v1/'+table+'?clinic_id=eq.'+encodeURIComponent(clinic)+'&select='+fields+'&order=id.asc&limit=500&offset='+offset+extra);
   if(!Array.isArray(query))throw Error('Resposta incompleta.');
   rows.push(...query);
   if(query.length<500)return rows;
  }
  throw Error('A consulta atingiu o limite de registros.');
 }
 async function ledger(clinic){
  const rpc=(name,body)=>cloud.request('/rest/v1/rpc/'+name,{method:'POST',body:{p_clinic:clinic,...body}});
  async function snapshot(){
   const meta=await rpc('clinic_load_start',{});
   if(typeof meta?.revision!=='string'||!meta.access)throw Error('Acesso aos dados financeiros indisponível.');
   const tables=['budgets','budget_items','sales','receipts'];
   const values=await Promise.all(tables.map(async table=>{
    if(!meta.access[table]?.read)return [table,null];
    let cursor=null;
    const rows=[];
    do{
     const result=await rpc('clinic_load_page',{p_revision:meta.revision,p_table:table,p_after:cursor});
     if(result?.revision!==meta.revision||!Array.isArray(result.rows)||result.rows.some(row=>row.chunked)||
        result.next!==null&&(typeof result.next!=='string'||result.next===cursor))throw Error('A leitura financeira não trouxe todos os registros.');
     rows.push(...result.rows);
     cursor=result.next;
     if(rows.length>20000)throw Error('A consulta financeira atingiu o limite de registros.');
    }while(cursor!==null);
    return [table,rows];
   }));
   return Object.fromEntries(values);
  }
  try{return await snapshot();}
  catch(error){if(error.code==='40001')return snapshot();throw error}
 }
 async function load(force=false){
  if(root.hidden)return;
  const clinic=clinicSelect.value;
  if(!clinic||!cloud?.enabled){state=null;draw();return}
  if(state?.clinic===clinic&&(state.loading||!force&&state.result))return;
  const next={clinic,result:state?.clinic===clinic?state.result:null,loading:true,warnings:[],error:''};
  state=next;draw();
  const [leads,expenses,financial]=await Promise.allSettled([
   list('nexodent_crm_leads',clinic,'id,created_at,source,stage,budget_id'),
   list('nexodent_general_expenses',clinic,'id,category,amount,paid_at,voided_at','&paid_at=not.is.null'),
   ledger(clinic)
  ]);
  if(state!==next||clinicSelect.value!==clinic)return;
  next.loading=false;
  if(leads.status==='rejected'){next.result=null;next.error='Não foi possível consultar leads: '+leads.reason.message;draw();return;}
  const data=financial.status==='fulfilled'?financial.value:{};
  if(expenses.status==='rejected')next.warnings.push('Investimentos indisponíveis: '+expenses.reason.message);
  if(financial.status==='rejected')next.warnings.push('Dados financeiros indisponíveis: '+financial.reason.message);
  if(financial.status==='fulfilled'&&Object.values(data).some(value=>value===null))next.warnings.push('O perfil atual tem acesso parcial aos orçamentos ou recebimentos.');
  next.result=model.prepare({...data,leads:leads.value,expenses:expenses.status==='fulfilled'?expenses.value:null});
  populate();draw();
 }
 populate();draw();
 [year,month,source].forEach(select=>select.addEventListener('change',draw));
 $('#crm-marketing-refresh').addEventListener('click',()=>load(true));
 clinicSelect.addEventListener('change',()=>{state=null;draw();load();});
 window.addEventListener('nexocrm:view-changed',event=>{if(event.detail==='marketing')load(true);});
 window.addEventListener('nexocrm:leads-loaded',()=>load(true));
 load();
})();
