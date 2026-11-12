
/* Galeria de fotografias vinculada ao prontuário do paciente. */
(function(){
'use strict';

const cache=new Map(),busy=new Set();
const uploadedThumbs=new Map();
const previews=new Map();
const previewQueue=[];
const previewPending=new Set();
let previewActive=0;
const observedPreviews=new WeakSet(),previewObservers=new Set();
const sharedPreviews=new Map();
let photoContext='';
function ensurePhotoContext(){
 const current=String(window.OralCloud?.clinicId||'local')+':'+String(window.OralCloud?.session?.user?.id||'local');
 if(current===photoContext)return;
 photoContext=current;cache.clear();previews.clear();uploadedThumbs.clear();sharedPreviews.clear();previewQueue.length=0;previewPending.clear();
 for(const observer of previewObservers)observer.disconnect();
 previewObservers.clear();
}
async function sharedPreview(job){
 const token=job.context.replace(/:[^:]+$/,'')+':'+job.rowId;
 if(sharedPreviews.has(token))return sharedPreviews.get(token);
 const task=(async()=>{const full=await OralCloudData.file(job.id,job.rowId);return mini(full?.dados?.data);})();
 sharedPreviews.set(token,task);
 try{const thumb=await task;if(sharedPreviews.get(token)===task){sharedPreviews.set(token,Promise.resolve(thumb));while(sharedPreviews.size>200)sharedPreviews.delete(sharedPreviews.keys().next().value);}return thumb;}
 catch(error){if(sharedPreviews.get(token)===task)sharedPreviews.delete(token);throw error;}
}

const key=(p,scope='ortho')=>
 String(window.OralCloud?.clinicId||'local')+':'+String(window.OralCloud?.session?.user?.id||'local')+':'+String(p.id)+':'+scope;

const category=scope=>({
 patient:'Imagem clínica',
 ortho:'Ortodontia - Fotos',
 impl:'Implantodontia - Fotos',
 prot:'Prótese - Fotos'
}[scope]||('Laboratório - Fotos - '+scope.slice(4)));

const scopeOf=el=>el?.dataset?.photoScope||'ortho';

const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

function isSharedPhoto(f){
 return /imagem cl[ií]nica|fotograf/i.test(String(f.categoria||''));
}

function isPhoto(f,scope='ortho'){
 if(!String(f.tipo||'').startsWith('image/'))return false;
 if(scope==='patient')return isSharedPhoto(f);
 return String(f.categoria||'')===category(scope)||isSharedPhoto(f);
}

function isOwnPhoto(f,scope){
 return String(f.categoria||'')===category(scope);
}

function mini(data){
 return new Promise(resolve=>{
  if(!data||!data.startsWith('data:image/'))return resolve('');
  const im=new Image();
  im.onload=()=>{
   try{
    const c=document.createElement('canvas');
    const scale=Math.min(1,180/Math.max(im.width,im.height));
    c.width=Math.max(1,Math.round(im.width*scale));
    c.height=Math.max(1,Math.round(im.height*scale));
    c.getContext('2d').drawImage(im,0,0,c.width,c.height);
    resolve(c.toDataURL('image/jpeg',.58));
   }catch(_){resolve('');}
  };
  im.onerror=()=>resolve('');
  im.src=data;
 });
}

function getPhotos(p,scope){
 return window.OralCloud?.enabled
  ?(cache.get(key(p,scope))?.photos||[])
  :(p.arquivos||[]).filter(f=>isPhoto(f,scope));
}

function scheduleLegacyPreviews(id,scope){
 for(const observer of previewObservers)if(!observer.photoTarget?.isConnected){observer.disconnect();previewObservers.delete(observer);}
 const p=db.p.find(x=>String(x.id)===String(id));
 if(!p||!window.OralCloud?.enabled)return;
 const k=key(p,scope),state=cache.get(k);
 if(!state||state.loading)return;

 const roots=[...document.querySelectorAll('[data-ortho-gallery]')]
  .filter(el=>el.dataset.orthoGallery===String(id)&&scopeOf(el)===scope&&el.getClientRects().length);
 if(!roots.length)return;

 const enqueue=(f)=>{
  if(!f||f.thumb||!f._rowId)return;
  const token=k+':'+f._rowId;
  if(previewPending.has(token)||previews.has(token))return;
  previewPending.add(token);
  previewQueue.push({id,scope,rowId:f._rowId,token,context:k});
  pumpPreviews();
 };
 for(const root of roots){
  for(const button of root.querySelectorAll('[data-ortho-index]')){
   const f=state.photos[Number(button.dataset.orthoIndex)];
   if(!f||f.thumb||!f._rowId)continue;
   if(!window.IntersectionObserver){enqueue(f);continue;}
   if(observedPreviews.has(button))continue;
   observedPreviews.add(button);
   const observer=new IntersectionObserver(entries=>{
    if(!entries.some(entry=>entry.isIntersecting))return;
    observer.disconnect();previewObservers.delete(observer);
    const current=db.p.find(x=>String(x.id)===String(id));
    if(current&&key(current,scope)===k)enqueue(f);
   },{rootMargin:'180px'});
   observer.photoTarget=button;previewObservers.add(observer);observer.observe(button);
  }
 }

 pumpPreviews();
}

function pumpPreviews(){
 while(previewActive<3&&previewQueue.length){
  const job=previewQueue.shift();
  previewActive++;
  (async()=>{
   try{
    const patient=db.p.find(x=>String(x.id)===String(job.id));
    if(!patient||key(patient,job.scope)!==job.context)return;
    const thumb=await sharedPreview(job);
    if(key(patient,job.scope)!==job.context)return;
    if(!thumb)return;
    previews.set(job.token,thumb);

    const p=db.p.find(x=>String(x.id)===String(job.id));
    if(!p)return;
    const state=cache.get(key(p,job.scope));
    const f=state?.photos.find(x=>String(x._rowId)===String(job.rowId));
    if(f)f.thumb=thumb;

    document.querySelectorAll('[data-ortho-gallery]').forEach(root=>{
     if(root.dataset.orthoGallery!==String(job.id)||scopeOf(root)!==job.scope)return;
     const index=state?.photos.indexOf(f);
     if(index<0)return;
     const img=root.querySelector(`[data-ortho-index="${index}"] img`);
     if(img)img.src=thumb;
    });
   }catch(e){
    console.warn('Miniatura antiga indisponível:',e?.message||e);
   }finally{
    previewPending.delete(job.token);
    previewActive--;
    pumpPreviews();
   }
  })();
 }
}

function hydrateVisibleGalleries(){
 document.querySelectorAll('[data-ortho-gallery]').forEach(el=>{
  if(el.getClientRects().length)
   scheduleLegacyPreviews(el.dataset.orthoGallery,scopeOf(el));
 });
}

document.addEventListener('toggle',e=>{
 if(e.target.matches('details'))
  setTimeout(hydrateVisibleGalleries,0);
},true);

function gallery(p,scope='ortho'){
 ensurePhotoContext();
 setTimeout(()=>scheduleLegacyPreviews(p.id,scope),0);
 const k=key(p,scope),state=cache.get(k);
 if(window.OralCloud?.enabled&&!state)load(p,scope);

 const photos=getPhotos(p,scope);
 const ownPhotos=photos.filter(f=>isOwnPhoto(f,scope));
 const working=busy.has(k);

 return `<div class="ortho-gallery" data-ortho-gallery="${safe(p.id)}" data-photo-scope="${safe(scope)}">
 <div class="ortho-gallery-head">
 <strong>Fotos do paciente</strong>
 <div class="ortho-gallery-actions">
 <button type="button" class="ortho-manage"
 data-ortho-manage="${safe(p.id)}"
 data-photo-scope="${safe(scope)}"
 ${working||!ownPhotos.length?'disabled':''}>Excluir fotos</button>
 <label class="ortho-upload">+ Adicionar fotos
 <input type="file" accept="image/jpeg,image/png,image/webp" multiple
 data-ortho-photos="${safe(p.id)}"
 data-photo-scope="${safe(scope)}"
 ${working?'disabled':''} hidden>
 </label></div></div>
 <div class="ortho-thumbs">
 ${photos.map((f,i)=>`<div class="ortho-photo-item">
 <button type="button" class="ortho-thumb"
 data-ortho-view="${safe(p.id)}"
 data-photo-scope="${safe(scope)}"
 data-ortho-index="${i}"
 aria-label="Ampliar foto ${i+1}">
 <img src="${safe(f.thumb||previews.get(k+':'+(f._rowId||f.id))||f.data||'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2290%22 height=%2290%22%3E%3Crect width=%2290%22 height=%2290%22 fill=%22%23f0f2f5%22/%3E%3C/svg%3E')}"
 alt="Foto do paciente ${i+1}" loading="lazy" decoding="async">
 </button></div>`).join('')}
 ${!photos.length?`<small>${state?.loading?'Carregando fotos...':state?.error?safe(state.error):'Nenhuma foto adicionada.'}</small>`:''}
 </div>
 <small>Novas fotos são otimizadas para carregar mais rápido. Guarde os originais da câmera quando precisar deles.</small>
 <small class="ortho-status" aria-live="polite">${safe(state?.status||'')}${working?' Aguarde a conclusão.':''}</small>
 </div>`;
}

async function load(p,scope='ortho'){
 const k=key(p,scope);
 if(cache.has(k))return;

 const state={photos:[],loading:true,error:'',status:''};
 cache.set(k,state);

 try{
  const rows=await OralCloudData.files(p.id);
  const matches=rows.filter(r=>
   r.slot==='arquivos'&&r.position>=0&&isPhoto(r.dados||{},scope)
  );
  const seen=new Set();
  state.photos=matches.filter(r=>{
   if(seen.has(String(r.id)))return false;
   seen.add(String(r.id));
   return true;
  }).map(r=>({
   ...r.dados,
   _rowId:r.id,
   thumb:r.dados.thumb||previews.get(k+':'+r.id)||uploadedThumbs.get(k+':'+r.dados?.id)||'',
   data:''
  }));

  state.status=state.photos.some(f=>!f.thumb)
   ?'Carregando miniaturas de fotografias antigas…':'';
 }catch(e){
  state.error=e.message||'Não foi possível carregar fotos';
 }finally{
  state.loading=false;
  refresh(p.id,scope);
  setTimeout(()=>scheduleLegacyPreviews(p.id,scope),0);
 }
}

function refresh(id,scope='ortho'){
 document.querySelectorAll('[data-ortho-gallery]').forEach(el=>{
  if(el.dataset.orthoGallery!==String(id)||scopeOf(el)!==scope)return;
  const p=db.p.find(x=>String(x.id)===String(id));
  if(p)el.outerHTML=gallery(p,scope);
 });
 setTimeout(()=>scheduleLegacyPreviews(id,scope),0);
}

const MAX_BYTES=450*1024;

async function preparePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))
  throw Error('Formato não permitido: '+file.name);

 const url=URL.createObjectURL(file);
 try{
  const img=await new Promise((resolve,reject)=>{
   const im=new Image();
   im.onload=()=>resolve(im);
   im.onerror=()=>reject(Error('Não foi possível abrir '+file.name));
   im.src=url;
  });

  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Não foi possível processar a foto.');

  for(const maxSide of [1600,1280,1050]){
   const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
   canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
   canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   ctx.fillStyle='#fff';
   ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(img,0,0,canvas.width,canvas.height);

   for(const quality of [.82,.74,.66]){
    const data=canvas.toDataURL('image/jpeg',quality);
    if(Math.floor((data.length-data.indexOf(',')-1)*3/4)<=MAX_BYTES)
     return {
      data,
      tipo:'image/jpeg',
      nome:file.name.replace(/\.(png|webp|jpe?g)$/i,'')+'.jpg'
     };
   }
  }
  throw Error('Não foi possível reduzir '+file.name);
 }finally{
  URL.revokeObjectURL(url);
 }
}

