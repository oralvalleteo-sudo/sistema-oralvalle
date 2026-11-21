(function(root,factory){
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 else root.NexoMarketingModel=model;
})(globalThis,()=>{
 const normalize=value=>String(value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
 const origin=value=>{
  const key=normalize(String(value||'').replace(/[_-]+/g,' '));
  if(['meta','meta ads','meta ads facebook','facebook','facebook ads','instagram','instagram ads','facebook e instagram','instagram / meta ads'].includes(key))return 'instagram';
  if(['google','google ads','google adwords','adwords','google ad words','google publicidade'].includes(key))return 'google ads';
  if(['orcamento','orcamentos','proposta','proposta financeira'].includes(key))return 'orcamento';
  return key||'sem origem';
 };
 const advertising=['marketing','publicidade','trafego pago','anuncios'];
 function expenseOrigin(value,description,supplier){
  const key=normalize(value),direct=origin(key);
  if(['google ads','instagram'].includes(direct))return direct;
  const match=key.match(/^(?:marketing|publicidade|trafego pago|anuncios)\s*[:–—-]\s*(.+)$/);
  if(match)return origin(match[1]);
  if(!advertising.includes(key))return null;
  const sources=new Set([origin(supplier)].filter(value=>['google ads','instagram'].includes(value)));
  const text=normalize(description);
  if(/\b(?:google ads|google adwords|adwords)\b/.test(text))sources.add('google ads');
  if(/\b(?:meta ads|facebook ads|instagram ads)\b/.test(text))sources.add('instagram');
  return sources.size===1?[...sources][0]:'sem origem';
 }
 function budgetLink(lead){
  if(lead.budget_id)return String(lead.budget_id);
  const match=String(lead.notes||'').match(/\[NEXODENT_BUDGET:([^\]]+)\]/);
  try{return match?decodeURIComponent(match[1]):'';}catch{return '';}
 }
 const cents=value=>{
  if(value===null||value===undefined||String(value).trim()==='')return null;
  let raw=String(value).trim().replace(/^R\$\s*/,'').replace(/\s/g,'');
  if(raw.includes(','))raw=raw.replace(/\./g,'').replace(',','.');
  if(!/^\d+(?:\.\d+)?$/.test(raw))return null;
  const amount=Math.round(Number(raw)*100);
  return Number.isSafeInteger(amount)?amount:null;
 };
 const byParent=rows=>{
  const map=new Map();
  for(const row of rows||[]){
   if(row.kind!=='object')continue;
   if(!map.has(row.parent_id))map.set(row.parent_id,[]);
   map.get(row.parent_id).push(row);
  }
  return map;
 };
 const dayFormatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'});
 const date=value=>{
  const raw=String(value||'').trim();
  const br=raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const day=br?`${br[3]}-${br[2]}-${br[1]}`:raw.slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day)?day:'';
 };
 function acquisitionDay(value){
  if(!String(value||'').includes('T'))return date(value);
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime())?'':dayFormatter.format(parsed);
 }
 const add=(map,key,value)=>{
  if(!map.has(key))map.set(key,[]);
  map.get(key).push(value);
 };
 function prepare({leads=[],expenses=null,budgets=null,budget_items=null,sales=null,receipts=null}){
  const items=byParent(budget_items),receiptRows=byParent(receipts),budgetKeys=new Map(),activeBudgets=new Map(),saleKeys=new Map();
  for(const budget of budgets||[]){
   if(budget.kind!=='object')continue;
   add(budgetKeys,String(budget.id),budget);
   if(budget.dados?.id!==undefined&&String(budget.dados.id)!==String(budget.id))add(budgetKeys,String(budget.dados.id),budget);
   if(!budget.dados?.archivedAt&&normalize(budget.dados?.status)==='aprovado')activeBudgets.set(budget.id,budget);
  }
  for(const sale of sales||[]){
   if(sale.kind!=='object'||sale.dados?.id===undefined)continue;
   add(saleKeys,String(sale.dados.id),sale);
  }
  const leadRows=leads.map(lead=>{
   const link=budgetLink(lead),source=origin(lead.source);
   return {...lead,link,day:acquisitionDay(lead.created_at),origin:link&&['outros','sem origem'].includes(source)?'orcamento':source};
  })
   .sort((a,b)=>(a.day||'9999').localeCompare(b.day||'9999')||String(a.created_at).localeCompare(String(b.created_at))||String(a.id).localeCompare(String(b.id)));
  const attribution=new Map();
  for(const lead of leadRows){
   const linked=budgetKeys.get(lead.link);
   if(linked?.length!==1||!activeBudgets.has(linked[0].id))continue;
   const previous=attribution.get(linked[0].id);
   if(!previous||previous.origin==='orcamento'&&lead.origin!=='orcamento')attribution.set(linked[0].id,lead);
  }
  // Explicit CRM attribution can connect an approved follow-up budget to an existing lead.
  const explicit=new Map();
  for(const lead of leadRows)for(const match of String(lead.notes||'').matchAll(/\[NEXODENT_MARKETING_BUDGET:([^\]]+)\]/g)){
   let id;
   try{id=decodeURIComponent(match[1]);}catch{continue}
   if(activeBudgets.has(id))add(explicit,id,lead);
  }
  for(const [id,owners] of explicit)if(owners.length===1)attribution.set(id,owners[0]);
  const saleOwners=new Map();
  const contracts=[];
  for(const [id,budget] of activeBudgets){
   const lead=attribution.get(id),lines=items.get(id)||[];
   const day=acquisitionDay(budget.dados?.approvedAt||budget.dados?.aprovadoEm)||date(budget.dados?.data)||lead?.day||'';

   const values=lines.map(row=>cents(row.dados?.valor));
   const discount=budget.dados?.desc==null||String(budget.dados.desc).trim()===''?0:cents(budget.dados.desc);
   const total=lines.length&&values.every(value=>value!==null)&&discount!==null?Math.max(0,values.reduce((sum,value)=>sum+value,0)-discount):null;
   const contract={id,lead,day,origin:lead?.origin||'orcamento',patient:budget.parent_id,total};
   contracts.push(contract);
   for(const line of lines){
    for(const ref of new Set([line.dados?.vid,line.dados?.paymentSaleId].filter(Boolean).map(String))){
     const candidates=saleKeys.get(ref)||[];
     if(candidates.length!==1)continue;
     const [sale]=candidates;
     const owner=saleOwners.get(sale.id);
     if(!owner||owner.origin==='orcamento'&&contract.origin!=='orcamento')saleOwners.set(sale.id,contract);
    }
   }
  }
  const spending=(expenses||[]).filter(expense=>!expense.voided_at&&expense.paid_at)
   .map(expense=>({origin:expenseOrigin(expense.category,expense.description,expense.supplier),day:date(expense.paid_at),value:cents(expense.amount)}))
   .filter(expense=>expense.origin!==null);
  return {leads:leadRows,contracts,saleOwners,receiptRows,spending,available:{expenses:expenses!==null,contracts:budgets!==null&&budget_items!==null,
   receipts:budgets!==null&&budget_items!==null&&sales!==null&&receipts!==null}};
 }
 function calculate(model,{year,month='',source=''},entries,receiptOrigins){
  const prefix=String(year)+(month?'-'+month:'');
  const inPeriod=day=>day.startsWith(prefix);
  const selected=key=>!source||key===origin(source);
  const leads=model.leads.filter(lead=>inPeriod(lead.day)&&selected(lead.origin));
  const contracts=model.contracts.filter(contract=>inPeriod(contract.day)&&selected(contract.origin));
  const rows=new Map();
  const entry=(lead,contract)=>{
   const key=lead?'lead:'+lead.id:'budget:'+contract.id;
   if(!rows.has(key))rows.set(key,{lead,contracted:[],received:[],budget:contract});
   return rows.get(key);
  };
  if(entries){
   for(const lead of leads)entry(lead).counted=true;
   for(const contract of contracts)entry(contract.lead,contract).contracted.push(contract.total);
  }
  const patients=new Set(contracts.map(contract=>contract.patient).filter(Boolean));
  const expenses=model.spending.filter(expense=>inPeriod(expense.day)&&selected(expense.origin));
  const completed=new Set(model.contracts.map(contract=>contract.lead).filter(Boolean));
  const moneyTotal=values=>values.some(value=>value===null)?null:values.reduce((sum,value)=>sum+value,0);
  const investment=model.available.expenses?moneyTotal(expenses.map(expense=>expense.value)):null;
  const contracted=model.available.contracts?moneyTotal(contracts.map(contract=>contract.total)):null;
  const actual=[], attributed=[], byOrigin=new Map();
  for(const [sale,contract] of model.saleOwners){
   const included=selected(contract.origin);
   if(!included&&!receiptOrigins)continue;
   for(const receipt of model.receiptRows.get(sale)||[]){
    if(!inPeriod(date(receipt.dados?.data)))continue;
    const amount=cents(receipt.dados?.valor);
    if(receiptOrigins)add(byOrigin,contract.origin,amount);
    if(!included)continue;
    actual.push(amount);
    if(entries)entry(contract.lead,contract).received.push(amount);
    if(!['orcamento','sem origem','outros'].includes(contract.origin))attributed.push(amount);
   }
  }
  if(entries)for(const row of rows.values())entries.push({
   lead:row.lead,budget:row.budget,counted:!!row.counted,
   contracted:model.available.contracts&&row.contracted.length?moneyTotal(row.contracted):null,
   received:model.available.receipts?moneyTotal(row.received):null
  });
  if(receiptOrigins&&model.available.receipts)for(const [key,values] of byOrigin)receiptOrigins.push({key,received:moneyTotal(values)});
  const received=model.available.receipts?moneyTotal(actual):null;
  const converted=model.available.contracts?patients.size:null;
  const attributedReceived=model.available.receipts&&origin(source)!=='orcamento'?moneyTotal(attributed):null;
  return {leads:leads.length,converted,investment,contracted,received,
   conversion:leads.length&&model.available.contracts?leads.filter(lead=>completed.has(lead)).length/leads.length:null,
   costLead:leads.length&&investment!==null?investment/leads.length:null,
   costPatient:converted&&investment!==null?investment/converted:null,
   roas:investment>0&&attributedReceived!==null?attributedReceived/investment:null,
   roi:investment>0&&attributedReceived!==null?(attributedReceived-investment)/investment:null,
   unlinkedClosed:leads.filter(lead=>normalize(lead.stage)==='fechado'&&!completed.has(lead)).length};
 }
 return {prepare,calculate,origin,expenseOrigin,date};
});
