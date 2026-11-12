const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:500,height:500}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>.ortho-thumb{width:100px;height:100px}.ortho-thumb img{width:100px;height:100px}.ortho-photo-item{height:130px}</style><div id="gallery"></div>');
 await page.evaluate(()=>{
  window.db={p:[{id:'synthetic'}]};window.photoReads=[];window.OralCloud={enabled:true,clinicId:'clinic-test',session:{user:{id:'user-test'}}};
  window.toast=()=>{};window.OralCloudData={files:async()=>Array.from({length:60},(_,i)=>({id:'photo-'+i,slot:'arquivos',position:i,dados:{id:'photo-'+i,tipo:'image/png',categoria:'Imagem clínica'}})),file:async(_,id)=>{photoReads.push(id);return {dados:{data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='}};}};
 });
 await page.addScriptTag({content:fs.readFileSync('assets/js/features/ortho-photos.js','utf8')});
 await page.evaluate(()=>document.getElementById('gallery').innerHTML=NexoOrthoPhotos.gallery(db.p[0],'patient'));
 await page.waitForFunction(()=>document.querySelector('[data-ortho-index="0"] img')?.src.startsWith('data:image/jpeg'));
 await page.waitForTimeout(200);const initial=await page.evaluate(()=>photoReads.length);assert.ok(initial>0&&initial<15,`initial reads ${initial}`);
 await page.locator('[data-ortho-index="55"]').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('[data-ortho-index="55"] img')?.src.startsWith('data:image/jpeg'));
 const total=await page.evaluate(()=>photoReads.length);assert.ok(total>initial&&total<30,`total reads ${total}`);assert.deepEqual(errors,[]);
 console.log(`Galeria com 60 fotos antigas: ${initial} originais solicitados na abertura, ${total} após rolar até a foto 56; demais fotos aguardam a aproximação da tela.`);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
