/* PDF presencial com assinaturas em imagem; não é assinatura certificada ICP-Brasil. */
(()=>{'use strict';
async function hash(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function prepare(input){
 const {patient,dentist,title,body,type,signatures,signedAt,clinicId,userId,fileId}=input;
 if(!patient?.id||!dentist?.id||!clinicId||!userId||!title?.trim()||!body?.trim()||body.length>12000||title.length>160)throw Error('Revise paciente, dentista, título e conteúdo de até 12.000 caracteres.');
 for(const role of ['dentista','paciente'])if(!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(signatures?.[role]||'')||!signedAt?.[role])throw Error('Colete as duas assinaturas após revisar o documento.');
 if(!(await ensureJsPDF()))throw Error('Não foi possível carregar o gerador local de PDF.');
 const snapshot={clinicId,userId,patientId:patient.id,patientName:patient.nome,dentistId:dentist.id,dentistName:dentist.nome,cro:dentist.cro||'',title,body,type,signedAt};
 const contentHash=await hash(new TextEncoder().encode(JSON.stringify(snapshot))),now=new Date().toISOString();
 const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',compress:true});let y=20;
 pdf.setFont('helvetica','bold');pdf.setFontSize(17);pdf.setTextColor(25,35,50);
 const safe=s=>String(s??'').replace(/[−–—]/g,'-').replace(/[^\u0020-\u00ff\n]/g,' ');
 for(const line of pdf.splitTextToSize(safe(title),180)){if(y>275){pdf.addPage();y=20;}pdf.text(line,15,y);y+=8;}
 pdf.setFont('helvetica','normal');pdf.setFontSize(10);
 const write=(text,size=10)=>{pdf.setFontSize(size);for(const line of pdf.splitTextToSize(safe(text),180)){if(y>275){pdf.addPage();y=20;}pdf.text(line,15,y);y+=size*.45+2;}};
 write('Tipo: '+type);write('Paciente: '+patient.nome);write('Profissional: '+dentist.nome+' | CRO: '+(dentist.cro||'não informado'));y+=6;write(body,11);
 pdf.addPage();y=20;write('REGISTRO DE ASSINATURA PRESENCIAL',15);write(title);write('Paciente: '+patient.nome);write('Profissional: '+dentist.nome+' | CRO: '+(dentist.cro||'não informado'));write('Concordância: as pessoas identificadas revisaram o documento e autorizaram suas assinaturas.');
 for(const role of ['dentista','paciente']){y+=8;write('Assinatura do '+role);pdf.addImage(signatures[role],'PNG',15,y,160,37);y+=42;write('Capturada em: '+signedAt[role],9);}
 y+=4;write('Documento gerado em: '+now,9);write('Registro: '+fileId,9);write('Resumo SHA-256 do conteúdo e identificação: '+contentHash,8);write('Assinaturas eletrônicas simples inseridas como imagens. Não é assinatura digital ICP-Brasil. Datas de captura informadas pelo aparelho. O hash detecta alterações em relação ao registro salvo e não comprova identidade.',8);
 const bytes=new Uint8Array(pdf.output('arraybuffer'));if(bytes.length>1500000)throw Error('O PDF excedeu o limite do prontuário. Reduza o conteúdo e colete novamente as assinaturas.');
 const digest=await hash(bytes),filename='Documento_assinado_'+String(fileId).replace(/[^a-zA-Z0-9_-]/g,'')+'.pdf';
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 const data='data:application/pdf;base64,'+btoa(binary);
 // Arquivar, calcular hash e baixar exatamente os mesmos bytes, sem regenerar o PDF.
 const frozenPdf={save(name){const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}};
 return {pdf:frozenPdf,file:{id:fileId,nome:filename,tipo:'application/pdf',categoria:'Documento assinado - '+type,data,dataEnvio:new Date().toLocaleDateString('pt-BR'),assinaturaTipo:'eletrônica simples presencial (não ICP-Brasil)',dentistaNome:dentist.nome,dentistaCro:dentist.cro||'',assinadoEm:now,sha256:digest,conteudoSha256:contentHash,assinaturaRegistro:snapshot}};
}
window.NexoPresentialSigning={prepare};
})();
