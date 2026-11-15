/* NexoDent: mensagens manuais de WhatsApp, sem API paga. */
(function(){
 const defaults={
 consulta:n=>`Olá, ${n}! Tudo bem? Aqui é da clínica. Gostaríamos de confirmar sua próxima consulta. Pode nos confirmar sua presença?`,
 lembrete:n=>`Olá, ${n}! Passando para lembrar da sua consulta. Se precisar remarcar, responda por aqui.`,
 retorno:n=>`Olá, ${n}! Tudo bem? Gostaríamos de saber se deseja agendar seu retorno.`,
 pos:n=>`Olá, ${n}! Estamos entrando em contato para saber como você está após o atendimento. Se tiver alguma dúvida, estamos à disposição.`,
 aniversario:n=>`Feliz aniversário, ${n}! Desejamos muita saúde e alegrias!`,
 personalizada:n=>`Olá, ${n}! Tudo bem?`
 };
 Object.assign(defaults,{
 primeiro:n=>`Olá, ${n}! Aqui é da Clínica Oral Valle. Trabalhamos com tratamentos particulares. Você procura implante, prótese ou outro atendimento?`,
 sus:n=>`Olá, ${n}! Nosso atendimento é particular e não realizamos tratamentos pelo SUS. Podemos explicar como funciona a avaliação e as condições de pagamento.`,
 implantes:n=>`Olá, ${n}! Podemos ajudar com informações sobre implantes particulares. Você procura repor um dente ou vários? O tratamento é definido após avaliação.`,
 proteses:n=>`Olá, ${n}! Temos atendimento particular para próteses dentárias. Podemos agendar uma avaliação para conhecer as opções indicadas para o seu caso?`,
 valores:n=>`Olá, ${n}! O valor depende do tratamento indicado após avaliação. Qual atendimento você procura?`,
 acompanhamento:n=>`Olá, ${n}! Você ainda tem interesse em agendar sua avaliação na Clínica Oral Valle? Posso consultar os horários disponíveis.`
 });
 const groups=[['Novos contatos',{primeiro:'Primeiro contato',sus:'Atendimento particular / SUS',implantes:'Implantes',proteses:'Próteses',valores:'Dúvidas sobre valores',acompanhamento:'Retomar contato'}],['Consultas',{consulta:'Confirmação de consulta',lembrete:'Lembrete',retorno:'Retorno'}],['Pós-atendimento',{pos:'Pós-atendimento',aniversario:'Aniversário',personalizada:'Personalizada'}]];
 const STORAGE='nexodent_wa_templates_v1';
 function read(){try{const v=JSON.parse(localStorage.getItem(STORAGE)||'{}');return v&&typeof v==='object'?v:{}}catch(_){return {}}}
 function templates(){return Object.assign({},defaults,read())}
 function renderTemplate(key,name){const v=templates()[key];return typeof v==='string'?v.replaceAll('{nome}',name):v(name)}
 window.nexoWaSettingsHtml=function(){const saved=read();return `<div class="ov-page-head"><div><h1>WhatsApp</h1><p class="sub">Prepare mensagens, revise e abra uma conversa para envio manual.</p></div></div>
 <section class="card"><h2>Prepare sua mensagem</h2><div class="wa-compose-grid">
 <div><label for="wa-contact-name">Primeiro nome</label><input id="wa-contact-name" autocomplete="off" placeholder="Nome do contato">
 <label for="wa-contact-phone">WhatsApp com DDD</label><input id="wa-contact-phone" type="tel" autocomplete="off" placeholder="(33) 99999-9999">
 <label for="wa-compose-template">Modelo</label><select id="wa-compose-template">${groups.map(([group,items])=>`<optgroup label="${group}">${Object.entries(items).map(([k,label])=>`<option value="${k}">${label}</option>`).join('')}</optgroup>`).join('')}</select></div>
 <div><label for="wa-compose-message">Prévia editável</label><textarea id="wa-compose-message" rows="7">${escapeHtml(renderTemplate('primeiro','{nome}'))}</textarea><div class="row" style="gap:10px;flex-wrap:wrap"><button type="button" id="wa-compose-copy" class="ghost">Copiar mensagem</button><button type="button" id="wa-compose-open">Abrir no WhatsApp</button></div></div></div><p id="wa-feedback" role="status" aria-live="polite" class="note"></p><p class="note">Nenhuma mensagem é enviada automaticamente. Revise o destinatário e o texto no WhatsApp.</p></section>
 <section class="card" style="border-top:4px solid #f97316"><h2>Modelos de mensagens</h2><p class="note">Use {nome} para inserir o primeiro nome. Os modelos são salvos somente neste navegador, sem sincronização entre computadores. Não inclua dados clínicos sensíveis sem necessidade.</p>
 ${groups.map(([group,items],i)=>`<details ${i===0?'open':''}><summary style="cursor:pointer;padding:16px 0;font-weight:700">${group}</summary>${Object.entries(items).map(([k,label])=>`<label for="wa-setting-${k}">${label}</label><textarea id="wa-setting-${k}" rows="3" data-wa-key="${k}">${escapeHtml(typeof saved[k]==='string'?saved[k]:defaults[k]('{nome}'))}</textarea>`).join('')}</details>`).join('')}
 <div class="row" style="margin-top:15px;gap:10px;flex-wrap:wrap"><button type="button" id="wa-settings-save">Salvar modelos</button><button type="button" id="wa-settings-reset" class="ghost">Restaurar padrões</button></div><p id="wa-save-status" role="status" aria-live="polite" class="note"></p></section><style>.wa-compose-grid{display:grid;grid-template-columns:minmax(200px,1fr) minmax(260px,2fr);gap:24px}.wa-compose-grid input,.wa-compose-grid select{width:100%;box-sizing:border-box;margin-bottom:14px}@media(max-width:700px){.wa-compose-grid{grid-template-columns:1fr}}</style>`};
 function feedback(message){const el=document.getElementById('wa-feedback');if(el)el.textContent=message}
 function compose(){const select=document.getElementById('wa-compose-template'),message=document.getElementById('wa-compose-message');if(!select||!message)return;const name=document.getElementById('wa-contact-name').value.trim().split(/\s+/)[0]||'{nome}';const editor=document.querySelector('[data-wa-key="'+select.value+'"]');message.value=(editor?editor.value:renderTemplate(select.value,'{nome}')).replaceAll('{nome}',name)}
 document.addEventListener('input',e=>{if(e.target.id==='wa-contact-name')compose();if(e.target.matches('[data-wa-key]')){const status=document.getElementById('wa-save-status');if(status)status.textContent='Alterações não salvas.';if(document.getElementById('wa-compose-template')?.value===e.target.dataset.waKey)compose()}});
 document.addEventListener('change',e=>{if(e.target.id==='wa-compose-template')compose()});
 function escapeHtml(t){return String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function patient(){try{return typeof cur==='function'?cur():null}catch(_){return null}}
 function update(){const p=patient(),sel=document.getElementById('nexo-wa-template'),msg=document.getElementById('nexo-wa-msg');if(!p||!sel||!msg)return;const first=String(p.nome||'').trim().split(/\s+/)[0]||'paciente';msg.value=renderTemplate(sel.value,first)}
 document.addEventListener('change',e=>{if(e.target.id==='nexo-wa-template')update()});
 document.addEventListener('click',e=>{
  // Interrompe ações manuais de WhatsApp quando a permissão comercial for negada.
  // Trata-se de proteção de interface, não de autorização de API.
  const waAction=e.target.closest('#wa-settings-save,#wa-settings-reset,#nexo-wa-open,#nexo-wa-copy,#wa-compose-open,#wa-compose-copy');
  if(waAction && window.NexoModules?.isAllowed('wa') === false){
    e.preventDefault(); e.stopImmediatePropagation();
    alert('O módulo WhatsApp está desativado para esta clínica.'); return;
  }
 const composeButton=e.target.closest('#wa-compose-open,#wa-compose-copy');
 if(composeButton){const value=document.getElementById('wa-compose-message').value.trim();if(!value){feedback('Escreva uma mensagem primeiro.');return}if(/\{[^}]+\}/.test(value)){feedback('Preencha o nome ou remova os campos entre chaves antes de continuar.');return}if(composeButton.id==='wa-compose-copy'){navigator.clipboard.writeText(value).then(()=>feedback('Mensagem copiada.'),()=>feedback('Não foi possível copiar. Selecione e copie o texto da prévia.'));return}const phone=document.getElementById('wa-contact-phone').value.replace(/\D/g,'');if(!/^\d{10,11}$/.test(phone)&&!/^55\d{10,11}$/.test(phone)){feedback('Informe um telefone brasileiro válido com DDD.');return}waOpen(phone.length<=11?'55'+phone:phone,value);feedback('Revise a mensagem e envie pelo WhatsApp.');return}
 if(e.target.closest('#wa-settings-save')){const next={};document.querySelectorAll('[data-wa-key]').forEach(el=>next[el.dataset.waKey]=el.value);try{localStorage.setItem(STORAGE,JSON.stringify(next));document.getElementById('wa-save-status').textContent='Modelos salvos neste navegador.'}catch(_){alert('Não foi possível salvar neste navegador.')}return}
 if(e.target.closest('#wa-settings-reset')){if(!confirm('Restaurar todas as mensagens padrão?'))return;try{localStorage.removeItem(STORAGE);if(typeof render==='function')render()}catch(_){alert('Não foi possível restaurar os modelos neste navegador.')}return}
 const b=e.target.closest('#nexo-wa-open,#nexo-wa-copy');if(!b)return;const p=patient(),msg=document.getElementById('nexo-wa-msg');if(!p||!msg)return;const value=msg.value.trim();if(!value){alert('Escreva uma mensagem primeiro.');return}if(b.id==='nexo-wa-copy'){if(typeof copy==='function')copy(value);else navigator.clipboard.writeText(value);return}const digits=String(p.tel||'').replace(/\D/g,'');if(digits.length!==10&&digits.length!==11&&!(digits.startsWith('55')&&(digits.length===12||digits.length===13))){alert('Cadastre um telefone válido com DDD nos dados do paciente.');return}waOpen(p.tel,value)});
 const obs=new MutationObserver(()=>{const sel=document.getElementById('nexo-wa-template'),msg=document.getElementById('nexo-wa-msg');if(sel&&msg&&!msg.dataset.nexoReady){msg.dataset.nexoReady='1';update()}});
 document.addEventListener('DOMContentLoaded',()=>obs.observe(document.body,{childList:true,subtree:true}));
})();
