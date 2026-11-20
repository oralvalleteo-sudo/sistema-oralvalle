const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');

const accounts = 100;
const uuid = (prefix, index) => prefix + '0000000-0000-0000-0000-' + String(index).padStart(12, '0');
const commonClinic = uuid('2', 0);
const marker = '[null,"lem"]';

function reminder(id, title, position = 0) {
  return {table:'reminders', id, row:{parent_id:null, slot:'lem', position, kind:'object', dados:{id, titulo:title}}};
}

test('100 unique accounts save independent reminders in shared and separate clinics', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable
        as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    `);
    for (const file of ['202610140001_relational_clinics.sql','202611200024_independent_reminder_writes.sql']) {
      await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
    }
    await db.query("insert into clinics(id,nome,revision) values($1,'Clínica fictícia compartilhada',0)", [commonClinic]);
    for (let i=1;i<=accounts;i++) {
      const account=uuid('1',i), ownClinic=uuid('2',i);
      await db.query('insert into auth.users values($1,$2)',[account,'conta-'+i+'@example.invalid']);
      await db.query("insert into clinics(id,nome,revision) values($1,'Clínica fictícia individual',0)",[ownClinic]);
      await db.query(`insert into clinic_members(clinic_id,user_id,perms) values
        ($1,$3,'{"lem":"edit"}'),($2,$3,'{"lem":"edit"}')`,[commonClinic,ownClinic,account]);
    }
    const write=(account,clinic,changes,expected,revision=0)=>db.transaction(async tx=>{
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[uuid('1',account)]);
      await tx.exec('set local role authenticated');
      return (await tx.query('select clinic_apply_independent_reminders($1,$2,$3::jsonb,$4::jsonb) result',
        [clinic,revision,JSON.stringify(changes),JSON.stringify(expected)])).rows[0].result;
    });
    const arrayMarker={table:'reminders',id:marker,row:{parent_id:null,slot:'lem',position:-1,kind:'array',dados:null}};
    const run=independent=>Promise.allSettled(Array.from({length:accounts},(_,index)=>{
      const id=JSON.stringify([null,'lem',['id',index+1]]);
      return write(index+1,independent?uuid('2',index+1):commonClinic,
        [arrayMarker,reminder(id,'Lembrete '+index,index)],{[marker]:null,[id]:null});
    }));
    const shared=await run(false);
    assert.equal(shared.filter(result=>result.status==='fulfilled').length,accounts,JSON.stringify(shared.find(result=>result.status==='rejected')));
    assert.equal(shared.filter(result=>result.value?.rebased).length,accounts-1);
    const separate=await run(true);
    assert.ok(separate.every(result=>result.status==='fulfilled'&&result.value.rebased===false));
    const counts=(await db.query("select count(*)::int total,count(distinct clinic_id)::int clinics from reminders where kind='object'")).rows[0];
    assert.deepEqual(counts,{total:200,clinics:101});
    const sameId=JSON.stringify([null,'lem',['id',1]]);
    const original=reminder(sameId,'Lembrete 0').row.dados;
    const edits=await Promise.allSettled([
      write(1,commonClinic,[reminder(sameId,'Primeira alteração')],{[sameId]:original}),
      write(2,commonClinic,[reminder(sameId,'Segunda alteração')],{[sameId]:original}),
    ]);
    assert.equal(edits.filter(result=>result.status==='fulfilled').length,1);
    assert.equal(edits.find(result=>result.status==='rejected').reason.code,'40001');
    await assert.rejects(write(1,uuid('2',2),[reminder(sameId,'Outra clínica')],{[sameId]:null}),error=>error.code==='42501');
    await db.query(`update clinic_members set perms='{"lem":"view"}' where clinic_id=$1 and user_id=$2`,[commonClinic,uuid('1',100)]);
    await assert.rejects(write(100,commonClinic,[reminder('denied','Sem edição')],{denied:null}),error=>error.code==='42501');
    const grant=(await db.query(`select has_function_privilege('anon',
      'public.clinic_apply_independent_reminders(uuid,bigint,jsonb,jsonb)','execute') allowed`)).rows[0];
    assert.equal(grant.allowed,false);
    console.log('Contas distintas: 100/100 lembretes salvos em clínica compartilhada e 100/100 em clínicas individuais. Edição concorrente no mesmo registro: uma salva, uma protegida.');
  } finally { await db.close(); }
});
