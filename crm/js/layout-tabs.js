(()=>{'use strict';
const panel=document.getElementById('crm-view-panel');
const tabs=[...document.querySelectorAll('.crm-view-tabs [data-crm-view]')];
if(!panel||!tabs.length)return;
const views={overview:[],opportunities:[],followup:[],reports:[]};
const nodes=[...panel.children];
const mapping=[
 ['overview','crm-goals'],['overview','crm-preview-section-title'],['overview','metrics'],
 ['opportunities','crm-preview-section-title'],['opportunities','board-heading'],['opportunities','crm-funil-nav-266'],['opportunities','board'],
 ['followup','followups'],['followup','crm-daily'],['followup','crm-operations'],['followup','crm-tasks'],
 ['reports','crm-management'],['followup','crm-priorities'],['followup','recovery'],
 ['reports','crm-productivity'],['reports','employee-performance'],['reports','sales-report'],
 ['opportunities','crm-pending-compact'],
 ['opportunities','integration'],['opportunities','integration']
];
// If the HTML changes, avoid hiding unknown elements or breaking CRM actions.
if(nodes.length!==mapping.length||nodes.some((node,i)=>!node.classList.contains(mapping[i][1])&&node.id!==mapping[i][1])){
 console.warn('CRM: estrutura alterada; revise o mapeamento de abas.');return;
}
nodes.forEach((node,i)=>{node.dataset.crmSection=mapping[i][0];views[mapping[i][0]].push(node)});
function activate(name,focus=false){
 if(!views[name])name='overview';
 for(const node of nodes){node.hidden=node.dataset.crmSection!==name;}
 tabs.forEach(tab=>{const selected=tab.dataset.crmView===name;
 tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
 if(selected){panel.setAttribute('aria-labelledby',tab.id);if(focus)tab.focus();}});
 try{sessionStorage.setItem('nexodent-crm-view',name)}catch(e){}
}
tabs.forEach((tab,i)=>{
 tab.addEventListener('click',()=>activate(tab.dataset.crmView));
 tab.addEventListener('keydown',e=>{
  if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
  e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  activate(tabs[next].dataset.crmView,true);
 });
});
let initial='overview';try{initial=sessionStorage.getItem('nexodent-crm-view')||initial}catch(e){}
activate(initial);
})();
