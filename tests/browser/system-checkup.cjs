/* Aplicação real + RPCs PostgreSQL em banco isolado. Nenhum acesso ao banco remoto. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const maliciousId='patient1"><img src=x onerror="window.injected=1">';
const root=path.resolve(__dirname,'../..'),C='00000000-0000-0000-0000-000000000010',U='00000000-0000-0000-0000-000000000001';
(async()=>{const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();let browser;try{
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';`);
for(const name of ['202610140001_relational_clinics.sql','202610200001_optimize_clinic_load.sql','202610200002_bounded_clinic_reads.sql','202610260001_performance_queries.sql','202610260002_lazy_patient_details.sql','202611110008_internal_communication.sql','202611110009_chat_file_limit_10mb.sql'])await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'));
await db.query('insert into auth.users values($1,$2)',[U,'synthetic@example.invalid']);await db.query('insert into clinics(id,nome)values($1,$2)',[C,'Clínica de teste']);await db.query('insert into clinic_members(clinic_id,user_id,nome,admin)values($1,$2,$3,true)',[C,U,'Profissional de teste']);
await db.query("insert into patients(clinic_id,id,slot,position,kind,dados)values($1,$2,'p',-1,'array','null')",[C,JSON.stringify([null,'p'])]);
await db.query(`insert into patients(clinic_id,id,slot,position,kind,dados)values($1,$2,'p',0,'object',$3)`,[C,JSON.stringify([null,'p',['id',maliciousId]]),JSON.stringify({id:maliciousId,nome:'Paciente de teste',tel:'11999999999'})]);
let queue=Promise.resolve();const rpc=body=>{const job=queue.then(()=>db.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[U]);await tx.exec('set local role authenticated');const params=Object.entries(body.data||{});return (await tx.query(`select public.${body.name}(${params.map(([key],i)=>`${key} => $${i+1}`).join(',')}) result`,params.map(([,v])=>typeof v==='object'&&v!==null?JSON.stringify(v):v))).rows[0].result;}));queue=job.catch(()=>{});return job;};
browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});
await page.addInitScript(({U})=>sessionStorage.setItem('oralvalle_cloud_session',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:U,email:'synthetic@example.invalid'}})),{U});
await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname.endsWith('.supabase.co')){let result;try{if(url.pathname==='/auth/v1/user')result={id:U,email:'synthetic@example.invalid'};else if(url.pathname.startsWith('/rest/v1/rpc/')){const name=url.pathname.split('/').at(-1);if(!/^[a-z_]+$/.test(name))throw Error('Invalid RPC');result=await rpc({name,data:route.request().postDataJSON()});}else if(url.pathname.startsWith('/auth/v1/logout'))result={};else throw Object.assign(Error('Serviço não instalado no banco de teste'),{code:'42P01'});return route.fulfill({contentType:'application/json',body:JSON.stringify(result)});}catch(e){console.log('RPC',url.pathname,e.code,e.message);return route.fulfill({status:e.code==='42501'?403:400,contentType:'application/json',body:JSON.stringify({code:e.code||'test',message:e.message})});}}
if(url.hostname!=='checkup.invalid')return route.fulfill({contentType:'text/javascript',body:''});const file=path.resolve(root,'.'+url.pathname.replace(/^\/sistema-oralvalle\//,'/'));if(!file.startsWith(root+'/')||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html',body:fs.readFileSync(file)});});
await page.goto('https://checkup.invalid/sistema-oralvalle/index.html');await page.locator('.ov-sidebar').first().waitFor({state:'visible'});assert.ok(await page.getByText('Agenda do dia',{exact:true}).isVisible());
const agendaButtonColor=await page.locator('[data-act="agtoday"]').evaluate(el=>getComputedStyle(el).backgroundColor);
const menu=page.locator('.ov-sidebar').first();await menu.locator('[data-t="pac"]').click();await page.waitForTimeout(200);assert.equal(await page.locator('.ov-new-patient').evaluate(el=>getComputedStyle(el).backgroundColor),agendaButtonColor);assert.equal(await page.locator('.ov-new-patient').evaluate(el=>getComputedStyle(el).backgroundImage),'none');assert.equal(await page.evaluate(()=>window.injected),undefined);assert.equal(await page.locator('img[src="x"]').count(),0);await page.locator('[data-act="novoPac"]').click();await page.locator('#nn').fill('Novo paciente sintético');await page.locator('#nt').fill('11988887777');await page.locator('#pvAdd').click();try{await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);}catch(e){console.log('STATUS',await page.locator('body').innerText());throw e;}assert.equal(Number((await db.query("select count(*) n from patients where kind='object' and dados->>'nome'=$1",['Novo paciente sintético'])).rows[0].n),1);
await menu.locator('[data-t="ag"]').click();await page.locator('#apn').fill('Novo paciente');await page.locator('[data-act="agpick"]').first().click();await page.locator('#ah').fill('10:00');await page.locator('[data-act="addag"]').click();try{await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);}catch(e){console.log('STATUS',await page.locator('body').innerText());throw e;}assert.equal(Number((await db.query("select count(*) n from appointments where kind='object' and dados->>'hora'='10:00'")).rows[0].n),1);
assert.equal(await page.locator('.slot-free').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');await page.locator('.slot-free').first().scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/nexo-agenda-standard.png'});
for(const tab of ['pac','lem','wa','dt','vd','reports','pf','hc','pr','mt','bk','cfg','sigdoc','chat']){const button=menu.locator(`[data-t="${tab}"]`).first();if(await button.count()){await button.click();await page.locator('.ov-content').waitFor({state:'visible'});assert.equal(await page.locator('.ov-sidebar').first().isVisible(),true);}}
await page.locator('iframe[title="Comunicação da equipe"]').waitFor();assert.equal(page.context().pages().length,1);await page.screenshot({path:process.env.CHECKUP_SCREENSHOT||'/tmp/nexodent-checkup.png'});
// Regressão: recepção edita orçamento e recebe pagamentos sem escrever configurações da clínica.
await db.query("update clinic_members set admin=false,perms=$1 where clinic_id=$2 and user_id=$3",[JSON.stringify(Object.fromEntries(['ag','pac','vd','pf','lem','dt','cm','pr','mt','hc','bk','pac.dados','pac.orc','pac.pag','pac.odo','pac.trat','pac.anam','pac.agd','pac.arquivos'].map(k=>[k,'edit']))),C,U]);
await page.reload();await page.locator('.ov-sidebar').first().waitFor({state:'visible'});
await page.evaluate(()=>{
 if(ME.admin)throw Error('O teste precisa usar recepção, não administrador.');
 const p=db.p.find(p=>p.nome==='Novo paciente sintético');
 p.orcs.push({id:'staff-budget',data:'16/11/2026',status:'Pendente',desc:'',val:'',cond:'',itens:[{id:'staff-item',proc:'Consulta sintética',valor:'100',dt:'',obs:''}]});
 view.h='pac';view.id=p.id;view.tab='orc';view.orcOpen={'staff-budget':true};
 A.orcsave(null,{o:'staff-budget'},p);
});
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
assert.equal(Number((await db.query("select count(*) n from budgets where dados->>'id'='staff-budget'")).rows[0].n),1);
await page.evaluate(()=>{
 const p=db.p.find(p=>p.nome==='Novo paciente sintético');
 db.vd.push({id:'staff-sale',pid:p.id,dt:'',proc:'Consulta sintética',valor:100,mat:0,lab:0,rep:0,data:tdy(),pg:[]});
 view.tab='pag';render();save();
});
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
await page.locator('[data-pgv="staff-sale"]').fill('40,00');
await page.locator('[data-act="pgrcv"][data-id="staff-sale"]').click();
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
assert.equal(Number((await db.query("select (dados->>'valor')::numeric amount from receipts where kind='object' and dados->>'forma'='Pix'")).rows[0].amount),40);
assert.equal(await page.evaluate(()=>Object.hasOwn(db,'taxasPagamento')),false);
assert.equal(Number((await db.query("select count(*) n from clinic_settings where slot='taxasPagamento'")).rows[0].n),0);
console.log('Recepção sem acesso administrativo: orçamento e recebimento persistidos sem criar configuração de taxas.');
// Desfazer um orçamento inteiro deve persistir recibos removidos, vínculos e histórico.
await page.evaluate(async()=>{
 const p=db.p.find(p=>p.nome==='Novo paciente sintético');
 const details=await OralCloudData.loadPatient(p.id);if(details)Object.assign(p,details);OralCloudData.prepareDefaults(db);
 const o=p.orcs.find(o=>o.id==='staff-budget');
 o.status='Aprovado';o.itens[0].vid='staff-sale';
 o.itens.push({id:'undo-item2',proc:'Segundo procedimento',valor:'50',vid:'undo-sale2'});
 db.vd.push({id:'undo-sale2',pid:p.id,dt:'',proc:'Segundo procedimento',valor:50,rep:5,pg:[{id:'undo-receipt2',valor:50,forma:'Pix',data:tdy()}]});
 db.vd.push({id:'untouched-sale',pid:p.id,dt:'',proc:'Outro orçamento',valor:25,rep:0,pg:[]});
 (p.trat=p.trat||[]).push({id:'undo-treatment',oid:o.id,oiid:o.itens[0].id,vid:'staff-sale',status:'Concluído',rep:10,data:tdy()});
 (p.evol=p.evol||[]).push({id:'undo-clinical-history',vid:'staff-sale',auto:true,data:tdy(),txt:'Registro clínico preservado'});
 view.tab='orc';render();save();
});
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
const undo=page.locator('[data-act="obundoall"][data-o="staff-budget"]');
page.once('dialog',async dialog=>{assert.match(dialog.message(),/2 recebimento/);await dialog.dismiss()});
await undo.click();
assert.equal(Number((await db.query("select count(*) n from sales where dados->>'id'='staff-sale'")).rows[0].n),1);
page.once('dialog',dialog=>dialog.accept());
await undo.click();
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
assert.equal(Number((await db.query("select count(*) n from sales where dados->>'id' in ('staff-sale','undo-sale2')")).rows[0].n),0);
assert.equal(Number((await db.query("select count(*) n from sales where dados->>'id'='untouched-sale'")).rows[0].n),1);
assert.equal(Number((await db.query("select count(*) n from receipts where kind='object'")).rows[0].n),0);
const archived=(await db.query("select dados from budgets where dados->>'id'='staff-budget'")).rows[0].dados.baixasDesfeitas;
assert.equal(archived.length,1);assert.equal(archived[0].recebido,90);assert.equal(archived[0].vendas.length,2);
assert.equal((await db.query("select dados->>'status' status from treatments where dados->>'id'='undo-treatment'")).rows[0].status,'Pendente');
assert.equal(Number((await db.query("select count(*) n from patient_evolutions where dados->>'id'='undo-clinical-history'")).rows[0].n),1);
await page.locator('summary').filter({hasText:'Histórico de baixas desfeitas'}).click();
assert.equal(await undo.count(),0);
console.log('Baixas do orçamento: cancelamento, remoção em lote e histórico persistidos no PostgreSQL isolado.');
// Receber o orçamento não executa procedimentos; conclusão posterior reutiliza o mesmo financeiro.
const clinicalHistoryBefore=Number((await db.query("select count(*) n from patient_evolutions where kind='object'")).rows[0].n);
await page.evaluate(async()=>{const p=db.p.find(p=>p.nome==='Novo paciente sintético');const details=await OralCloudData.loadPatient(p.id);Object.assign(p,details);OralCloudData.prepareDefaults(db);db.dt.push({id:'staff-dentist',nome:'Dentista sintético',modo:'fixo',base:'bruto',ativo:true,pct:20});const o=p.orcs.find(o=>o.id==='staff-budget');o.status='Aprovado';o.itens=[{id:'staff-item',proc:'Consulta sintética',valor:'100',dt:'staff-dentist',obs:'',tid:'staff-treatment'},{id:'staff-item-2',proc:'Retorno sintético',valor:'200',dt:'staff-dentist',obs:'',tid:'staff-treatment-2'}];p.trat=[{id:'staff-treatment',oiid:'staff-item',oid:o.id,proc:'Consulta sintética',valor:'100',dt:'staff-dentist',status:'Pendente',mats:[]},{id:'staff-treatment-2',oiid:'staff-item-2',oid:o.id,proc:'Retorno sintético',valor:'200',dt:'staff-dentist',status:'Pendente',mats:[]}];view.tab='orc';view.orcOpen={[o.id]:true};save();render()});
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
assert.equal(await page.locator('.nexo-pending-procedures').count(),0);
await page.locator('[data-act="oball"][data-o="staff-budget"]').click();assert.equal(await page.locator('#oab').inputValue(),'');await page.locator('#oab').fill('50');await page.locator('[data-act="oballconf"]').click();await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
assert.equal(Number((await db.query("select count(*) n from treatments where kind='object' and dados->>'status'='Pendente'")).rows[0].n),2);
assert.equal(await page.locator('.nexo-pending-procedures').count(),0);
assert.equal(Number((await db.query("select count(*) n from patient_evolutions where kind='object'")).rows[0].n),clinicalHistoryBefore);
assert.equal(Number((await db.query("select count(*) n from sales where kind='object' and dados->>'clinicalPending'='true'")).rows[0].n),2);
await page.locator('[data-act="tab"][data-t="odo"]').click();assert.equal(await page.locator('.nexo-pending-procedures').evaluate(el=>el.open),false);assert.equal(await page.locator('[data-pending-procedure]').first().isVisible(),false);await page.locator('.nexo-pending-procedures > summary').click();assert.equal(await page.locator('[data-pending-procedure]').first().isVisible(),true);page.once('dialog',dialog=>dialog.accept());await page.locator('[data-act="trbaixa"][data-id="staff-treatment"]').first().click();await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
assert.equal(Number((await db.query("select count(*) n from treatments where kind='object' and dados->>'status'='Concluído'")).rows[0].n),1);
assert.equal(await page.locator('[data-pending-procedure]').count(),1);
assert.equal(Number((await db.query("select count(*) n from sales where kind='object'")).rows[0].n),3);
assert.equal(Number((await db.query("select count(*) n from receipts where kind='object'")).rows[0].n),1);
assert.equal(Number((await db.query("select count(*) n from patient_evolutions where kind='object'")).rows[0].n),clinicalHistoryBefore+1);
console.log('Pagamento parcial do orçamento mantém dois procedimentos pendentes; conclusão clínica explícita não duplica venda nem recebimento.');
// Item direto do orçamento: o botão dispensa cadastro prévio de tratamento.
const salesBeforeDirect=Number((await db.query("select count(*) n from sales where kind='object'")).rows[0].n),receiptsBeforeDirect=Number((await db.query("select count(*) n from receipts where kind='object'")).rows[0].n);
await page.evaluate(()=>{const p=db.p.find(p=>p.nome==='Novo paciente sintético'),o=p.orcs.find(o=>o.id==='staff-budget'),it={id:'direct-item',proc:'Item direto sintético',valor:'100',dt:'staff-dentist',dente:'25'};o.itens.push(it);obLaunch(p,it,100,75,'Pix',tdy(),0);save();render()});await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);await page.locator('.nexo-pending-procedures > summary').click();const direct=page.locator('[data-act="trbaixa"][data-item="direct-item"]');assert.equal(await direct.isVisible(),true);page.once('dialog',dialog=>dialog.dismiss());await direct.click();assert.equal(Number((await db.query("select count(*) n from treatments where dados->>'oiid'='direct-item'")).rows[0].n),0);page.once('dialog',dialog=>dialog.accept());await direct.click();await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
assert.equal(Number((await db.query("select count(*) n from treatments where dados->>'oiid'='direct-item' and dados->>'status'='Concluído'")).rows[0].n),1);assert.equal(Number((await db.query("select count(*) n from sales where kind='object'")).rows[0].n),salesBeforeDirect+1);assert.equal(Number((await db.query("select count(*) n from receipts where kind='object'")).rows[0].n),receiptsBeforeDirect+1);assert.equal((await db.query("select dados->>'status' status from treatments where dados->>'id'='staff-treatment-2'")).rows[0].status,'Pendente');assert.equal(await direct.count(),0);console.log('Conclusão direta no orçamento: apenas item escolhido, cancelamento sem alteração e pagamentos preservados.');
await page.locator('[data-act="logout"]').first().click();await page.locator('#cloudEmail').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>window.OralCloud.session),null);assert.equal(await page.locator('.ov-sidebar').count(),0);assert.deepEqual(errors,[]);console.log('Aplicação real: entrada, cadastro e persistência de paciente, agendamento, navegação de módulos, central interna e saída sem dados clínicos visíveis.');
}finally{if(browser)await browser.close();await db.close();}})().catch(error=>{console.error(error);process.exit(1)});
