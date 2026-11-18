const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{const p=await b.newPage(),errors=[],alerts=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',async d=>{if(d.type()==='alert')alerts.push(d.message());await d.accept()});await p.route('https://expense-review.invalid/**',r=>r.fulfill({contentType:'text/html',body:'<main id="app"></main>'}));await p.clock.setFixedTime(new Date('2026-11-18T15:00:00Z'));await p.goto('https://expense-review.invalid');await p.addScriptTag({content:`let view={h:'cash'},db={vd:[],cp:[]};window.pmLvl=()=>2;window.NexoModules={isAllowed:()=>true};window.posts=0;window.reviews=0;window.rows=['a','b','c'].map(id=>({id,clinic_id:'one',description:'CEMIG',category:'Energia',supplier:'',amount:474.18,reference_month:'2026-11-01',due_date:'2026-10-22',paid_at:null,planned_paid_at:'2099-11-22',payment_method:null}));rows.push({id:'old',clinic_id:'one',description:'Compra antiga',category:'MARKETING',amount:100,reference_month:'2026-10-01',paid_at:'2026-10-15'});window.OralCloud={enabled:true,clinicId:'one',request:async(path,opt)=>{if(path.includes('/rpc/nexodent_review_expense')){reviews++;const d=opt.body;for(const row of rows){if(d.p_copies.includes(row.id))row.voided_at='2026-11-17';if(row.id===d.p_keep){row.paid_at=null;row.planned_paid_at=d.p_planned;row.payment_method=null}}return {kept:d.p_keep,voided:d.p_copies.length}}if(opt){posts++;const row={...opt.body};rows.push(row);return [row]}return path.includes('lab_payment')?[]:rows.filter(r=>!r.voided_at)}};window.render=()=>document.getElementById('app').innerHTML=NexoCash.html();`});await p.addScriptTag({path:'assets/js/features/cash-model.js'});await p.addScriptTag({path:'assets/js/features/cash.js'});await p.evaluate(()=>render());await p.waitForSelector('[data-cash="review"]');await p.locator('[data-cash="review"]').click();await p.waitForFunction(()=>!document.querySelector('[data-cash="review"]'));assert.equal(await p.evaluate(()=>reviews),1);assert.equal(await p.locator('details tbody tr').count(),1);assert.match(await p.locator('details tbody').innerText(),/previsto em 22\/11\/99/);assert.doesNotMatch(await p.locator('details tbody').innerText(),/Paga em/);assert.equal(await p.evaluate(()=>rows.filter(r=>r.voided_at).length),2);assert.ok(await p.locator('[data-cash="pay"]').count());for(let i=0;i<2;i++){
 await p.locator('[data-cash="new"]').click();
 await p.locator('[name="description"]').fill('Google Ads');
 const category=p.locator('[name="category"]');
 assert.deepEqual(await category.getByRole('option',{name:/^marketing$/i}).allTextContents(),['Marketing']);
 if(i===0){
  await category.selectOption('__new__');
  await p.locator('[name="custom_category"]').fill('MARKETING');
 }else await category.selectOption('Marketing');
 await p.locator('[name="amount"]').fill('100');
 await p.locator('[name="paid_at"]').fill('2026-11-17');
 await p.locator('[name="payment_method"]').fill('Pix');
 await p.locator('#nx-cash-form button[type="submit"]').click();
 await p.waitForFunction(()=>!document.getElementById('nx-cash-form')&&!document.querySelector('[data-cash="refresh"]').disabled);
}
assert.equal(await p.evaluate(()=>posts),2);
const purchases=await p.evaluate(()=>rows.filter(r=>r.description==='Google Ads'));
assert.equal(new Set(purchases.map(r=>r.id)).size,2);
assert.deepEqual(purchases.map(r=>r.category),['Marketing','Marketing']);
assert.match(await p.locator('.nx-cash-metrics').innerText(),/200,00/);
assert.deepEqual(errors,[]);
console.log('Revisão de cópias preservada e duas compras pagas iguais cadastradas com IDs distintos.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
