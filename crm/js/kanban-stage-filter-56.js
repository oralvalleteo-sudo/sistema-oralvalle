(()=>{'use strict';
const board=document.getElementById('board');
const search=document.getElementById('search');
if(!board||!search)return;
const bar=search.closest('.bar');
if(!bar)return;
const label=document.createElement('label');
label.className='crm-stage-filter-56';
label.textContent='Etapa do funil ';
const select=document.createElement('select');
select.id='crm-stage-filter-56';
select.setAttribute('aria-label','Filtrar etapas do funil');
const options=[['all','Todas as etapas'],['open','Somente em aberto'],['closed','Fechados e perdidos'],['Novo lead','Novo lead'],['Contatado','Contatado'],['Agendado','Agendado'],['Avaliado','Avaliado'],['Orçamento','Orçamento'],['Fechado','Fechado'],['Perdida','Perdida']];
for(const [value,name] of options){const opt=document.createElement('option');opt.value=value;opt.textContent=name;select.append(opt)}
label.append(select);
const clear=document.createElement('button');
clear.type='button';clear.className='crm-clear-filters-56';clear.textContent='Limpar filtros';
bar.append(label,clear);
const notice=document.createElement('p');notice.className='crm-stage-notice-56';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
board.before(notice);
function apply(){const value=select.value;let visible=0;
 for(const col of board.querySelectorAll('.column')){
  const stage=col.dataset.stage||'';
  const match=value==='all'||(value==='open'&&stage!=='Fechado'&&stage!=='Perdida')||(value==='closed'&&(stage==='Fechado'||stage==='Perdida'))||value===stage;
  col.hidden=!match;if(match)visible++;
 }
 notice.textContent=value==='all'?'':visible?'Exibindo '+select.options[select.selectedIndex].textContent.toLocaleLowerCase('pt-BR')+'.':'Nenhuma etapa encontrada.';
 clear.disabled=value==='all'&&!search.value;
}
select.addEventListener('change',apply);
search.addEventListener('input',apply);
clear.addEventListener('click',()=>{select.value='all';search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));apply();search.focus()});
const observer=new MutationObserver(apply);
observer.observe(board,{childList:true});
apply();
})();