function fingerprint(f){
 return [f.nome,f.data?.length,f.data?.slice(-120)].join(':');
}

async function upload(input){
 const p=db.p.find(x=>String(x.id)===String(input.dataset.orthoPhotos));
 if(!p)return;
 const files=[...input.files];
 if(!files.length)return;

 const scope=scopeOf(input),k=key(p,scope);
 if(busy.has(k))return;
 busy.add(k);

 let added=0,skipped=0;
 const errors=[];

 try{
  if(window.OralCloud?.enabled&&!cache.has(k))await load(p,scope);
  const existing=new Set(
   getPhotos(p,scope).map(fingerprint)
  );

  for(let i=0;i<files.length;i++){
   const state=cache.get(k);
   if(state)state.status=`Enviando ${i+1} de ${files.length} fotos…`;
   refresh(p.id,scope);

   try{
    const photo=await preparePhoto(files[i]);
    const fp=fingerprint(photo);
    if(existing.has(fp)){skipped++;continue;}

    const thumb=await mini(photo.data);
    const record={
     id:uid(),
     nome:photo.nome,
     tipo:photo.tipo,
     categoria:category(scope),
     data:photo.data,
     thumb,
     dataEnvio:hojeBR()
    };

    if(window.OralCloud?.enabled){
     await OralCloudSync.fileOperation(p.id,'append',{file:record});
     uploadedThumbs.set(k+':'+record.id,thumb);
    }
    else{
     (p.arquivos=p.arquivos||[]).push(record);
     save();
    }
    existing.add(fp);
    added++;
   }catch(e){
    errors.push(files[i].name+': '+(e.message||e));
   }
  }

  if(window.OralCloud?.enabled){
   cache.delete(k);
   await load(p,scope);
   if(scope==='patient'){
    for(const other of ['ortho','impl','prot'])
     cache.delete(key(p,other));
   }
  }else refresh(p.id,scope);

  toast(`${added} foto(s) adicionada(s).${skipped?' '+skipped+' repetida(s) ignorada(s).':''}${errors.length?' '+errors.length+' falha(s).':''}`,6000);
  if(errors.length)console.warn('Falhas no envio:',errors);
 }catch(e){
  toast('Erro na galeria: '+(e.message||e),6000);
 }finally{
  busy.delete(k);
  const state=cache.get(k);
  if(state)state.status='';
  refresh(p.id,scope);
  input.value='';
 }
}

