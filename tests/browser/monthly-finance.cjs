const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',args:['--no-sandbox']});try{const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',async d=>d.accept(d.type()==='prompt'?(d.message().includes('Data')?'2026-11-14':'Pix'):undefined));await p.route('https://monthly.invalid/**',r=>r.fulfill({contentType:'text/html',body:'<main id="app"></main>'}));await p.goto('https://monthly.invalid');await p.addStyleTag({path:'assets/css/app-shell.css'});await p.addStyleTag({path:'assets/css/button-contrast.css'});await p.addScriptTag({content:`let view={h:'cash'},db={vd:[{id:'s',pg:[{id:'r',data:'2026-11-02',valor:1000}]}],cp:[{id:'cp',data:'2026-11-03',valor:100}]};window.pmLvl=()=>2;window.NexoModules={isAllowed:()=>true};window.labAmount=200;window.posts=[];window.rows=[{id:'old',clinic_id:'one',reference_month:'2026-11-01',description:'Conta atrasada',category:'Luz',amount:75,due_date:'2026-10-20',paid_at:'2026-10-25',revision:0},{id:'a',clinic_id:'one',reference_month:'2026-11-01',description:'Salário A',category:'Folha',supplier:'Dado antigo preservado',amount:100,due_date:null,paid_at:null,revision:0},{id:'b',clinic_id:'one',reference_month:'2026-11-01',description:'Salário B',category:'folha',amount:25,due_date:null,paid_at:null,revision:0}];window.OralCloud={enabled:true,clinicId:'one',request:async(path,opt)=>{if(opt){posts.push({path,...structuredClone(opt)});const d=opt.body;if(path.includes('nexodent_merge_expense_categories')){let count=0;for(const r of rows)if(!r.voided_at&&d.p_sources.includes(r.category)){r.category=d.p_target;r.revision++;count++}return {updated:count,category:d.p_target}}if(path.includes('nexodent_void_expense')){rows.find(r=>r.id===d.p_id).voided_at='2026-11-17';return {voided:d.p_id}}if(opt.method==='POST'){rows.push({...d,revision:0});return [{...d,revision:0}]}const rowId=new URL('https://server.invalid'+path).searchParams.get('id')?.slice(3);const row=rows.find(r=>r.id===rowId);Object.assign(row,d);row.revision++;return [{...row}]}if(path.includes('lab_financial_obligations'))return [{source_order_id:'order',laboratory:'Studio',work_description:'Coroa de laboratório',amount:350,reference_date:'2026-11-09',status:'Recebido'},{source_order_id:'previous',amount:125,reference_date:'2026-10-20',status:'Recebido'},{source_order_id:'undated',amount:20,status:'Pendente'}];if(path.includes('lab_settlements'))return [{source_order_id:'order',paid_amount:25}];if(path.includes('lab_payment'))return [{id:'lab',source_order_id:'order',amount:labAmount,kind:'payment',paid_at:'2026-11-04'}];return rows.filter(r=>!r.voided_at)}};window.render=()=>document.getElementById('app').innerHTML=NexoCash.html();`});await p.addScriptTag({path:'assets/js/features/cash-model.js'});await p.addScriptTag({path:'assets/js/calculations.js'});await p.addScriptTag({path:'assets/js/features/cash.js'});await p.addScriptTag({path:'assets/js/features/lab-payables.js'});await p.evaluate(()=>render());await p.waitForFunction(()=>document.querySelector('.nx-cash-metrics')?.textContent.includes('375,00'));assert.equal(await p.locator('details.card tbody tr').count(),6);assert.match(await p.locator('details.card tbody').innerText(),/Conta atrasada/);await p.locator('#nx-cash-month').fill('2026-10');assert.doesNotMatch(await p.locator('details.card tbody').innerText(),/Conta atrasada|Salário/);await p.locator('#nx-cash-month').fill('2026-11');assert.match(await p.locator('details.card tbody').innerText(),/Conta atrasada/);assert.equal(await p.locator('details.card tbody tr').filter({hasText:'Conta atrasada'}).count(),1);assert.equal(await p.getByText('Gastos do período',{exact:true}).count(),0);const dashboard=p.locator('section.card').filter({has:p.getByRole('heading',{name:'Despesas por categoria',exact:true})});assert.match(await dashboard.innerText(),/625,00/);assert.equal(await dashboard.locator('[role="img"]').count(),4);const expenseList=p.locator('#nx-cash-expenses');
const categoryFilter=expenseList.getByLabel('Filtrar por categoria');
await categoryFilter.selectOption('laboratorio');
assert.equal(await expenseList.locator('tbody tr').count(),2);
assert.doesNotMatch(await expenseList.locator('tbody').innerText(),/Conta atrasada|Salário/);
await p.locator('[data-cash="paid"]').click();
assert.equal(await expenseList.locator('tbody tr').count(),1);
assert.match(await expenseList.locator('tfoot').innerText(),/200,00/);
await expenseList.getByRole('button',{name:'Ver todas as despesas'}).click();
await categoryFilter.selectOption('');
assert.equal(await expenseList.locator('tbody tr').count(),6);
const labCategory=dashboard.locator('[data-cash-category="laboratorio"]');
assert.equal(await labCategory.getByRole('img').isVisible(),true);
assert.equal(await labCategory.getByRole('button',{name:/Laboratório/}).evaluate(button=>{
 const style=getComputedStyle(button);
 return style.backgroundColor==='rgba(0, 0, 0, 0)'&&style.color===getComputedStyle(button.parentElement).color;
}),true);
assert.equal(await p.locator('.nx-cash-warning').count(),0);
await labCategory.getByRole('button',{name:/Laboratório/}).click();
await labCategory.getByRole('table').waitFor();
assert.equal(await labCategory.locator('tbody tr').count(),2);
assert.match(await labCategory.locator('tbody').innerText(),/Studio.*Coroa de laboratório/s);
assert.match(await labCategory.locator('tfoot').innerText(),/325,00/);
assert.match(await labCategory.innerText(),/Pago.*200,00.*A pagar.*125,00/s);
await labCategory.getByRole('button',{name:/Laboratório/}).click();
await labCategory.getByRole('table').waitFor({state:'hidden'});

