/* Aplicação real + RPCs PostgreSQL em banco isolado. Nenhum acesso ao banco remoto. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const maliciousId='patient1"><img src=x onerror="window.injected=1">';
const root=path.resolve(__dirname,'../..'),C='00000000-0000-0000-0000-000000000010',U='00000000-0000-0000-0000-000000000001';
(async()=>{const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();let browser;try{
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';`);
for(const name of ['202610140001_relational_clinics.sql','202610200001_optimize_clinic_load.sql','202610200002_bounded_clinic_reads.sql','202610260001_performance_queries.sql','202610260002_lazy_patient_details.sql','202611110008_internal_communication.sql','202611110009_chat_file_limit_10mb.sql','202611180023_ortho_maintenance_cancellation.sql'])await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'));
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
await db.exec(`create function public.nexodent_evolution_status(p_clinic uuid,p_record_id text)
 returns jsonb language sql as $$ select '{"is_finalized":false}'::jsonb $$;`);
// Item direto do orçamento: o botão dispensa cadastro prévio de tratamento.
const salesBeforeDirect=Number((await db.query("select count(*) n from sales where kind='object'")).rows[0].n),receiptsBeforeDirect=Number((await db.query("select count(*) n from receipts where kind='object'")).rows[0].n);
await page.evaluate(()=>{const p=db.p.find(p=>p.nome==='Novo paciente sintético'),o=p.orcs.find(o=>o.id==='staff-budget'),it={id:'direct-item',proc:'Item direto sintético',valor:'100',dt:'staff-dentist',dente:'25'};o.itens.push(it);obLaunch(p,it,100,75,'Pix',tdy(),0);save();render()});await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);await page.locator('.nexo-pending-procedures > summary').click();await page.waitForFunction(()=>document.querySelector('iframe[title="Odontograma anatômico"]')?.contentDocument?.querySelector('[data-tooth="25"][data-clinical-status="a_realizar"]'));const direct=page.locator('[data-act="trbaixa"][data-item="direct-item"]');assert.equal(await direct.isVisible(),true);page.once('dialog',dialog=>dialog.dismiss());await direct.click();assert.equal(Number((await db.query("select count(*) n from treatments where dados->>'oiid'='direct-item'")).rows[0].n),0);const toothChart=page.frameLocator('iframe[title="Odontograma anatômico"]');
await toothChart.locator('[data-tooth="25"]').evaluate(el=>el.click());
page.once('dialog',dialog=>dialog.accept());
await toothChart.getByRole('button',{name:'Dar baixa',exact:true}).evaluate(el=>el.click());await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
assert.equal(Number((await db.query("select count(*) n from treatments where dados->>'oiid'='direct-item' and dados->>'status'='Concluído'")).rows[0].n),1);assert.equal(Number((await db.query("select count(*) n from sales where kind='object'")).rows[0].n),salesBeforeDirect+1);assert.equal(Number((await db.query("select count(*) n from receipts where kind='object'")).rows[0].n),receiptsBeforeDirect+1);assert.equal((await db.query("select dados->>'status' status from treatments where dados->>'id'='staff-treatment-2'")).rows[0].status,'Pendente');assert.equal(await direct.count(),0);console.log('Conclusão direta no orçamento: apenas item escolhido, cancelamento sem alteração e pagamentos preservados.');
await page.waitForFunction(()=>document.querySelector('iframe[title="Odontograma anatômico"]')?.contentDocument?.querySelector('[data-tooth="25"][data-clinical-status="finalizado"]'));
const chart=page.frameLocator('iframe[title="Odontograma anatômico"]');await chart.locator('[data-tooth="25"]').evaluate(el=>el.click());assert.equal(await chart.locator('#entries .entry').count(),1);assert.equal(await chart.locator('#entries .entry button').count(),1);assert.equal(await chart.getByRole('button',{name:'Editar baixa'}).count(),1);assert.equal(await chart.locator('#price').count(),0);await chart.locator('#notes').fill('Observação manual sintética preservada');await chart.locator('#saveNotes').evaluate(el=>el.click());await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);const manual=await page.evaluate(()=>db.p.find(p=>p.nome==='Novo paciente sintético').odo.__nexoVisual);assert.equal(manual.notes['25'],'Observação manual sintética preservada');assert.equal(manual.linkedRecords,undefined);assert.equal(Object.keys(manual.records).length,0);console.log('Odontograma: orçamento marca dente pendente; conclusão clínica atualiza o estado; projeção não é salva como marcação manual e observações permanecem.');

await chart.getByRole('button',{name:'Editar baixa'}).evaluate(el=>el.click());
const completion=page.getByRole('dialog',{name:'Editar baixa'});
await completion.getByLabel('Descrição da evolução').fill('Descrição da baixa corrigida');
await completion.getByRole('button',{name:'Salvar baixa'}).click();
await completion.waitFor({state:'hidden'});
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
assert.equal(Number((await db.query("select count(*) n from patient_evolutions where dados->>'txt'='Descrição da baixa corrigida'")).rows[0].n),1);
assert.equal(Number((await db.query("select count(*) n from receipts where kind='object'")).rows[0].n),receiptsBeforeDirect+1);

// A marcação manual antiga, inclusive com situação Finalizado, pode gerar uma baixa clínica.
const salesBeforeManual=Number((await db.query("select count(*) n from sales where kind='object'")).rows[0].n);
await page.evaluate(()=>{
 const patient=cur();
 patient.odo.__nexoVisual.records['11']=[{tool:'restauracao',surface:'',status:'finalizado'}];
 save();render();
});
await chart.locator('[data-tooth="11"]').evaluate(el=>el.click());
await chart.getByRole('button',{name:'Dar baixa',exact:true}).evaluate(el=>el.click());
await page.getByRole('button',{name:'Confirmar baixa',exact:true}).click();
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
await chart.getByRole('button',{name:'Editar baixa',exact:true}).waitFor();
const manualCompletion=await page.evaluate(()=>{
 const patient=cur();
 return patient.evol.find(e=>e.id===patient.odo.__nexoVisual.records['11'][0].evolutionId);
});
assert.equal(manualCompletion.n,'11');
assert.equal(manualCompletion.txt,'Restauração');
await chart.getByRole('button',{name:'Editar baixa',exact:true}).evaluate(el=>el.click());
await completion.getByLabel('Descrição da evolução').fill('Restauração com resina');
await completion.getByRole('button',{name:'Salvar baixa'}).click();
await completion.waitFor({state:'hidden'});
await chart.locator('[data-tooth="12"]').evaluate(el=>el.click());
await chart.getByRole('button',{name:'Registrar evolução deste dente'}).evaluate(el=>el.click());
await page.getByRole('button',{name:'Salvar evolução',exact:true}).click();
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
assert.equal(Number((await db.query("select count(*) n from patient_evolutions where dados->>'txt'='Restauração com resina'")).rows[0].n),1);
assert.equal(Number((await db.query("select count(*) n from patient_evolutions where dados->>'txt'='Evolução registrada para o dente 12.'")).rows[0].n),1);
assert.equal(Number((await db.query("select count(*) n from sales where kind='object'")).rows[0].n),salesBeforeManual);
console.log('Odontograma: baixa de marcação manual antiga, edição e evolução apenas com dente, sem movimento financeiro.');

// Escolher receitas não deve recolher o grupo nem abrir documentos de outro paciente.
await page.locator('[data-act="tab"][data-t="arquivos"]').click();const prescriptionFold=page.locator('.ov-doc-fold[data-doc-fold="Receituários e Atestados"]');await prescriptionFold.locator('summary').first().click();for(const model of ['long','peq','imp','perio','livre']){await page.locator('#rxModelo').selectOption(model);assert.equal(await prescriptionFold.evaluate(el=>el.open),true);assert.equal(await page.locator('#rxTexto').isVisible(),true);assert.equal(await page.locator('#rxModelo').inputValue(),model);if(model!=='livre')assert.ok((await page.locator('#rxTexto').inputValue()).length>0)}await page.locator('#rxDent').selectOption('staff-dentist');assert.equal(await prescriptionFold.evaluate(el=>el.open),true);await prescriptionFold.locator('summary').first().click();await page.evaluate(()=>render());assert.equal(await prescriptionFold.evaluate(el=>el.open),false);await prescriptionFold.locator('summary').first().click();await page.evaluate(()=>{view.id=db.p.find(p=>p.nome!=='Novo paciente sintético').id;render()});assert.equal(await prescriptionFold.evaluate(el=>el.open),false);console.log('Receituário: todos os modelos permanecem abertos e visíveis; recolhimento manual e troca de paciente respeitados.');
// Painel de precificação: dados reais do cadastro, atualização e leitura sem alteração de preços.
await page.evaluate(()=>{db.hc={alu:'1000',eqp:'1000',luz:'100',net:'100',fix:'0',pl:'1000',dias:'5',hdia:'8',occ:'100',mg:'30',imp:'5',cart:'2',com:'20'};db.pr.push({id:'overview-profitable',nome:'Procedimento rentável sintético',min:'30',preco:'1000',mat:'20',lab:'10',custo:'5',parc:false},{id:'overview-loss',nome:'Procedimento em prejuízo sintético',min:'60',preco:'1',mat:'100',lab:'10',custo:'5',parc:false});view.id=null;view.h='hc';save();render()});await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);assert.equal(await page.locator('.pricing-donut').count(),1);assert.equal(await page.locator('.pricing-legend>div').count(),6);await page.locator('[data-pricing-filter="loss"]').click();assert.equal(await page.locator('.pricing-table-wrap tbody tr').count(),1);assert.match(await page.locator('.pricing-table-wrap tbody').innerText(),/prejuízo sintético/);await page.locator('[data-pricing-filter="all"]').click();await page.locator('[data-pricing-sort="price-desc"]').click();assert.match(await page.locator('.pricing-table-wrap tbody tr').first().innerText(),/rentável sintético/);await page.screenshot({path:'/tmp/nexodent-pricing-overview.png'});await page.locator('[data-pricing-adjust]').click();assert.equal(await page.locator('#pricing-parameters').evaluate(el=>el.open),true);await page.locator('[data-h="mg"]').fill('40');assert.equal(await page.locator('[data-h="mg"]').inputValue(),'40');assert.match(await page.locator('.pricing-main').innerText(),/40,0%/);await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
// Catálogo no visual aprovado: filtros, busca, composição e edição preservada.
await page.locator('.ov-sidebar [data-act="nav"][data-t="pr"]').first().click();assert.equal(await page.locator('.procedure-catalog').isVisible(),true);assert.equal(await page.locator('[data-nc-filter="loss"] b').innerText(),'1');await page.locator('[data-nc-filter="loss"]').click();assert.equal(await page.locator('.nc-card:not([hidden])').count(),1);await page.locator('#prq').fill('RENTAVEL');assert.equal(await page.locator('.nc-card:not([hidden])').count(),0);await page.locator('[data-nc-filter="all"]').click();assert.equal(await page.locator('.nc-card:not([hidden])').count(),1);await page.locator('#prq').fill('');assert.ok(await page.locator('.nc-card:not([hidden])').count()>2);await page.locator('#nc-sort').selectOption('price-desc');const profitable=page.locator('.nc-card[data-procedure-id="overview-profitable"]');assert.equal(await page.locator('.nc-card:not([hidden])').first().getAttribute('data-procedure-id'),'overview-profitable');await page.screenshot({path:'/tmp/nexodent-procedures-desktop.png'});await profitable.locator('.nc-editor>summary').click();await profitable.locator('[data-f="preco"]').click();await profitable.locator('[data-f="preco"]').fill('1500');assert.equal(await profitable.locator('[data-f="preco"]').evaluate(el=>document.activeElement===el),true);assert.equal((await profitable.locator('.nc-price>strong').innerText()).replace(/\s/g,''),'R$1.500,00');await profitable.locator('.nc-composition>summary').click();assert.equal(await profitable.locator('[data-pres]').isVisible(),true);await profitable.locator('[data-f="parTipo"]').selectOption('pct');assert.equal(await profitable.locator('.nc-editor').evaluate(el=>el.open),true);assert.equal(await profitable.locator('.nc-composition').evaluate(el=>el.open),true);await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);await page.locator('[data-nc-filter="loss"]').click();await page.locator('[data-act="addpr"]').click();assert.equal(await page.locator('[data-nc-filter="all"]').getAttribute('aria-pressed'),'true');const newProcedure=page.locator('.nc-editor[open]').last();await newProcedure.locator('[data-f="nome"]').fill('Novo procedimento de teste');await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);assert.equal(Number((await db.query("select count(*) n from procedures where dados->>'nome'='Novo procedimento de teste'")).rows[0].n),1);assert.equal((await db.query("select dados->>'preco' price from procedures where dados->>'id'='overview-profitable'")).rows[0].price,'1500');console.log('Catálogo: filtros combinados com busca, ordenação, composição de custos e edição sem perda de foco ou criação duplicada.');
const pricingRevision=(await db.query('select revision from clinics where id=$1',[C])).rows[0].revision;await db.query("update clinic_members set perms=jsonb_set(jsonb_set(perms,'{hc}','\"view\"'),'{pr}','\"view\"') where clinic_id=$1 and user_id=$2",[C,U]);await page.reload();await page.locator('.ov-sidebar').first().waitFor({state:'visible'});await page.locator('.ov-sidebar [data-act="nav"][data-t="hc"]').first().click();await page.locator('.pricing-head').waitFor();await page.locator('[data-pricing-adjust]').click();assert.equal(await page.locator('[data-h="mg"]').isDisabled(),true);await page.locator('[data-pricing-filter="loss"]').click();assert.match(await page.locator('.pricing-table-wrap tbody').innerText(),/prejuízo sintético/);assert.equal((await db.query('select revision from clinics where id=$1',[C])).rows[0].revision,pricingRevision);await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.pricing-head').evaluate(el=>el.getBoundingClientRect().right<=window.innerWidth),true);await page.setViewportSize({width:1366,height:900});await page.locator('.ov-sidebar [data-act="nav"][data-t="pr"]').first().click();assert.equal(await page.locator('[data-act="addpr"]').isDisabled(),true);assert.equal(await page.locator('#prq').isDisabled(),false);assert.equal(await page.locator('#nc-sort').isDisabled(),false);await page.locator('#prq').fill('rentavel');assert.equal(await page.locator('.nc-card:not([hidden])').count(),1);await page.locator('.nc-card:not([hidden]) .nc-editor>summary').click();assert.equal(await page.locator('.nc-card:not([hidden]) [data-f="preco"]').isDisabled(),true);assert.equal((await db.query('select revision from clinics where id=$1',[C])).rows[0].revision,pricingRevision);await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.procedure-catalog').evaluate(el=>el.getBoundingClientRect().right<=window.innerWidth),true);await page.screenshot({path:'/tmp/nexodent-procedures-mobile.png'});await page.setViewportSize({width:1366,height:900});console.log('Precificação: gráfico e ranking com custos do cadastro, filtros, atualização sem perder campos e acesso somente leitura verificados.');
// Registrar manutenção e recebimento direto na Ortodontia com o prontuário ainda sob demanda.
const countBeforeOrtho=Number((await db.query("select count(*) n from budgets where kind='object'")).rows[0].n);
await page.evaluate(()=>{
 const patient=db.p.find(item=>item.nome==='Novo paciente sintético');
 patient.orthoMensal=true;
 save();
});
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
await page.reload();
await page.locator('.ov-sidebar [data-act="orthonav"]').first().click();
const orthoCard=page.locator('.ov-care-collapse').filter({hasText:'Novo paciente sintético'});
await orthoCard.locator('summary').click();
await orthoCard.getByRole('button',{name:'Registrar manutenção'}).click();
const maintenance=page.getByRole('dialog',{name:'Registrar manutenção ortodôntica'});
await maintenance.getByLabel('Dentista que realizou').selectOption('staff-dentist');
await maintenance.getByLabel('Valor da manutenção').fill('150');
await maintenance.getByLabel('Recebido hoje').fill('100');
await maintenance.getByRole('button',{name:'Salvar'}).click();
await maintenance.waitFor({state:'hidden'});
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
const recorded=(await db.query("select dados from patient_evolutions where dados->>'performedByDentistId'='staff-dentist'")).rows[0].dados;
assert.match(recorded.txt,/Manutenção ortodôntica — realizado por /);
const sale=(await db.query("select id,dados from sales where dados->>'orthoEvolutionId'=$1",[recorded.id])).rows[0];
assert.equal(sale.dados.valor,150);
assert.equal(sale.dados.dt,'staff-dentist');
assert.equal((await db.query("select dados from receipts where parent_id=$1 and kind='object'",[sale.id])).rows[0].dados.valor,100);
assert.equal(Number((await db.query("select count(*) n from budgets where kind='object'")).rows[0].n),countBeforeOrtho);
console.log('Ortodontia: manutenção com dentista executor, recebimento parcial e persistência sem orçamento.');
await db.query('update clinic_members set admin=true where clinic_id=$1 and user_id=$2',[C,U]);
await page.reload();
await page.locator('.ov-sidebar [data-act="nav"][data-t="pac"]').first().click();
await page.locator('[data-act="open"]').filter({hasText:'Novo paciente sintético'}).first().click();
await page.locator('[data-act="tab"][data-t="odo"]').click();
const answerCancellation=dialog=>dialog.accept(dialog.type()==='prompt'?'Lançamento incorreto':undefined);
page.on('dialog',answerCancellation);
await page.getByRole('button',{name:'Cancelar manutenção',exact:true}).click();
await page.getByText('Manutenção cancelada · Lançamento incorreto').waitFor();
page.off('dialog',answerCancellation);
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
const cancelled=(await db.query("select dados from patient_evolutions where dados->>'id'=$1",[recorded.id])).rows[0].dados;
assert.equal(cancelled.maintenanceCancellation.by,U);
assert.equal(cancelled.txt,recorded.txt);
assert.equal((await db.query('select id from sales where id=$1',[sale.id])).rows.length,0);
assert.equal((await db.query('select id from receipts where parent_id=$1',[sale.id])).rows.length,0);
console.log('Ortodontia: cancelamento administrativo preserva a evolução e retira o financeiro vinculado.');
// A taxa editada no atendimento vinculado aparece no mês do recebimento e nas métricas.
await page.evaluate(()=>{
 const p=db.p.find(p=>p.nome==='Novo paciente sintético');
 const o=p.orcs.find(o=>o.id==='staff-budget');
 o.itens.push({id:'fee-test-item',proc:'Procedimento histórica',valor:'100',dt:'staff-dentist'});
 db.pr.push({id:'fee-proc',nome:'Procedimento com preço',preco:'135'});
 view.h='pac';view.tab='orc';view.id=p.id;view.orcOpen={[o.id]:true};render();
});
const procedure=page.locator('input[data-o="staff-budget"][data-f="proc"]').last();
await procedure.fill('Procedimento com preço');
await page.getByRole('option',{name:'Procedimento com preço',exact:true}).click();
assert.match(await page.locator('input[data-o="staff-budget"][data-f="valor"]').last().inputValue(),/135,00/);
await page.evaluate(()=>{
 const p=db.p.find(p=>p.nome==='Novo paciente sintético');
 view.h='vd';view.id=null;
 view.pre={oid:'staff-budget',ii:'fee-test-item',pid:p.id,dt:'staff-dentist',proc:'Procedimento com preço',valor:135};
 render();
});
await page.locator('#vfm').selectOption('Crédito 2x');
await page.locator('#ovFeeOverride').fill('4');
await page.locator('#vdt').fill('2025-09-18');
await page.getByRole('button',{name:'Dar baixa e lançar venda'}).click();
await page.locator('#sales-month').fill('2025-09');
await page.getByText('Taxas da operadora no mês: R$ 5,40').waitFor();
await page.getByText('Recebimento líquido do mês: R$ 129,60').waitFor();
await page.getByText('Conferência mensal de comissões',{exact:true}).click();
assert.ok(await page.getByText('Comissões geradas',{exact:true}).isVisible());
await page.getByRole('button',{name:'Conferir taxas dos recebimentos'}).click();
assert.match(await page.locator('#ov-fin-detail-dialog').innerText(),/18\/09\/2025/);
await page.getByRole('button',{name:'Fechar',exact:false}).click();
await page.getByRole('button',{name:'Configurar taxas',exact:true}).click();
for(const [method,label,rate] of [['Pix','PIX','1.5'],['Débito','Cartão de débito','2'],['Crédito à vista','Crédito à vista','3.25']]){
 await page.locator('[data-fin-tab="'+method+'"]').filter({hasText:label}).click();
 await page.locator('[data-fee-rate="'+method+'"]').fill(rate);
}
await page.locator('[data-fin-tab="Crédito parcelado"]').click();
await page.locator('[data-fee-rate="Crédito 2x"]').fill('4.13');
await page.getByRole('button',{name:'Salvar configurações financeiras'}).click();
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
const storedRates=(await db.query("select dados from clinic_settings where slot='taxasPagamento'")).rows[0].dados;
assert.deepEqual([storedRates.Pix,storedRates['Débito'],storedRates['Crédito à vista']],[1.5,2,3.25]);
await page.reload();
await page.locator('.ov-sidebar [data-t="vd"]').first().click();
for(const [method,expected] of [['Pix','1,50'],['Débito','2,00'],['Crédito à vista','3,25']]){
 await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
 await page.locator('#vp').evaluate(select=>{select.closest('details').open=true});
 const patientId=await page.evaluate(()=>db.p.find(p=>p.nome==='Novo paciente sintético').id);
 await page.locator('#vp').selectOption(patientId);
 await page.locator('#vdn').selectOption('staff-dentist');
 await page.locator('#vpr').fill('Taxa teste '+method);
 await page.locator('#vv').fill('100');
 await page.locator('#vfm').selectOption(method);
 await page.locator('#vdt').fill('2025-10-18');
 assert.match(await page.locator('#ovFeePreview').innerText(),new RegExp('Taxa: R\\$\\s'+expected));
 await page.getByRole('button',{name:'Dar baixa e lançar venda'}).click();
 await page.waitForFunction(proc=>db.vd.some(sale=>sale.proc===proc&&sale.data==='2025-10-18'&&sale.pg[0]?.valor===100),'Taxa teste '+method);
}
await page.locator('#sales-month').fill('2025-10');
await page.getByText('Taxas da operadora no mês: R$ 6,75').waitFor();
await page.getByRole('button',{name:'Conferir taxas dos recebimentos'}).click();
const confirmFee=dialog=>dialog.accept(dialog.type()==='prompt'?'2,50':undefined);
page.on('dialog',confirmFee);
await page.getByRole('row').filter({hasText:'Taxa teste Pix'}).getByRole('button',{name:'Corrigir taxa'}).click();
page.off('dialog',confirmFee);
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
await page.getByRole('button',{name:'Fechar',exact:false}).click();
await page.getByText('Taxas da operadora no mês: R$ 7,75').waitFor();
await page.getByText('Recebimento líquido do mês: R$ 292,25').waitFor();
const feeReceipts=(await db.query("select dados from receipts where kind='object' and dados->>'data'='2025-10-18'")).rows.map(row=>row.dados);
assert.equal(feeReceipts.length,3);
assert.equal(feeReceipts.find(receipt=>receipt.forma==='Pix').taxaAjustes[0].anterior.taxaValor,1.5);
assert.deepEqual(feeReceipts.map(receipt=>receipt.valor),[100,100,100]);
console.log('Taxas Pix, débito e crédito persistem e entram no mês; ajuste histórico mantém o bruto.');
await page.getByRole('button',{name:'Conferir taxas dos recebimentos'}).click();
await page.getByRole('row').filter({hasText:'Taxa teste Pix'}).getByRole('button',{name:'Corrigir forma'}).click();
const methodCorrection=page.getByRole('dialog',{name:'Corrigir forma do recebimento'});
await methodCorrection.getByText('Dividir em duas formas').click();
await methodCorrection.getByLabel('Valor na segunda forma').fill('50');
await methodCorrection.locator('select[name=second]').selectOption('Débito');
await methodCorrection.getByRole('button',{name:'Salvar correção'}).click();
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
await page.getByRole('button',{name:'Fechar',exact:false}).click();
await page.getByText('Taxas da operadora no mês: R$ 7,50').waitFor();
const splitReceipts=(await db.query("select dados from receipts where kind='object' and dados->>'data'='2025-10-18'")).rows.map(row=>row.dados);
assert.equal(splitReceipts.length,4);
assert.equal(splitReceipts.reduce((sum,receipt)=>sum+receipt.valor,0),300);
assert.equal(splitReceipts.find(receipt=>receipt.valor===50&&receipt.forma==='Pix').taxaValor,1.25);
assert.equal(splitReceipts.find(receipt=>receipt.valor===50&&receipt.forma==='Débito').taxaValor,1);
await page.evaluate(()=>{
 const patient=db.p.find(p=>p.nome==='Novo paciente sintético');
 const budget={id:'mixed-budget',data:'19/11/2026',status:'Aprovado',desc:'',val:'',cond:'',
 itens:Array.from({length:4},(_,i)=>({id:'mix-item-'+i,proc:'Pagamento misto '+i,valor:'350',dt:'staff-dentist'}))};
 patient.orcs.push(budget);
 view.h='pac';view.id=patient.id;view.tab='orc';view.orcOpen={'mixed-budget':true};
 save();render();
});
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
const mixedBudget=page.locator('[data-oid="mixed-budget"]');
await mixedBudget.locator('[data-nxp="entrada"]').fill('400');
await mixedBudget.locator('[data-nxp="parcelas"]').fill('2');
await mixedBudget.locator('[data-f="cond"]').fill('Condições acordadas com o paciente');
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
const savedPlan=(await db.query("select dados->'paymentPlan' plan from budgets where dados->>'id'='mixed-budget'")).rows[0].plan;
assert.equal(savedPlan.formaEntrada,'PIX');
assert.equal(savedPlan.parcelas,'2');
await mixedBudget.locator('[data-act="oball"]').click();
assert.match(await page.locator('.ob-pay').innerText(),/Pix[\s\S]*Crédito 2x/);
assert.equal(await page.locator('#oab').evaluate(el=>num(el.value)),400);
assert.equal(await page.locator('#oab2').inputValue(),'');
await page.locator('#oab2').fill('1.000,00');
await page.locator('#oad').fill('2025-10-19');
await page.locator('[data-act="oballconf"][data-o="mixed-budget"]').click();
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
const mix=(await db.query("select dados from receipts where kind='object' and dados->>'data'='2025-10-19'")).rows.map(row=>row.dados);
assert.equal(mix.length,5);
assert.equal(mix.filter(receipt=>receipt.forma==='Pix').reduce((sum,receipt)=>sum+receipt.valor,0),400);
assert.equal(mix.filter(receipt=>receipt.forma==='Crédito 2x').reduce((sum,receipt)=>sum+receipt.valor,0),1000);
assert.equal(mix.reduce((sum,receipt)=>sum+Math.round(receipt.taxaValor*100),0),4730);
const grouped=await page.evaluate(()=>ovBudgetReceiptGroups(db.vd.flatMap(v=>(v.pg||[]).filter(p=>p.data==='2025-10-19').map(p=>({v,p})))).map(({method,gross,indices})=>[method,gross,indices.length]));
assert.deepEqual(grouped,[['Pix',400,2],['Crédito 2x',1000,3]]);
await menu.locator('[data-t="vd"]').first().click();
await page.locator('#sales-month').fill('2025-10');
await page.getByRole('button',{name:'Conferir taxas dos recebimentos'}).click();
const receiptReport=page.locator('#ov-fin-detail-dialog');
assert.match(await receiptReport.locator('tbody > tr').filter({hasText:'Orçamento · total por forma'}).allTextContents().then(rows=>rows.join(' ')),/Pix.*400,00.*Crédito 2x.*1\.000,00/);
assert.equal(await receiptReport.locator('details').count(),2);
await receiptReport.getByRole('button',{name:'Fechar'}).click();
await page.evaluate(()=>{
 const patient=db.p.find(p=>p.nome==='Novo paciente sintético');
 patient.orcs.push({id:'full-budget',data:'19/11/2026',status:'Aprovado',desc:'',val:'',
  cond:'Entrada: R$ 100,00 (PIX); Restante: R$ 200,00 (Cartão de crédito) em 2x de R$ 100,00',
  itens:[{id:'full-a',proc:'Quitação A',valor:'120',dt:'staff-dentist'},{id:'full-b',proc:'Quitação B',valor:'180',dt:'staff-dentist'}]});
 view.h='pac';view.id=patient.id;view.tab='orc';view.orcOpen={'full-budget':true};
 save();render();
});
const fullBudget=page.locator('[data-oid="full-budget"]');
await fullBudget.locator('[data-act="oball"]').click();
await fullBudget.locator('#oad').fill('2025-10-20');
await fullBudget.getByText('Quitar saldo em uma única forma').click();
await fullBudget.locator('[data-ob-full-method]').selectOption('Débito');
await fullBudget.getByRole('button',{name:'Confirmar quitação de'}).click();
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
const fullPaid=await db.query("select dados from receipts where kind='object' and dados->>'data'='2025-10-20' order by (dados->>'valor')::numeric");
assert.deepEqual(fullPaid.rows.map(({dados})=>[dados.forma,dados.valor,dados.taxaValor]),[['Débito',120,2.4],['Débito',180,3.6]]);
assert.equal(await fullBudget.getByText('Quitar saldo em uma única forma').count(),0);
await menu.locator('[data-t="vd"]').first().click();
await page.locator('#sales-month').fill('2025-10');
await page.getByText('Taxas da operadora no mês: R$ 60,80').waitFor();
await page.getByRole('button',{name:'Conferir taxas dos recebimentos'}).click();
await receiptReport.getByText('2 lançamentos por procedimento').last().click();
await receiptReport.getByRole('table',{name:'Lançamentos por procedimento'}).getByRole('row')
 .filter({has:page.getByRole('cell',{name:'Quitação A',exact:true})}).getByRole('button',{name:'Corrigir forma'}).click();
await methodCorrection.locator('select[name=first]').selectOption('Crédito 2x');
assert.match(await methodCorrection.locator('[data-fee-preview]').innerText(),/2,40.*4,96.*115,04/);
await methodCorrection.getByRole('button',{name:'Salvar correção'}).click();
await page.waitForFunction(()=>window.OralCloudSync?.dirty===false);
await receiptReport.getByRole('button',{name:'Fechar'}).click();
await page.getByText('Taxas da operadora no mês: R$ 63,36').waitFor();
await page.getByText('Recebimento líquido do mês: R$ 1.936,64').waitFor();
const corrected=(await db.query("select dados from receipts where kind='object' and dados->>'data'='2025-10-20' and dados->>'forma'='Crédito 2x'")).rows[0].dados;
assert.deepEqual([corrected.valor,corrected.taxaValor,corrected.liquido,corrected.taxaAjustes[0].anterior.forma],[120,4.96,115.04,'Débito']);
console.log('Quitação em uma forma e correção histórica atualizam taxas e líquido do mês.');
console.log('Pagamento misto no orçamento e divisão de recebimento antigo conservam o bruto e as formas.');
await page.locator('[data-act="logout"]').first().click();await page.locator('#cloudEmail').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>window.OralCloud.session),null);assert.equal(await page.locator('.ov-sidebar').count(),0);assert.deepEqual(errors,[]);console.log('Aplicação real: entrada, cadastro e persistência de paciente, agendamento, navegação de módulos, central interna e saída sem dados clínicos visíveis.');
}finally{if(browser)await browser.close();await db.close();}})().catch(error=>{console.error(error);process.exit(1)});
