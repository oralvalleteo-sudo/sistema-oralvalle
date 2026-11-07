(()=>{'use strict';
const board=document.getElementById('board');if(!board)return;
let updating=false;const expanded=new Set();
function compact(){if(updating)return;updating=true;
try{for(const col of board.querySelectorAll(':scope > .column')){
 const cards=Array.from(col.querySelectorAll(':scope > .card'));
 const key=col.dataset.stage||col.querySelector('h3')?.textContent||'etapa';
 let toggle=col.querySelector(':scope > .crm-stage-toggle');
 if(cards.length<=5){cards.forEach(c=>c.classList.remove('crm-card-collapsed'));if(toggle)toggle.remove();continue;}
 const showAll=expanded.has(key);
 cards.forEach((c,i)=>c.classList.toggle('crm-card-collapsed',!showAll&&i>=5));
 if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.className='crm-stage-toggle';toggle.addEventListener('click',()=>{if(expanded.has(key))expanded.delete(key);else expanded.add(key);compact();});col.append(toggle);}
 toggle.textContent=showAll?'Mostrar menos':'Ver todos ('+(cards.length-5)+' restantes)';
 }}finally{updating=false;}}
let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;compact()})};
new MutationObserver(schedule).observe(board,{childList:true,subtree:false});
compact();
})();