await p.locator('[data-cash="new"]').click();assert.equal(await p.locator('[name="supplier"]').count(),0);assert.equal(await p.locator('[name="due_date"]').getAttribute('required'),null);await p.locator('[name="description"]').fill('Sem prazo');await p.locator('[name="category"]').selectOption('__new__');await p.locator('[name="custom_category"]').fill('Serviço externo');await p.locator('[name="amount"]').fill('40');await p.locator('#nx-cash-form button[type="submit"]').click();await p.waitForFunction(()=>!document.getElementById('nx-cash-form'));const added=await p.evaluate(()=>rows.find(r=>r.description==='Sem prazo'));assert.equal(added.due_date,null);assert.equal(added.reference_month,'2026-11-01');assert.match(await dashboard.innerText(),/Serviço externo/);await p.locator('[data-cash="pay"][data-id="'+added.id+'"]').click();await p.waitForFunction(()=>document.querySelector('.nx-cash-metrics').textContent.includes('415,00'));assert.equal(await p.locator('details.card [data-cash="pay"][data-id="'+added.id+'"]').count(),0);assert.match(await p.locator('details.card').filter({has:p.getByText('Despesas do mês',{exact:true})}).innerText(),/Sem prazo/);
await p.locator('[data-cash="edit"][data-id="a"]').click();await p.locator('[name="amount"]').fill('120');await p.locator('#nx-cash-form button[type="submit"]').click();await p.waitForFunction(()=>!document.getElementById('nx-cash-form'));assert.equal(await p.evaluate(()=>rows.find(r=>r.id==='a').supplier),'Dado antigo preservado');await dashboard.getByText('Unir ou renomear categorias',{exact:true}).click();assert.deepEqual(await p.locator('#nx-cash-merge [name="sources"] option').filter({hasText:/^folha$/i}).allTextContents(),['Folha']);await p.locator('#nx-cash-merge [name="sources"]').selectOption('Folha');await p.locator('#nx-cash-merge [name="target"]').fill('Equipe');await p.locator('#nx-cash-merge button').click();await p.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent.includes('Categorias unidas'));assert.match(await dashboard.innerText(),/Equipe/);assert.doesNotMatch(await dashboard.getByLabel('Gráfico de despesas por categoria').innerText(),/Folha|folha/);assert.equal(await p.evaluate(()=>rows.filter(r=>r.category==='Equipe').length),2);
await p.locator('[data-cash="delete"][data-id="'+added.id+'"]').click();await p.waitForFunction(()=>document.querySelector('.nx-cash-metrics').textContent.includes('375,00'));assert.equal(await p.evaluate(id=>!!rows.find(r=>r.id===id).voided_at,added.id),true);const before=await p.evaluate(()=>posts.filter(x=>x.path==='/rest/v1/nexodent_general_expenses').length);await p.evaluate(()=>{labAmount=500;window.dispatchEvent(new Event('nexodent:lab-payments-updated'))});await p.waitForFunction(()=>document.querySelector('.nx-cash-metrics').textContent.includes('675,00'));assert.equal(await p.evaluate(()=>posts.filter(x=>x.path==='/rest/v1/nexodent_general_expenses').length),before);await p.evaluate(()=>{db.cp.push({id:'new-cp',data:'2026-11-10',valor:70});render()});assert.match(await p.locator('.nx-cash-metrics').innerText(),/745,00/);await p.evaluate(()=>{
 window.r2=value=>Math.round(value*100)/100;window.num=Number;
 const request=OralCloud.request;
 window.failLab=true;
 OralCloud.request=(path,options)=>{
  if(window.failLab&&path.includes('nexodent_lab_payment_events'))throw Error('Laboratório simulado indisponível');
  return request(path,options);
 };
 view.h='reports';view.reportType='balanceannual';view.balanceYear='2026';
 window.render=()=>document.getElementById('app').innerHTML=nexoReportsHtml();
});
await p.addScriptTag({path:'assets/js/features/reports.js'});
await p.evaluate(()=>render());
await p.getByText(/Falha na consulta: Laboratório: Laboratório simulado/).waitFor();
const annualCard=label=>p.getByText(label,{exact:true}).locator('..').locator('strong');
assert.equal(await annualCard('Dentistas pagos').innerText(),'170.00');
assert.doesNotMatch(await annualCard('Despesas gerais pagas').innerText(),/Indisponível/);
assert.equal(await annualCard('Resultado operacional').innerText(),'Indisponível');
await p.evaluate(()=>{window.failLab=false});
await p.getByRole('button',{name:'Atualizar dados financeiros'}).click();
await p.waitForFunction(()=>!document.getElementById('app').textContent.includes('Indisponível')&&!document.getElementById('app').textContent.includes('Carregando'));
assert.equal(await annualCard('Laboratórios pagos').innerText(),'500.00');
await p.locator('#nx-r-type').selectOption('balancemonthly');
assert.equal(await p.locator('.nx-report-table tbody tr').count(),13);
assert.doesNotMatch(await p.locator('.nx-report-table').innerText(),/Indisponível/);
await p.evaluate(()=>{
 window.render=()=>document.getElementById('app').innerHTML=view.h==='cash'?NexoCash.html():nexoReportsHtml();
 NexoCash.openExpense('Laboratório',true);
});
await p.getByRole('heading',{name:'Pagamento retroativo ao laboratório'}).waitFor();
const retroForm=p.locator('#nx-cash-form');
assert.equal(await retroForm.locator('[name="category"]').inputValue(),'Laboratório');
await retroForm.locator('[name="description"]').fill('Laboratório retroativo');
await retroForm.locator('[name="amount"]').fill('120');
await retroForm.locator('[name="paid_at"]').fill('2026-10-10');
await retroForm.locator('[name="payment_method"]').selectOption('Pix');
assert.equal(await retroForm.locator('[name="reference_month"]').inputValue(),'2026-10');
await retroForm.getByRole('button',{name:'Salvar despesa'}).click();
await retroForm.waitFor({state:'detached'});
await p.getByRole('button',{name:'Salários da equipe'}).click();
assert.equal(await p.locator('#nx-cash-form [name="category"]').inputValue(),'Salários');
await p.getByRole('button',{name:'Cancelar',exact:true}).click();
await p.getByRole('button',{name:'Contabilidade',exact:true}).click();
assert.equal(await p.locator('#nx-cash-form [name="category"]').inputValue(),'Contabilidade');
await p.getByRole('button',{name:'Cancelar',exact:true}).click();
await p.getByRole('button',{name:'Impostos',exact:true}).click();
assert.equal(await p.locator('#nx-cash-form [name="category"]').inputValue(),'Impostos');
await p.evaluate(()=>{view.h='reports';view.reportType='balanceannual';render();});
await p.waitForFunction(()=>!document.getElementById('app').textContent.includes('Carregando'));
assert.equal(await annualCard('Laboratórios pagos').innerText(),'620.00');
await p.evaluate(()=>{
 db.vd.push({id:'new-sale',valor:150,data:'2026-10-13',pg:[{id:'new-receipt',valor:150,data:'2026-10-13'}]});
 render();
});
assert.equal(await annualCard('Recebimentos').innerText(),'1150.00');
await p.evaluate(()=>{window.labAmount=550;window.dispatchEvent(new Event('nexodent:lab-payments-updated'));});
await p.waitForFunction(()=>!document.getElementById('app').textContent.includes('Carregando'));
assert.equal(await annualCard('Laboratórios pagos').innerText(),'670.00');
await p.evaluate(()=>{
 rows.push(
  {id:'legacy-lab',description:'Prótese anterior',category:'PROTETICO',amount:80,paid_at:'2026-10-12',reference_month:'2025-12-01'},
  {id:'linked-lab',description:'Coroa conciliada',category:'Laboratório',amount:550,paid_at:'2026-11-04',external_reference:'LABPAY-lab'},
  {id:'manual-dentist',description:'Repasse antigo',category:'Repasse aos dentistas',amount:85,paid_at:'2026-10-12',reference_month:'2025-12-01'},
  {id:'linked-dentist',description:'Repasse conciliado',category:'Dentistas',amount:100,paid_at:'2026-11-03',external_reference:'CP-cp'},
  {id:'unpaid-dentist',description:'Repasse a pagar',category:'Dentista',amount:950,reference_month:'2026-10-01'},
  {id:'unpaid-lab',description:'Laboratório a pagar',category:'Laboratório',amount:900,reference_month:'2026-10-01'}
 );
 window.dispatchEvent(new Event('nexodent:expenses-updated'));
});
await p.waitForFunction(()=>!document.getElementById('app').textContent.includes('Carregando'));
assert.equal(await annualCard('Laboratórios pagos').innerText(),'750.00');
assert.equal(await annualCard('Dentistas pagos').innerText(),'255.00');
assert.equal(await p.getByText(/Conferir lançamentos de laboratório em/).count(),0);

