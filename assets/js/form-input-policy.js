/* Evita sugestões históricas de formulário; mantém seletores próprios e credenciais. */
(function(){'use strict';
 const credentials=new Set(['username','current-password','new-password','one-time-code']);
 function apply(node){if(node.nodeType!==1&&node.nodeType!==9)return;const fields=[];if(node.matches?.('input,textarea,select,form'))fields.push(node);fields.push(...node.querySelectorAll('input,textarea,select,form'));
  for(const field of fields){if(field.type==='password'||credentials.has(field.getAttribute('autocomplete'))||field.closest('[data-allow-autofill]'))continue;field.setAttribute('autocomplete','off');if(field.tagName!=='FORM'){field.setAttribute('data-lpignore','true');field.setAttribute('data-1p-ignore','true');}}
 }
 apply(document);
 new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)apply(node)}).observe(document.documentElement,{childList:true,subtree:true});
 document.addEventListener('focusin',event=>apply(event.target));
})();
