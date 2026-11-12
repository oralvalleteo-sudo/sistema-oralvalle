const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setContent('<main>Teste sintético</main>');
 await page.evaluate(()=>{window.posts=[];window.currentClinic='c';window.sdkCalls=[];window.FB={init:options=>{window.initOptions=options},login:(callback,options)=>{window.loginCallback=callback;window.sdkCalls.push(options)}};window.cloud={session:{user:{id:'u'}},request:async(path,options)=>{posts.push({path,...options});return {status:'pending',phone_number:'synthetic'}}};window.config={flow:'embedded',state:'A'.repeat(43),app_id:'123',config_id:'999',version:'v99.0',expires_in:600};window.begin=()=>{window.outcome=null;return NexoWhatsAppEmbedded.connect(config,cloud,'c',()=>currentClinic).then(result=>outcome={ok:true,result},error=>outcome={ok:false,message:error.message});};window.finishEvent=(origin)=>window.dispatchEvent(new MessageEvent('message',{origin,data:JSON.stringify({type:'WA_EMBEDDED_SIGNUP',event:'FINISH',data:{waba_id:'123',phone_number_id:'456'}})}));});
 await page.route('https://connect.facebook.net/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},contentType:'text/javascript',body:'queueMicrotask(()=>window.fbAsyncInit?.());'}));
 await page.addScriptTag({content:fs.readFileSync('integracoes/whatsapp-embedded.js','utf8')});
 for(const order of ['code-first','event-first']){
  await page.evaluate(()=>{begin();});await page.getByRole('button',{name:'Continuar na Meta'}).click();
  await page.evaluate(order=>{finishEvent('https://evil.invalid');if(order==='code-first')loginCallback({authResponse:{code:'synthetic-code'}});else finishEvent('https://www.facebook.com');},order);
  assert.equal(await page.evaluate(()=>outcome),null);
  await page.evaluate(order=>{if(order==='code-first')finishEvent('https://www.facebook.com');else loginCallback({authResponse:{code:'synthetic-code'}});},order);
  await page.waitForFunction(()=>outcome?.ok===true);
 }
 assert.equal(await page.evaluate(()=>posts.length),2);assert.equal(await page.evaluate(()=>sdkCalls[0].override_default_response_type),true);assert.equal(await page.evaluate(()=>initOptions.autoLogAppEvents),false);
 await page.evaluate(()=>{begin();});await page.getByRole('button',{name:'Cancelar',exact:true}).click();await page.waitForFunction(()=>outcome?.ok===false);assert.equal(await page.evaluate(()=>posts.length),2);
 await page.evaluate(()=>{begin();});await page.locator('dialog').waitFor();await page.evaluate(()=>{currentClinic='other';});await page.getByRole('button',{name:'Continuar na Meta'}).click();await page.waitForFunction(()=>outcome?.ok===false);assert.ok((await page.evaluate(()=>outcome.message)).includes('clínica'));assert.equal(await page.evaluate(()=>posts.length),2);assert.deepEqual(errors,[]);
 console.log('Cadastro incorporado: origens falsas ignoradas, código/evento em ambas as ordens, cancelamento e troca de clínica sem gravação indevida.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
