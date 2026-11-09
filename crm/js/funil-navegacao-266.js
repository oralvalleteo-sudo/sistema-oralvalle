/* Navegação independente: não altera leads, etapas ou banco de dados. */
(function(){'use strict';
function init(){
 const board=document.getElementById('board'),prev=document.getElementById('crm-funil-prev-266'),next=document.getElementById('crm-funil-next-266'),progress=document.getElementById('crm-funil-progress-266');
 if(!board||!prev||!next)return;
 function columns(){return Array.from(board.querySelectorAll(':scope > .column'));}
 function step(dir){const cols=columns();if(!cols.length)return;const x=board.scrollLeft;let target;
 if(dir>0){target=cols.find(c=>c.offsetLeft-board.offsetLeft>x+12)||cols[cols.length-1];}
 else{target=[...cols].reverse().find(c=>c.offsetLeft-board.offsetLeft<x-12)||cols[0];}
 board.scrollTo({left:target.offsetLeft-board.offsetLeft,behavior:'smooth'});
 }
 function update(){const max=Math.max(0,board.scrollWidth-board.clientWidth),x=board.scrollLeft;prev.disabled=x<4;next.disabled=x>=max-4;const cols=columns();if(progress)progress.textContent=max<5?'Todas as etapas visíveis':(cols.length+' etapas · use as setas');}
 prev.addEventListener('click',()=>step(-1));next.addEventListener('click',()=>step(1));
 board.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);
 board.addEventListener('wheel',e=>{if(!e.shiftKey||Math.abs(e.deltaY)<Math.abs(e.deltaX))return;if(board.scrollWidth<=board.clientWidth)return;e.preventDefault();board.scrollLeft+=e.deltaY;},{passive:false});
 new MutationObserver(()=>requestAnimationFrame(update)).observe(board,{childList:true});update();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
