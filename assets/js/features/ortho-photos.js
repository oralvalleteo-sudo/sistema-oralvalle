/* Galeria de fotografias ortodônticas, vinculada ao prontuário do paciente. */
(function(){'use strict';
const cache=new Map(),busy=new Set();
const key=p=>String(window.OralCloud?.clinicId||'local')+':'+String(p.id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isPhoto=f=>String(f.categoria||'')==='Ortodontia - Fotos'&&String(f.tipo||'').startsWith('image/');
function gallery(p){const k=key(p),state=cache.get(k);if(window.OralCloud?.enabled&&!state)load(p);
 const photos=window.OralCloud?.enabled?(state?.photos||[]):(p.arquivos||[]).filter(isPhoto);
 const working=busy.has(k);
 return `<div class="ortho-gallery" data-ortho-gallery="${safe(p.id)}"><div class="ortho-gallery-head"><strong>Fotos do paciente</strong><label class="ortho-upload">+ Adicionar fotos<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-ortho-photos="${safe(p.id)}" ${working?'disabled':''} hidden></label></div><div class="ortho-thumbs">${photos.map((f,i)=>`<div class="ortho-photo-item"><button type="button" class="ortho-thumb" data-ortho-view="${safe(p.id)}" data-ortho-index="${i}" aria-label="Ampliar foto ${i+1}"><img src="${safe(f.data||'')}" alt="Foto ortodôntica ${i+1}" loading="lazy" decoding="async"></button><button type="button" class="ortho-delete" data-ortho-delete="${safe(p.id)}" data-ortho-index="${i}" aria-label="Excluir foto ${i+1}" title="Excluir foto" ${working?'disabled':''}>×</button></div>`).join('')}${!photos.length?`<small>${state?.loading?'Carregando fotos...':state?.error?safe(state.error):'Nenhuma foto adicionada.'}</small>`:''}</div><small class="ortho-status" aria-live="polite">${safe(state?.status||'')}${working?' Aguarde a conclusão.':''}</small></div>`;
}
async function load(p){const k=key(p);if(cache.has(k))return;const state={photos:[],loading:true,error:'',status:''};cache.set(k,state);
 try{const rows=await OralCloudData.files(p.id);const matches=rows.filter(r=>r.slot==='arquivos'&&r.position>=0&&isPhoto(r.dados||{}));
  const seen=new Set();const unique=matches.filter(r=>{const id=String(r.id);if(seen.has(id))return false;seen.add(id);return true;});
  // Limita as consultas simultâneas, evitando bloquear a interface.
  const results=new Array(unique.length);let next=0;
  await Promise.all(Array.from({length:Math.min(3,unique.length)},async()=>{while(next<unique.length){const i=next++;try{const full=await OralCloudData.file(p.id,unique[i].id);const f=full.dados||{};if(isPhoto(f)&&/^data:image\/(jpeg|png|webp);base64,/.test(f.data||''))results[i]={...f,_rowId:unique[i].id};}catch(e){console.warn('Foto não carregada',e);}}}));
  state.photos=results.filter(Boolean);
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
async function removePhoto(button){const p=db.p.find(x=>String(x.id)===String(button.dataset.orthoDelete));if(!p)return;
 const k=key(p);if(busy.has(k))return;const photos=window.OralCloud?.enabled?(cache.get(k)?.photos||[]):(p.arquivos||[]).filter(isPhoto);
 const f=photos[Number(button.dataset.orthoIndex)];if(!f||!confirm('Excluir esta fotografia do paciente? Esta ação não poderá ser desfeita.'))return;
 busy.add(k);refresh(p.id);
 try{if(window.OralCloud?.enabled){if(!f._rowId)throw Error('Identificador da fotografia não encontrado.');await OralCloudSync.fileOperation(p.id,'delete',{row_id:f._rowId});const state=cache.get(k);if(state)state.photos=state.photos.filter(x=>x!==f);}
 else{p.arquivos=p.arquivos.filter(x=>x!==f);save();}toast('Fotografia excluída.',3500);
 }catch(e){toast('Não foi possível excluir: '+(e.message||e),6000);}finally{busy.delete(k);refresh(p.id);}
}
document.addEventListener('change',e=>{if(e.target.matches('[data-ortho-photos]'))upload(e.target);});
document.addEventListener('click',e=>{const del=e.target.closest('[data-ortho-delete]');if(del){removePhoto(del);return;}const b=e.target.closest('[data-ortho-view]');if(!b)return;const p=db.p.find(x=>String(x.id)===String(b.dataset.orthoView));if(!p)return;const photos=window.OralCloud?.enabled?(cache.get(key(p))?.photos||[]):(p.arquivos||[]).filter(isPhoto);const f=photos[Number(b.dataset.orthoIndex)];if(!f)return;const overlay=document.createElement('div');overlay.className='ortho-photo-overlay';overlay.innerHTML=`<div class="ortho-photo-modal" role="dialog" aria-modal="true" aria-label="Foto do paciente"><button type="button" class="ortho-close">Fechar ✕</button><img alt="Foto ortodôntica ampliada" src="${safe(f.data)}"><small>${safe(f.nome||'Foto ortodôntica')}</small></div>`;overlay.addEventListener('click',ev=>{if(ev.target===overlay||ev.target.closest('.ortho-close'))overlay.remove();});document.body.append(overlay);overlay.querySelector('button').focus();});
window.NexoOrthoPhotos={gallery};
})();
