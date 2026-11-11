import {asaas,paymentEvent} from '../_shared/saas-billing.mjs';
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return reply(405,{error:'Método inválido'});
 const expected=Deno.env.get('ASAAS_WEBHOOK_TOKEN')||'',given=req.headers.get('asaas-access-token')||'';
 if(expected.length<32||given.length!==expected.length)return reply(401,{error:'Evento não autorizado'});
 let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^given.charCodeAt(i);if(diff)return reply(401,{error:'Evento não autorizado'});
 try{
 const raw=await req.text();if(new TextEncoder().encode(raw).length>1048576)return reply(413,{error:'Limite excedido'});
 const event=JSON.parse(raw);if(typeof event.id!=='string'||event.id.length>200)return reply(400,{error:'Evento inválido'});
 if(!event.payment?.id)return reply(200,{ignored:true});
 if(!/^pay_[a-zA-Z0-9]+$/.test(event.payment.id))return reply(400,{error:'Cobrança inválida'});
 // A mensagem dispara uma consulta; o corpo recebido nunca determina pagamento/valor/cliente.
 const payment=await asaas('/payments/'+event.payment.id);await paymentEvent(event.id,payment);
 return reply(200,{accepted:true});
 }catch{return reply(503,{error:'Evento não conciliado. Reenviar.'});}
});
