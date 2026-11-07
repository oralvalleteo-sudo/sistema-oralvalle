(()=>{'use strict';
function setup(){
 const panel=document.getElementById('crm-view-panel');
 const daily=panel&&panel.querySelector('.crm-daily');
 if(!panel||!daily||document.getElementById('crm-extra-tools'))return;
 const details=document.createElement('details');details.id='crm-extra-tools';details.className='integration crm-extra-tools';
 const summary=document.createElement('summary');summary.textContent='Ferramentas adicionais de acompanhamento';
 const intro=document.createElement('p');intro.textContent='Consultas complementares. Abra somente quando precisar; a fila de contatos acima é a área principal de trabalho.';
 details.append(summary,intro);
 daily.insertAdjacentElement('afterend',details);
 // Preserve original DOM nodes and all event handlers; avoid duplicated lists on main screen.
 const extra=['.followups','.crm-priorities','.recovery','.crm-recovery59','.crm-budget-followup73'];
 for(const selector of extra){const el=panel.querySelector(selector);if(el&&el!==details)details.append(el)}
 // Keep the Kanban as the only main opportunity list; optional budget alert is in Follow-up.
 const label=document.querySelector('.crm-view-tabs [data-crm-view="followup"]');
 if(label)label.textContent='Atendimento';
 const overview=document.querySelector('.crm-view-tabs [data-crm-view="overview"]');
 if(overview)overview.textContent='Resumo';
 const title=panel.querySelector('.crm-daily #daily-title');if(title)title.textContent='Fila de atendimento';
 const sub=panel.querySelector('.crm-daily .daily-head p');if(sub)sub.textContent='Contatos pendentes, retornos e ações em um único lugar.';
 // Fix tab navigation for dynamic widgets: extras are children of a mapped section.
 const update=()=>{const current=document.querySelector('.crm-view-tabs [aria-selected="true"]');details.hidden=!!current&&current.dataset.crmView!=='followup'};
 document.querySelectorAll('.crm-view-tabs [data-crm-view]').forEach(b=>b.addEventListener('click',()=>queueMicrotask(update)));
 update();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();