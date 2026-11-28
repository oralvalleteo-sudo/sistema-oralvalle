const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('offline RPC rejects replay with changed payload and unauthorized clinic',async()=>{
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
try{
await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;");
for(const name of ['202610140001_relational_clinics.sql','202611280001_offline_operation_ledger.sql','202611280002_offline_apply.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
const c='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222',u='33333333-3333-3333-3333-333333333333',op='44444444-4444-4444-4444-444444444444';
await db.query('insert into clinics(id,nome) values($1,$3),($2,$3)',[c,other,'Synthetic']);
await db.query('insert into auth.users(id) values($1)',[u]);
await db.query('insert into clinic_members(clinic_id,user_id,admin) values($1,$2,true)',[c,u]);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u]);
await db.exec('set role authenticated');
const sql='select nexodent_offline_apply($1,$2,$3,$4::jsonb) as result';
assert.equal((await db.query(sql,[c,op,0,'[]'])).rows[0].result.status,'applied');
assert.equal((await db.query(sql,[c,op,0,'[]'])).rows[0].result.status,'already_applied');
await assert.rejects(db.query(sql,[c,op,1,'[]']),e=>e.code==='22023');
await assert.rejects(db.query(sql,[other,op,0,'[]']),e=>e.code==='42501');
await assert.rejects(db.query(sql,[c,'55555555-5555-5555-5555-555555555555',99,'[]']),e=>e.code==='40001');
}finally{await db.close();}
});
