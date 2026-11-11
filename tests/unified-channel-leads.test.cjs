const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const A='11111111-1111-1111-1111-111111111111',B='22222222-2222-2222-2222-222222222222';
test('Google, Meta e WhatsApp compartilham o contato sem sobrescrever negociação',async()=>{
 const {PGlite}=await import(process.env.PGLITE_MODULE||'/workspace/.onboarding/pglite/node_modules/@electric-sql/pglite/dist/index.js');const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table clinics(id uuid primary key);
 create table nexodent_channel_connections(clinic_id uuid,provider text,status text,external_account_id text,external_account_label text,updated_at timestamptz,primary key(clinic_id,provider));
 create table nexodent_crm_leads(id uuid primary key,clinic_id uuid,name text,phone text,source text,stage text,estimated_value numeric,notes text,commercial_owner_id uuid);
 insert into clinics values('${A}'),('${B}');
 insert into nexodent_channel_connections(clinic_id,provider,status,external_account_id) values('${A}','google_ads','connected','1234567890');`);
 for(const file of ['202611110001_google_ads_leads.sql','202611110002_unified_channel_leads.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 const receive=async(clinic,channel,event,contact)=>(await db.query('select nexodent_channel_lead_receive($1,$2,$3,$4) result',[clinic,channel,event,contact])).rows[0].result;
 const first=await receive(A,'google_ads','g1',{name:'Maria',phone:'(11) 99999-9999',email:'maria@example.invalid'});
 await db.query("update nexodent_crm_leads set stage='Agendado',notes='Negociação preservada',commercial_owner_id=$2 where id=$1",[first.lead_id,B]);
 const second=await receive(A,'whatsapp_business','w1',{name:'Perfil WhatsApp',phone:'+5511999999999',ad_origin:'meta_ads',ad_id:'ad1'});
 const third=await receive(A,'meta_ads','m1',{name:'Outro nome',phone:'5511999999999',email:'maria@example.invalid'});
 assert.equal(second.lead_id,first.lead_id);assert.equal(third.lead_id,first.lead_id);
 assert.equal(second.created,false);assert.equal((await receive(A,'meta_ads','m1',{phone:'11999999999'})).duplicate,true);
 const current=(await db.query('select * from nexodent_crm_leads where id=$1',[first.lead_id])).rows[0];
 assert.equal(current.name,'Maria');assert.equal(current.stage,'Agendado');assert.equal(current.source,'Google Ads');assert.equal(current.notes,'Negociação preservada');assert.equal(current.commercial_owner_id,B);assert.equal(current.acquisition_sources.length,3);
 const other=await receive(B,'whatsapp_business','w1',{phone:'+5511999999999'});assert.notEqual(other.lead_id,first.lead_id);
 const emailOnly=await receive(A,'meta_ads','m2',{email:'MARIA@example.invalid'});assert.equal(emailOnly.lead_id,first.lead_id);
 await assert.rejects(receive(A,'whatsapp_business','invalid',{name:'Sem contato'}));
 await db.query("insert into nexodent_crm_leads(id,clinic_id,name,phone,source,stage,notes) values($1,$2,'Manual','(21) 98888-8888','Indicação','Fechado','Não alterar')",[B,A]);
 assert.equal((await receive(A,'whatsapp_business','w2',{phone:'+5521988888888'})).lead_id,B);
 await db.query('select nexodent_channel_asset_bind($1,$2,$3,$4,$5,$6)',[A,'whatsapp_business','123','Número','999',null]);
 await assert.rejects(db.query('select nexodent_channel_asset_bind($1,$2,$3,$4,$5,$6)',[B,'whatsapp_business','123','Outro','999',null]));
 const permissions=await db.query("select has_function_privilege('authenticated','nexodent_channel_lead_receive(uuid,text,text,jsonb)','execute') allowed");assert.equal(permissions.rows[0].allowed,false);
 // O caminho Google autenticado usa a mesma identidade.
 await db.query('select nexodent_google_leads_setup($1,$2)',[A,'a'.repeat(64)]);
 const google=await db.query('select nexodent_google_lead_receive($1,$2,$3) result',[A,'a'.repeat(64),{lead_id:'g2',name:'Maria',phone:'11999999999',account_id:'1234567890'}]);
 assert.equal(google.rows[0].result.lead_id,first.lead_id);
 }finally{await db.close()}
});
test('WhatsApp ignora status e atribui anúncio Meta quando a referência é fornecida',async()=>{
 const {whatsappContacts,metaLeadContact}=await import('../supabase/functions/_shared/meta-events.mjs');
 assert.deepEqual(whatsappContacts({statuses:[{id:'status'}]}),[]);
 const contacts=whatsappContacts({contacts:[{wa_id:'5511999999999',profile:{name:'Maria'}}],messages:[{id:'w1',from:'5511999999999',type:'text',text:{body:'não armazenar conversa'},referral:{source_type:'ad',source_id:'ad1'}}]});
 assert.equal(contacts[0].phone,'+5511999999999');assert.equal(contacts[0].ad_origin,'meta_ads');assert.equal(contacts[0].name,'Maria');assert.equal(contacts[0].text,undefined);
 assert.equal(metaLeadContact({field_data:[{name:'phone_number',values:['11999999999']}]}).phone,'11999999999');
});
test('assinatura Meta recusa corpo alterado e segredo incorreto',async()=>{
 const {verifyMetaSignature}=await import('../supabase/functions/_shared/meta-events.mjs');const {createHmac}=require('node:crypto');
 const raw=new TextEncoder().encode('{"entry":[]}'),signature='sha256='+createHmac('sha256','synthetic-secret').update(raw).digest('hex');
 assert.equal(await verifyMetaSignature(raw,signature,'synthetic-secret'),true);
 assert.equal(await verifyMetaSignature(new TextEncoder().encode('{}'),signature,'synthetic-secret'),false);
 assert.equal(await verifyMetaSignature(raw,signature,'different'),false);
 assert.equal(await verifyMetaSignature(raw,'','synthetic-secret'),false);
});
