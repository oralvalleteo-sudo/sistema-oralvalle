(()=>{'use strict';
const panel=document.getElementById('crm-view-panel');
const tabs=[...document.querySelectorAll('.crm-view-tabs [data-crm-view]')];
if(!panel||!tabs.length)return;
const groups=new Set(['overview','opportunities','followup','reports']);
// Classify by stable section identity rather than fragile child indexes.
const sectionGroups=[
 ['overview',['crm-goals','metrics']],
 ['opportunities',['board-heading','crm-funil-nav-266','board','crm-pending-compact']],
 ['followup',['followups','crm-daily','crm-operations','crm-tasks','crm-priorities','recovery','crm-recovery59','crm-budget-followup73','crm-extra-tools']],
 ['reports',['crm-management','crm-productivity','employee-performance','sales-report']]
];
function classify(node){
 if(node.dataset.crmSection&&groups.has(node.dataset.crmSection))return node.dataset.crmSection;
 if(node.classList.contains('crm-preview-section-title')){
  return /funil|oportunidad/i.test(node.textContent||'')?'opportunities':'overview';
 }
 for(const [group,classes] of sectionGroups){if(classes.some(cls=>node.classList.contains(cls)||node.id===cls))return group;}
 // Integrated lead lookup is an opportunity widget.
 if(node.querySelector('#integr-result'))return 'opportunities';
 return 'followup';
}
let current='overview';
try{const saved=sessionStorage.getItem('nexodent-crm-view');if(groups.has(saved))current=saved;}catch(e){}
function sync(){
 for(const node of [...panel.children]){
  const group=classify(node);
  node.dataset.crmSection=group;
  node.hidden=group!==current;
 }
 tabs.forEach(tab=>{
  const active=tab.dataset.crmView===current;
  tab.setAttribute('aria-selected',String(active));
  tab.tabIndex=active?0:-1;
 });
 const activeTab=tabs.find(tab=>tab.dataset.crmView===current);
 if(activeTab)panel.setAttribute('aria-labelledby',activeTab.id);
}
function activate(name,focus=false){
 current=groups.has(name)?name:'overview';sync();
 if(focus)tabs.find(tab=>tab.dataset.crmView===current)?.focus();
 try{sessionStorage.setItem('nexodent-crm-view',current);}catch(e){}
}
tabs.forEach((tab,i)=>{
 tab.addEventListener('click',()=>activate(tab.dataset.crmView));
 tab.addEventListener('keydown',e=>{
  if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
  e.preventDefault();
  const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  activate(tabs[next].dataset.crmView,true);
 });
});
// Other CRM modules inject widgets after this script initializes.
// Hide each newly injected widget unless it belongs to the active tab.
const observer=new MutationObserver(records=>{
 if(records.some(record=>record.type==='childList'&&record.addedNodes.length))sync();
});
observer.observe(panel,{childList:true});
sync();
})();
