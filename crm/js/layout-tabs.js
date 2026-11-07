(()=>{'use strict';
// Cada componente pertence a uma única aba. Não clonar nem mover componentes.
const panel=document.getElementById('crm-view-panel');
const tabs=[...document.querySelectorAll('.crm-view-tabs [data-crm-view]')];
if(!panel||tabs.length!==4)return;
const children=[...panel.children];
const viewByIndex={
  0:'overview', 1:'overview', 2:'overview',
  3:'opportunities',4:'opportunities',5:'opportunities',
  6:'followup',7:'followup',8:'followup',9:'followup',
  10:'reports',11:'followup',12:'followup',13:'reports',
  14:'reports',15:'reports',16:'opportunities',17:'opportunities'
};
// Confere a estrutura antes de aplicar para evitar ocultar conteúdo após futuras mudanças.
const expected=['crm-goals','crm-preview-section-title','metrics','crm-preview-section-title','board-heading','board','followups','crm-daily','crm-operations','crm-tasks','crm-management','crm-priorities','recovery','crm-productivity','employee-performance','sales-report','integration','integration'];
const matches=(el,tag)=>el.id===tag||el.classList.contains(tag);
if(children.length!==expected.length||children.some((el,i)=>!matches(el,expected[i]))){console.warn('CRM: estrutura de abas diferente; organização preservada para evitar perda de conteúdo.');return;}
const titles={overview:'Visão geral',opportunities:'Oportunidades',followup:'Acompanhamento',reports:'Relatórios'};
function activate(name,focus=false){
 if(!titles[name])return;
 children.forEach((node,i)=>{node.hidden=viewByIndex[i]!==name;});
 tabs.forEach(tab=>{const active=tab.dataset.crmView===name;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active){panel.setAttribute('aria-labelledby',tab.id);if(focus)tab.focus();}});
 try{sessionStorage.setItem('nexodent-crm-view',name)}catch(e){}
}
tabs.forEach(tab=>{tab.addEventListener('click',()=>activate(tab.dataset.crmView));tab.addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const i=tabs.indexOf(tab);const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;activate(tabs[next].dataset.crmView,true);});});
let initial='overview';try{initial=sessionStorage.getItem('nexodent-crm-view')||initial}catch(e){}
activate(titles[initial]?initial:'overview');
})();
