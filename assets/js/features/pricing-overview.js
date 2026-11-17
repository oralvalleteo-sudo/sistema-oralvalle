/* Leitura dos cálculos existentes. O painel não altera preços, custos ou comissões. */
(function(root){
'use strict';
const numeric=value=>{if(typeof value==='number')return Number.isFinite(value)?value:0;let text=String(value??'').replace(/[^\d,.\-]/g,'');if(text.includes(','))text=text.replace(/\./g,'').replace(',','.');const n=parseFloat(text);return Number.isFinite(n)?n:0;};
const expenseKeys=['alu','eqp','luz','net','fix'];
function build({procedures=[],settings={},calculate,hour}){
  const monthly=expenseKeys.reduce((sum,key)=>sum+numeric(settings[key]),0)+numeric(settings.pl);
  const configured=monthly>0&&Number.isFinite(hour.hrs)&&hour.hrs>0;
  const target=numeric(settings.mg);
  const rows=procedures.filter(p=>p.ativo!==false&&numeric(p.preco)>0).map(p=>{
    const calc=calculate(p),price=numeric(p.preco),minutes=numeric(p.min);
    const valid=configured&&minutes>0&&Number.isFinite(calc.lu)&&Number.isFinite(calc.mg)&&[calc.ch,calc.mat,calc.lab,calc.procCusto,calc.par,calc.comValorPct].every(v=>Number.isFinite(v)&&v>=0);
    return {id:String(p.id??''),name:String(p.nome||'Procedimento sem nome'),price,minutes,profit:valid?calc.lu:null,margin:valid?calc.mg:null,
      status:!valid?'unknown':calc.lu<-.005?'loss':calc.mg+1e-7>=target?'above':'below',calc};
  });
  const hourlyRows=rows.filter(r=>r.minutes>0&&r.profit!==null);
  const hours=hourlyRows.reduce((sum,r)=>sum+r.minutes/60,0);
  const components=[{key:'profit',label:'Lucro estimado',color:'#16835b',value:0},{key:'clinic',label:'Hora clínica',color:'#3480c4',value:0},{key:'materials',label:'Materiais',color:'#8b6bc8',value:0},{key:'lab',label:'Laboratório e outros custos',color:'#64748b',value:0},{key:'commission',label:'Comissões previstas',color:'#d8942e',value:0},{key:'taxes',label:'Impostos e taxas',color:'#ca6b90',value:0}];
  let totalPrice=0;
  hourlyRows.forEach(r=>{const c=r.calc;totalPrice+=r.price;components[0].value+=r.profit;components[1].value+=c.ch;components[2].value+=c.mat;components[3].value+=c.lab+c.procCusto;components[4].value+=c.par+c.comValorPct;components[5].value+=r.price*(numeric(settings.imp)+numeric(settings.cart))/100;});
  const loss=components[0].value<-.005;
  const denominator=loss?components.slice(1).reduce((sum,c)=>sum+c.value,0):totalPrice;
  components.forEach(c=>{c.percent=denominator>0?Math.max(0,c.value)/denominator*100:0;c.hourly=hours>0?c.value/hours:0;});
  return {rows,configured,target,monthly,hour,costFields:expenseKeys.filter(k=>String(settings[k]??'').trim()!==''&&numeric(settings[k])>=0).length,
    priced:rows.length,total:procedures.filter(p=>p.ativo!==false).length,above:rows.filter(r=>r.status==='above').length,below:rows.filter(r=>r.status==='below').length,lossCount:rows.filter(r=>r.status==='loss').length,
    hourlyCount:hourlyRows.length,missingDuration:rows.filter(r=>!(r.minutes>0)).length,averageHourly:hours>0?totalPrice/hours:null,components,loss};
}
function model(){return build({procedures:typeof pmLvl==='function'&&pmLvl('pr')<1?[]:db.pr||[],settings:db.hc||{},calculate:prCalc,hour:hcCalc(db.hc||{})});}
function html(){
  const m=model(),canSee=typeof pmLvl!=='function'||pmLvl('pr')>=1,fmt=brl;
  const pct=n=>n.toFixed(1).replace('.',',')+'%';
  const figure=m.averageHourly===null?'<div class="pricing-empty">'+(!canSee?'Seu acesso não inclui os procedimentos.':!m.configured?'Preencha os custos e a capacidade de atendimento para compor os preços.':'Cadastre preço e duração nos procedimentos para visualizar a composição.')+'</div>':(()=>{
    let cursor=0;const stops=m.components.filter(c=>c.percent>0).map(c=>{const start=cursor;cursor+=c.percent;return c.color+' '+start.toFixed(4)+'% '+cursor.toFixed(4)+'%';}).join(',');
    return `<div class="pricing-composition"><div class="pricing-donut" role="img" aria-label="Composição estimada dos preços por hora; detalhes na legenda" style="background:conic-gradient(${stops||'#e2e8f0 0% 100%'})"><div><strong>${fmt(m.averageHourly)}</strong><span>preço médio por hora</span></div></div><div class="pricing-legend">${m.components.map(c=>`<div><span><i style="background:${c.color}"></i>${c.label}</span><b${c.value<0?' class="pricing-negative"':''}>${fmt(c.hourly)}<small>${c.value<0?'Prejuízo':pct(c.percent)}</small></b></div>`).join('')}</div></div>`;
  })();
  const countCard=(filter,label,count,tone)=>`<button type="button" class="pricing-margin ${tone}" data-pricing-filter="${filter}" aria-pressed="${(view.pricingFilter||'all')===filter}"><span><strong>${m.configured?count:'—'}</strong> ${label}</span><span aria-hidden="true">›</span></button>`;
  const filter=view.pricingFilter||'all',sort=view.pricingSort||'margin-desc';
  const selected=m.rows.filter(r=>filter==='all'||r.status===filter).sort((a,b)=>sort==='price-desc'?b.price-a.price:sort==='margin-asc'?(a.margin??Infinity)-(b.margin??Infinity):(b.margin??-Infinity)-(a.margin??-Infinity));
  const labels={above:'Acima da meta',below:'Abaixo da meta',loss:'Prejuízo',unknown:'Dados pendentes'};
  return `<header class="pricing-head"><div><h1>Custo Hora Clínica</h1><p>Entenda os custos da clínica e a formação dos preços dos procedimentos.</p></div><a class="pricing-adjust" href="#pricing-parameters" data-pricing-adjust>Ajustar custos e parâmetros</a></header>
  <div class="pricing-kpis"><article><span>Procedimentos com preço</span><strong>${canSee?m.priced:'—'}</strong><small>${canSee?'de '+m.total+' cadastrados':'Acesso a procedimentos necessário'}</small></article><article><span>Custos fixos informados</span><strong>${m.costFields} de 5</strong><small>Pró-labore cadastrado separadamente</small></article><article><span>Horas produtivas no mês</span><strong>${m.hour.hrs.toFixed(1).replace('.',',')} h</strong><small>Considera a ocupação da agenda informada</small></article></div>
  ${!m.configured?'<p class="pricing-notice">Complete os custos mensais e a capacidade de atendimento. A rentabilidade ficará disponível após esse preenchimento.</p>':''}
  <div class="pricing-main"><section class="pricing-card"><h2>Composição do preço por hora</h2>${figure}<p class="pricing-footnote">${m.loss?'Os custos superam o preço médio. O gráfico mostra a participação de cada custo no total de custos. ':'Percentuais sobre o preço dos procedimentos. '}Amostra: ${m.hourlyCount} procedimento(s) com preço e duração; uma execução de cada, ponderada pela duração. É uma simulação, não faturamento.${m.missingDuration?' '+m.missingDuration+' procedimento(s) sem duração foram excluídos do gráfico.':''}</p></section>
  <section class="pricing-card"><h2>Rentabilidade dos procedimentos</h2><p class="pricing-muted">Meta cadastrada: ${pct(m.target)} de margem.</p>${countCard('above','na meta ou acima',m.above,'positive')}${countCard('below','abaixo da meta',m.below,'attention')}${countCard('loss','com prejuízo',m.lossCount,'negative')}<button type="button" class="ghost sm" data-pricing-filter="all">Ver todos os procedimentos</button></section></div>
  <section class="pricing-card pricing-hour"><div><h2>Custo da hora clínica</h2><strong>${m.configured?fmt(m.hour.custo):'—'} <small>por hora produtiva</small></strong><p class="pricing-muted">${m.configured?fmt(m.hour.estr)+' somente de estrutura, sem pró-labore.':'Informe os custos e a capacidade nos parâmetros abaixo.'}</p></div><div class="pricing-hour-metrics"><div><span>Custo mensal + pró-labore</span><b>${fmt(m.monthly)}</b></div><div><span>Impostos e taxas médias</span><b>${pct(numeric(db.hc.imp)+numeric(db.hc.cart))}</b></div><div><span>Ocupação informada</span><b>${pct(numeric(db.hc.occ))}</b></div></div></section>
  <section class="pricing-card"><div class="pricing-ranking-head"><h2>Comparar procedimentos</h2><div class="pricing-sort" role="group" aria-label="Ordenar procedimentos">${[['margin-desc','Maior margem'],['price-desc','Maior preço'],['margin-asc','Menor margem']].map(([key,label])=>`<button type="button" class="ghost sm" data-pricing-sort="${key}" aria-pressed="${sort===key}">${label}</button>`).join('')}</div></div><div class="pricing-table-wrap"><table><thead><tr><th>Procedimento</th><th>Duração</th><th>Preço</th><th>Lucro estimado</th><th>Margem</th><th>Situação</th></tr></thead><tbody>${selected.length?selected.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.minutes>0?r.minutes+' min':'Não informada'}</td><td>${fmt(r.price)}</td><td${r.profit<0?' class="pricing-negative"':''}>${r.profit===null?'—':fmt(r.profit)}</td><td>${r.margin===null?'—':pct(r.margin)}</td><td><span class="pricing-status ${r.status}">${labels[r.status]}</span></td></tr>`).join(''):`<tr><td colspan="6">${!canSee?'Seu acesso não inclui o catálogo de procedimentos.':filter==='all'?'Nenhum procedimento com preço cadastrado.':'Nenhum procedimento neste grupo.'}</td></tr>`}</tbody></table></div><p class="pricing-footnote">Cálculo com os custos, comissões e taxas cadastrados, sem considerar volume real de atendimentos. Confira os parâmetros antes de decidir os preços.</p>${canSee?'<button type="button" class="ghost sm" data-act="nav" data-t="pr">Abrir cadastro de procedimentos</button>':''}</section>`;
}
function refresh(){const target=document.getElementById('pricing-overview');if(target)target.innerHTML=html();}
const api={build,html,refresh};
if(typeof module==='object'&&module.exports)module.exports=api;
else{
  root.NexoPricingOverview=api;
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-pricing-filter],[data-pricing-sort],[data-pricing-adjust]');
    if(!button||!button.closest('.pricing-page'))return;
    if(button.hasAttribute('data-pricing-adjust')){event.preventDefault();const details=document.getElementById('pricing-parameters');if(details){details.open=true;details.scrollIntoView({behavior:'smooth',block:'start'});}return;}
    if(button.dataset.pricingSort)view.pricingSort=button.dataset.pricingSort;
    if(button.dataset.pricingFilter)view.pricingFilter=button.dataset.pricingFilter;
    refresh();
  });
}
})(typeof window!=='undefined'?window:globalThis);
