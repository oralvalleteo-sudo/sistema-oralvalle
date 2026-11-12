const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://nested.invalid/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('whatsapp-embedded.js'))return route.fulfill({contentType:'text/javascript; charset=utf-8',body:fs.readFileSync('integracoes/whatsapp-embedded.js','utf8')});
  return route.fulfill({contentType:'text/html; charset=utf-8',body:path==='/index.html'?'<main>Aplicativo</main><iframe src="/crm/index.html"></iframe>':path==='/crm/index.html'?'<iframe src="/integracoes/index.html"></iframe>':'<main>Integrações</main><script src="/integracoes/whatsapp-embedded.js?build=283"></script>'});
 });
 await page.route('https://connect.facebook.net/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},contentType:'text/javascript',body:'queueMicrotask(()=>window.fbAsyncInit?.());'}));
 await page.goto('https://nested.invalid/index.html');
 const frame=page.frames().find(f=>f.url().includes('/integracoes/'));await frame.waitForFunction(()=>!!window.NexoWhatsAppEmbedded);
 await page.evaluate(()=>{window.NexoWhatsAppEmbedded={version:282,connect(){throw new Error('Agente antigo não deve ser usado');}};window.__nexoWhatsAppEmbeddedLoader=Promise.resolve(window);window.OralCloud={session:{user:{id:'u'}}};window.rootSdkCalls=0;window.FB={init:()=>{rootSdkCalls++;},login:(cb,options)=>{window.rootCallback=cb;window.rootOptions=options;}};});
 await frame.evaluate(()=>{
  window.cloud={session:{user:{id:'u'}},request:async()=>({status:'pending'})};window.config={flow:'embedded',state:'A'.repeat(43),app_id:'123',config_id:'999',version:'v99.0'};
  window.begin=()=>{window.outcome=null;NexoWhatsAppEmbedded.connect(config,cloud,'c',()=> 'c','coexistence').then(result=>outcome={ok:true,result},error=>outcome={ok:false,error:error.message});};begin();
 });
 await frame.waitForFunction(()=>outcome?.ok===false);assert.match(await frame.evaluate(()=>outcome.error),/Atualize/);assert.equal(await page.evaluate(()=>rootSdkCalls),0);await page.evaluate(()=>{delete window.NexoWhatsAppEmbedded;delete window.__nexoWhatsAppEmbeddedLoader;});await frame.evaluate(()=>begin());
 await page.getByRole('button',{name:'Continuar na Meta'}).waitFor();assert.equal(await frame.locator('dialog').count(),0);assert.equal(await page.locator('dialog').count(),1);assert.equal(await page.evaluate(()=>rootSdkCalls),1);assert.equal(await page.evaluate(()=>NexoWhatsAppEmbedded.version),284);
 await page.getByRole('button',{name:'Continuar na Meta'}).click();assert.equal(await page.evaluate(()=>rootOptions.extras.featureType),'whatsapp_business_app_onboarding');await page.evaluate(()=>{rootCallback({authResponse:{code:'synthetic'}});window.dispatchEvent(new MessageEvent('message',{origin:'https://www.facebook.com',data:JSON.stringify({type:'WA_EMBEDDED_SIGNUP',event:'FINISH',data:{waba_id:'123',phone_number_id:'456'}})}));});
 await frame.waitForFunction(()=>outcome?.ok===true);
 await frame.evaluate(()=>begin());await page.locator('dialog').waitFor();await page.evaluate(()=>{OralCloud.session.user.id='other';});await page.getByRole('button',{name:'Continuar na Meta'}).click();await frame.waitForFunction(()=>outcome?.ok===false);assert.match(await frame.evaluate(()=>outcome.error),/clínica/);
 assert.deepEqual(errors,[]);console.log('CRM em dois iframes: SDK e botão de autorização executam na janela principal; troca de conta cancela o fluxo.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
