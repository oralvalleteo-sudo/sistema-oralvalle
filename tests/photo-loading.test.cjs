const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('arquivos independentes carregam em paralelo com limite três e validam paciente',async()=>{
 let active=0,peak=0;const parent=JSON.stringify([null,'p',['id','p1']]);
 const cloud={enabled:true,clinicId:'c',session:{user:{id:'u'}},request:async(url,{body})=>{
  if(url.endsWith('clinic_load_start'))return {protocol:2,revision:'0',access:{patients:{read:true,admin:true,write:{p:true}}}};
  if(url.endsWith('clinic_load_page'))return {revision:'0',next:null,rows:[{id:JSON.stringify([null,'p']),parent_id:null,slot:'p',position:-1,kind:'array',dados:null},{id:parent,parent_id:null,slot:'p',position:0,kind:'object',dados:{id:'p1',nome:'Synthetic'}}]};
  if(url.endsWith('clinic_row_chunk')){active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,15));active--;return {revision:'0',next:null,text:JSON.stringify({id:body.p_id,parent_id:body.p_id==='wrong'?'other':parent,dados:{data:'synthetic'}})};}
  throw Error(url);
 }};
 const window={OralCloud:cloud};vm.runInNewContext(fs.readFileSync('assets/js/supabase/data.js','utf8'),{window,console,Map,Set,Promise,JSON});
 await window.OralCloudData.load();await Promise.all(['a','b','c','d','e'].map(id=>window.OralCloudData.file('p1',id)));assert.equal(peak,3);
 await assert.rejects(window.OralCloudData.file('p1','wrong'),/não pertence/);
 const switching=window.OralCloudData.file('p1','a');const rejected=assert.rejects(switching,/mudaram|conta mudou/);await new Promise(r=>setTimeout(r,1));cloud.session.user.id='other';await rejected;
});
test('listagem retorna miniatura limitada e preserva sigilo do documento assinado',async()=>{
 const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();try{
 await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';");
 for(const n of ['202610140001_relational_clinics.sql','202610200002_bounded_clinic_reads.sql','202611110010_signed_file_protection.sql','202611120012_photo_thumbnails.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+n,'utf8'));
 const c='11111111-1111-1111-1111-111111111111',u='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';await db.query('insert into clinics(id,nome)values($1,$2)',[c,'Synthetic']);await db.query('insert into auth.users values($1,$2)',[u,'synthetic@example.invalid']);await db.query('insert into clinic_members(clinic_id,user_id,admin)values($1,$2,true)',[c,u]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u]);
 const read=async dados=>(await db.query("select private.read_row($1,'patient_files',$2,true) result",[c,JSON.stringify({slot:'arquivos',kind:'object',dados})])).rows[0].result.dados;
 const thumb='data:image/jpeg;base64,YQ==',photo={id:'a',tipo:'image/jpeg',data:'private-original',thumb};assert.equal((await read(photo)).thumb,thumb);assert.equal((await read(photo)).data,undefined);
 assert.equal((await read({...photo,thumb:'data:image/svg+xml;base64,YQ=='})).thumb,null);assert.equal((await read({...photo,thumb:'data:image/jpeg;base64,'+'a'.repeat(33000)})).thumb,null);
 const signed=await read({tipo:'application/pdf',data:'private-pdf',assinaturaRegistro:{secret:'secret'},sha256:'a'.repeat(64),thumb});assert.equal(signed.thumb,null);assert.equal(signed.assinaturaRegistro,undefined);assert.equal(signed.sha256,'a'.repeat(64));
 }finally{await db.close();}
});