function managePhotos(id,scope='ortho'){
 const p=db.p.find(x=>String(x.id)===String(id));
 if(!p)return;

 const k=key(p,scope);
 if(busy.has(k))return;

 // Apenas fotos próprias desta especialidade podem ser excluídas aqui.
 const photos=getPhotos(p,scope).filter(f=>isOwnPhoto(f,scope));
 if(!photos.length)return;

 const overlay=document.createElement('div');
 overlay.className='ortho-photo-overlay ortho-selection-overlay';
 overlay.innerHTML=`<div class="ortho-select-modal" role="dialog" aria-modal="true" aria-label="Selecionar fotografias para excluir">
 <div class="ortho-select-head"><strong>Selecionar fotos para excluir</strong>
 <button type="button" data-ortho-cancel>Fechar ✕</button></div>
 <p>Selecione as fotografias que deseja remover. Nenhuma foto será excluída antes da confirmação.</p>
 <div class="ortho-select-grid">
 ${photos.map((f,i)=>`<label class="ortho-select-item">
 <input type="checkbox" value="${i}" aria-label="Selecionar foto ${i+1}">
 <img src="${safe(f.thumb||previews.get(k+':'+(f._rowId||f.id))||f.data||'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2290%22 height=%2290%22%3E%3Crect width=%2290%22 height=%2290%22 fill=%22%23f0f2f5%22/%3E%3C/svg%3E')}" alt="Foto ${i+1}" loading="lazy" decoding="async">
 <span>${safe(f.nome||'Foto '+(i+1))}</span></label>`).join('')}
 </div>
 <div class="ortho-select-footer">
 <label><input type="checkbox" data-ortho-all> Selecionar todas</label>
 <span data-ortho-count>0 selecionadas</span>
 <button type="button" class="ortho-confirm-delete" disabled>Excluir selecionadas</button>
 </div>
 <small class="ortho-delete-progress" aria-live="polite"></small>
 </div>`;

 const close=()=>overlay.remove();
 overlay.addEventListener('click',e=>{
  if(e.target===overlay||e.target.closest('[data-ortho-cancel]'))close();
 });

 const checks=[...overlay.querySelectorAll('.ortho-select-item input')];
 const all=overlay.querySelector('[data-ortho-all]');
 const confirmBtn=overlay.querySelector('.ortho-confirm-delete');
 const count=overlay.querySelector('[data-ortho-count]');

 function update(){
  const n=checks.filter(c=>c.checked).length;
  count.textContent=`${n} selecionada(s)`;
  confirmBtn.disabled=!n;
  all.checked=n===checks.length;
  all.indeterminate=n>0&&n<checks.length;
 }

 checks.forEach(c=>c.addEventListener('change',update));
 all.addEventListener('change',()=>{
  checks.forEach(c=>c.checked=all.checked);
  update();
 });

 confirmBtn.addEventListener('click',async()=>{
  const selected=checks.filter(c=>c.checked)
   .map(c=>photos[Number(c.value)]);

  if(!selected.length)return;
  if(!confirm(`Excluir ${selected.length} fotografia(s) permanentemente?`))return;

  busy.add(k);
  confirmBtn.disabled=true;
  all.disabled=true;
  checks.forEach(c=>c.disabled=true);

  let removed=0;
  const failures=[];

  try{
   for(const f of selected){
    overlay.querySelector('.ortho-delete-progress').textContent=
     `Excluindo ${removed+failures.length+1} de ${selected.length}…`;

    try{
     if(!isOwnPhoto(f,scope))
      throw Error('Esta foto pertence ao prontuário compartilhado.');

     if(window.OralCloud?.enabled){
      if(!f._rowId)
       throw Error('Identificador não encontrado');

      await OralCloudSync.fileOperation(p.id,'delete',{
       row_id:f._rowId
      });

      previews.delete(k+':'+f._rowId);

      const state=cache.get(k);
      if(state)
       state.photos=state.photos.filter(x=>x!==f);
     }else{
      p.arquivos=p.arquivos.filter(x=>x!==f);
      save();
     }

     removed++;
    }catch(e){
     failures.push(e.message||String(e));
    }

    refresh(p.id,scope);
   }

   toast(`${removed} foto(s) excluída(s).${failures.length?' '+failures.length+' falha(s).':''}`,6000);

   if(failures.length)
    console.warn('Falhas ao excluir:',failures);

   close();
  }finally{
   busy.delete(k);
   refresh(p.id,scope);
  }
 });

 document.body.append(overlay);
 overlay.querySelector('[data-ortho-cancel]').focus();
}

