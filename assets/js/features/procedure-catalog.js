/* Visualização e filtros do catálogo; cálculos financeiros continuam no mecanismo existente. */
(function(root){
'use strict';
const normal=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function filterRows(items,{query='',filter='all',sort='name'}={}){
 const q=normal(query).trim();
 return items.filter(r=>(!q||normal(r.name).includes(q))&&(filter==='all'||r.status===filter)).sort((a,b)=>{
   if(sort==='price-desc')return b.price-a.price||a.name.localeCompare(b.name,'pt-BR');
   if(sort==='margin-desc'||sort==='margin-asc'){if(a.margin===null)return b.margin===null?0:1;if(b.margin===null)return -1;return (sort==='margin-desc'?b.margin-a.margin:a.margin-b.margin)||a.name.localeCompare(b.name,'pt-BR');}
   return a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'});
 });
}
function model(){
 const procedures=db.pr||[],overview=root.NexoPricingOverview.build({procedures,settings:db.hc||{},calculate:prCalc,hour:hcCalc(db.hc||{})});
 const items=procedures.map(x=>{const calculated=overview.rows.find(r=>r.id===String(x.id)),price=num(x.preco),calc=prCalc(x),margin=calculated?.margin??null,profit=calculated?.profit??null;
   return {procedure:x,id:String(x.id),name:String(x.nome||'Novo procedimento'),price,minutes:num(x.min),calc,margin,profit,cost:profit===null?null:price-profit,status:price<=0?'none':calculated?.status||'unknown'};
 });
 const priced=items.filter(r=>r.price>0),margins=items.filter(r=>r.margin!==null);
 return {items,total:items.length,averagePrice:priced.length?priced.reduce((sum,r)=>sum+r.price,0)/priced.length:null,averageMargin:margins.length?margins.reduce((sum,r)=>sum+r.margin,0)/margins.length:null,target:overview.target,
 counts:{all:items.length,none:items.filter(r=>r.status==='none').length,below:items.filter(r=>r.status==='below').length,loss:items.filter(r=>r.status==='loss').length}};
}
const icons={tooth:'<path d="M5 3c3-2 4 1 7 1s4-3 7-1c4 3 1 8 0 13-1 5-3 6-4 0l-1-4c-1-2-3-2-4 0l-1 4c-1 6-3 5-4 0C4 11 1 6 5 3Z"/>',list:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/>',coins:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v5c0 4 16 4 16 0V5M4 10v5c0 4 16 4 16 0v-5M4 15v4c0 4 16 4 16 0v-4"/>',chart:'<path d="M4 21V11h4v10M10 21V7h4v14M16 21V3h4v18M2 21h20"/>'};
function icon(key){return `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[key]||icons.tooth}</svg>`;}
function statsHtml(m){return `<article><i>${icon('list')}</i><div><span>Procedimentos cadastrados</span><strong>${m.total}</strong><small>Total no seu catálogo</small></div></article><article><i>${icon('coins')}</i><div><span>Preço médio</span><strong>${m.averagePrice===null?'—':brl(m.averagePrice)}</strong><small>Média dos preços definidos</small></div></article><article><i>${icon('chart')}</i><div><span>Margem média</span><strong>${m.averageMargin===null?'—':m.averageMargin.toFixed(1).replace('.',',')+'%'}</strong><small>Margem estimada com dados completos</small></div></article>`;}
function headHtml(r){const labels={above:'Margem adequada',below:'Margem baixa',loss:'Prejuízo',none:'Sem preço',unknown:'Dados pendentes'},x=r.procedure,materials=(x.mats||[]).length;
 return `<span class="nc-procedure-icon">${icon('tooth')}</span><div class="nc-identity"><h2>${esc(r.name)}</h2><p>${r.minutes>0?r.minutes+' min':'Duração não informada'} <span aria-hidden="true">|</span> ${materials?materials+' '+(materials===1?'material':'materiais'):num(x.mat)>0?'Com materiais':'Sem materiais'}${x.parc?' · Parceiro':''}</p></div><div class="nc-price"><strong>${r.price>0?brl(r.price):'—'}</strong><span class="nc-status ${r.status}">${labels[r.status]}</span></div>`;
}
function metricsHtml(r){
 const {ok,sug}=r.calc;
 const suggested=ok&&Number.isFinite(sug)&&sug>0?brl(sug):'—';
 return `<div><small>Custo total</small><strong>${r.cost===null?'—':brl(r.cost)}</strong></div><div><small>Lucro estimado</small><strong${r.profit<0?' class="nc-negative"':''}>${r.profit===null?'—':brl(r.profit)}</strong></div><div><small>Margem estimada</small><strong>${r.margin===null?'—':r.margin.toFixed(1).replace('.',',')+'%'}</strong></div><div><small>Preço sugerido</small><strong>${suggested}</strong></div>`;
}
function apply(){
 const page=document.querySelector('.procedure-catalog');if(!page)return;
 const m=model(),visible=filterRows(m.items,{query:view.prq,filter:view.prFilter||'all',sort:view.prSort||'name'}),visibleIds=new Set(visible.map(r=>r.id));
 const grid=page.querySelector('.nc-grid'),cards=Array.from(grid.querySelectorAll('.nc-card'));
 filterRows(m.items,{sort:view.prSort||'name'}).forEach(r=>{const card=cards.find(c=>c.dataset.procedureId===r.id);if(card){card.hidden=!visibleIds.has(r.id);grid.appendChild(card);}});
 page.querySelector('.nc-list-count').textContent=visible.length+' '+(visible.length===1?'procedimento':'procedimentos')+(visible.length!==m.total?' de '+m.total:'');
 page.querySelector('.nc-empty').hidden=visible.length>0;
 page.querySelectorAll('[data-nc-filter]').forEach(button=>{button.setAttribute('aria-pressed',String((view.prFilter||'all')===button.dataset.ncFilter));button.querySelector('b').textContent=m.counts[button.dataset.ncFilter];});
}
function refresh(){
 const page=document.querySelector('.procedure-catalog');if(!page)return;
 const m=model();page.querySelector('.nc-kpis').innerHTML=statsHtml(m);
 page.querySelectorAll('.nc-card').forEach(card=>{const row=m.items.find(r=>r.id===card.dataset.procedureId);if(!row)return;card.querySelector('.nc-card-head').innerHTML=headHtml(row);card.querySelector('.nc-card-metrics').innerHTML=metricsHtml(row);});
 page.querySelectorAll('[data-nc-filter]').forEach(button=>button.querySelector('b').textContent=m.counts[button.dataset.ncFilter]);
 if(!document.activeElement?.closest('.nc-editor'))apply();
}
const api={filterRows,model,icon,statsHtml,headHtml,metricsHtml,apply,refresh};
if(typeof module==='object'&&module.exports)module.exports=api;
else{
 root.NexoProcedureCatalog=api;
 document.addEventListener('click',event=>{const button=event.target.closest?.('[data-nc-filter]');if(!button||!button.closest('.procedure-catalog'))return;view.prFilter=button.dataset.ncFilter;apply();});
 document.addEventListener('change',event=>{if(event.target.id==='nc-sort'){view.prSort=event.target.value;apply();}});
 document.addEventListener('toggle',event=>{const el=event.target;if(!el?.isConnected||!el.matches?.('.nc-editor,.nc-composition'))return;const id=el.closest('.nc-card')?.dataset.procedureId;if(!id)return;if(el.classList.contains('nc-editor')){if(el.open)view.prOpen=id;else if(view.prOpen===id)view.prOpen=null;}else{(view.prCompositions=view.prCompositions||{})[id]=el.open;}},true);
}
})(typeof window!=='undefined'?window:globalThis);
