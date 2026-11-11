const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{stripTypeScriptTypes}=require('node:module'),{createHmac}=require('node:crypto');
const vars={SUPABASE_URL:'https://supabase.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic',NEXODENT_APP_ORIGIN:'https://app.invalid',META_APP_SECRET:'synthetic-secret',META_WEBHOOK_VERIFY_TOKEN:'synthetic-verify',NEXODENT_CHANNEL_ENCRYPTION_KEY:'a'.repeat(64)};
globalThis.Deno={env:{get:name=>vars[name]},serve:handler=>{globalThis.metaHandler=handler}};
const handlers=new Map();
async function loadHandler(name){
 if(handlers.has(name))return handlers.get(name);
 const filename=path.resolve('supabase/functions',name,'index.ts');
 const source=stripTypeScriptTypes(fs.readFileSync(filename,'utf8')).replace(/from '(\.\.\/[^']+)'/g,(_,relative)=>"from '"+pathToFileURL(path.resolve(path.dirname(filename),relative)).href+"'");
 await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));handlers.set(name,globalThis.metaHandler);return globalThis.metaHandler;
}
const signed=payload=>{const raw=JSON.stringify(payload);return new Request('https://supabase.invalid/webhook',{method:'POST',body:raw,headers:{'x-hub-signature-256':'sha256='+createHmac('sha256',vars.META_APP_SECRET).update(raw).digest('hex')}})};
test('webhook WhatsApp roteia por número, não por identificador enviado no contato',async()=>{
 const handler=await loadHandler('nexodent-meta-webhook'),original=globalThis.fetch,captured=[];
 globalThis.fetch=async(url,options)=>{
 const u=String(url);
 if(u.includes('nexodent_channel_assets'))return Response.json([{clinic_id:'clinic-authorized'}]);
 if(u.includes('nexodent_channel_connections'))return Response.json([{clinic_id:'clinic-authorized'}]);
 if(u.includes('rpc/nexodent_channel_lead_receive')){captured.push(JSON.parse(options.body));return Response.json({accepted:true});}
 throw Error('Chamada inesperada');
 };
 try{
 const response=await handler(signed({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:'123'},messages:[{id:'wamid.1',from:'5511999999999',type:'text',clinic_id:'attacker'}]}}]}]}));
 assert.equal(response.status,200);assert.equal(captured[0].p_clinic,'clinic-authorized');assert.equal(captured[0].p_contact.phone,'+5511999999999');assert.equal(captured[0].p_channel,'whatsapp_business');
 assert.equal((await handler(new Request('https://supabase.invalid/webhook',{method:'POST',body:'{}'}))).status,401);
 assert.equal((await handler(new Request('https://supabase.invalid/webhook?hub.mode=subscribe&hub.verify_token=synthetic-verify&hub.challenge=123'))).status,200);
 }finally{globalThis.fetch=original;}
});
test('Meta leadgen busca dados com token da página e falha transitória pede reenvio',async()=>{
 const handler=await loadHandler('nexodent-meta-webhook'),original=globalThis.fetch,captured=[];
 const {seal}=await import('../supabase/functions/_shared/meta-channel.mjs'),cipher=await seal('synthetic-page-token');
 globalThis.fetch=async(url,options)=>{
 const u=String(url);
 if(u.includes('nexodent_channel_assets'))return Response.json([{clinic_id:'clinic-authorized',token_cipher:cipher}]);
 if(u.includes('nexodent_channel_connections'))return Response.json([{clinic_id:'clinic-authorized'}]);
 if(u.includes('graph.facebook.com')){assert.equal(options.headers.Authorization,'Bearer synthetic-page-token');return Response.json({id:'42',field_data:[{name:'phone_number',values:['11999999999']}]});}
 if(u.includes('rpc/nexodent_channel_lead_receive')){captured.push(JSON.parse(options.body));return Response.json({accepted:true});}
 throw Error('Chamada inesperada');
 };
 const event={object:'page',entry:[{id:'123',changes:[{field:'leadgen',value:{leadgen_id:'42'}}]}]};
 try{assert.equal((await handler(signed(event))).status,200);assert.equal(captured[0].p_channel,'meta_ads');assert.equal(captured[0].p_event,'42');
 globalThis.fetch=async()=>{throw Error('offline')};assert.equal((await handler(signed(event))).status,503);
 }finally{globalThis.fetch=original;}
});
test('seleção Meta recusa ativo ausente na autorização e callback recusa state ausente',async()=>{
 const handler=await loadHandler('nexodent-meta-connect-assets'),original=globalThis.fetch;
 const {seal}=await import('../supabase/functions/_shared/meta-channel.mjs'),cipher=await seal('synthetic-user-token');
 globalThis.fetch=async(url)=>{
 const u=String(url);
 if(u.includes('/auth/v1/user'))return Response.json({id:'11111111-1111-1111-1111-111111111111'});
 if(u.includes('clinic_members'))return Response.json([{user_id:'user'}]);
 if(u.includes('nexodent_meta_credentials'))return Response.json([{token_cipher:cipher}]);
 if(u.includes('/me/accounts'))return Response.json({data:[{id:'1',name:'Página autorizada',access_token:'synthetic-page-token'}]});
 throw Error('Ativo indevido não deve ser assinado');
 };
 try{
 const r=await handler(new Request('https://supabase.invalid/assets',{method:'POST',headers:{origin:vars.NEXODENT_APP_ORIGIN,authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({clinic_id:'11111111-1111-1111-1111-111111111111',provider:'meta_ads',action:'select',external_id:'999'})}));
 assert.equal(r.status,403);
 const callback=await loadHandler('nexodent-meta-connect-callback');assert.match((await callback(new Request('https://supabase.invalid/callback'))).headers.get('location'),/meta_connection=error/);
 const start=await loadHandler('nexodent-meta-connect-start');globalThis.fetch=async()=>new Response(null,{status:401});
 assert.equal((await start(new Request('https://supabase.invalid/start',{method:'POST',headers:{origin:vars.NEXODENT_APP_ORIGIN},body:JSON.stringify({clinic_id:'11111111-1111-1111-1111-111111111111',provider:'meta_ads'})}))).status,403);
 }finally{globalThis.fetch=original;}
});
