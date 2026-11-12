const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 for(const mode of ['completes','stalls','blocked']){
  const page=await browser.newPage();await page.clock.install();await page.setContent('<main>SDK sintético</main>');
  await page.route('https://connect.facebook.net/**',r=>mode==='blocked'?r.abort():r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},contentType:'text/javascript',body:'window.FB={init(){window.stubUsed=true;},login(){window.stubUsed=true;}};window.bootstrapLoaded=true;'}));
  await page.evaluate(()=>{window.cloud={session:{user:{id:'u'}},request:async()=>({status:'pending'})};window.config={flow:'embedded',state:'A'.repeat(43),app_id:'123',config_id:'999',version:'v99.0'};});
  await page.addScriptTag({content:fs.readFileSync('integracoes/whatsapp-embedded.js','utf8')});
  await page.evaluate(()=>{window.outcome=null;NexoWhatsAppEmbedded.connect(config,cloud,'c',()=> 'c').then(result=>outcome={ok:true},error=>outcome={ok:false,code:error.code});});
  if(mode==='blocked'){await page.waitForFunction(()=>window.outcome?.ok===false);assert.equal(await page.evaluate(()=>outcome.code),'META_SDK_DOWNLOAD_FAILED');assert.equal(await page.locator('dialog').count(),0);await page.close();continue;}
  await page.waitForFunction(()=>window.bootstrapLoaded===true);assert.equal(await page.locator('dialog').count(),0);assert.equal(await page.evaluate(()=>!!window.stubUsed),false);
  if(mode==='completes'){
   await page.evaluate(()=>{window.realLogins=0;window.FB={init(){window.realInitialized=true},login(cb){realLogins++;window.loginCallback=cb;}};window.fbAsyncInit();});
   await page.getByRole('button',{name:'Continuar na Meta'}).click();assert.equal(await page.evaluate(()=>realLogins),1);assert.equal(await page.evaluate(()=>realInitialized),true);assert.equal(await page.evaluate(()=>!!window.stubUsed),false);
   await page.evaluate(()=>{loginCallback({authResponse:{code:'synthetic'}});window.dispatchEvent(new MessageEvent('message',{origin:'https://www.facebook.com',data:JSON.stringify({type:'WA_EMBEDDED_SIGNUP',event:'FINISH',data:{waba_id:'123',phone_number_id:'456'}})}));});await page.waitForFunction(()=>outcome?.ok===true);
  }else{
   await page.clock.fastForward(16000);await page.waitForFunction(()=>outcome?.ok===false);assert.equal(await page.evaluate(()=>outcome.code),'META_SDK_NOT_READY');assert.equal(await page.locator('dialog').count(),0);assert.equal(await page.evaluate(()=>!!window.stubUsed),false);
  }
  await page.close();
 }
 console.log('SDK em duas fases: bootstrap com stubs não libera login; fbAsyncInit libera, e carregamento incompleto termina com diagnóstico específico.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
