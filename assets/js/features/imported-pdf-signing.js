/* NexoDent 184: PDF importado com assinaturas manuscritas separadas.
   Assinaturas inseridas como imagens: NÃO são ICP-Brasil. */
(()=>{'use strict';
const loadPdfLib=()=>new Promise((resolve,reject)=>{
 if(window.PDFLib)return resolve(window.PDFLib);
 const existing=document.querySelector('script[data-nexo-pdflib]');
 if(existing){existing.addEventListener('load',()=>resolve(window.PDFLib));existing.addEventListener('error',()=>reject(Error('Biblioteca PDF indisponível')));return;}
 const s=document.createElement('script');s.dataset.nexoPdflib='1';
 s.src='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
 s.onload=()=>window.PDFLib?resolve(window.PDFLib):reject(Error('Biblioteca PDF indisponível'));
 s.onerror=()=>reject(Error('Não foi possível carregar a biblioteca PDF'));
 document.head.append(s);
});
const read=f=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Falha na leitura do PDF'));r.readAsArrayBuffer(f)});
const dataUri=bytes=>'data:application/pdf;base64,'+btoa(Array.from(bytes,(x)=>String.fromCharCode(x)).join(''));
const draw=(canvas)=>{const ctx=canvas.getContext('2d');ctx.lineWidth=2.4;ctx.lineCap='round';ctx.strokeStyle='#1d2939';let active=false,used=false;
 const pos=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height]};
 canvas.addEventListener('pointerdown',e=>{active=true;canvas.setPointerCapture(e.pointerId);const [x,y]=pos(e);ctx.beginPath();ctx.moveTo(x,y)});
 canvas.addEventListener('pointermove',e=>{if(!active)return;const [x,y]=pos(e);ctx.lineTo(x,y);ctx.stroke();used=true});
 canvas.addEventListener('pointerup',()=>active=false);canvas.addEventListener('pointercancel',()=>active=false);
 return {used:()=>used,clear:()=>{ctx.clearRect(0,0,canvas.width,canvas.height);used=false}};
};
async function open(patient){
 if(!patient?.id)return;
 if(!window.OralCloud?.enabled||!window.OralCloudSync?.fileOperation||!window.OralCloud?.clinicId){alert('Conecte a clínica ao Supabase para importar documentos.');return}
 const cover=document.createElement('div');cover.style.cssText='position:fixed;inset:0;z-index:99999;background:#0009;display:flex;justify-content:center;align-items:center;padding:12px';
 const box=document.createElement('section');box.style.cssText='background:#fff;color:#222;border-radius:12px;padding:20px;width:min(720px,100%);max-height:95vh;overflow:auto';
 box.innerHTML=`<h2>Importar PDF e coletar assinaturas</h2><p>Paciente: <b data-patient></b></p><label>Documento PDF (máximo 10 MB)<input type="file" accept="application/pdf,.pdf" data-file></label><p><button type="button" data-preview>Visualizar PDF original</button></p><label>Dentista responsável<select data-dentist><option value="">Selecione o dentista</option></select></label><h3>Assinatura do dentista</h3><canvas data-draw="dentist" width="600" height="160" style="width:100%;height:135px;border:1px solid #bbb;touch-action:none;background:#fff"></canvas><button type="button" data-clear="dentist">Limpar</button><h3>Assinatura do paciente</h3><canvas data-draw="patient" width="600" height="160" style="width:100%;height:135px;border:1px solid #bbb;touch-action:none;background:#fff"></canvas><button type="button" data-clear="patient">Limpar</button><p><label><input type="checkbox" data-consent> Confirmo que o dentista e o paciente assinaram pessoalmente, após visualizar o documento.</label></p><p style="font-size:12px">As assinaturas serão inseridas como imagens em uma página adicional do PDF. Não constituem assinatura digital ICP-Brasil.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-save>Salvar PDF original e assinado no prontuário</button><button type="button" data-cancel>Cancelar</button></div><p data-status role="status"></p>`;
 box.querySelector('[data-patient]').textContent=patient.nome||'';
 const select=box.querySelector('[data-dentist]');(db.dt||[]).filter(d=>d.ativo!==false).forEach(d=>{const o=document.createElement('option');o.value=d.id;o.textContent=(d.nome||'Dentista')+' — '+(d.cro||'CRO não informado');select.append(o)});
 const state=typeof rxState==='function'?rxState(patient):null;if(state?.dt)select.value=state.dt;
 const signatures={};for(const who of ['dentist','patient']){signatures[who]=draw(box.querySelector(`[data-draw="${who}"]`));box.querySelector(`[data-clear="${who}"]`).onclick=()=>signatures[who].clear()}
 const fileInput=box.querySelector('[data-file]');const status=box.querySelector('[data-status]');
 const selected=()=>{const f=fileInput.files?.[0];if(!f||(!/\.pdf$/i.test(f.name)&&f.type!=='application/pdf'))throw Error('Selecione um arquivo PDF.');if(f.size>10*1024*1024)throw Error('O PDF deve ter no máximo 10 MB.');return f};
 box.querySelector('[data-preview]').onclick=()=>{try{const f=selected();const url=URL.createObjectURL(f);const w=window.open(url,'_blank','noopener');if(!w)alert('Permita pop-ups para visualizar o PDF.');setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(e){alert(e.message)}};
 box.querySelector('[data-cancel]').onclick=()=>cover.remove();
 box.querySelector('[data-save]').onclick=async()=>{
 const button=box.querySelector('[data-save]');try{
 const f=selected(),dentist=(db.dt||[]).find(d=>d.id===select.value);
 if(!dentist)throw Error('Selecione o dentista responsável.');
 if(!signatures.dentist.used()||!signatures.patient.used())throw Error('As duas assinaturas são necessárias.');
 if(!box.querySelector('[data-consent]').checked)throw Error('Confirme que as assinaturas foram realizadas pessoalmente.');
 button.disabled=true;status.textContent='Preparando PDF...';
 const lib=await loadPdfLib(),original=new Uint8Array(await read(f));
 const pdf=await lib.PDFDocument.load(original,{ignoreEncryption:false});
 if(!pdf.getPageCount())throw Error('PDF sem páginas.');
 const page=pdf.addPage([595.28,841.89]);const font=await pdf.embedFont(lib.StandardFonts.Helvetica);
 const text=(s,x,y,size=11)=>page.drawText(String(s||'').replace(/[^\x20-\x7e]/g,' ').slice(0,90),{x,y,size,font,color:lib.rgb(.12,.15,.2)});
 text('ANEXO - ASSINATURAS MANUSCRITAS',40,790,16);text('Paciente: '+(patient.nome||''),40,750);text('Dentista: '+(dentist.nome||''),40,727);text('CRO: '+(dentist.cro||'Nao informado'),40,705);
 const stamp=new Date().toISOString();text('Registro: '+stamp,40,680,10);
 text('Assinatura do dentista',40,620,12);
 const dentistImage=await pdf.embedPng(box.querySelector('[data-draw="dentist"]').toDataURL('image/png'));
 page.drawImage(dentistImage,{x:40,y:475,width:480,height:125});
 text('Assinatura do paciente',40,435,12);
 const patientImage=await pdf.embedPng(box.querySelector('[data-draw="patient"]').toDataURL('image/png'));
 page.drawImage(patientImage,{x:40,y:290,width:480,height:125});
 text('Assinaturas manuscritas em imagem - NAO ICP-Brasil.',40,245,10);
 const signed=await pdf.save();
 const originalData=dataUri(original),signedData=dataUri(signed);
 const base=f.name.replace(/\.pdf$/i,'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80);
 const op=window.OralCloudSync.fileOperation;
 status.textContent='Salvando original no Supabase...';
 await op(patient.id,'append',{file:{id:uid(),nome:base+'_ORIGINAL.pdf',tipo:'application/pdf',categoria:'Receituário',data:originalData,dataEnvio:hojeBR(),documentoImportado:true}});
 status.textContent='Salvando versão assinada no Supabase...';
 await op(patient.id,'append',{file:{id:uid(),nome:base+'_ASSINADO_MANUSCRITO.pdf',tipo:'application/pdf',categoria:'Documento assinado - Receituário',data:signedData,dataEnvio:hojeBR(),assinaturaTipo:'manuscrita (não ICP-Brasil)',dentistaNome:dentist.nome||'',dentistaCro:dentist.cro||'',assinadoEm:stamp}});
 status.textContent='Original e versão assinada salvos.';alert('PDF original e versão assinada salvos no prontuário. Não é assinatura ICP-Brasil.');cover.remove();if(typeof render==='function')render();
 }catch(e){status.textContent='Erro: '+(e.message||e);alert('Não foi possível concluir: '+(e.message||e)+'\nSe o primeiro arquivo foi salvo, confira o prontuário antes de tentar novamente.')}finally{button.disabled=false}
 };
 cover.append(box);document.body.append(cover);
}
window.NexoImportedPdfSigning={open};
if(typeof A!=='undefined')A.rximportpdf=(button,data,patient)=>open(patient);
})();
