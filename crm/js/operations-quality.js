(()=>{'use strict';
const root=document.querySelector('.crm-operations');if(!root)return;
const $=id=>document.getElementById(id), labels={overdue:'Retorno atrasado',no_date:'Sem próximo contato',no_owner:'Sem responsável',no_origin:'Sem origem',stale:'Sem atualização há 7 dias'};
let clinic=null,leads=[],review=null;
const fmt=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const date=v=>{if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d};
const day=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
function audit(x){if(x.stage==='Fechado'||x.stage==='Perdida')return [];
 const flags=[],now=day(),next=date(x.next_contact_at),updated=date(x.updated_at||x.created_at);
 if(next&&next<now)flags.push('overdue');if(!next&&x.stage!=='Atendido')flags.push('no_date');
 if(!x.commercial_owner_id)flags.push('no_owner');if(!String(x.source||x.origin||'').trim())flags.push('no_origin');
 if(x.stage!=='Atendido'&&updated&&now-updated>=7*86400000)flags.push('stale');return flags;
}
function text(tag,value){const e=document.createElement(tag);e.textContent=String(value??'');return e}
function data(){return leads.map(lead=>{const stage=review?.stages?.get(lead.id)||lead.stage;const x={...lead,stage};return {x,flags:audit(x)}}).filter(r=>r.flags.length)}
function selected(){const f=$('ops-filter').value,q=$('ops-search').value.trim().toLocaleLowerCase('pt-BR');return data().filter(r=>(f==='all'||r.flags.includes(f))&&(!q||String(r.x.name||r.x.patient_name||'').toLocaleLowerCase('pt-BR').includes(q)))}
function draw(){const all=data(),metrics=$('ops-metrics'),body=$('ops-rows');metrics.replaceChildren();body.replaceChildren();
 for(const [key,title] of [['all','Com pendências'],...Object.entries(labels).map(([k,v])=>[k,v])]){const card=document.createElement('div');card.append(text('span',title),text('strong',key==='all'?all.length:all.filter(r=>r.flags.includes(key)).length));metrics.append(card)}
 const rows=selected();$('ops-count').textContent=rows.length+' oportunidade(s) com pendências neste filtro.';
 for(const {x,flags} of rows.slice(0,150)){const tr=document.createElement('tr');tr.append(text('td',x.name||x.patient_name||'Sem nome'),text('td',x.stage||'—'));const td=document.createElement('td'),tags=document.createElement('div');tags.className='ops-tags';flags.forEach(f=>tags.append(text('em',labels[f])));td.append(tags);tr.append(td,text('td',x.next_contact_at?String(x.next_contact_at).slice(0,10).split('-').reverse().join('/'):'—'),text('td',fmt.format(Math.max(0,Number(x.estimated_value)||0))));body.append(tr)}
 if(rows.length>150){const tr=document.createElement('tr'),td=text('td','Exibindo 150 de '+rows.length+'. Use os filtros ou exporte o CSV.');td.colSpan=5;tr.append(td);body.append(tr)}
 if(!rows.length){const tr=document.createElement('tr'),td=text('td','Nenhuma pendência neste filtro.');td.colSpan=5;tr.append(td);body.append(tr)}
}
function csvCell(v){let s=String(v??'');if(/^[\s\u0000-\u001f]*[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
function exportCsv(){const lines=[['Paciente','Etapa','Pendências','Próximo contato','Valor estimado']];selected().forEach(({x,flags})=>lines.push([x.name||x.patient_name||'',x.stage||'',flags.map(f=>labels[f]).join('; '),String(x.next_contact_at||'').slice(0,10),Math.max(0,Number(x.estimated_value)||0).toFixed(2)]));const blob=new Blob(['\ufeff'+lines.map(r=>r.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='nexodent-pendencias-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
$('ops-filter').addEventListener('change',draw);$('ops-search').addEventListener('input',draw);$('ops-export').addEventListener('click',exportCsv);
const model=window.NexoMarketingModel;
const cloud=window.OralCloud;
const normalized=value=>String(value||'').trim().toLocaleLowerCase('pt-BR');
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
function budgetPatient(budget){
 try{
  const key=JSON.parse(budget.parent_id);
  return key?.[1]==='p'&&key[2]?.[0]==='id'?String(budget.parent_id):'';
 }catch{return ''}
}
async function linkedRows(clinicId,table,key,ids,fields,filter=''){
 const rows=[];
 for(let index=0;index<ids.length;index+=30){
  const values=ids.slice(index,index+30).map(id=>JSON.stringify(id)).join(',');
  for(let offset=0;;offset+=500){
   const batch=await cloud.request('/rest/v1/'+table+'?clinic_id=eq.'+encodeURIComponent(clinicId)+
    '&'+key+'=in.('+encodeURIComponent(values)+')&select='+fields+'&order=id.asc&limit=500&offset='+offset+filter);
   if(!Array.isArray(batch))throw Error('Resposta inválida');
   rows.push(...batch);
   if(batch.length<500)break;
  }
 }
 return rows;
}
async function reconcile(){
 if(root.hidden||review||!clinic||!cloud?.enabled)return;
 const candidates=leads.filter(lead=>['Orçamento','Avaliado'].includes(lead.stage))
  .map(lead=>({lead,id:model.budgetLink(lead)})).filter(row=>row.id);
 if(!candidates.length)return;
 const current={stages:new Map()};
 review=current;
 $('ops-sync').textContent='Conferindo os orçamentos vinculados…';
 $('ops-export').disabled=true;
 try{
  const budgets=await linkedRows(clinic,'budgets','id',[...new Set(candidates.map(row=>row.id))],'id,parent_id,status,dados');
  if(review!==current)return;
  const byId=new Map(budgets.map(row=>[String(row.id),row]));
  const pending=[];
  const unapproved=[];
  for(const {lead,id} of candidates){
   const budget=byId.get(id);
   if(!budget||budget.dados?.archivedAt)continue;
   const status=normalized(budget.dados?.status||budget.status);
   if(status==='aprovado'){
    current.stages.set(lead.id,'Fechado');
    continue;
   }
   unapproved.push({lead,id});
   const patient=budgetPatient(budget),since=model.date(budget.dados?.data);
   if(patient&&since)pending.push({lead,patient,since});
  }
  const [sales,visits]=await Promise.allSettled([
   linkedRows(clinic,'budget_items','parent_id',[...new Set(unapproved.map(row=>row.id))],'id,parent_id,sale_ref','&kind=eq.object&slot=eq.itens&position=gte.0'),
   linkedRows(clinic,'appointments','patient_ref',[...new Set(pending.map(row=>row.patient))],'id,patient_ref,status,dados')
  ]);
  if(review!==current)return;
  if(sales.status==='fulfilled'){
   const sold=new Set(sales.value.filter(row=>row.sale_ref).map(row=>String(row.parent_id)));
   for(const row of sales.value)if(!row.sale_ref)sold.delete(String(row.parent_id));
   for(const {lead,id} of unapproved)if(sold.has(id))current.stages.set(lead.id,'Fechado');
  }
  if(visits.status==='fulfilled'){
   const lastVisit=new Map(),limit=today();
   for(const appointment of visits.value){
    if(normalized(appointment.dados?.st||appointment.status)!=='compareceu')continue;
    const day=model.date(appointment.dados?.data),patient=String(appointment.patient_ref||'');
    if(day&&day<=limit&&day>(lastVisit.get(patient)||''))lastVisit.set(patient,day);
   }
   for(const {lead,patient,since} of pending){
    if(!current.stages.has(lead.id)&&(lastVisit.get(patient)||'')>=since)current.stages.set(lead.id,'Atendido');
   }
  }
  if(sales.status==='rejected'||visits.status==='rejected')throw Error('Consulta incompleta');
  $('ops-sync').textContent='';
 }catch{
  if(review===current)$('ops-sync').textContent='A conferência de orçamentos e atendimentos ficou incompleta. Use Atualizar para tentar novamente.';
 }finally{
  if(review===current){$('ops-export').disabled=false;draw()}
 }
}
function visibility(){
 root.hidden=document.querySelector('[data-crm-view="followup"]')?.getAttribute('aria-selected')!=='true';
 reconcile();
}
new MutationObserver(visibility).observe(document.getElementById('crm-tab-followup'),{attributes:true,attributeFilter:['aria-selected']});visibility();
function reset(clinicId,rows){
 clinic=clinicId;
 leads=rows;
 review=null;
 $('ops-sync').textContent='';
 $('ops-export').disabled=false;
 draw();
 reconcile();
}
$('clinic').addEventListener('change',()=>reset(null,[]));
window.addEventListener('nexocrm:leads-loaded',e=>reset(e.detail.clinicId,e.detail.leads));draw();
})();