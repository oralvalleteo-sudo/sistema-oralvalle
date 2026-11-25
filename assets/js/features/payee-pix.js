(function(){
 'use strict';
 const table='/rest/v1/nexodent_payee_pix';
 const clinic=()=>window.OralCloud?.enabled&&window.OralCloud.clinicId;
 const access=(type,write=false)=>{
  const level=write?2:1;
  return !!clinic()&&typeof pmLvl==='function'&&pmLvl('vd')>=level&&
   (type==='dentist'?pmLvl('dt')>=level:type==='laboratory'&&pmLvl('lab')>=1&&pmLvl('pac')>=1);
 };
 function button(type,id,name){
  if(!access(type)||!id)return '';
  return `<button type="button" class="ghost sm" data-payee-pix="${type}" data-payee-id="${esc(id)}" data-payee-name="${esc(name)}">Chave Pix</button>`;
 }
 let active;
 function close(){
  if(active)active.close();
 }
 document.addEventListener('click',async event=>{
  const trigger=event.target.closest('[data-payee-pix]');
  if(!trigger||active)return;
  const type=trigger.dataset.payeePix,id=trigger.dataset.payeeId,clinicId=clinic();
  if(!access(type))return;
  const dialog=document.createElement('dialog');
  dialog.className='card';
  dialog.setAttribute('aria-labelledby','nexo-payee-heading');
  dialog.style.maxWidth='min(440px, 92vw)';
  dialog.innerHTML=`<h2 id="nexo-payee-heading">Chave Pix</h2><p>${esc(trigger.dataset.payeeName)}</p>
   <form><label for="nexo-payee-key">Chave para recebimento</label>
   <input id="nexo-payee-key" maxlength="200" autocomplete="off" spellcheck="false" disabled>
   <p role="status">Carregando chave Pix…</p><div class="row">
   <button type="button" class="ghost">Fechar</button>
   <button type="submit" hidden disabled>Salvar chave Pix</button></div></form>`;
  const form=dialog.querySelector('form'),field=form.querySelector('input');
  const status=form.querySelector('[role="status"]'),submit=form.querySelector('[type="submit"]');
  form.querySelector('[type="button"]').addEventListener('click',close);
  dialog.addEventListener('close',()=>{dialog.remove();if(active===dialog)active=null;});
  active=dialog;
  document.body.append(dialog);
  dialog.showModal();
  const current=()=>dialog.open&&clinic()===clinicId&&access(type);
  const filters=new URLSearchParams({clinic_id:'eq.'+clinicId,payee_type:'eq.'+type,payee_id:'eq.'+id,select:'pix_key'});
  try{
   const rows=await window.OralCloud.request(table+'?'+filters);
   if(!current())return;
   if(!Array.isArray(rows))throw Error();
   field.value=rows[0]?.pix_key||'';
   field.disabled=false;
   field.readOnly=!access(type,true);
   submit.hidden=submit.disabled=field.readOnly;
   status.textContent=field.readOnly?(field.value?'Consulta':'Nenhuma chave cadastrada.'):'Deixe em branco para remover a chave.';
  }catch(_){
   if(current())status.textContent='Chave Pix indisponível. A configuração do banco ou o acesso precisa ser conferido.';
   return;
  }
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   if(!current()||!access(type,true)||submit.disabled)return;
   const key=field.value.trim();
   field.readOnly=true;submit.disabled=true;status.textContent='Salvando…';
   try{
    const rows=await window.OralCloud.request(table+'?on_conflict=clinic_id,payee_type,payee_id',{
     method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},
     body:{clinic_id:clinicId,payee_type:type,payee_id:id,pix_key:key}
    });
    if(!current())return;
    if(!Array.isArray(rows)||rows[0]?.pix_key!==key)throw Error();
    field.value=key;status.textContent=key?'Chave Pix salva.':'Chave Pix removida.';
   }catch(_){
    if(current())status.textContent='Não foi possível confirmar a gravação. Confira a chave antes de tentar novamente.';
   }finally{
    if(current()&&access(type,true)){field.readOnly=false;submit.disabled=false;}
   }
  });
 });
 for(const event of ['nexodent:signed-out','nexodent:clinic-data-loaded','nexodent:modules-updated'])window.addEventListener(event,close);
 window.NexoPayeePix={button};
})();
