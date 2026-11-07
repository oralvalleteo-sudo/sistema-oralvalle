/* CRM 83 — ajusta a fonte dos valores (R$) para caberem no cartão, sem quebrar nem cortar.
   Só mexe em estilo; não altera textos, IDs nem dados. Reduz apenas quando necessário. */
(()=>{'use strict';
const SEL='.crm-main .metrics strong,.crm-main .goals-stats strong';
const MIN=11;                       // nunca abaixo de 11px
const lastW=new WeakMap();
function fit(el){
  el.style.removeProperty('font-size');            // começa do tamanho definido no CSS
  const avail=el.clientWidth;
  if(!avail)return;                                // aba oculta: refaz quando aparecer (ResizeObserver)
  let size=parseFloat(getComputedStyle(el).fontSize);
  while(el.scrollWidth>avail+0.5&&size>MIN){
    size-=0.5;el.style.setProperty('font-size',size+'px','important');
  }
}
function fitAll(){document.querySelectorAll(SEL).forEach(fit)}
function watch(){
  const els=[...document.querySelectorAll(SEL)];
  if(!els.length)return false;
  const mo=new MutationObserver(list=>{const done=new Set();
    for(const m of list){const t=m.target.nodeType===1?m.target:m.target.parentElement;
      const el=t&&t.closest&&t.closest('strong');if(el&&!done.has(el)&&el.matches(SEL)){done.add(el);fit(el)}}});
  const ro=new ResizeObserver(entries=>{
    for(const e of entries){const w=Math.round(e.contentRect.width);
      if(lastW.get(e.target)===w)continue;          // evita laço: só reage a mudança de largura
      lastW.set(e.target,w);fit(e.target.querySelector('strong'));}
  });
  els.forEach(el=>{mo.observe(el,{childList:true,characterData:true,subtree:true});
    if(el.parentElement)ro.observe(el.parentElement);});
  fitAll();return true;
}
function start(){
  if(!watch())return;
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitAll);
  addEventListener('resize',fitAll,{passive:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
