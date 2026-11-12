const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('cache reaproveita somente assets públicos versionados e exclui API, HTML e requisições autenticadas',async()=>{
 const listeners={},saved=new Map();let fetched=0;
 const ctx=vm.createContext({URL,caches:{open:async()=>({match:async r=>saved.get(r.url)?.clone(),put:async(r,s)=>saved.set(r.url,s.clone())})},fetch:async()=>{fetched++;return new Response('static',{headers:{'content-type':'text/javascript'}})},self:{registration:{scope:'https://app.invalid/sistema-oralvalle/'},addEventListener:(t,f)=>listeners[t]=f}});
 vm.runInContext(fs.readFileSync('sw.js','utf8'),ctx);
 async function request(path,options){let response;listeners.fetch({request:new Request('https://app.invalid'+path,options),respondWith:p=>response=p});return response?await response:null;}
 for(let i=0;i<2;i++)assert.equal(await (await request('/sistema-oralvalle/assets/js/app.js?build=276')).text(),'static');
 assert.equal(fetched,1);assert.equal(saved.size,1);
 for(const path of ['/sistema-oralvalle/index.html','/sistema-oralvalle/legal/rights.js?v=276','/sistema-oralvalle/assets/patient.json?v=276','/sistema-oralvalle/assets/js/app.js','/rest/v1/patients?build=276','/assets/js/app.js?build=276'])assert.equal(await request(path),null);
 assert.equal(await request('/sistema-oralvalle/assets/js/app.js?build=276',{headers:{authorization:'Bearer synthetic'}}),null);
 assert.equal(await request('/sistema-oralvalle/assets/js/app.js?build=276',{method:'POST'}),null);
 assert.equal(fetched,1);
});
