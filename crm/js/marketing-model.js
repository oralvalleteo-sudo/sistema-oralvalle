(function(root,factory){
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 else root.NexoMarketingModel=model;
})(globalThis,()=>{
 const normalize=value=>String(value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
 const origin=value=>{
  const key=normalize(value);
  if(key==='meta ads'||key==='facebook ads'||key==='instagram ads')return 'instagram';
  return key||'sem origem';
 };
 const expenseOrigin=value=>{
  const key=normalize(value);
  if(['marketing','publicidade','trafego pago','anuncios'].includes(key))return 'sem origem';
  const match=key.match(/^(?:marketing|publicidade|trafego pago|anuncios)\s*[:–—-]\s*(.+)$/);
  if(match)return origin(match[1]);
  return ['google ads','meta ads','facebook ads','instagram ads'].includes(key)?origin(key):null;
 };
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
 const date=value=>String(value||'').slice(0,10);
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
  const leadRows=leads.map(lead=>({...lead,day:acquisitionDay(lead.created_at),origin:origin(lead.source)}))
   .sort((a,b)=>(a.day||'9999').localeCompare(b.day||'9999')||String(a.created_at).localeCompare(String(b.created_at))||String(a.id).localeCompare(String(b.id)));
  const attribution=new Map();
  for(const lead of leadRows){
   const linked=budgetKeys.get(String(lead.budget_id||''));
   if(linked?.length===1&&activeBudgets.has(linked[0].id)&&!attribution.has(linked[0].id))attribution.set(linked[0].id,lead);
  }
  const saleOwners=new Map();
  const contracts=[];
  for(const [id,lead] of attribution){
   const budget=activeBudgets.get(id),lines=items.get(id)||[];
   const values=lines.map(row=>cents(row.dados?.valor));
   const discount=budget.dados?.desc==null||String(budget.dados.desc).trim()===''?0:cents(budget.dados.desc);
   const total=lines.length&&values.every(value=>value!==null)&&discount!==null?Math.max(0,values.reduce((sum,value)=>sum+value,0)-discount):null;
   const contract={lead,patient:budget.parent_id,total};
   contracts.push(contract);
   for(const line of lines){
    for(const ref of new Set([line.dados?.vid,line.dados?.paymentSaleId].filter(Boolean).map(String))){
     const candidates=saleKeys.get(ref)||[];
     if(candidates.length!==1)continue;
     const [sale]=candidates;
     if(!saleOwners.has(sale.id))saleOwners.set(sale.id,contract);
    }
   }
  }
  const spending=(expenses||[]).filter(expense=>!expense.voided_at&&expense.paid_at)
   .map(expense=>({origin:expenseOrigin(expense.category),day:date(expense.paid_at),value:cents(expense.amount)}))
   .filter(expense=>expense.origin!==null);
  return {leads:leadRows,contracts,saleOwners,receiptRows,spending,available:{expenses:expenses!==null,contracts:budgets!==null&&budget_items!==null,
   receipts:budgets!==null&&budget_items!==null&&sales!==null&&receipts!==null}};
 }
 function calculate(model,{year,month='',source=''}){
  const prefix=String(year)+(month?'-'+month:'');
  const inPeriod=day=>day.startsWith(prefix);
  const selected=key=>!source||key===source;
  const leads=model.leads.filter(lead=>inPeriod(lead.day)&&selected(lead.origin));
  const included=new Set(leads);
  const contracts=model.contracts.filter(contract=>included.has(contract.lead));
  const patients=new Set(contracts.map(contract=>contract.patient).filter(Boolean));
  const expenses=model.spending.filter(expense=>inPeriod(expense.day)&&selected(expense.origin));
  const completed=new Set(contracts.map(contract=>contract.lead));
  const moneyTotal=values=>values.some(value=>value===null)?null:values.reduce((sum,value)=>sum+value,0);
  const investment=model.available.expenses?moneyTotal(expenses.map(expense=>expense.value)):null;
  const contracted=model.available.contracts?moneyTotal(contracts.map(contract=>contract.total)):null;
  const actual=[];
  for(const [sale,contract] of model.saleOwners){
   if(!included.has(contract.lead))continue;
   for(const receipt of model.receiptRows.get(sale)||[]){
    if(inPeriod(date(receipt.dados?.data)))actual.push(cents(receipt.dados?.valor));
   }
  }
  const received=model.available.receipts?moneyTotal(actual):null;
  const converted=model.available.contracts?patients.size:null;
  return {leads:leads.length,converted,investment,contracted,received,
   conversion:leads.length&&model.available.contracts?completed.size/leads.length:null,
   costLead:leads.length&&investment!==null?investment/leads.length:null,
   costPatient:converted&&investment!==null?investment/converted:null,
   roas:investment>0&&received!==null?received/investment:null,
   roi:investment>0&&received!==null?(received-investment)/investment:null,
   unlinkedClosed:leads.filter(lead=>normalize(lead.stage)==='fechado'&&!completed.has(lead)).length};
 }
 return {prepare,calculate,origin,expenseOrigin};
});
