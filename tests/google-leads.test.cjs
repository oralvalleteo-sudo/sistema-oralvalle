const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('normaliza formulário sem importar campos desconhecidos',async()=>{
 const {normalizeLead}=await import('../supabase/functions/_shared/google-lead.mjs');
 const result=normalizeLead({lead_id:'a',user_column_data:[{column_id:'FULL_NAME',string_value:' Maria '},{column_id:'PHONE_NUMBER',string_value:'11999999999'}]});
 assert.equal(result.name,'Maria');assert.equal(result.phone,'11999999999');assert.equal(result.is_test,false);
 assert.throws(()=>normalizeLead({lead_id:'a',user_column_data:[]}));
});
test('recepção SQL isola clínicas, deduplica, testa e revoga chave',async()=>{
 const {PGlite}=await import(process.env.PGLITE_MODULE || '/workspace/.onboarding/pglite/node_modules/@electric-sql/pglite/dist/index.js');const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table clinics(id uuid primary key);create table nexodent_channel_connections(clinic_id uuid,provider text,status text,external_account_id text);
 create table nexodent_crm_leads(id uuid primary key,clinic_id uuid,name text,phone text,source text,stage text,estimated_value numeric,notes text);
 insert into clinics values('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');
 insert into nexodent_channel_connections values('11111111-1111-1111-1111-111111111111','google_ads','connected','1234567890'),('22222222-2222-2222-2222-222222222222','google_ads','connected','2345678901');`);
 await db.exec(fs.readFileSync('supabase/migrations/202611110001_google_ads_leads.sql','utf8'));
 const clinic='11111111-1111-1111-1111-111111111111',key='a'.repeat(64),lead={lead_id:'external-1',name:'Teste sintético',phone:'11999999999',account_id:'1234567890',is_test:false};
 const setup=(c,k)=>db.query('select nexodent_google_leads_setup($1,$2) result',[c,k]);
 const receive=(c,k,l)=>db.query('select nexodent_google_lead_receive($1,$2,$3) result',[c,k,l]);
 await setup(clinic,key);
 assert.equal((await receive(clinic,key,{...lead,is_test:true})).rows[0].result.test,true);
 assert.equal((await db.query('select count(*)::int n from nexodent_crm_leads')).rows[0].n,0);
 assert.equal((await receive(clinic,key,lead)).rows[0].result.duplicate,false);
 assert.equal((await receive(clinic,key,lead)).rows[0].result.duplicate,true);
 await assert.rejects(receive('22222222-2222-2222-2222-222222222222',key,lead));
 await assert.rejects(receive(clinic,key,{...lead,account_id:'9999999999'}));
 await setup(clinic,'b'.repeat(64));await assert.rejects(receive(clinic,key,lead));
 assert.equal((await db.query('select count(*)::int n from nexodent_crm_leads')).rows[0].n,1);
 const perms=await db.query("select has_function_privilege('authenticated','nexodent_google_lead_receive(uuid,text,jsonb)','execute') allowed");assert.equal(perms.rows[0].allowed,false);
 }finally{await db.close()}
});
