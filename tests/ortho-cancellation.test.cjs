const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('somente administradores cancelam manutenção e o vínculo clínico permanece', async () => {
  const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
  const db = new PGlite();
  const clinic = '11111111-1111-1111-1111-111111111111';
  const admin = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const staff = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const original = {id:'maintenance', txt:'[Ortodontia] Manutenção — realizado por Dentista.', data:'2026-11-18'};
  const cancelled = {...original, maintenanceCancellation:{by:admin, reason:'Lançamento incorreto', at:'2026-11-18T16:30:00.000Z'}};
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';`);
    for (const migration of ['202610140001_relational_clinics.sql','202611180023_ortho_maintenance_cancellation.sql']){
      await db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'));
    }
    await db.query('insert into auth.users(id) values ($1),($2)',[admin,staff]);
    await db.query("insert into clinics(id,nome) values ($1,'Teste')",[clinic]);
    await db.query(`insert into clinic_members(clinic_id,user_id,admin,perms)
      values ($1,$2,true,'{}'),($1,$3,false,'{"pac":"edit","pac.odo":"edit"}')`,[clinic,admin,staff]);
    await db.query("insert into patients(clinic_id,id,slot,position,kind,dados) values ($1,'patient','p',0,'object','{}')",[clinic]);
    const write = data => db.query(`insert into patient_evolutions(clinic_id,id,parent_id,slot,position,kind,dados)
      values ($1,'maintenance','patient','evol',0,'object',$2)
      on conflict (clinic_id,id) do update set dados=excluded.dados`,[clinic,data]);
    await write(original);
    await db.exec(`create table assigned_dentists(clinic_id uuid, evolution_id text,
      foreign key(clinic_id,evolution_id) references patient_evolutions(clinic_id,id));`);
    await db.query("insert into assigned_dentists values ($1,'maintenance')",[clinic]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[staff]);
    await assert.rejects(write(cancelled), error=>error.code==='42501');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
    await assert.rejects(write({...cancelled,txt:'Conteúdo alterado'}), error=>error.code==='22023');
    await write(cancelled);
    await assert.rejects(write(original), error=>error.code==='22023');
    assert.deepEqual((await db.query("select dados from patient_evolutions where id='maintenance'")).rows[0].dados,cancelled);
    assert.equal((await db.query('select * from assigned_dentists')).rows.length,1);
  }finally{await db.close();}
});
