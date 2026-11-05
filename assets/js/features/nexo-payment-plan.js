(()=>{'use strict';
const parse=s=>{s=String(s||'').trim();if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(',','.');return Number(s)||0};
const money=n=>n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
function update(panel,commit){const card=panel.closest('[data-oid]');if(!card)return;const field=card.querySelector('[data-f="cond"]'),totalEl=card.querySelector('[data-ototal]');if(!field||!totalEl)return;
const total=Math.max(0,parse(totalEl.textContent.replace(/[^\d,.]/g,'')));
const get=k=>panel.querySelector('[data-nxp="'+k+'"]');const entry=Math.max(0,parse(get('entrada').value));const rest=Math.max(0,total-entry),n=Math.min(60,Math.max(1,Math.floor(Number(get('parcelas').value)||1)));
const out=panel.querySelector('[data-nxres]');if(entry>total){out.textContent='A entrada não pode ultrapassar o total do orçamento.';out.style.color='#b42318';return}out.style.color='';out.textContent='Total: R$ '+money(total)+' | Entrada: R$ '+money(entry)+' | Restante: R$ '+money(rest)+(n>1?' | '+n+'x de R$ '+money(rest/n):'');
if(!commit)return;
const cond='Entrada: R$ '+money(entry)+' ('+get('formaEntrada').value+'); Restante: R$ '+money(rest)+' ('+get('formaSaldo').value+')'+(n>1?' em '+n+'x de R$ '+money(rest/n):'');
field.value=cond;field.dispatchEvent(new Event('input',{bubbles:true}));}
document.addEventListener('input',e=>{const p=e.target.closest('[data-nxplan]');if(p&&e.target.matches('[data-nxp]'))update(p,true)});
document.addEventListener('change',e=>{const p=e.target.closest('[data-nxplan]');if(p&&e.target.matches('[data-nxp]'))update(p,true)});
const observer=new MutationObserver(()=>{document.querySelectorAll('[data-nxplan]').forEach(p=>{if(!p.querySelector('[data-nxres]').textContent)update(p,false)})});
window.addEventListener('DOMContentLoaded',()=>observer.observe(document.body,{childList:true,subtree:true}));
})();
