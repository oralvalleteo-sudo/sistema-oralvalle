const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('offline ledger rejects direct client access and duplicate operations',async()=>{
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
try{
await db.exec('create role anon; create role authenticated; create table public.clinics(id uuid primary key);');
await db.exec(fs.readFileSync('supabase/migrations/202611280001_offline_operation_ledger.sql','utf8'));
const clinic='11111111-1111-1111-1111-111111111111',op='22222222-2222-2222-2222-222222222222',user='33333333-3333-3333-3333-333333333333';
await db.query('insert into clinics values ($1)',[clinic]);
const sql='insert into nexodent_offline_operations(clinic_id,operation_id,user_id,entity_type,entity_id,expected_revision,request_hash) values ($1,$2,$3,$4,$5,$6,$7)';
const args=[clinic,op,user,'patient','synthetic',0,'a'.repeat(64)];
await db.query(sql,args);await assert.rejects(db.query(sql,args),e=>e.code==='23505');
for(const role of ['anon','authenticated']){await db.exec('set role '+role);try{await assert.rejects(db.query('select * from nexodent_offline_operations'),e=>e.code==='42501');await assert.rejects(db.query(sql,args),e=>e.code==='42501');}finally{await db.exec('reset role');}}
}finally{await db.close();}
});
