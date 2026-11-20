const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{calculate,validDate}=require('../assets/js/features/cash-model');
const from='2026-11-01',to='2026-11-30';
test('fluxo soma recebimentos efetivos, repasses e laboratório uma única vez; contas pendentes não são saídas',()=>{const r=calculate({from,to,sales:[{id:'s',data:'2026-10-01',pg:[{id:'a',valor:1000,data:'2026-11-03'}]}],commissions:[{id:'c',valor:100,data:'2026-11-05'}],lab:[{id:'opening',amount:80,paid_at:'2026-11-01',kind:'opening'},{id:'l',amount:200,paid_at:'2026-11-04',kind:'payment'},{id:'l',amount:200,paid_at:'2026-11-04',kind:'payment'}],expenses:[{id:'rent',amount:300,category:'Aluguel',description:'Aluguel',due_date:'2026-11-10',paid_at:'2026-11-10'},{id:'light',amount:50,due_date:'2026-11-15'},{id:'linked',amount:200,external_reference:'LABPAY-l',paid_at:'2026-11-04'},{id:'cp',amount:100,external_reference:'CP-c',paid_at:'2026-11-05'}]});assert.equal(r.income,100000);assert.equal(r.outcome,60000);assert.equal(r.balance,40000);assert.equal(r.pending,5000);assert.equal(r.openings,1);assert.equal(r.rows.length,4);assert.deepEqual(r.warnings,[])});
test('vínculos divergentes ficam visíveis e não apagam despesas por suposição',()=>{const r=calculate({from,to,commissions:[{id:'c',valor:100,data:'2026-11-02'}],expenses:[{id:'a',external_reference:'CP-c',amount:90,paid_at:'2026-11-03'}]});assert.equal(r.outcome,19000);assert.ok(r.warnings.length);const x=calculate({from,to,lab:[{id:'l',amount:20,paid_at:'2026-10-31',kind:'payment'}],expenses:[{id:'a',external_reference:'LABPAY-l',amount:20,paid_at:'2026-11-01'}]});assert.equal(x.outcome,0);assert.ok(x.warnings.length)});
test('datas inválidas e pagamentos sem data não geram saldo fictício',()=>{for(const d of ['2026-99-10','2026-02-30','',undefined])assert.equal(validDate(d),false);const r=calculate({from,to,sales:[{id:'s',pg:[{id:'p',valor:10,data:'2026-02-30'}]}]});assert.equal(r.income,0);assert.equal(r.warnings.length,1)});
test('SQL de despesas isola clínicas, restringe edição, protege registros e aceita reaplicação',async()=>{const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();try{await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';`);await db.exec(fs.readFileSync('supabase/migrations/202610140001_relational_clinics.sql','utf8'));const sql=fs.readFileSync('supabase/migrations/202611170019_general_expenses.sql','utf8');await db.exec(sql);await db.exec(sql);const c='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222',u='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',row='cccccccc-cccc-cccc-cccc-cccccccccccc';await db.query("insert into clinics(id,nome)values($1,'A'),($2,'B')",[c,other]);await db.query('insert into auth.users(id)values($1),($2)',[u,v]);await db.query(`insert into clinic_members(clinic_id,user_id,perms)values($1,$2,'{"vd":"edit"}'),($1,$3,'{"vd":"view"}')`,[c,u,v]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u]);await db.exec('set role authenticated');await db.query("insert into nexodent_general_expenses(id,clinic_id,description,amount,due_date)values($1,$2,'Aluguel',100,'2026-11-10')",[row,c]);await assert.rejects(db.query("insert into nexodent_general_expenses(clinic_id,description,amount,due_date)values($1,'Outra',100,'2026-11-10')",[other]),e=>e.code==='42501');await assert.rejects(db.query("insert into nexodent_general_expenses(id,clinic_id,description,amount,due_date)values($1,$2,'Repetida',100,'2026-11-10')",[row,c]),e=>e.code==='23505');await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[v]);await db.exec('set role authenticated');assert.equal((await db.query('select * from nexodent_general_expenses')).rows.length,1);assert.equal((await db.query("update nexodent_general_expenses set paid_at='2026-11-10' returning id")).rows.length,0);await assert.rejects(db.query('delete from nexodent_general_expenses'),e=>e.code==='42501');await db.exec('reset role');await db.query("update clinic_members set active=false where user_id=$1",[v]);await db.exec('set role authenticated');assert.equal((await db.query('select * from nexodent_general_expenses')).rows.length,0);}finally{await db.close()}});

test('valores legados com vírgula são apurados e valores inválidos exigem conferência',()=>{const r=calculate({from,to,sales:[{id:'s',pg:[{id:'a',valor:'1.234,56',data:'2026-11-01'},{id:'b',valor:'inválido',data:'2026-11-02'}]}]});assert.equal(r.income,123456);assert.equal(r.warnings.length,1)});

test('categorias e detalhamento usam os mesmos lançamentos pagos e a pagar',()=>{
 const r=calculate({from,to,
  lab:[{id:'p',source_order_id:'work',kind:'payment',paid_at:'2026-11-10',amount:40}],
  labAccounts:[
   {id:'work',laboratory:'Studio',work_description:'Coroa',reference_date:'2026-11-08',balance:6000},
   {id:'old',reference_date:'2026-10-08',balance:5500}
  ],
  expenses:[
   {id:'linked',external_reference:'LABPAY-p',category:'Laboratório',paid_at:'2026-11-10',amount:40},
   {id:'manual-lab',category:'laboratorios',description:'Reparo',reference_month:'2026-11-01',amount:25},
   {id:'salary-one',category:'Salário',reference_month:'2026-11-01',amount:10},
   {id:'salary-two',category:'Salários',reference_month:'2026-11-01',amount:15}
  ]
 });
 const lab=r.categories.find(c=>c.key==='laboratorio');
 assert.deepEqual(lab.entries.map(e=>e.id),['LABPAY-p','LAB-work','manual-lab']);
 assert.deepEqual([lab.paid,lab.pending,lab.total],[4000,8500,12500]);
 assert.equal(r.categories.find(c=>c.key==='salarios').total,2500);
 assert.equal(r.registered,r.entries.reduce((sum,row)=>sum+row.cents,0));
 assert.equal(r.outcome,4000);
});
