/* Galeria de fotografias ortodônticas, vinculada ao prontuário do paciente. */
(function(){'use strict';
const cache=new Map(),busy=new Set(),deleteSelection=new Set();
// Miniaturas leves em cache apenas durante esta sessão; não persiste imagens clínicas no navegador.
const previews=new Map();
function mini(data){return new Promise(resolve=>{if(!data||!data.startsWith('data:image/'))return resolve('');const im=new Image();im.onload=()=>{try{const c=document.createElement('canvas');const scale=Math.min(1,180/Math.max(im.width,im.height));c.width=Math.max(1,Math.round(im.width*scale));c.height=Math.max(1,Math.round(im.height*scale));c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.58));}catch(_){resolve('');}};im.onerror=()=>resolve('');im.src=data;});}
const key=p=>String(window.OralCloud?.clinicId||'local')+':'+String(p.id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isPhoto=f=>String(f.categoria||'')==='Ortodontia - Fotos'&&String(f.tipo||'').startsWith('image/');
function gallery(p){const k=key(p),state=cache.get(k);if(window.OralCloud?.enabled&&!state)load(p);
 const photos=window.OralCloud?.enabled?(state?.photos||[]):(p.arquivos||[]).filter(isPhoto);
 const working=busy.has(k);
 return `<div class="ortho-gallery" data-ortho-gallery="${safe(p.id)}"><div class="ortho-gallery-head"><strong>Fotos do paciente</strong><div class="ortho-gallery-actions"><button type="button" class="ortho-manage" data-ortho-manage="${safe(p.id)}" ${working||!photos.length?'disabled':''}>Excluir fotos</button><label class="ortho-upload">+ Adicionar fotos<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-ortho-photos="${safe(p.id)}" ${working?'disabled':''} hidden></label></div></div><div class="ortho-thumbs">${photos.map((f,i)=>`<div class="ortho-photo-item"><button type="button" class="ortho-thumb" data-ortho-view="${safe(p.id)}" data-ortho-index="${i}" aria-label="Ampliar foto ${i+1}"><img src="${safe(f.thumb||previews.get(k+':'+(f._rowId||f.id))||f.data||'')}" alt="Foto ortodôntica ${i+1}" loading="lazy" decoding="async"></button></div>`).join('')}${!photos.length?`<small>${state?.loading?'Carregando fotos...':state?.error?safe(state.error):'Nenhuma foto adicionada.'}</small>`:''}</div><small class="ortho-status" aria-live="polite">${safe(state?.status||'')}${working?' Aguarde a conclusão.':''}</small></div>`;
}
async function load(p){const k=key(p);if(cache.has(k))return;const state={photos:[],loading:true,error:'',status:''};cache.set(k,state);
 try{const rows=await OralCloudData.files(p.id);const matches=rows.filter(r=>r.slot==='arquivos'&&r.position>=0&&isPhoto(r.dados||{}));
  const seen=new Set();const unique=matches.filter(r=>{const id=String(r.id);if(seen.has(id))return false;seen.add(id);return true;});
  // Limita as consultas simultâneas, evitando bloquear a interface.
  const results=new Array(unique.length);let next=0;
  // Mostra miniaturas já processadas imediatamente, sem baixar novamente os arquivos completos.
  unique.forEach((r,i)=>{const t=previews.get(k+':'+r.id);if(t)results[i]={...(r.dados||{}),_rowId:r.id,thumb:t,data:'',tipo:'image/jpeg',categoria:'Ortodontia - Fotos'};});
  state.photos=results.filter(Boolean);refresh(p.id);state.status=`Carregando 0 de ${unique.length} fotos…`;
  await Promise.all(Array.from({length:Math.min(3,unique.length)},async()=>{while(next<unique.length){const i=next++;try{const full=await OralCloudData.file(p.id,unique[i].id);const f=full.dados||{};if(isPhoto(f)&&/^data:image\/(jpeg|png|webp);base64,/.test(f.data||'')){const thumb=await mini(f.data);if(thumb)previews.set(k+':'+unique[i].id,thumb);
    results[i]={...f,_rowId:unique[i].id,thumb};state.photos=results.filter(Boolean);state.status=`Carregando ${state.photos.length} de ${unique.length} fotos…`;refresh(p.id);}}catch(e){console.warn('Foto não carregada',e);}}}));
  state.photos=results.filter(Boolean);state.status='';
 }catch(e){state.error=e.message||'Não foi possível carregar fotos';}finally{state.loading=false;refresh(p.id);}}
function refresh(id){document.querySelectorAll('[data-ortho-gallery]').forEach(el=>{if(el.dataset.orthoGallery!==String(id))return;const p=db.p.find(x=>String(x.id)===String(id));if(p)el.outerHTML=gallery(p);});}
function read(file){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=()=>no(Error('Erro ao ler imagem'));r.readAsDataURL(file);});}
const MAX_BYTES=1.5*1024*1024;
async function preparePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Formato não permitido: '+file.name);
 const url=URL.createObjectURL(file);
 try{const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Não foi possível abrir '+file.name));im.src=url;});
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw Error('Não foi possível processar a foto.');
  // Limita resolução de TODAS as fotos, inclusive as menores que 1,5 MB.
  for(const maxSide of [1280,1050,850,650]){
   const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   for(const quality of [.76,.64,.52]){const data=canvas.toDataURL('image/jpeg',quality);if(Math.floor((data.length-data.indexOf(',')-1)*3/4)<=MAX_BYTES)return {data,tipo:'image/jpeg',nome:file.name.replace(/\.(png|webp|jpe?g)$/i,'')+'.jpg'};}
  }throw Error('Não foi possível reduzir '+file.name);
 }finally{URL.revokeObjectURL(url);}
}
function fingerprint(f){return [f.nome,f.data?.length,f.data?.slice(-120)].join(':');}
async function upload(input){
 const p=db.p.find(x=>String(x.id)===String(input.dataset.orthoPhotos));if(!p)return;
 const files=[...input.files];if(!files.length)return;const k=key(p);if(busy.has(k))return;
 busy.add(k);let added=0,skipped=0;const errors=[];
 try{
  if(window.OralCloud?.enabled&&!cache.has(k))await load(p);
  const existing=new Set((window.OralCloud?.enabled?(cache.get(k)?.photos||[]):(p.arquivos||[]).filter(isPhoto)).map(fingerprint));
  for(let i=0;i<files.length;i++){
   const state=cache.get(k);if(state)state.status=`Enviando ${i+1} de ${files.length} fotos…`;refresh(p.id);
   try{const photo=await preparePhoto(files[i]);const fp=fingerprint(photo);if(existing.has(fp)){skipped++;continue;}
    const record={id:uid(),nome:photo.nome,tipo:photo.tipo,categoria:'Ortodontia - Fotos',data:photo.data,dataEnvio:hojeBR()};
    if(window.OralCloud?.enabled)await OralCloudSync.fileOperation(p.id,'append',{file:record});else{(p.arquivos=p.arquivos||[]).push(record);save();}
    existing.add(fp);added++;
   }catch(e){errors.push(files[i].name+': '+(e.message||e));}
  }
  if(window.OralCloud?.enabled){cache.delete(k);await load(p);}else refresh(p.id);
  toast(`${added} foto(s) adicionada(s).${skipped?' '+skipped+' repetida(s) ignorada(s).':''}${errors.length?' '+errors.length+' falha(s).':''}`,6000);
  if(errors.length)console.warn('Falhas no envio:',errors);
 }catch(e){toast('Erro na galeria: '+(e.message||e),6000);}finally{busy.delete(k);const state=cache.get(k);if(state)state.status='';refresh(p.id);input.value='';}
}
function managePhotos(id){
 const p=db.p.find(x=>String(x.id)===String(id));if(!p)return;
 const k=key(p);if(busy.has(k))return;
 const photos=window.OralCloud?.enabled?(cache.get(k)?.photos||[]):(p.arquivos||[]).filter(isPhoto);
 if(!photos.length)return;
 const overlay=document.createElement('div');overlay.className='ortho-photo-overlay ortho-selection-overlay';
 overlay.innerHTML=`<div class="ortho-select-modal" role="dialog" aria-modal="true" aria-label="Selecionar fotografias para excluir"><div class="ortho-select-head"><strong>Selecionar fotos para excluir</strong><button type="button" data-ortho-cancel>Fechar ✕</button></div><p>Selecione as fotografias que deseja remover. Nenhuma foto será excluída antes da confirmação.</p><div class="ortho-select-grid">${photos.map((f,i)=>`<label class="ortho-select-item"><input type="checkbox" value="${i}" aria-label="Selecionar foto ${i+1}"><img src="${safe(f.data||'')}" alt="Foto ${i+1}" loading="lazy"><span>${safe(f.nome||'Foto '+(i+1))}</span></label>`).join('')}</div><div class="ortho-select-footer"><label><input type="checkbox" data-ortho-all> Selecionar todas</label><span data-ortho-count>0 selecionadas</span><button type="button" class="ortho-confirm-delete" disabled>Excluir selecionadas</button></div><small class="ortho-delete-progress" aria-live="polite"></small></div>`;
 const close=()=>overlay.remove();overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('[data-ortho-cancel]'))close();});
 const checks=[...overlay.querySelectorAll('.ortho-select-item input')],all=overlay.querySelector('[data-ortho-all]'),confirmBtn=overlay.querySelector('.ortho-confirm-delete'),count=overlay.querySelector('[data-ortho-count]');
 function update(){const n=checks.filter(c=>c.checked).length;count.textContent=`${n} selecionada(s)`;confirmBtn.disabled=!n;all.checked=n===checks.length;all.indeterminate=n>0&&n<checks.length;}
 checks.forEach(c=>c.addEventListener('change',update));all.addEventListener('change',()=>{checks.forEach(c=>c.checked=all.checked);update();});
 confirmBtn.addEventListener('click',async()=>{const selected=checks.filter(c=>c.checked).map(c=>photos[Number(c.value)]);if(!selected.length)return;if(!confirm(`Excluir ${selected.length} fotografia(s) permanentemente?`))return;
 busy.add(k);confirmBtn.disabled=true;all.disabled=true;checks.forEach(c=>c.disabled=true);let removed=0;const failures=[];
 try{for(const f of selected){overlay.querySelector('.ortho-delete-progress').textContent=`Excluindo ${removed+failures.length+1} de ${selected.length}…`;
 try{if(window.OralCloud?.enabled){if(f._rowId)previews.delete(k+':'+f._rowId);if(!f._rowId)throw Error('Identificador não encontrado');await OralCloudSync.fileOperation(p.id,'delete',{row_id:f._rowId});const state=cache.get(k);if(state)state.photos=state.photos.filter(x=>x!==f);}else{p.arquivos=p.arquivos.filter(x=>x!==f);save();}removed++;}catch(e){failures.push(e.message||String(e));}refresh(p.id);}
 toast(`${removed} foto(s) excluída(s).${failures.length?' '+failures.length+' falha(s).':''}`,6000);if(failures.length)console.warn('Falhas ao excluir:',failures);close();
 }finally{busy.delete(k);refresh(p.id);}});
 document.body.append(overlay);overlay.querySelector('[data-ortho-cancel]').focus();
}
document.addEventListener('change',e=>{if(e.target.matches('[data-ortho-photos]'))upload(e.target);});
document.addEventListener('click',async e=>{const manage=e.target.closest('[data-ortho-manage]');if(manage){managePhotos(manage.dataset.orthoManage);return;}const b=e.target.closest('[data-ortho-view]');if(!b)return;const p=db.p.find(x=>String(x.id)===String(b.dataset.orthoView));if(!p)return;const photos=window.OralCloud?.enabled?(cache.get(key(p))?.photos||[]):(p.arquivos||[]).filter(isPhoto);let f=photos[Number(b.dataset.orthoIndex)];if(!f)return;if(!f.data&&f._rowId){try{const full=await OralCloudData.file(p.id,f._rowId);f={...full.dados,_rowId:f._rowId};}catch(err){toast('Não foi possível abrir a fotografia.',5000);return;}}const overlay=document.createElement('div');overlay.className='ortho-photo-overlay';overlay.innerHTML=`<div class="ortho-photo-modal" role="dialog" aria-modal="true" aria-label="Foto do paciente"><button type="button" class="ortho-close">Fechar ✕</button><img alt="Foto ortodôntica ampliada" src="${safe(f.data)}"><small>${safe(f.nome||'Foto ortodôntica')}</small></div>`;overlay.addEventListener('click',ev=>{if(ev.target===overlay||ev.target.closest('.ortho-close'))overlay.remove();});document.body.append(overlay);overlay.querySelector('button').focus();});
window.NexoOrthoPhotos={gallery};
})();
