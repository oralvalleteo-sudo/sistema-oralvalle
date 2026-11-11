const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),{stripTypeScriptTypes}=require('node:module');
const vars={SUPABASE_URL:'https://supabase.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic',NEXODENT_BILLING_ORIGINS:'https://app.invalid',ASAAS_API_KEY:'synthetic-key',BILLING_SANDBOX_ENABLED:'true',ASAAS_WEBHOOK_TOKEN:'synthetic-webhook-token-12345678901234567890'};
let registered;globalThis.Deno={env:{get:n=>vars[n]},serve:h=>{registered=h}};
const clinic='11111111-1111-1111-1111-111111111111',id='22222222-2222-2222-2222-222222222222';
async function handler(name){const filename=path.resolve('supabase/functions',name,'index.ts'),source=stripTypeScriptTypes(fs.readFileSync(filename,'utf8')).replace(/from '(\.\.\/[^']+)'/g,(_,r)=>"from '"+pathToFileURL(path.resolve(path.dirname(filename),r)).href+"'");await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));return registered;}
test('checkout usa preço do banco, não cria cobrança sem consentimento e não libera retorno de checkout',async()=>{
 const {checkout}=await import('../supabase/functions/_shared/saas-billing.mjs'),original=globalThis.fetch,calls=[];
 const c={id,clinic_id:clinic,created_by:clinic,owned:true,mode:'sandbox',plan_code:'profissional',cycle:'monthly',method:'PIX',amount_cents:7990,installments:1,period_start:'2026-11-12',status:'creating'};
 const payment={id:'pay_test',subscription:'sub_test',customer:'cus_test',value:79.9,status:'PENDING',dueDate:c.period_start,externalReference:id,invoiceUrl:'https://sandbox.asaas.com/i/test'};
 globalThis.fetch=async(url,opts={})=>{const u=String(url),body=opts.body?JSON.parse(opts.body):null;
 if(u.includes('rpc/nexodent_prepare_checkout'))return Response.json(c);
 if(u.includes('/customers?'))return Response.json({data:[{id:'cus_test',externalReference:clinic}]});
 if(u.endsWith('/subscriptions')&&opts.method==='POST'){assert.equal(body.value,79.9);calls.push(body);return Response.json({id:'sub_test'});}
 if(u.includes('/subscriptions/sub_test/payments'))return Response.json({data:[payment]});
 if(u.includes('nexodent_clinic_subscriptions'))return Response.json([{provider_subscription_id:null}]);
 if(u.includes('nexodent_billing_checkouts')){if(opts.method==='PATCH'){Object.assign(c,body);return Response.json([c]);}return Response.json([c]);}
 if(u.includes('rpc/nexodent_apply_billing_payment')){assert.equal(body.p_status,'PENDING');return Response.json({ok:true});}
 throw Error('Chamada inesperada '+u);};
 const request=new Request('https://supabase.invalid/billing',{headers:{origin:'https://app.invalid'}}),input={clinic_id:clinic,request_key:id,plan:'profissional',cycle:'monthly',method:'PIX',installments:1,cpf_cnpj:'12345678901',billing_name:'Teste sintético',amount:0,consent:true};
 try{
 assert.equal((await checkout(request,{...input,consent:false},{id:clinic,email:'synthetic@example.invalid'})).status,400);assert.equal(calls.length,0);
 const result=await checkout(request,input,{id:clinic,email:'synthetic@example.invalid'});assert.equal(result.status,200);assert.equal((await result.json()).mode,'sandbox');assert.equal(calls.length,1);
 c.owned=false;const again=await checkout(request,{...input,plan:'premium'},{id:clinic,email:'synthetic@example.invalid'});
 // Consulta repetida é coberta pelo SQL: o servidor retorna a contratação já existente.
 assert.equal(again.status,409);assert.equal(calls.length,1);
 }finally{globalThis.fetch=original;}
});
test('webhook consulta pagamento real e ignora status falso enviado pelo cliente',async()=>{
 const h=await handler('nexodent-billing-webhook'),original=globalThis.fetch;let applied;
 globalThis.fetch=async(url,opts={})=>{
 const u=String(url);
 if(u.includes('api-sandbox.asaas.com/v3/payments/pay_test'))return Response.json({id:'pay_test',subscription:'sub_test',customer:'cus_test',value:79.9,status:'PENDING',dueDate:'2026-11-12',externalReference:id,invoiceUrl:'https://sandbox.asaas.com/i/test'});
 if(u.includes('nexodent_billing_checkouts'))return Response.json([{id,mode:'sandbox',provider_customer_id:'cus_test',provider_subscription_id:'sub_test',amount_cents:7990,installments:1}]);
 if(u.includes('rpc/nexodent_apply_billing_payment')){applied=JSON.parse(opts.body);return Response.json({ok:true});}
 throw Error('Chamada inesperada');};
 try{
 assert.equal((await h(new Request('https://supabase.invalid/webhook',{method:'POST',body:'{}'}))).status,401);
 const r=await h(new Request('https://supabase.invalid/webhook',{method:'POST',headers:{'asaas-access-token':vars.ASAAS_WEBHOOK_TOKEN},body:JSON.stringify({id:'event-1',payment:{id:'pay_test',status:'CONFIRMED',value:0}})}));
 assert.equal(r.status,200);assert.equal(applied.p_status,'PENDING');assert.equal(applied.p_amount,7990);
 }finally{globalThis.fetch=original;}
});
