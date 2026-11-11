const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C1='11111111-1111-1111-1111-111111111111',C2='22222222-2222-2222-2222-222222222222';
const users=['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4'];
let nonce=0;const key=()=>`00000000-0000-0000-0000-${String(++nonce).padStart(12,'0')}`;
async function database(){const {PGlite}=await import(process.env.PGLITE_MODULE||'/workspace/.onboarding/pglite/node_modules/@electric-sql/pglite/dist/index.js');const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';`);await db.exec(fs.readFileSync('supabase/migrations/202610140001_relational_clinics.sql','utf8'));await db.exec(fs.readFileSync('supabase/migrations/202611110008_internal_communication.sql','utf8'));await db.exec(fs.readFileSync('supabase/migrations/202611110009_chat_file_limit_10mb.sql','utf8'));
await db.query('insert into clinics(id,nome) values($1,$3),($2,$4)',[C1,C2,'Clínica A','Clínica B']);
for(let i=0;i<users.length;i++){await db.query('insert into auth.users(id,email) values($1,$2)',[users[i],`synthetic${i}@example.invalid`]);await db.query('insert into clinic_members(clinic_id,user_id,nome,admin,perms) values($1,$2,$3,$4,null)',[i===3?C2:C1,users[i],`Pessoa ${i+1}`,i===0||i===3]);}
return db;}
const login=(db,id)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
const create=async(db,members,kind='direct',name='')=>(await db.query('select nexodent_chat_create($1,$2,$3,$4) id',[C1,kind,name,members])).rows[0].id;
const send=async(db,room,body,attachment=null,id=key())=>(await db.query('select nexodent_chat_send($1,$2,$3,$4,$5) id',[C1,room,id,body,attachment])).rows[0].id;
test('conversa individual, não lidas e privacidade inclusive contra administrador não participante',async()=>{const db=await database();try{
 await login(db,users[0]);const room=await create(db,[users[1]]);assert.equal(await create(db,[users[1]]),room);
 await assert.rejects(create(db,[users[3]]),e=>e.code==='42501');
 const n=key(),id=await send(db,room,'Olá equipe',null,n);assert.equal(await send(db,room,'Olá equipe',null,n),id);await assert.rejects(send(db,room,'Alterada',null,n));
 await login(db,users[1]);let list=(await db.query('select nexodent_chat_rooms_list($1) result',[C1])).rows[0].result;assert.equal(Number(list.rooms[0].unread),1);assert.equal((await db.query('select nexodent_chat_unread($1) count',[C1])).rows[0].count,'1');
 const page=(await db.query('select nexodent_chat_messages_page($1,$2) result',[C1,room])).rows[0].result;assert.equal(page.messages[0].body,'Olá equipe');assert.equal(typeof page.messages[0].id,'string');
 await db.query('select nexodent_chat_mark_read($1,$2,$3)',[C1,room,id]);list=(await db.query('select nexodent_chat_rooms_list($1) result',[C1])).rows[0].result;assert.equal(Number(list.rooms[0].unread),0);
 await login(db,users[2]);await assert.rejects(db.query('select nexodent_chat_messages_page($1,$2)',[C1,room]),e=>e.code==='42501');const privateRoom=await create(db,[users[1]]);
 await login(db,users[0]);await assert.rejects(db.query('select nexodent_chat_detail($1,$2)',[C1,privateRoom]),e=>e.code==='42501');
 await login(db,users[3]);await assert.rejects(db.query('select nexodent_chat_rooms_list($1)',[C1]),e=>e.code==='42501');await assert.rejects(db.query('select nexodent_chat_detail($1,$2)',[C2,room]),e=>e.code==='42501');
 const acl=(await db.query("select has_table_privilege('authenticated','nexodent_chat_messages','select') direct,has_function_privilege('anon','nexodent_chat_messages_page(uuid,uuid,bigint,bigint)','execute') anonymous")).rows[0];assert.equal(acl.direct,false);assert.equal(acl.anonymous,false);
 }finally{await db.close()}});
