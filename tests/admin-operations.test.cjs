const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const admin='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',member='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',clinic='11111111-1111-1111-1111-111111111111';
test('suporte exige administrador da plataforma, audita mudanças e não expõe dados clínicos',async()=>{
 const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';create table clinics(id uuid primary key,nome text,created_at timestamptz default now());create table clinic_members(clinic_id uuid,user_id uuid,active boolean);`);
 await db.exec(fs.readFileSync('supabase/migrations/202610290001_nexodent_admin_foundation.sql','utf8'));
 const sql=fs.readFileSync('supabase/migrations/202611120015_admin_operations.sql','utf8');await db.exec(sql);await db.exec(sql);
 await db.query('insert into auth.users values($1),($2)',[admin,member]);await db.query('insert into clinics(id,nome) values($1,$2)',[clinic,'Clínica sintética']);await db.query('insert into clinic_members values($1,$2,true)',[clinic,member]);await db.query('insert into nexodent_platform_admins(user_id) values($1)',[admin]);
 const login=id=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
 for(const id of ['',member]){await login(id);for(const query of ['select nexodent_admin_support_list()',`select nexodent_admin_clinic_operations('${clinic}')`,`select nexodent_admin_support_create('${clinic}','interface','normal','Falha sintética')`,`select nexodent_admin_support_change('${clinic}','resolved','Correção validada')`,`select nexodent_admin_support_history('${clinic}')`])await assert.rejects(db.query(query),e=>e.code==='42501');}
 await login(admin);const id=(await db.query('select nexodent_admin_support_create($1,$2,$3,$4) id',[clinic,'interface','high','Falha sintética'])).rows[0].id;
 await assert.rejects(db.query("select nexodent_admin_support_change($1,'resolved','')",[id]),e=>e.code==='22023');await assert.rejects(db.query("select nexodent_admin_support_change($1,'execute_sql','justificativa')",[id]),e=>e.code==='22023');
 await db.query("select nexodent_admin_support_change($1,'resolved','Correção validada na versão publicada')",[id]);const events=(await db.query('select nexodent_admin_support_history($1) data',[id])).rows[0].data;assert.equal(events.length,2);assert.ok(events.every(e=>e.actor_id===admin));
 const detail=(await db.query('select nexodent_admin_clinic_operations($1) data',[clinic])).rows[0].data;assert.equal(detail.active_members,1);assert.equal(detail.open_cases,0);assert.deepEqual(Object.keys(detail).sort(),['active_members','measured_at','open_cases']);
 const acl=(await db.query("select has_table_privilege('authenticated','nexodent_support_history','update') direct,has_function_privilege('anon','nexodent_admin_support_list()','execute') anonymous")).rows[0];assert.equal(acl.direct,false);assert.equal(acl.anonymous,false);
 }finally{await db.close();}
});
