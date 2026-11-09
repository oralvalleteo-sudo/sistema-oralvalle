/* Galeria de fotografias ortodônticas, vinculada ao prontuário do paciente. */
(function(){'use strict';
const cache=new Map();
const key=p=>String(window.OralCloud?.clinicId||'local')+':'+String(p.id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isPhoto=f=>String(f.categoria||'')==='Ortodontia - Fotos'&&String(f.tipo||'').startsWith('image/');
function gallery(p){const k=key(p),state=cache.get(k);if(window.OralCloud?.enabled&&!state){load(p);}
 const photos=window.OralCloud?.enabled?(state?.photos||[]):(p.arquivos||[]).filter(isPhoto);
 return `<div class="ortho-gallery" data-ortho-gallery="${safe(p.id)}"><div class="ortho-gallery-head"><strong>Fotos do paciente</strong><label class="ortho-upload">+ Adicionar fotos<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-ortho-photos="${safe(p.id)}" hidden></label></div><div class="ortho-thumbs">${photos.map((f,i)=>`<button type="button" class="ortho-thumb" data-ortho-view="${safe(p.id)}" data-ortho-index="${i}" aria-label="Ampliar foto ${i+1}"><img src="${safe(f.data||'')}" alt="Foto ortodôntica ${i+1}" loading="lazy"></button>`).join('')}${!photos.length?`<small>${state?.loading?'Carregando fotos...':state?.error?safe(state.error):'Nenhuma foto adicionada.'}</small>`:''}</div></div>`;
}
async function load(p){const k=key(p);if(cache.has(k))return;const state={photos:[],loading:true,error:''};cache.set(k,state);try{const rows=await OralCloudData.files(p.id);const matches=rows.filter(r=>r.slot==='arquivos'&&r.position>=0&&isPhoto(r.dados||{}));for(const r of matches){const full=await OralCloudData.file(p.id,r.id);const f=full.dados||{};if(isPhoto(f)&&/^data:image\/(jpeg|png|webp);base64,/.test(f.data||''))state.photos.push(f);}}catch(e){state.error=e.message||'Não foi possível carregar fotos';}finally{state.loading=false;refresh(p.id);}}
function refresh(id){document.querySelectorAll('[data-ortho-gallery]').forEach(el=>{if(el.dataset.orthoGallery!==String(id))return;const p=db.p.find(x=>String(x.id)===String(id));if(p)el.outerHTML=gallery(p);});}
function read(file){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=()=>no(Error('Erro ao ler imagem'));r.readAsDataURL(file);});}
const MAX_BYTES=1.5*1024*1024;
async function preparePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Formato não permitido: '+file.name);
 if(file.size<=MAX_BYTES)return {data:await read(file),tipo:file.type,nome:file.name};
 // Fotos grandes são reduzidas individualmente, sem limitar o tamanho total da seleção.
 const url=URL.createObjectURL(file);
 let img;
 try{
  img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Não foi possível abrir '+file.name));im.src=url;});
  let width=img.naturalWidth,height=img.naturalHeight;
  if(!width||!height)throw Error('Imagem inválida: '+file.name);
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Não foi possível processar a foto.');
  let longest=2400;
  for(let step=0;step<7;step++){
   const scale=Math.min(1,longest/Math.max(width,height));
   canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
   ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(img,0,0,canvas.width,canvas.height);
   for(const quality of [0.86,0.75,0.62,0.48]){
    const data=canvas.toDataURL('image/jpeg',quality);
    // Estimativa dos bytes do JPEG codificado em base64.
    const bytes=Math.floor((data.length-data.indexOf(',')-1)*3/4);
    if(bytes<=MAX_BYTES)return {data,tipo:'image/jpeg',nome:file.name.replace(/\.(png|webp|jpe?g)$/i,'')+'.jpg'};
   }
   longest=Math.round(longest*0.75);
  }
  throw Error('A foto '+file.name+' não pôde ser reduzida para 1,5 MB.');
 }finally{URL.revokeObjectURL(url);}
}
async function upload(input){
 const p=db.p.find(x=>String(x.id)===String(input.dataset.orthoPhotos));if(!p)return;
 const files=[...input.files];if(!files.length)return;
 input.disabled=true;let added=0;const errors=[];
 try{
  for(let i=0;i<files.length;i++){
   const f=files[i];
   try{
    const photo=await preparePhoto(f);
    const record={id:uid(),nome:photo.nome,tipo:photo.tipo,categoria:'Ortodontia - Fotos',data:photo.data,dataEnvio:hojeBR()};
    if(window.OralCloud?.enabled)await OralCloudSync.fileOperation(p.id,'append',{file:record});
    else{(p.arquivos=p.arquivos||[]).push(record);save();}
    added++;
   }catch(e){errors.push(f.name+': '+(e.message||e));}
  }
  cache.delete(key(p));
  if(window.OralCloud?.enabled)await load(p);else refresh(p.id);
  if(added)toast(added+' foto(s) adicionada(s) ao prontuário.'+(errors.length?' '+errors.length+' não enviada(s).':''),5000);
  if(errors.length){console.warn('Falhas no envio de fotos ortodônticas:',errors);if(!added)toast('Não foi possível enviar as fotos: '+errors[0],6000);}
 }catch(e){cache.delete(key(p));refresh(p.id);toast('Erro ao atualizar galeria: '+(e.message||e),5000);}
 finally{input.disabled=false;input.value='';}
}
document.addEventListener('change',e=>{if(e.target.matches('[data-ortho-photos]'))upload(e.target);});
document.addEventListener('click',e=>{const b=e.target.closest('[data-ortho-view]');if(!b)return;const p=db.p.find(x=>String(x.id)===String(b.dataset.orthoView));if(!p)return;const photos=window.OralCloud?.enabled?(cache.get(key(p))?.photos||[]):(p.arquivos||[]).filter(isPhoto);const f=photos[Number(b.dataset.orthoIndex)];if(!f)return;const overlay=document.createElement('div');overlay.className='ortho-photo-overlay';overlay.innerHTML=`<div class="ortho-photo-modal" role="dialog" aria-modal="true" aria-label="Foto do paciente"><button type="button" class="ortho-close">Fechar ✕</button><img alt="Foto ortodôntica ampliada" src="${safe(f.data)}"><small>${safe(f.nome||'Foto ortodôntica')}</small></div>`;overlay.addEventListener('click',ev=>{if(ev.target===overlay||ev.target.closest('.ortho-close'))overlay.remove();});document.body.append(overlay);overlay.querySelector('button').focus();});
window.NexoOrthoPhotos={gallery};
})();