test('grupo, remoção de participantes, acesso de leitura e desativação',async()=>{const db=await database();try{
 await login(db,users[0]);const group=await create(db,[users[1],users[2]],'group','Equipe');await send(db,group,'Histórico do grupo');
 await db.query("update clinic_members set perms='{\"chat\":\"view\"}' where user_id=$1",[users[2]]);
 await login(db,users[2]);assert.equal((await db.query('select nexodent_chat_messages_page($1,$2) result',[C1,group])).rows[0].result.messages.length,1);await assert.rejects(send(db,group,'Não pode enviar'),e=>e.code==='42501');
 await login(db,users[1]);await assert.rejects(db.query('select nexodent_chat_group_members($1,$2,$3)',[C1,group,[users[1],users[2]]]),e=>e.code==='42501');
 await login(db,users[0]);await db.query('select nexodent_chat_group_members($1,$2,$3)',[C1,group,[users[2]]]);
 await login(db,users[1]);await assert.rejects(db.query('select nexodent_chat_messages_page($1,$2)',[C1,group]),e=>e.code==='42501');await assert.rejects(send(db,group,'Removido'),e=>e.code==='42501');
 await login(db,users[0]);await db.query("select clinic_update_member($1,$2,'{\"perms\":{\"chat\":\"none\"}}')",[C1,users[2]]);
 await login(db,users[2]);await assert.rejects(db.query('select nexodent_chat_people($1)',[C1]),e=>e.code==='42501');
 await login(db,users[0]);await db.query('update clinic_members set active=false where user_id=$1',[users[2]]);await login(db,users[2]);await assert.rejects(db.query('select nexodent_chat_detail($1,$2)',[C1,group]),e=>e.code==='42501');
 }finally{await db.close()}});
test('arquivo privado com hash, rejeição de tipo adulterado e limite de envio',async()=>{const db=await database();try{
 await login(db,users[0]);const room=await create(db,[users[1]]),file={name:'informacoes.pdf',mime:'application/pdf',base64:Buffer.from('%PDF-1.4\nDocumento sintético').toString('base64')},id=await send(db,room,'Arquivo',file);
 await login(db,users[1]);const page=(await db.query('select nexodent_chat_messages_page($1,$2) result',[C1,room])).rows[0].result;assert.equal(page.messages[0].attachment.name,file.name);assert.equal(page.messages[0].attachment.base64,undefined);
 const result=(await db.query('select nexodent_chat_download($1,$2,$3) result',[C1,room,id])).rows[0].result;assert.equal(Buffer.from(result.base64,'base64').toString(),'%PDF-1.4\nDocumento sintético');assert.equal(result.sha256,require('node:crypto').createHash('sha256').update(Buffer.from(file.base64,'base64')).digest('hex'));
 await login(db,users[2]);await assert.rejects(db.query('select nexodent_chat_download($1,$2,$3)',[C1,room,id]),e=>e.code==='42501');
 await login(db,users[0]);await assert.rejects(send(db,room,'',{name:'script.html',mime:'text/html',base64:'AAAA'}));await assert.rejects(send(db,room,'',{name:'fake.pdf',mime:'application/pdf',base64:'AAAA'}));await assert.rejects(send(db,room,'',{...file,name:'../escape.pdf'}));
 await assert.rejects(send(db,room,'',{...file,base64:'A'.repeat(1398108)}));
 const already=Number((await db.query('select count(*) n from nexodent_chat_messages where author_id=$1',[users[0]])).rows[0].n);for(let i=already;i<30;i++)await send(db,room,'Mensagem '+i);await assert.rejects(send(db,room,'Limite excedido'),/Aguarde/);
 }finally{await db.close()}});

test('anexos de 2 MB e 10 MB, rejeição acima do limite e atualização sem perda',async()=>{const db=await database();try{
 await login(db,users[0]);const room=await create(db,[users[1]]);
 for(const size of [2*1024*1024,10*1024*1024]){const data=Buffer.alloc(size,65);data.write('%PDF-1.4');const id=await send(db,room,'',{name:'grande.pdf',mime:'application/pdf',base64:data.toString('base64')});const result=(await db.query('select nexodent_chat_download($1,$2,$3) result',[C1,room,id])).rows[0].result;assert.equal(Buffer.from(result.base64,'base64').length,size);}
 const over=Buffer.alloc(10*1024*1024+1,65);over.write('%PDF-1.4');await assert.rejects(send(db,room,'',{name:'grande.pdf',mime:'application/pdf',base64:over.toString('base64')}),/10 MB/);
 await db.exec(fs.readFileSync('supabase/migrations/202611110009_chat_file_limit_10mb.sql','utf8'));assert.equal(Number((await db.query('select count(*) n from nexodent_chat_files')).rows[0].n),2);
 }finally{await db.close()}});
