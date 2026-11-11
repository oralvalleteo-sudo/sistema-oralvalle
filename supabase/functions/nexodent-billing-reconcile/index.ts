import {db,asaas,paymentEvent,safeCheckoutUrl,mode} from '../_shared/saas-billing.mjs';
Deno.serve(async req=>{
 const secret=Deno.env.get('BILLING_CRON_TOKEN')||'';
 if(req.method!=='POST'||secret.length<32||req.headers.get('authorization')!=='Bearer '+secret)return new Response(null,{status:401});
 let processed=0,failed=0;
 try{
 const checkouts=await db('nexodent_billing_checkouts?superseded=eq.false&status=in.(creating,unknown,pending,confirmed)&mode=eq.'+mode+'&order=updated_at.asc&limit=25');
 for(const c of checkouts){try{
 let subscription=c.provider_subscription_id,payment=c.provider_payment_id;
 if(!subscription&&!payment){
 const contracts=await asaas('/subscriptions?externalReference='+c.id+'&limit=100');subscription=contracts.data?.find(s=>s.externalReference===c.id)?.id;
 if(!subscription){const invoices=await asaas('/payments?externalReference='+c.id+'&limit=100');payment=invoices.data?.find(p=>p.externalReference===c.id)?.id;}
 if(!subscription&&!payment){failed++;continue;}
 }
 const invoices=[];
 if(subscription){let offset=0;for(let page=0;page<20;page++){const result=await asaas('/subscriptions/'+encodeURIComponent(subscription)+'/payments?limit=100&offset='+offset);invoices.push(...(result.data||[]));if(!result.hasMore)break;offset+=100;if(page===19)throw Error('Conciliação extensa exige revisão');}}else if(payment)invoices.push(await asaas('/payments/'+encodeURIComponent(payment)));
 if(!invoices.length){failed++;continue;}
 const initial=invoices.find(p=>p.dueDate===c.period_start)||invoices[0];
 await db('nexodent_billing_checkouts?id=eq.'+c.id,'PATCH',{provider_customer_id:initial.customer,provider_subscription_id:subscription||null,provider_payment_id:payment||initial.id,provider_installment_id:initial.installment||null,checkout_url:safeCheckoutUrl(initial.invoiceUrl),status:c.status==='confirmed'?'confirmed':'pending',updated_at:new Date().toISOString()});
 for(const invoice of invoices)await paymentEvent('reconcile:'+invoice.id+':'+invoice.status,invoice);
 processed++;
 }catch{failed++;}}
 return Response.json({processed,failed});
 }catch{return Response.json({processed,failed,error:'Conciliação não concluída'},{status:503});}
});
