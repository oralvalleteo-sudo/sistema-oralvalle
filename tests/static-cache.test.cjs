const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('cache reaproveita somente assets públicos versionados e exclui API, HTML e requisições autenticadas',async()=>{
 const listeners={},saved=new Map();let fetched=0;
 const ctx=vm.createContext({URL,caches:{open:async()=>({match:async r=>saved.get(r.url)?.clone(),put:async(r,s)=>saved.set(r.url,s.clone())})},fetch:async()=>{fetched++;return new Response('static',{headers:{'content-type':'text/javascript'}})},self:{registration:{scope:'https://app.invalid/sistema-oralvalle/'},addEventListener:(t,f)=>(listeners[t]??=[]).push(f)}});
 vm.runInContext(fs.readFileSync('sw.js','utf8'),ctx);
 async function request(path,options){let response;const event={request:new Request('https://app.invalid'+path,options),respondWith(p){assert.equal(response,undefined,'only one handler may respond');response=p;}};for(const handler of listeners.fetch)handler(event);return response?await response:null;}
 for(let i=0;i<2;i++)assert.equal(await (await request('/sistema-oralvalle/assets/js/app.js?build=276')).text(),'static');
 assert.equal(fetched,1);assert.equal(saved.size,1);
 for(const path of ['/sistema-oralvalle/index.html','/sistema-oralvalle/legal/rights.js?v=276','/sistema-oralvalle/assets/patient.json?v=276','/sistema-oralvalle/assets/js/app.js','/rest/v1/patients?build=276','/assets/js/app.js?build=276'])assert.equal(await request(path),null);
 assert.equal(await request('/sistema-oralvalle/assets/js/app.js?build=276',{headers:{authorization:'Bearer synthetic'}}),null);
 assert.equal(await request('/sistema-oralvalle/assets/js/app.js?build=276',{method:'POST'}),null);
 assert.equal(fetched,1);
});

test('a versão carregada coincide com a versão anunciada na publicação', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const loaded = html.match(/<meta name="nexodent-build" content="(\d+)"/)?.[1];
  const { build: published } = JSON.parse(fs.readFileSync('nexodent-version.json', 'utf8'));
  assert.ok(loaded, 'O HTML precisa declarar a versão carregada.');
  assert.equal(loaded, published);
});

test('abertura sem rede recupera somente o shell público previamente instalado',async()=>{
 const handlers=[];
 const ctx=vm.createContext({URL,Response,fetch:async()=>{throw new TypeError('offline')},
  caches:{open:async name=>{
   assert.match(name,/^nexodent-public-shell-/);
   return {match:async url=>{
    assert.equal(url,'https://app.invalid/sistema-oralvalle/index.html');
    return new Response('Shell público');
   }};
  }},
  self:{registration:{scope:'https://app.invalid/sistema-oralvalle/'},addEventListener:(type,handler)=>{if(type==='fetch')handlers.push(handler)}}});
 vm.runInContext(fs.readFileSync('sw.js','utf8'),ctx);
 let result;
 const event={request:{url:'https://app.invalid/sistema-oralvalle/',method:'GET',mode:'navigate',headers:new Headers()},respondWith(response){
  assert.equal(result,undefined,'somente um handler pode responder à navegação');
  result=response;
 }};
 for(const handler of handlers)handler(event);
 const response=await result;
 assert.equal(await response.text(),'Shell público');
});
