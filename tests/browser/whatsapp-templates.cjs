const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.route('http://wa.test/',r=>r.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));
 await page.goto('http://wa.test/');
 await page.evaluate(()=>{localStorage.setItem('nexodent_wa_templates_v1',JSON.stringify({consulta:'Mensagem antiga {nome}'}));window.waOpen=(phone,message)=>window.lastOpen={phone,message};window.render=()=>document.body.innerHTML=window.nexoWaSettingsHtml()});
 await page.addScriptTag({content:fs.readFileSync('assets/js/features/whatsapp-free.js','utf8')});
 await page.evaluate(()=>window.render());
 assert.equal(await page.locator('[data-wa-key="consulta"]').inputValue(),'Mensagem antiga {nome}');
 await page.click('#wa-compose-open');
 assert.match(await page.locator('#wa-feedback').textContent(),/Preencha/);
 await page.fill('#wa-contact-name','Ana Silva');
 assert.match(await page.locator('#wa-compose-message').inputValue(),/Olá, Ana!/);
 await page.selectOption('#wa-compose-template','sus');
 assert.match(await page.locator('#wa-compose-message').inputValue(),/particular/);
 await page.fill('#wa-contact-phone','55999999999');
 await page.click('#wa-compose-open');
 assert.equal(await page.evaluate(()=>window.lastOpen.phone),'5555999999999');
 await page.fill('[data-wa-key="sus"]','Texto atualizado {nome}');
 assert.match(await page.locator('#wa-save-status').textContent(),/não salvas/);
 await page.click('#wa-settings-save');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('nexodent_wa_templates_v1')).sus),'Texto atualizado {nome}');
 await page.evaluate(()=>window.NexoModules={isAllowed:()=>false});
 page.once('dialog',d=>d.accept());
 await page.click('#wa-compose-open');
 assert.match((await page.evaluate(()=>window.lastOpen.message)),/particular/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 console.log('PASS: modelos existentes, personalização, telefone DDD 55, salvamento, permissão e tela móvel.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