await p.locator('#nx-r-type').selectOption('balancemonthly');
const monthlyTable=p.locator('.nx-report-table');
const headers=await monthlyTable.locator('th').allTextContents();
const monthlyValue=(month,label)=>monthlyTable.locator('tbody tr').filter({has:p.getByRole('cell',{name:month,exact:true})}).locator('td').nth(headers.indexOf(label)).innerText();
assert.equal(await monthlyValue('2026-10','Laboratórios pagos'),'200.00');
assert.equal(await monthlyValue('2026-11','Laboratórios pagos'),'550.00');
assert.equal(await monthlyValue('2026-10','Dentistas pagos'),'85.00');
assert.equal(await monthlyValue('2026-11','Dentistas pagos'),'170.00');
assert.equal(await monthlyValue('TOTAL','Laboratórios pagos'),'750.00');
assert.equal(await monthlyValue('TOTAL','Dentistas pagos'),'255.00');
await p.evaluate(()=>{window.NexoLabLoad=async()=>{};view.reportFrom='2026-10-01';view.reportTo='2026-10-31';view.reportType='labpayments';render();});
await p.getByText('Pagamentos a laboratórios no período:',{exact:false}).waitFor();
assert.match(await p.getByText('Pagamentos a laboratórios no período:',{exact:false}).innerText(),/200\.00/);
await p.getByText('Ver despesas pagas de laboratório (2)',{exact:true}).click();
assert.equal(await p.getByText(/Prótese anterior/).isVisible(),true);
assert.equal(await p.getByText(/Laboratório a pagar/).count(),0);
await p.evaluate(()=>{
 const request=OralCloud.request;
 OralCloud.request=async(path,options)=>{
  if(path.includes('nexodent_lab_settlements'))return [
   {source_order_id:'dm-current',paid_amount:600,paid_at:'2026-11-18'},
   {source_order_id:'dm-previous',paid_amount:300,paid_at:'2025-12-12'}
  ];
  if(path.includes('nexodent_lab_payment_events'))return [
   ...await request(path,options),
   {id:'opening',kind:'opening',source_order_id:'dm-current',amount:600,paid_at:'2026-11-18'}
  ];
  return request(path,options);
 };
 view.reportType='balanceannual';
 view.balanceYear='2026';
 window.dispatchEvent(new Event('nexodent:lab-payments-updated'));
});
await p.waitForFunction(()=>!document.getElementById('app').textContent.includes('Carregando'));
assert.equal(await annualCard('Laboratórios pagos').innerText(),'1350.00');
await p.evaluate(()=>{view.balanceYear='2025';render();});
assert.equal(await annualCard('Laboratórios pagos').innerText(),'300.00');
await p.evaluate(()=>{
 view.balanceYear='2026';
 rows.push(
  {id:'ads',description:'Anúncios',category:'Marketing',amount:100,paid_at:'2026-09-10',reference_month:'2026-09-01'},
  {id:'ads-digital',description:'Anúncios digitais',category:'MARKETING DIGITAL',amount:50,paid_at:'2026-10-10',reference_month:'2026-10-01'},
  {id:'ads-pending',description:'Anúncios em aberto',category:'Marketing digital',amount:1000,reference_month:'2026-10-01'}
 );
 db.vd.push({id:'marketing-test-receipt',valor:1000,data:'2026-10-15',pg:[{id:'extra',valor:1000,data:'2026-10-15'}]});
 for(const sale of db.vd)for(const payment of sale.pg||[])payment.taxaValor=0;
 window.dispatchEvent(new Event('nexodent:expenses-updated'));
});
await p.waitForFunction(()=>!document.getElementById('app').textContent.includes('Carregando'));
assert.equal(await annualCard('Marketing digital').innerText(),'150.00');
const annualValue=async label=>Number(await annualCard(label).innerText());
assert.equal(await annualValue('Resultado operacional'),
 await annualValue('Recebimentos')-await annualValue('Despesas gerais pagas')-await annualValue('Laboratórios pagos')-await annualValue('Dentistas pagos')-await annualValue('Taxas'));
console.log('Balanço anual carrega automaticamente, preserva fontes disponíveis durante falhas e atualiza com o balanço mensal.');
assert.deepEqual(errors,[]);console.log('Mensal: referência independente do dia pago, vencimento opcional, categoria livre, totais/gráfico, união de categorias, edição/exclusão auditáveis e atualizações automáticas de laboratório/dentistas.');}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
