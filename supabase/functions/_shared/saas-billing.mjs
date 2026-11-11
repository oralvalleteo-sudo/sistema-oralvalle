export const base=Deno.env.get('SUPABASE_URL');
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const origins=(Deno.env.get('NEXODENT_BILLING_ORIGINS')||Deno.env.get('NEXODENT_APP_ORIGIN')||'').split(',').map(s=>s.trim()).filter(Boolean);
export const mode=Deno.env.get('ASAAS_ENVIRONMENT')==='production'?'production':'sandbox';
const gateway=mode==='production'?'https://api.asaas.com/v3':'https://api-sandbox.asaas.com/v3';
export function ready(){return !!Deno.env.get('ASAAS_API_KEY')&&(mode==='sandbox'?Deno.env.get('BILLING_SANDBOX_ENABLED')==='true':Deno.env.get('BILLING_LIVE_ENABLED')==='true');}
export function response(req,status,data){const origin=req.headers.get('origin');return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origins.includes(origin)?origin:'','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'}});}
export const allowedOrigin=req=>origins.includes(req.headers.get('origin'));
export async function db(path,method='GET',body,authorization){
 const r=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:service,Authorization:authorization||'Bearer '+service,'Content-Type':'application/json',Prefer:'return=representation,resolution=merge-duplicates'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('Não foi possível atualizar a assinatura. Confira a instalação do banco.');return r.json();
}
export async function manager(req,clinic){
 if(!/^[0-9a-f-]{36}$/i.test(clinic||''))throw Error('Clínica inválida');
 const r=await fetch(base+'/auth/v1/user',{headers:{apikey:service,Authorization:req.headers.get('authorization')||''},signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Entre novamente');const user=await r.json();
 const rows=await db('clinic_members?clinic_id=eq.'+clinic+'&user_id=eq.'+encodeURIComponent(user.id)+'&active=eq.true&admin=eq.true&select=user_id');
 if(rows.length!==1)throw Error('Somente o administrador da clínica pode gerenciar a assinatura');return user;
}
export class GatewayError extends Error{constructor(status){super('O serviço de pagamento recusou a operação ('+status+').');this.status=status;}}
export async function asaas(path,method='GET',body){
 if(!ready())throw Error('Pagamentos ainda não configurados pela plataforma');
 const r=await fetch(gateway+path,{method,headers:{access_token:Deno.env.get('ASAAS_API_KEY'),'Content-Type':'application/json','User-Agent':'NexoDent/1.0'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(18000)});
 if(!r.ok)throw new GatewayError(r.status);return r.json();
}
export function safeCheckoutUrl(url){try{const u=new URL(url);return u.protocol==='https:'&&(mode==='sandbox'?u.hostname==='sandbox.asaas.com':['www.asaas.com','asaas.com'].includes(u.hostname))?u.href:null;}catch{return null;}}
export async function paymentEvent(eventId,payment){
 const ref=String(payment.externalReference||'');
 let checkouts=payment.subscription?await db('nexodent_billing_checkouts?provider_subscription_id=eq.'+encodeURIComponent(payment.subscription)+'&select=*'):[];
 if(!checkouts.length&&/^[0-9a-f-]{36}$/i.test(ref))checkouts=await db('nexodent_billing_checkouts?id=eq.'+ref+'&select=*');
 if(checkouts.length!==1)throw Error('Cobrança ainda não vinculada');const c=checkouts[0];
 if(c.mode!==mode||payment.customer!==c.provider_customer_id)throw Error('Cliente de cobrança inválido');
 if(c.provider_subscription_id&&payment.subscription!==c.provider_subscription_id)throw Error('Assinatura incorreta');
 if(!c.provider_subscription_id&&c.provider_payment_id&&payment.id!==c.provider_payment_id&&String(payment.installment||'')!==String(c.provider_installment_id||''))throw Error('Parcela incorreta');
 const cents=Math.round(Number(payment.value)*100);if(!Number.isSafeInteger(cents)||(cents<Math.floor(c.amount_cents/c.installments)||cents>Math.ceil(c.amount_cents/c.installments)))throw Error('Valor divergente');
 return db('rpc/nexodent_apply_billing_payment','POST',{p_event:eventId,p_checkout:c.id,p_payment:payment.id,p_status:payment.deleted?'DELETED':payment.status,p_amount:cents,p_due:payment.dueDate,p_url:safeCheckoutUrl(payment.invoiceUrl)});
}
export async function cancelRemote(clinic,free=false,exclude=null){
 const subscriptions=await db('nexodent_billing_checkouts?clinic_id=eq.'+clinic+'&renewal_canceled=eq.false&superseded=eq.false&select=*');
 for(const c of subscriptions){if(c.id===exclude)continue;if(c.mode!==mode)throw Error('O ambiente de pagamento da clínica não corresponde ao servidor.');if(c.provider_subscription_id)await asaas('/subscriptions/'+encodeURIComponent(c.provider_subscription_id),'DELETE');
 if(['creating','pending','unknown'].includes(c.status)&&c.provider_payment_id){const payment=await asaas('/payments/'+encodeURIComponent(c.provider_payment_id));if(['PENDING','OVERDUE'].includes(payment.status))await asaas(c.provider_installment_id?'/installments/'+encodeURIComponent(c.provider_installment_id):'/payments/'+encodeURIComponent(payment.id),'DELETE');}
 }
 await db('rpc/nexodent_billing_cancel','POST',{p_clinic:clinic,p_free:free,p_keep:exclude});
}
export async function checkout(req,input,user){
 if(input.consent!==true)return response(req,400,{error:'Confirme as condições da contratação',code:'VALIDATION'});
 if(!ready())return response(req,503,{error:'Pagamentos ainda não configurados pela plataforma',code:'BILLING_NOT_CONFIGURED'});
 const cpf=String(input.cpf_cnpj||'').replace(/\D/g,'');if(![11,14].includes(cpf.length)||String(input.billing_name||'').trim().length<3)return response(req,400,{error:'Informe nome e CPF ou CNPJ válidos',code:'VALIDATION'});
 if(!/^[0-9a-f-]{36}$/i.test(input.request_key||''))return response(req,400,{error:'Identificador da contratação inválido'});
 const c=await db('rpc/nexodent_prepare_checkout','POST',{p_clinic:input.clinic_id,p_user:user.id,p_request:input.request_key,p_plan:input.plan,p_cycle:input.cycle,p_method:input.method,p_installments:input.installments===12?12:1,p_mode:mode});
 if(!c.owned&&(c.plan_code!==input.plan||c.cycle!==input.cycle||c.method!==input.method||c.installments!==(input.installments===12?12:1)))return response(req,409,{error:'Já existe outra contratação pendente. Consulte a fatura antes de trocar o plano.',code:'EXISTING_CHECKOUT'});
 if(!c.owned&&c.status==='failed')return response(req,409,{error:'A tentativa anterior foi recusada. Corrija os dados e tente novamente.',code:'CHECKOUT_RETRY_ALLOWED'});
 if(!c.owned)return response(req,c.checkout_url?200:409,{checkout_url:safeCheckoutUrl(c.checkout_url),mode,status:c.status,error:c.checkout_url?undefined:'Contratação em processamento. Não refaça o pagamento; consulte a situação.'});
 const path='nexodent_billing_checkouts?id=eq.'+c.id;
 try{

 // externalReference estável permite identificar o cliente sem criar uma conta por tentativa.
 const customers=await asaas('/customers?externalReference='+encodeURIComponent(input.clinic_id));
 const customer=customers.data?.find(c=>c.externalReference===input.clinic_id)||await asaas('/customers','POST',{name:String(input.billing_name||'').trim().slice(0,150),email:user.email,cpfCnpj:cpf,externalReference:input.clinic_id,notificationDisabled:false});
 if(!customer.id)throw Error('Cliente não confirmado');
 await db(path,'PATCH',{provider_customer_id:customer.id});
 // Uma nova contratação substitui a renovação anterior, mantendo o período já pago.
 const current=await db('nexodent_clinic_subscriptions?clinic_id=eq.'+input.clinic_id+'&select=provider_subscription_id');
 if(current[0]?.provider_subscription_id)await cancelRemote(input.clinic_id,false,c.id);
 let payment,subscription;
 if(c.installments===12){
 payment=await asaas('/payments','POST',{customer:customer.id,billingType:'CREDIT_CARD',totalValue:c.amount_cents/100,installmentCount:12,dueDate:c.period_start,description:'NexoDent — assinatura anual',externalReference:c.id});
 await db(path,'PATCH',{provider_payment_id:payment.id,provider_installment_id:payment.installment||null});
 }else{
 subscription=await asaas('/subscriptions','POST',{customer:customer.id,billingType:c.method,value:c.amount_cents/100,nextDueDate:c.period_start,cycle:c.cycle==='annual'?'YEARLY':'MONTHLY',description:'NexoDent — '+c.plan_code,externalReference:c.id});
 await db(path,'PATCH',{provider_subscription_id:subscription.id});
 const payments=await asaas('/subscriptions/'+encodeURIComponent(subscription.id)+'/payments');payment=payments.data?.find(p=>p.dueDate===c.period_start)||payments.data?.[0];
 }
 if(!payment?.id)throw Error('Aguardando geração da primeira cobrança');
 const url=safeCheckoutUrl(payment.invoiceUrl);if(!url)throw Error('Link de pagamento não confirmado');
 await db(path,'PATCH',{provider_payment_id:payment.id,checkout_url:url,status:'pending',renewal_canceled:false,updated_at:new Date().toISOString()});
 // Também registra a fatura pendente. Somente status confirmado pelo provedor libera acesso.
 await paymentEvent('initial:'+payment.id+':'+payment.status,payment);
 return response(req,200,{checkout_url:url,mode});
 }catch(error){
 await db(path,'PATCH',{status:error instanceof GatewayError&&error.status<500?'failed':'unknown',updated_at:new Date().toISOString()});
 return response(req,503,{error:error instanceof GatewayError?error.message:'A confirmação da contratação está pendente. Consulte a situação antes de tentar novamente.',code:error instanceof GatewayError&&error.status<500?'CHECKOUT_FAILED':'CHECKOUT_PENDING'});
 }
}
