(()=>{'use strict';
function setup(){
 const panel=document.getElementById('crm-view-panel');
 const pending=panel?.querySelector('#crm-pending-compact');
 if(!pending||document.getElementById('crm-extra-tools'))return;
 const details=document.createElement('details');
 details.id='crm-extra-tools';
 details.className='integration crm-extra-tools';
 const summary=document.createElement('summary');
 summary.textContent='Acompanhamento e recuperação de orçamentos';
 details.append(summary);
 for(const selector of ['.recovery','.crm-recovery59','.crm-budget-followup73']){
  const section=panel.querySelector(selector);
  if(!section)continue;
  section.hidden=false;
  details.append(section);
 }
 if(details.childElementCount>1)pending.after(details);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();