document.addEventListener('change',e=>{
 if(e.target.matches('[data-ortho-photos]'))
  upload(e.target);
});

document.addEventListener('click',async e=>{
 const manage=e.target.closest('[data-ortho-manage]');

 if(manage){
  managePhotos(manage.dataset.orthoManage,scopeOf(manage));
  return;
 }

 const b=e.target.closest('[data-ortho-view]');
 if(!b)return;

 const p=db.p.find(x=>String(x.id)===String(b.dataset.orthoView));
 if(!p)return;

 const scope=scopeOf(b);
 const photos=getPhotos(p,scope);

 let f=photos[Number(b.dataset.orthoIndex)];
 if(!f)return;

 if(!f.data&&f._rowId){
  try{
   const full=await OralCloudData.file(p.id,f._rowId);
   if(!full?.dados?.data)
    throw Error('Imagem indisponível');

   f={...full.dados,_rowId:f._rowId};
  }catch(err){
   toast('Não foi possível abrir a fotografia.',5000);
   return;
  }
 }

 if(!String(f.data||'').startsWith('data:image/')){
  toast('Imagem indisponível.',5000);
  return;
 }

 const overlay=document.createElement('div');
 overlay.className='ortho-photo-overlay';

 overlay.innerHTML=`<div class="ortho-photo-modal"
 role="dialog" aria-modal="true"
 aria-label="Foto do paciente">
 <button type="button" class="ortho-close">Fechar ✕</button>
 <img decoding="async" alt="Foto do paciente ampliada" src="${safe(f.data)}">
 <small>${safe(f.nome||'Foto do paciente')}</small>
 </div>`;

 overlay.addEventListener('click',ev=>{
  if(ev.target===overlay||ev.target.closest('.ortho-close'))
   overlay.remove();
 });

 document.body.append(overlay);
 overlay.querySelector('button').focus();
});

window.NexoOrthoPhotos={gallery};

})();
